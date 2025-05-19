import fs from 'fs';
import path from 'path';
import fm from 'front-matter';
import MarkdownIt from 'markdown-it';
import { type MinimalifyPlugin } from '../typings.js';
import { gatherMdFiles } from '@/utils/glob.js';
import { logger } from '@/utils/logger.js';
import chalk from 'chalk';

/**
 * markdown plugin
 *
 * Renders .md pages in srcDir to HTML in outDir,
 * injecting optional front-matter attributes as meta-tags.
 */
const md = new MarkdownIt({
    html: true,
    linkify: true,
    typographer: true,
});

export const markdown: MinimalifyPlugin = {
    name: 'markdown',

    async onPreBuild(cfg) {
        // Find all .md pages in srcDir
        logger.debug(`${this.name}-plugin: gathering .md files`);
        const pages = await gatherMdFiles(cfg);
        if (pages.length === 0) {
            logger.debug(`${this.name}-plugin: no .md files found`);
            return;
        }
        logger.debug(`${this.name}-plugin: found ${pages.length} .md files`);
        for (const absMd of pages) {
            const rel = path.relative(cfg.src_dir, absMd);
            const raw = fs.readFileSync(absMd, 'utf8');

            // parse front-matter
            // @ts-expect-error front-matter types are not correct
            const { attributes, body } = fm(raw) as {
                attributes: Record<string, any>;
                body: string;
            };

            // Render markdown to HTML
            const htmlBody = md.render(body);

            // Build a simple HTML page
            const title = attributes.title || path.basename(rel, '.md');
            const headMeta = [
                `<meta charset="UTF-8">`,
                `<title>${title}</title>`,
            ];

            if (attributes.date) {
                headMeta.push(
                    `<meta name="date" content="${attributes.date}">`,
                );
            }

            const htmlPage = `
<!DOCTYPE html>
<html lang="en">
<head>
${headMeta.join('\n')}
</head>
<body>
${htmlBody}
</body>
</html>`.trim();

            // Write .html in outDir
            const outRel = rel.replace(/\.md$/, '.html');
            const dst = path.join(cfg.out_dir, outRel);

            fs.mkdirSync(path.dirname(dst), { recursive: true });
            fs.writeFileSync(dst, htmlPage, 'utf8');

            logger.debug(
                `${this.name}-plugin: wrote HTML page → ${chalk.underline(
                    path.relative(process.cwd(), dst),
                )}`,
            );
        }
    },
};
