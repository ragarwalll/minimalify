import { gatherJsFiles, gatherLocalAsstesUri } from '@/utils/glob.js';
import {
    AssetProcessor,
    type GetPages,
    type AssetNode,
    type AssetProcessorContext,
} from './processor.js';
import fs from 'fs';
import { LRUCache } from '@/lib/lru-cache.js';
import { fingerprint } from '@/utils/hasher.js';
import { logger } from '@/utils/logger.js';
import { limit } from '@/utils/other.js';
import { minify } from 'terser';
import { ensureDir } from '@/utils/dir.js';
import path from 'path';
import { terminalPretty } from '@/lib/terminal-pretty.js';
import { JS_BUNDLE_NAME } from '@/utils/constants/bundle.js';
import { type EmitterEventType } from '@/utils/types.js';

const _lruCache = new LRUCache<string, string>({ max: 100 });

export class JsProcessor extends AssetProcessor {
    _nodeType = 'js' as const;

    /**
     * Initialize the JS processor.
     * @param {AssetProcessorContext} ctx the context for the asset processor
     */
    async init(ctx: AssetProcessorContext) {
        const absFiles = await gatherJsFiles(this._cfg);

        for (const absPath of absFiles) {
            ctx.addNode({
                type: this._nodeType,
                name: this.formatNodeName(absPath),
                absPath,
            });
        }
    }

    override async getAssets<T>(
        type: 'external' | 'local',
        _get: GetPages,
    ): Promise<T> {
        // 1. Clean & ensure the output directory
        const outDir = path.join(this._cfg.out_dir, this._nodeType);
        ensureDir(outDir);

        const assets: string[] = [];
        if (type === 'external') {
            const assetsUri = await _get();
            for (let uri of assetsUri) {
                const data = await this._cache.fetch(uri);
                await this._pluginManager.callHook(
                    'onAsset',
                    this._cfg,
                    this._nodeType,
                    data,
                    outDir,
                );
                assets.push(data);
            }
        } else {
            let assetsUri = await gatherLocalAsstesUri(
                this._cfg,
                this._nodeType,
            );

            assetsUri =
                (await this._pluginManager.callHook(
                    'onBundle',
                    this._cfg,
                    this._nodeType,
                    assetsUri,
                )) || assetsUri;
            const batchSize = 4;

            for (let i = 0; i < assetsUri.length; i += batchSize) {
                const batch = assetsUri.slice(i, i + batchSize);
                const results = await Promise.all(
                    batch.map((f) => fs.promises.readFile(f, 'utf8')),
                );
                assets.push(...results);
            }
        }

        return assets as T;
    }

    override patchNode(
        _ctx: AssetProcessorContext,
        absPath: string,
        _eventType: EmitterEventType,
    ): Promise<AssetNode> {
        logger.debug(`patching node ${absPath} with event type ${_eventType}`);
        return Promise.resolve({
            type: this._nodeType,
            name: this.formatNodeName(absPath),
            absPath,
        });
    }

    override async minify(
        bundle: string,
        _getAllPages: GetPages,
    ): Promise<string> {
        if (!this._cfg.js.minify) return bundle;

        const hash = await fingerprint(bundle);
        if (_lruCache.has(hash)) {
            logger.debug(`js bundle found in cache → ${hash}`);
            return _lruCache.get(hash) as string;
        }

        logger.debug(`minifying js bundle using terser`);
        const res = await limit(() =>
            minify(bundle, this._cfg.js.minify_options),
        );

        if (res.code === undefined) {
            logger.error(`failed to minify js bundle`);
            return bundle;
        }

        _lruCache.set(hash, res.code);

        return res.code;
    }

    override async write(bundle: string) {
        logger.debug(`calling ${terminalPretty.underline('post-bundle')} hook`);
        bundle =
            (await this._pluginManager.callHook(
                'onPostBundle',
                this._cfg,
                this._nodeType,
                bundle,
            )) || bundle;

        const outDir = path.join(this._cfg.out_dir, this._nodeType);
        ensureDir(outDir);

        logger.debug(
            `writing bundle to disk → ${terminalPretty.underline(path.relative(process.cwd(), outDir))}`,
        );

        fs.writeFileSync(path.join(outDir, JS_BUNDLE_NAME), bundle, 'utf8');
    }
}
