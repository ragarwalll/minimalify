import { type MinimalifyPlugin } from '../typings.js';
import { logger } from '@/utils/logger.js';
import { type DefaultTreeAdapterMap } from 'parse5';
import { type MinimalifyConfig } from '@/config/struct.js';

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

        const existingSeoProps = getCurrentHtmlSeoProps(head);
        let seoProps = getCurrentConfigSeoProps(cfg, existingSeoProps);

        // filter out undefined
        seoProps = Object.fromEntries(
            Object.entries(seoProps).filter(([, v]) => v !== undefined),
        ) as SeoPropsMap;

        // remove all existing SEO <meta> tags
        for (const key of availableSeoProps) {
            head.childNodes = head.childNodes.filter(
                (child) => !isMetaWithKey(child as any, key),
            );
        }

        // add new SEO <meta> tags
        for (const [rawName, content] of Object.entries(seoProps)) {
            const name = rawName as AvailableSeoProps;
            const isName = name in AvailableSeoNames;
            const isProperty = name in AvailableSeoProperties;
            if (!isName && !isProperty) {
                logger.debug(
                    `${this.name}-plugin: ${name} is not a valid SEO property`,
                );
                continue;
            }
            const attrName = isName ? 'name' : 'property';
            head.childNodes.push({
                tagName: 'meta',
                attrs: [
                    { name: attrName, value: name },
                    { name: 'content', value: content! },
                ],
            } as DefaultTreeAdapterMap['element']);
        }

        return doc;
    },
};

/** helper to detect a <meta name="…" /> or <meta property="…" /> */
function isMetaWithKey(
    el: DefaultTreeAdapterMap['node'],
    key: AvailableSeoProps,
): boolean {
    if ((el as any).tagName !== 'meta') return false;
    const attrs = (el as DefaultTreeAdapterMap['element']).attrs;
    const nameVal = attrs.find((a) => a.name === 'name')?.value;
    const propVal = attrs.find((a) => a.name === 'property')?.value;
    return nameVal === key || propVal === key;
}

enum AvailableSeoNames {
    title = 'title',
    description = 'description',
    keywords = 'keywords',
    author = 'author',
    robots = 'robots',
    classification = 'classification',
    target = 'target',
    rating = 'rating',
    'twitter:title' = 'twitter:title',
    'twitter:description' = 'twitter:description',
    'twitter:site' = 'twitter:site',
    'twitter:card' = 'twitter:card',
    'twitter:image' = 'twitter:image',
    'twitter:image:alt' = 'twitter:image:alt',
}

enum AvailableSeoProperties {
    'og:type' = 'og:type',
    'og:title' = 'og:title',
    'og:description' = 'og:description',
    'og:url' = 'og:url',
    'og:site_name' = 'og:site_name',
    'og:locale' = 'og:locale',
    'og:image' = 'og:image',
    'og:image:alt' = 'og:image:alt',
    'og:image:type' = 'og:image:type',
    'profile:first_name' = 'profile:first_name',
    'profile:last_name' = 'profile:last_name',
    'profile:username' = 'profile:username',
    'profile:email' = 'profile:email',
    'profile:image' = 'profile:image',
    'profile:description' = 'profile:description',
    'profile:twitter' = 'profile:twitter',
    'profile:facebook' = 'profile:facebook',
    'profile:linkedin' = 'profile:linkedin',
    'profile:github' = 'profile:github',
    'profile:instagram' = 'profile:instagram',
    'profile:youtube' = 'profile:youtube',
}

// union of both
type AvailableSeoProps =
    | keyof typeof AvailableSeoNames
    | keyof typeof AvailableSeoProperties;

// flat list
const availableSeoProps = [
    ...Object.keys(AvailableSeoNames),
    ...Object.keys(AvailableSeoProperties),
] as AvailableSeoProps[];

type SeoPropsMap = { [K in AvailableSeoProps]: string | undefined };

