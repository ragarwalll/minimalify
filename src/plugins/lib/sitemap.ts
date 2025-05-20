import fs from 'fs';
import path from 'path';
import fg from 'fast-glob';
import { type MinimalifyPlugin } from '../typings.js';
import { logger } from '@/utils/logger.js';
import { terminalPretty } from '@/lib/terminal-pretty.js';

/**
 * sitemap plugin
 *
 * After the site is built, generates sitemap.xml in the outDir.
 */
export const sitemap: MinimalifyPlugin = {
    name: 'sitemap',

    async onPostBuild(cfg) {
        logger.debug(`${this.name}-plugin: generating sitemap.xml`);

        const pages = await fg('**/*.html', {
            cwd: cfg.out_dir,
            onlyFiles: true,
        });

        logger.debug(`${this.name}-plugin: found ${pages.length} HTML pages`);

        const domain = cfg.seo?.url?.replace(/\/$/, '') || '';
        const urls = pages.map((rel) => {
            const loc = domain ? `${domain}/${rel}` : rel;
            return `  <url><loc>${loc}</loc></url>`;
        });

        const xml = [
            '<?xml version="1.0" encoding="UTF-8"?>',
            '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
            ...urls,
            '</urlset>',
        ].join('\n');

        const dest = path.join(cfg.out_dir, 'sitemap.xml');
        fs.writeFileSync(dest, xml, 'utf8');

        logger.info(
            `${this.name}-plugin: sitemap.xml generated → ${terminalPretty.underline(path.relative(process.cwd(), dest))}`,
        );
    },
};
