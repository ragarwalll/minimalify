import { type MinimalifyPlugin } from '../typings.js';
import { logger } from '@/utils/logger.js';
import { type DefaultTreeAdapterMap } from 'parse5';
import path from 'path';
import fs from 'fs/promises';
import { constants as fsConstants } from 'fs';
import { generateUUID } from '@/utils/uuid.js';
import {
    generateAllSizes,
    generateFavicon,
    type SizesGenerated,
} from '@/utils/favicon.js';
import { ensureDir } from '@/utils/dir.js';
import { type MinimalifyConfig } from '@/config/struct.js';

const BASE_IMG_NAME = 'generated-favicon';
const ALT_IMG_NAME = 'generated-favicon-alt';

async function exists(filePath: string): Promise<boolean> {
    try {
        await fs.access(filePath, fsConstants.F_OK);
        return true;
    } catch {
        return false;
    }
}

export const favicon: MinimalifyPlugin = {
    name: 'favicon',

    async onPage(cfg, _pagePath, doc) {
        const faviconCfg = cfg.favicon;
        if (!faviconCfg?.base) {
            logger.debug(`${this.name}: no favicon.base, skipping`);
            return doc;
        }

        // Resolve source images
        const srcDir = cfg.src_dir;
        const baseImg = path.resolve(srcDir, faviconCfg.base);
        const altImg = faviconCfg.alt
            ? path.resolve(srcDir, faviconCfg.alt)
            : baseImg;

        if (!(await exists(baseImg)) || !(await exists(altImg))) {
            logger.warn(`${this.name}: base or alt image missing, skipping`);
            return doc;
        }

        // Merge default settings
        const defaults = {
            favicon_active: 'alt',
            favicon_inactive: 'base',
            safari: 'alt',
            mstile: 'base',
            pwa: 'base',
            apple: 'base',
        };
        const settings = { ...defaults, ...faviconCfg.settings };

        const isSvg = baseImg.endsWith('.svg') || altImg.endsWith('.svg');
        if (isSvg && !faviconCfg.svg_current_color) {
            logger.warn(
                `${this.name}: svg_current_color is required for SVG favicons, skipping`,
            );
            return doc;
        }

        // Find <head>
        const htmlNode = (doc as any).childNodes.find(
            (n: any) => n.tagName === 'html',
        );
        const head = htmlNode?.childNodes.find(
            (n: any) => n.tagName === 'head',
        ) as DefaultTreeAdapterMap['element'] | undefined;
        if (!head) {
            logger.debug(`${this.name}: no <head>, skipping`);
            return doc;
        }

        // Remove existing favicon tags
        const linkRelsToRemove = new Set([
            'icon',
            'apple-touch-icon',
            'mask-icon',
        ]);
        const metaNamesToRemove = [
            'msapplication-TileColor',
            'msapplication-TileImage',
        ];
        const msLogoPattern = /^msapplication-[a-zA-Z]+\d+x\d+logo$/;
        head.childNodes = head.childNodes.filter((n: any) => {
            if (n.tagName === 'link') {
                const rel = n.attrs.find((a: any) => a.name === 'rel')?.value;
                return !linkRelsToRemove.has(rel);
            }
            if (n.tagName === 'meta') {
                const name = n.attrs.find((a: any) => a.name === 'name')?.value;
                return (
                    !metaNamesToRemove.includes(name) &&
                    !msLogoPattern.test(name || '')
                );
            }
            return true;
        });

        // Prepare output folder
        const outDir = cfg.out_dir;
        const dest = path.join(outDir, generateUUID());
        await ensureDir(dest);

        // Decide which image to use for active/inactive
        const activePath =
            settings.favicon_active === 'base' ? baseImg : altImg;
        const inactivePath =
            settings.favicon_inactive === 'base' ? baseImg : altImg;

        // Kick off parallel tasks
        let baseSizes: SizesGenerated[] = [];
        let altSizes: SizesGenerated[] = [];
        await Promise.all([
            // ICOs
            generateFavicon(
                activePath,
                path.join(dest, 'favicon.ico'),
                faviconCfg,
            ),
            generateFavicon(
                inactivePath,
                path.join(dest, 'favicon-inactive.ico'),
                faviconCfg,
            ),
            // PNG sizes
            generateAllSizes(baseImg, dest, 'base', faviconCfg).then(
                (r) => (baseSizes = r),
            ),
            baseImg !== altImg
                ? generateAllSizes(altImg, dest, 'alt', faviconCfg).then(
                      (r) => (altSizes = r),
                  )
                : Promise.resolve().then(() => (altSizes = baseSizes)),
            // Copy raw SVGs
            isSvg
                ? fs.copyFile(baseImg, path.join(dest, `${BASE_IMG_NAME}.svg`))
                : null,
            isSvg
                ? fs.copyFile(altImg, path.join(dest, `${ALT_IMG_NAME}.svg`))
                : null,
        ]);

        const activeIcons =
            settings.favicon_active === 'base' ? baseSizes : altSizes;
        const appleIcons = settings.apple === 'base' ? baseSizes : altSizes;
        const mstileIcons = settings.mstile === 'base' ? baseSizes : altSizes;
        const pwaIcons = settings.pwa === 'base' ? baseSizes : altSizes;

        // Inject tags
        generateFaviconTag(head, activeIcons, cfg, dest, isSvg);
        generateAppleTag(head, appleIcons, cfg);
        await generateMsTileTag(head, mstileIcons, cfg);
        if (isSvg)
            generateSafariTag(
                head,
                cfg,
                dest,
                BASE_IMG_NAME + path.extname(baseImg),
            );
        await generatePwaTag(head, pwaIcons, cfg);

        if (faviconCfg.theme_color) {
            head.childNodes.push({
                tagName: 'meta',
                attrs: [
                    {
                        name: 'theme-color',
                        value: faviconCfg.theme_color,
                    },
                ],
            } as DefaultTreeAdapterMap['element']);
        }

        return doc;
    },
};
/**
 * Generate the favicon tags
 * @param head the head element of the document
 * @param icons the icons to generate
 * @param cfg the config object
 * @param destinationFolder the destination folder for the favicon
 * @param isSvg whether the image is an svg or not
 */
