import { gatherImgFiles, gatherLocalAsstesUri } from '@/utils/glob.js';
import {
    AssetProcessor,
    type GetPages,
    type AssetNode,
    type AssetProcessorContext,
} from './processor.js';
import path from 'path';
import fs from 'fs';
import { ensureDir } from '@/utils/dir.js';
import { limit } from '@/utils/other.js';
import { fingerprint } from '@/utils/hasher.js';
import { logger } from '@/utils/logger.js';
// eslint-disable-next-line import/default
import pkg from 'bloom-filters';
import { type EmitterEventType } from '@/utils/types.js';

// Bloom filter for URLs
const { BloomFilter } = pkg;
const urlBloom = BloomFilter.create(1000, 0.01);

export class ImagesProcessor extends AssetProcessor {
    _nodeType = 'img' as const;

    /**
     * Initialize the Images processor.
     * @param {AssetProcessorContext} ctx the context for the asset processor
     */
    async init(ctx: AssetProcessorContext) {
        const absFiles = await gatherImgFiles(this._cfg);

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

    override minify(bundle: string, _getAllPages: GetPages): Promise<string> {
        return Promise.resolve(bundle);
    }

    override async getAssets<T>(
        _type: 'external' | 'local',
        _pagesFn: GetPages,
    ): Promise<T> {
        return [] as unknown as T;
    }

    override async write(joinedImgUri: string): Promise<void> {
        const assetsUri = joinedImgUri.split('\n');

        // 1. Clean & ensure the output directory
        const outDir = path.join(this._cfg.out_dir);
        ensureDir(outDir);

        // 2. Download & load shared assets & call the hook
        if (joinedImgUri !== undefined && joinedImgUri !== '')
            await Promise.all(
                assetsUri.map((uri) =>
                    limit(async () => {
                        if (urlBloom.has(uri)) {
                            logger.debug(
                                `skipping asset ${uri} as it is already processed`,
                            );
                            return;
                        }
                        urlBloom.add(uri);

                        const data = await this._cache.fetch(uri);

                        const hex = await fingerprint(uri);

                        const dst = path.join(
                            outDir,
                            `${hex}${path.extname(uri)}`,
                        );
                        logger.debug(`copying asset to disk → ${dst}`);

                        ensureDir(path.dirname(dst));
                        fs.writeFileSync(dst, data);

                        await this._pluginManager.callHook(
                            'onAsset',
                            this._cfg,
                            'image',
                            data,
                            dst,
                        );
                    }),
                ),
            );

        // 3. Gather local assets
        let localAssetsUri = await gatherLocalAsstesUri(this._cfg, 'img');
        await Promise.all(
            localAssetsUri.map((uri) =>
                limit(async () => {
                    if (urlBloom.has(uri)) {
                        logger.debug(
                            `skipping asset ${uri} as it is already processed`,
                        );
                        return;
                    }
                    urlBloom.add(uri);

                    const data = fs.readFileSync(uri);

                    const dst = path.join(
                        outDir,
                        path.relative(this._cfg.src_dir, uri),
                    );
                    logger.debug(`copying asset to disk → ${dst}`);

                    ensureDir(path.dirname(dst));
                    fs.writeFileSync(dst, data);

                    await this._pluginManager.callHook(
                        'onAsset',
                        this._cfg,
                        'image',
                        '',
                        dst,
                    );
                }),
            ),
        );

        logger.debug(`proccessed ${assetsUri.length} assets`);
        logger.debug(`proccessed ${localAssetsUri.length} local assets`);
    }
}
