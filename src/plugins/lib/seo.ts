import path from 'path';
import { parseFragment } from 'parse5';
import { type MinimalifyPlugin } from '../typings.js';
import { logger } from '@/utils/logger.js';
import chalk from 'chalk';

export const seo: MinimalifyPlugin = {
    name: 'seo',

    onPage(cfg, pagePath, doc) {
        logger.debug(
            `${this.name}-plugin: injecting SEO metadata → ${pagePath}`,
        );

        const seoCfg = cfg.seo;
        if (!seoCfg) {
            logger.debug(
                `${this.name}-plugin: no SEO config found, skipping injection`,
            );
            return;
        }
        const rel = path.relative(cfg.srcDir, pagePath);
        const htmlNode = (doc as any).childNodes.find(
            (n: any) => n.tagName === 'html',
        );
        const head = htmlNode.childNodes.find((n: any) => n.tagName === 'head');

        // Derive default title from filename
        const baseName = rel.replace(/\.html$/, '').replace(/-/g, ' ');
        const defaultTitle =
            baseName.charAt(0).toUpperCase() + baseName.slice(1);

        // TITLE
        let titleNode = head.childNodes.find((n: any) => n.tagName === 'title');
        if (!titleNode) {
            titleNode = parseFragment(`<title>${defaultTitle}</title>`)
                .childNodes[0];
            head.childNodes.unshift(titleNode);
        }
        if (seoCfg.titleSuffix && titleNode.childNodes[0]) {
            titleNode.childNodes[0].value += ` ${seoCfg.titleSuffix}`;
        }

        // DESCRIPTION
        const hasDesc = head.childNodes.some(
            (n: any) =>
                n.tagName === 'meta' &&
                n.attrs.some(
                    (a: any) => a.name === 'name' && a.value === 'description',
                ),
        );
        if (!hasDesc && seoCfg.defaultDescription) {
            const meta = parseFragment(
                `<meta name="description" content="${seoCfg.defaultDescription}">`,
            ).childNodes[0];
            head.childNodes.push(meta);
        }

        // OpenGraph & Twitter
        const pageUrl = seoCfg.siteUrl
            ? seoCfg.siteUrl.replace(/\/$/, '') + '/' + rel
            : undefined;
        const ogTags: string[] = [];
        if (pageUrl)
            ogTags.push(`<meta property="og:url" content="${pageUrl}">`);
        if (titleNode.childNodes[0])
            ogTags.push(
                `<meta property="og:title" content="${
                    (titleNode.childNodes[0] as any).value
                }">`,
            );
        if (seoCfg.defaultDescription)
            ogTags.push(
                `<meta property="og:description" content="${seoCfg.defaultDescription}">`,
            );
        if (seoCfg.twitterCard)
            ogTags.push(
                `<meta name="twitter:card" content="${seoCfg.twitterCard}">`,
            );

        ogTags.forEach((tag) => {
            const el = parseFragment(tag).childNodes[0];
            head.childNodes.push(el);
        });

        logger.debug(
            `${this.name}-plugin: injected SEO metadata → ${chalk.underline(
                rel,
            )} (${head.childNodes.length} nodes)`,
        );
    },
};