const generateFaviconTag = (
    head: DefaultTreeAdapterMap['element'],
    icons: SizesGenerated[],
    cfg: MinimalifyConfig,
    destinationFolder: string,
    isSvg: boolean,
) => {
    icons.forEach((icon) => {
        head.childNodes.push({
            tagName: 'link',
            attrs: [
                {
                    name: 'rel',
                    value: 'icon',
                },
                {
                    name: 'sizes',
                    value: icon.sizeKey,
                },
                {
                    name: 'type',
                    value: 'image/png',
                },
                {
                    name: 'href',
                    value: path.relative(cfg.out_dir, icon.outPath),
                },
            ],
        } as DefaultTreeAdapterMap['element']);
    });

    head.childNodes.push({
        tagName: 'link',
        attrs: [
            {
                name: 'rel',
                value: 'icon',
            },
            {
                name: 'type',
                value: 'image/x-icon',
            },
            {
                name: 'href',
                value: path.relative(
                    cfg.out_dir,
                    path.join(destinationFolder, 'favicon.ico'),
                ),
            },
        ],
    } as DefaultTreeAdapterMap['element']);

    if (!isSvg) return;
    head.childNodes.push({
        tagName: 'link',
        attrs: [
            {
                name: 'rel',
                value: 'icon',
            },
            {
                name: 'type',
                value: 'image/svg+xml',
            },
            {
                name: 'href',
                value: path.relative(
                    cfg.out_dir,
                    path.join(destinationFolder, BASE_IMG_NAME + '.svg'),
                ),
            },
        ],
    } as DefaultTreeAdapterMap['element']);
};

/**
 * Generate the safari tag
 * @param head the head element of the document
 * @param cfg the config object
 * @param destinationFolder the destination folder for the favicon
 * @param baseImg the base image for the favicon
 */
const generateSafariTag = (
    head: DefaultTreeAdapterMap['element'],
    cfg: MinimalifyConfig,
    destinationFolder: string,
    baseImg: string,
) => {
    if (!baseImg.endsWith('.svg')) return;
    head.childNodes.push({
        tagName: 'link',
        attrs: [
            {
                name: 'rel',
                value: 'mask-icon',
            },
            {
                name: 'href',
                value: path.relative(
                    cfg.out_dir,
                    path.join(destinationFolder, baseImg),
                ),
            },
        ],
    } as DefaultTreeAdapterMap['element']);
};

/**
 * Generate the ms tile tags
 * @param head the head element of the document
 * @param icons the icons to generate
 * @param cfg the config object
 */
const generateMsTileTag = async (
    head: DefaultTreeAdapterMap['element'],
    icons: SizesGenerated[],
    cfg: MinimalifyConfig,
) => {
    head.childNodes.push({
        tagName: 'meta',
        attrs: [
            {
                name: 'name',
                value: 'msapplication-TileColor',
            },
            {
                name: 'content',
                value: cfg.favicon?.background_color ?? '#ffffff',
            },
        ],
    } as DefaultTreeAdapterMap['element']);

    icons.forEach((icon) => {
        head.childNodes.push({
            tagName: 'meta',
            attrs: [
                {
                    name: 'name',
                    value: `msapplication-${icon.width === icon.height ? 'square' : 'wide'}${icon.sizeKey}logo`,
                },
                {
                    name: 'content',
                    value: path.relative(cfg.out_dir, icon.outPath),
                },
            ],
        } as DefaultTreeAdapterMap['element']);
    });

    const lastMsTileIcon = icons[icons.length - 1];

    if (lastMsTileIcon) {
        head.childNodes.push({
            tagName: 'meta',
            attrs: [
                {
                    name: 'name',
                    value: `msapplication-TileImage`,
                },
                {
                    name: 'content',
                    value: path.relative(cfg.out_dir, lastMsTileIcon.outPath),
                },
            ],
        } as DefaultTreeAdapterMap['element']);

        const browserConfig = `<?xml version="1.0" encoding="utf-8"?> \
<browserconfig> \
    <msapplication> \
        <tile> \
            <${lastMsTileIcon.width === lastMsTileIcon.height ? 'square' : 'wide'}${lastMsTileIcon.sizeKey}logo src="${path.relative(cfg.out_dir, lastMsTileIcon.outPath)}"/> \
            <TileColor>${cfg.favicon?.background_color ?? '#ffffff'}</TileColor> \
        </tile> \
    </msapplication> \
</browserconfig> \
`;
        await fs.writeFile(
            path.join(cfg.out_dir, 'browserconfig.xml'),
            browserConfig,
            'utf-8',
        );
        head.childNodes.push({
            tagName: 'meta',
            attrs: [
                {
                    name: 'name',
                    value: 'msapplication-config',
                },
                {
                    name: 'content',
                    value: 'browserconfig.xml',
                },
            ],
        } as DefaultTreeAdapterMap['element']);
    }
};