/** extract existing <meta> values from the <head> */
function getCurrentHtmlSeoProps(
    head: DefaultTreeAdapterMap['element'],
): SeoPropsMap {
    const result = availableSeoProps.reduce((acc, key) => {
        acc[key] = undefined;
        return acc;
    }, {} as SeoPropsMap);

    for (const child of head.childNodes) {
        const el = child as DefaultTreeAdapterMap['element'];
        if (el.tagName !== 'meta') continue;
        const nameAttr = el.attrs.find(
            (a) => a.name === 'name' || a.name === 'property',
        )?.value;
        const content = el.attrs.find((a) => a.name === 'content')?.value;
        if (nameAttr && content && nameAttr in result) {
            result[nameAttr as AvailableSeoProps] = content;
        }
    }
    return result;
}

/** build the final SEO props by merging config + existing */
function getCurrentConfigSeoProps(
    cfg: MinimalifyConfig,
    docMap: SeoPropsMap,
): SeoPropsMap {
    const seo = cfg.seo ?? {};
    const author = seo.author ?? {};
    const og = seo.opengraph ?? {};
    const tw = seo.twitter ?? {};
    const robots = seo.robots ?? {};

    const authorMap: Partial<SeoPropsMap> = {
        'profile:first_name': docMap['profile:first_name'] ?? author.firstName,
        'profile:last_name': docMap['profile:last_name'] ?? author.lastName,
        'profile:username': docMap['profile:username'] ?? author.username,
        'profile:email': docMap['profile:email'] ?? author.email,
        'profile:image': docMap['profile:image'] ?? author.image,
        'profile:description':
            docMap['profile:description'] ??
            seo.description ??
            docMap.description,
        'profile:twitter': docMap['profile:twitter'] ?? author.twitter,
        'profile:facebook': docMap['profile:facebook'] ?? author.facebook,
        'profile:linkedin': docMap['profile:linkedin'] ?? author.linkedin,
        'profile:github': docMap['profile:github'] ?? author.github,
        'profile:instagram': docMap['profile:instagram'] ?? author.instagram,
        'profile:youtube': docMap['profile:youtube'] ?? author.youtube,
    };

    const ogMap: Partial<SeoPropsMap> = {
        'og:url': docMap['og:url'] ?? seo.url,
        'og:title': docMap['og:title'] ?? seo.title ?? docMap.title,
        'og:description':
            docMap['og:description'] ?? seo.description ?? docMap.description,
        'og:image': docMap['og:image'] ?? author.image,
        'og:image:alt': docMap['og:image:alt'] ?? author.imageAlt,
        'og:image:type': docMap['og:image:type'] ?? author.imageType,
        'og:type': docMap['og:type'] ?? og.type,
        'og:site_name': docMap['og:site_name'] ?? og.site_name,
        'og:locale': docMap['og:locale'] ?? 'en_US',
    };

    const otherMap: Partial<SeoPropsMap> = {
        title: docMap.title ?? seo.title,
        description: docMap.description ?? seo.description,
        keywords: docMap.keywords ?? seo.keywords?.join(', ') ?? undefined,
        author:
            docMap.author ??
            author.username ??
            `${author.firstName ?? ''} ${author.lastName ?? ''}`,
        classification: docMap.classification ?? seo.classification,
        rating: docMap.rating ?? seo.rating ?? 'General',
        target: docMap.target ?? seo.target ?? 'all',
    };

    const twitterMap: Partial<SeoPropsMap> = {
        'twitter:title': docMap['twitter:title'] ?? tw.title,
        'twitter:description': docMap['twitter:description'] ?? tw.description,
        'twitter:site': docMap['twitter:site'] ?? tw.site,
        'twitter:card': docMap['twitter:card'] ?? tw.card,
        'twitter:image': docMap['twitter:image'] ?? tw.image,
        'twitter:image:alt': docMap['twitter:image:alt'] ?? tw.imageAlt,
    };

    // build robots string without stray commas
    const parts: string[] = [
        robots.index ? 'index' : 'noindex',
        robots.follow ? 'follow' : 'nofollow',
    ];
    if (robots.allow?.length) {
        parts.push('allow: ' + robots.allow.join(', '));
    }
    if (robots.disallow?.length) {
        parts.push('disallow: ' + robots.disallow.join(', '));
    }
    const robotsStr = parts.join(', ');

    const robotsMap: Partial<SeoPropsMap> = {
        robots: docMap.robots ?? robotsStr,
    };

    return {
        ...authorMap,
        ...ogMap,
        ...otherMap,
        ...twitterMap,
        ...robotsMap,
    } as SeoPropsMap;
}
