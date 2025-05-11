import fs from 'fs';
import path from 'path';
import { type MinimalifyPlugin } from '../typings.js';
import {
    gatherCssFiles,
    gatherHtmlPages,
    gatherImgFiles,
    gatherJsFiles,
} from '@/utils/glob.js';
import { logger } from '@/utils/logger.js';
import chalk from 'chalk';

/**
 * perf-monitor plugin
 *
 * After build, collects:
 *  - Timestamp
 *  - Total HTML, CSS, JS, image sizes
 *  - Number of pages
 * Writes perf-metrics.json in outDir.
 */
export const perfMonitor: MinimalifyPlugin = {
    name: 'perf-monitor',

    async onPostBuild(cfg) {
        logger.debug(`${this.name}-plugin: collecting performance metrics`);

        const outDir = cfg.outDir;
        const pages = await gatherHtmlPages(cfg);
        const cssFiles = await gatherCssFiles(cfg);
        const jsFiles = await gatherJsFiles(cfg);
        const imgFiles = await gatherImgFiles(cfg);

        const sumKB = (list: string[]) => {
            const totalBytes = list
                .map((f) => fs.statSync(f).size)
                .reduce((a, b) => a + b, 0);
            return (totalBytes / 1024).toFixed(2) + ' KB';
        };

        const metrics = {
            timestamp: new Date().toISOString(),
            pages: pages.length,
            totalHtmlBytes: sumKB(pages),
            totalCssBytes: sumKB(cssFiles),
            totalJsBytes: sumKB(jsFiles),
            totalImageBytes: sumKB(imgFiles),
        };

        fs.writeFileSync(
            path.join(outDir, 'perf-metrics.json'),
            JSON.stringify(metrics, null, 2),
            'utf8',
        );

        logger.info(
            `${this.name}-plugin: performance metrics written to → ${chalk.underline(path.relative(process.cwd(), path.join(outDir, 'perf-metrics.json')))}`,
        );
    },
};