const generatePwaTag = async (
    head: DefaultTreeAdapterMap['element'],
    icons: SizesGenerated[],
    cfg: MinimalifyConfig,
) => {
    // find title from head
    let title = '';
    let titleNode = head.childNodes.find((node) => {
        const n = node as DefaultTreeAdapterMap['element'];
        return n.tagName === 'title' && n.childNodes.length > 0;
    }) as DefaultTreeAdapterMap['element'] | undefined;

    if (!titleNode) title = cfg.seo?.title ?? '';

    let childNode = titleNode?.childNodes[0];
    childNode = childNode as DefaultTreeAdapterMap['textNode'] | undefined;

    if (childNode == undefined) title = cfg.seo?.title ?? '';
    title = childNode?.value ?? '';

    const manifest: {
        name?: string;
        short_name?: string;
        description?: string;
        start_url?: string;
        display?: string;
        background_color?: string;
        theme_color?: string;
        categories?: string[];
        icons?: {
            src: string;
            sizes: string;
            type: string;
        }[];
    } = {};
    if (title && title.length > 0) manifest['name'] = title;

    let name = '';
    if (cfg.seo?.author?.first_name) name = cfg.seo?.author?.first_name;
    if (cfg.seo?.author?.last_name) name += ' ' + cfg.seo?.author?.last_name;

    if (name && name.length > 0) manifest['short_name'] = name;
    if (cfg.seo?.description && cfg.seo?.description.length > 0)
        manifest['description'] = cfg.seo?.description;

    // Ensure start_url is a relative path
    if (cfg.seo?.url && cfg.seo?.url.length > 0) {
        try {
            const urlObj = new URL(cfg.seo.url);
            manifest['start_url'] = urlObj.pathname || '/';
        } catch {
            manifest['start_url'] = '/';
        }
    }

    manifest['display'] = 'standalone';
    if (cfg.favicon?.background_color)
        manifest['background_color'] = cfg.favicon?.background_color;

    if (cfg.favicon?.theme_color)
        manifest['theme_color'] = cfg.favicon?.theme_color;

    if (cfg.seo?.keywords && cfg.seo?.keywords.length > 0)
        manifest['categories'] = cfg.seo?.keywords;

    manifest['icons'] = icons.map((icon) => {
        return {
            src: path.relative(cfg.out_dir, icon.outPath),
            sizes: icon.sizeKey,
            type: 'image/png',
        };
    });

    // save the manifest to the out_dir
    const manifestPath = path.join(cfg.out_dir, 'site.webmanifest');
    await fs.writeFile(manifestPath, JSON.stringify(manifest, null, 2));

    // file the manifest in the head
    head.childNodes = head.childNodes.filter((node) => {
        const n = node as DefaultTreeAdapterMap['element'];
        return !(
            n.tagName === 'link' &&
            n.attrs.some((a) => a.name === 'rel' && a.value === 'manifest')
        );
    });

    head.childNodes.push({
        tagName: 'link',
        attrs: [
            {
                name: 'rel',
                value: 'manifest',
            },
            {
                name: 'href',
                value: 'site.webmanifest',
            },
        ],
    } as DefaultTreeAdapterMap['element']);
};

/**
 * Generate the apple touch icon tags
 * @param head the head element of the document
 * @param appleIcons the apple icons to generate
 * @param cfg the config object
 */
const generateAppleTag = (
    head: DefaultTreeAdapterMap['element'],
    appleIcons: SizesGenerated[],
    cfg: MinimalifyConfig,
) => {
    appleIcons.forEach((icon) => {
        head.childNodes.push({
            tagName: 'link',
            attrs: [
                {
                    name: 'rel',
                    value: 'apple-touch-icon',
                },
                {
                    name: 'sizes',
                    value: icon.sizeKey,
                },
                {
                    name: 'href',
                    value: path.relative(cfg.out_dir, icon.outPath),
                },
            ],
        } as DefaultTreeAdapterMap['element']);
    });
};
