// lib/plugins/version-assets.ts
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import fg from 'fast-glob';
import { type MinimalifyPlugin } from '../typings.js';
import { CSS_BUNDLE_NAME, JS_BUNDLE_NAME } from '@/utils/constants/bundle.js';
import { logger } from '@/utils/logger.js';
import { terminalPretty } from '@/lib/terminal-pretty.js';

export const versionAssets: MinimalifyPlugin = {
    name: 'version-assets',

    async onPostBuild(cfg) {
        logger.debug(`${this.name}-plugin: versioning assets`);
        const manifest: Record<string, string> = {};
        const outDir = cfg.out_dir;

        // Helper to rename & record
        const escapeForRegex = (str: string): string => {
            return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        };

        const processFile = (subdir: string, bundleName: string) => {
            const full = path.join(outDir, subdir, bundleName);
            if (!fs.existsSync(full)) return;
            const data = fs.readFileSync(full);
            const hash = crypto
                .createHash('md5')
                .update(data)
                .digest('hex')
                .slice(0, 8);
            const ext = path.extname(bundleName);
            const base = path.basename(bundleName, ext);
            const newName = `${base}.${hash}${ext}`;
            fs.renameSync(full, path.join(outDir, subdir, newName));
            manifest[`${subdir}/${bundleName}`] = `${subdir}/${newName}`;
        };

        // Process CSS and JS
        processFile('css', CSS_BUNDLE_NAME);
        processFile('js', JS_BUNDLE_NAME);

        // Write manifest
        const manifestPath = path.join(outDir, 'asset-manifest.json');
        fs.writeFileSync(
            manifestPath,
            JSON.stringify(manifest, null, 2),
            'utf8',
        );
        logger.info(
            `${this.name}-plugin: asset manifest written to → ${terminalPretty.underline(path.relative(process.cwd(), manifestPath))}`,
        );

        // Update HTML references
        const htmlFiles = await fg('**/*.html', {
            cwd: outDir,
            absolute: true,
        });

        for (const htmlPath of htmlFiles) {
            let html = fs.readFileSync(htmlPath, 'utf8');
            for (const [orig, hashed] of Object.entries(manifest)) {
                const re = new RegExp(escapeForRegex(orig), 'g');
                html = html.replace(re, hashed);
            }
            fs.writeFileSync(htmlPath, html, 'utf8');
        }

        logger.debug(
            `${this.name}-plugin: updated HTML files → ${htmlFiles.join(', ')}`,
        );
    },
};
