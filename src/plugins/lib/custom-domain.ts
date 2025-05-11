import fs from 'fs';
import path from 'path';
import fg from 'fast-glob';
import { type MinimalifyPlugin } from '../typings.js';
import { logger } from '@/utils/logger.js';

/**
 * custom-domain plugin
 *
 * Writes a CNAME file in the outDir if cfg.customDomain is set.
 * Also updates any <meta property="og:url"> and <link rel="canonical">
 * tags in all HTML pages to use the custom domain.
 */
export const customDomain: MinimalifyPlugin = {
    name: 'custom-domain',

    async onPostBuild(cfg) {
        if (!cfg.customDomain) return;
        logger.debug(
            `${this.name}-plugin: custom domain → ${cfg.customDomain}`,
        );

        const outDir = cfg.outDir;
        // 1) Write CNAME
        fs.writeFileSync(path.join(outDir, 'CNAME'), cfg.customDomain, 'utf8');

        // 2) Update HTML pages
        const htmlFiles = await fg('**/*.html', {
            cwd: outDir,
            absolute: true,
        });
        for (const htmlPath of htmlFiles) {
            let html = fs.readFileSync(htmlPath, 'utf8');
            const domain = cfg.customDomain.replace(/\/$/, '');
            // canonical link
            html = html.replace(
                /<link rel="canonical" href="[^"]*"/g,
                `<link rel="canonical" href="${domain}${htmlPath
                    .replace(outDir, '')
                    .replace(/\\/g, '/')}"`, // normalize slash
            );
            // OpenGraph URL
            html = html.replace(
                /<meta property="og:url" content="[^"]*"/g,
                `<meta property="og:url" content="${domain}${htmlPath
                    .replace(outDir, '')
                    .replace(/\\/g, '/')}"`,
            );
            fs.writeFileSync(htmlPath, html, 'utf8');
        }
        logger.debug(
            `${this.name}-plugin: updated HTML pages → ${htmlFiles.join(', ')}`,
        );
    },
};
