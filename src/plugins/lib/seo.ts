import { type MinimalifyPlugin } from '../typings.js';
import { logger } from '@/utils/logger.js';
import { type DefaultTreeAdapterMap } from 'parse5';
import {
    prepareAndMerge,
    seoAttrCollections,
} from '@/utils/tag-modifier-merger.js';

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
            return doc;
        }

        const htmlNode = (doc as any).childNodes.find(
            (n: any) => n.tagName === 'html',
        );
        const head = htmlNode?.childNodes.find(
            (n: any) => n.tagName === 'head',
        ) as DefaultTreeAdapterMap['element'] | undefined;

        if (!head) {
            logger.debug(
                `${this.name}-plugin: no <head> tag found, skipping injection`,
            );
            return doc;
        }

        prepareAndMerge(cfg, head, seoAttrCollections);

        return doc;
    },
};
