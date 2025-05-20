import fs from 'fs';
import path from 'path';
import os from 'os';
import pLimit from 'p-limit';
import sharp from 'sharp';
import { type MinimalifyPlugin } from '../typings.js';
import { logError, logger } from '@/utils/logger.js';
import { terminalPretty } from '@/lib/terminal-pretty.js';

// Limit concurrent image optimizations to CPU cores
const concurrency = os.cpus().length;
const limit = pLimit(concurrency);

/**
 * image-optimizer plugin
 *
 * Whenever an image is copied or downloaded (onAsset),
 * optimize it in place with Sharp.
 */
export const imageOptimizer: MinimalifyPlugin = {
    name: 'image-optimizer',

    async onAsset(cfg, type, _src, dest) {
        if (type !== 'image') return;
        if (!cfg.images.optimize) return;
        logger.debug(
            `${this.name}-plugin: optimizing image → ${path.relative(process.cwd(), dest)}`,
        );

        const ext = path.extname(dest).toLowerCase();
        if (ext === '.svg') return;
        if (ext === '.webp') return;
        if (ext === '.avif') return;
        if (ext === '.gif') return;
        if (ext === '.ico') return;
        if (ext === '.bmp') return;
        if (ext === '.tiff') return;
        if (ext === '.jfif') return;
        if (ext === '.jpe') return;
        if (ext === '.jif') return;
        if (!(cfg.images.supported_formats ?? []).includes(ext.substring(1)))
            return;

        try {
            await limit(async () => {
                // Read, optimize, and overwrite
                const buffer = fs.readFileSync(dest);
                const optimized = await sharp(buffer).toBuffer();
                fs.writeFileSync(dest, optimized);
            });
            logger.debug(
                `${this.name}-plugin: optimized image → ${terminalPretty.underline(path.relative(process.cwd(), dest))}`,
            );
        } catch (err: any) {
            logError(err);
            logger.error(
                `${this.name}-plugin: failed to optimize image → ${terminalPretty.underline(path.relative(process.cwd(), dest))}`,
            );
        }
    },
};
