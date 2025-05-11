import fs from 'fs';
import path from 'path';
import { gzipSync } from 'zlib';
import { type MinimalifyPlugin } from '../typings.js';
import { logger } from '@/utils/logger.js';
import chalk from 'chalk';

/**
 * bundle-analyzer plugin
 *
 * After each CSS or JS bundle is generated, writes:
 *  - A JSON report with raw size and gzipped size
 *  - A simple text summary to the console
 */
export const bundleAnalyzer: MinimalifyPlugin = {
    name: 'bundle-analyzer',

    async onPostBundle(cfg, type, content) {
        logger.debug(`${this.name}-plugin: auditing asset → ${type}`);

        // Determine output directory: "css" or "js" under outDir
        const outDir = path.resolve(cfg.outDir, type);
        if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });

        const reportFile = path.join(outDir, `${type}-bundle-report.json`);
        const rawSize = Buffer.byteLength(content, 'utf8');
        const gzippedSize = Buffer.byteLength(
            gzipSync(Buffer.from(content)),
            'utf8',
        );

        const report = {
            type,
            rawSize,
            gzippedSize,
            timestamp: new Date().toISOString(),
        };

        fs.writeFileSync(reportFile, JSON.stringify(report, null, 2), 'utf8');
        logger.debug(`${this.name}-plugin: raw size → ` + rawSize + ' bytes');
        logger.debug(
            `${this.name}-plugin: gzipped size → ` + gzippedSize + ' bytes',
        );
        logger.info(
            `${this.name}-plugin: report written to → ${chalk.underline(path.relative(process.cwd(), reportFile))}`,
        );

        // return content unmodified
        return content;
    },
};
