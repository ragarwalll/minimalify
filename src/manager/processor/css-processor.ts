import { gatherCssFiles, gatherLocalAsstesUri } from '@/utils/glob.js';
import {
    AssetProcessor,
    type GetPages,
    type AssetNode,
    type AssetProcessorContext,
} from './processor.js';
import path from 'path';
import fs from 'fs';
import { ensureDir } from '@/utils/dir.js';
import cssnano from 'cssnano';
import { LRUCache } from 'lru-cache';
import { PurgeCSS } from 'purgecss';
import { fingerprint } from '@/utils/hasher.js';
import { logger } from '@/utils/logger.js';
import { limit } from '@/utils/other.js';
import autoprefixer from 'autoprefixer';
import postcss from 'postcss';
import chalk from 'chalk';
import { CSS_BUNDLE_NAME } from '@/utils/constants/bundle.js';
import { type EmitterEventType } from '@/utils/types.js';

const _lruCache = new LRUCache<string, string>({ max: 100 });

export class CSSProcessor extends AssetProcessor {
    _nodeType = 'css' as const;

    /**
     * Initialize the CSS processor.
     * @param {AssetProcessorContext} ctx the context for the asset processor
     */
    async init(ctx: AssetProcessorContext) {
        const absFiles = await gatherCssFiles(this._cfg);

        for (const absPath of absFiles) {
            ctx.addNode({
                type: this._nodeType,
                name: this.formatNodeName(absPath),
                absPath,
            });
        }
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

    override async minify(
        bundle: string,
        getAllPages: GetPages,
    ): Promise<string> {
        if (!this._cfg.css.minify) return bundle;

        // 1. Purge CSS
        const purge = new PurgeCSS();
        const purged = await purge.purge({
            content: (await getAllPages()).map((p) =>
                path.join(this._cfg.out_dir, p),
            ),
            css: [{ raw: bundle }],
        });

        bundle = purged[0]?.css ?? bundle;

        // 2. Check if the bundle is already cached
        const hash = await fingerprint(bundle);
        if (_lruCache.has(hash)) {
            logger.debug(`css bundle found in cache → ${hash}`);
            return _lruCache.get(hash) as string;
        }

        // 3. Minify the CSS
        logger.debug(`minifying CSS bundle using PostCSS + cssnano...`);
        const res = await limit(() =>
            postcss([autoprefixer, cssnano]).process(bundle, {
                from: undefined,
            }),
        );
        bundle = res.css;

        // 4. Cache the bundle
        _lruCache.set(hash, bundle);

        return bundle;
    }

    override async write(bundle: string) {
        logger.debug(`calling ${chalk.underline('post-bundle')} hook`);
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
            `writing bundle to disk → ${chalk.underline(path.relative(process.cwd(), outDir))}`,
        );

        fs.writeFileSync(path.join(outDir, CSS_BUNDLE_NAME), bundle, 'utf8');
    }
}
