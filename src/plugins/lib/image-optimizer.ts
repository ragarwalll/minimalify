import fs from 'fs';
import path from 'path';
import os from 'os';
import pLimit from 'p-limit';
import sharp from 'sharp';
import { type MinimalifyPlugin } from '../typings.js';
import { logError, logger } from '@/utils/logger.js';
import chalk from 'chalk';

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
        if (!cfg.images.supportedFormats.includes(ext.substring(1))) return;

        try {
            await limit(async () => {
                // Read, optimize, and overwrite
                const buffer = fs.readFileSync(dest);
                const optimized = await sharp(buffer).toBuffer();
                fs.writeFileSync(dest, optimized);
            });
            logger.debug(
                `${this.name}-plugin: optimized image → ${chalk.underline(path.relative(process.cwd(), dest))}`,
            );
        } catch (err: any) {
            logError(err);
            logger.error(
                `${this.name}-plugin: failed to optimize image → ${chalk.underline(path.relative(process.cwd(), dest))}`,
            );
        }
    },
};
