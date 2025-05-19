import { type MinimalifyConfig } from '@/config/struct.js';
import { type DefaultTreeAdapterMap } from 'parse5';

export interface LookupAttr {
    name: string;
    value: string | RegExp;
}

export interface TagDetails {
    lookup: LookupAttr[];
    valueAttr: string;
    setter?: (
        cfg: MinimalifyConfig,
        allTagDetails: TagDetailsMap,
        existingValue: string,
    ) => string | undefined;
}

// map tagName → list of TagDetails
export type TagDetailsMap = {
    [tagName: string]: TagDetails[];
};

/**
 * Scans `node.childNodes` for elements matching any TagDetails;
 * reads existing values, calls setters for missing/empty ones,
 * removes old matching nodes, and re-inserts one per TagDetails.
 */
export function prepareAndMerge(
    cfg: MinimalifyConfig,
    node: DefaultTreeAdapterMap['element'],
    tagDetails: TagDetailsMap,
): DefaultTreeAdapterMap['element'] {
    type Flat = {
        tagName: string;
        lookup: LookupAttr[];
        valueAttr: { name: string; value: string };
    };

    const flatList: Flat[] = [];
    const seen = new Set<string>();

    // 1) Discover existing matching nodes
    for (const child of node.childNodes as any[]) {
        if ((child as any).nodeName === '#text') continue;
        const el = child as DefaultTreeAdapterMap['element'];
        const detailsList = tagDetails[el.tagName];
        if (!detailsList) continue;

        for (const details of detailsList) {
            let match = true;
            const actuals: Record<string, string> = {};
            for (const la of details.lookup) {
                const attr = el.attrs.find((a) => a.name === la.name);
                if (!attr) {
                    match = false;
                    break;
                }
                const v = attr.value;
                if (la.value instanceof RegExp) {
                    if (!la.value.test(v)) {
                        match = false;
                        break;
                    }
                } else {
                    if (v !== la.value) {
                        match = false;
                        break;
                    }
                }
                actuals[la.name] = v;
            }
            if (!match) continue;

            const valAttr = el.attrs.find((a) => a.name === details.valueAttr);
            if (!valAttr || !valAttr.value) continue;

            const key = [
                el.tagName,
                ...details.lookup.map(
                    (la) =>
                        `${la.name}:${
                            la.value instanceof RegExp
                                ? la.value.toString()
                                : la.value
                        }`,
                ),
            ].join('|');

            (details as any).__existing = valAttr.value;
            seen.add(key);
            flatList.push({
                tagName: el.tagName,
                lookup: details.lookup,
                valueAttr: { name: details.valueAttr, value: valAttr.value },
            });
        }
    }

    // 2) For each configured TagDetails, call setter if missing/empty
    for (const tagName in tagDetails) {
        const detailsList = tagDetails[tagName];
        if (!detailsList) continue;
        for (const details of detailsList) {
            const key = [
                tagName,
                ...details.lookup.map(
                    (la) =>
                        `${la.name}:${
                            la.value instanceof RegExp
                                ? la.value.toString()
                                : la.value
                        }`,
                ),
            ].join('|');
            const existing = (details as any).__existing as string | undefined;
            if (seen.has(key) && existing) continue;
            if (!details.setter) continue;
            const newVal = details.setter(cfg, tagDetails, existing ?? '');
            if (!newVal) continue;
            flatList.push({
                tagName,
                lookup: details.lookup,
                valueAttr: { name: details.valueAttr, value: newVal },
            });
            seen.add(key);
        }
    }

    // 3) Remove old matching nodes
    node.childNodes = node.childNodes.filter((c: any) => {
        if (c.nodeName === '#text') return true;
        const el = c as DefaultTreeAdapterMap['element'];
        return !flatList.some((f) => {
            if (el.tagName !== f.tagName) return false;
            return f.lookup.every((la) => {
                const attr = el.attrs.find((a) => a.name === la.name);
                if (!attr) return false;
                const v = attr.value;
                return la.value instanceof RegExp
                    ? la.value.test(v)
                    : v === la.value;
            });
        });
    });

    // 4) Insert one element per flatList entry
    for (const f of flatList) {
        node.childNodes.push({
            tagName: f.tagName,
            attrs: [
                ...f.lookup.map((la) => ({
                    name: la.name,
                    value:
                        la.value instanceof RegExp
                            ? la.value.toString()
                            : la.value,
                })),
                { name: f.valueAttr.name, value: f.valueAttr.value },
            ],
        } as DefaultTreeAdapterMap['element']);
    }

    return node;
}

export const seoAttrCollections: TagDetailsMap = {
    meta: [
        // standard <meta name="…">
        {
            lookup: [{ name: 'name', value: 'title' }],
            valueAttr: 'content',
            setter: (cfg: MinimalifyConfig, _all, existing: string) =>
                cfg.seo?.title ?? existing,
        },
        {
            lookup: [{ name: 'name', value: 'description' }],
            valueAttr: 'content',
            setter: (cfg, _all, existing) => cfg.seo?.description ?? existing,
        },
        {
            lookup: [{ name: 'name', value: 'keywords' }],
            valueAttr: 'content',
            setter: (cfg, _all, existing) =>
                cfg.seo?.keywords?.join(', ') ?? existing,
        },
        {
            lookup: [{ name: 'name', value: 'author' }],
            valueAttr: 'content',
            setter: (cfg, _all, existing) => {
                const a = cfg.seo?.author;
                if (!a) return existing;
                if (a.first_name && a.last_name)
                    return `${a.first_name} ${a.last_name}`;
                return (
                    a.first_name ??
                    a.last_name ??
                    a.username ??
                    a.email ??
                    existing
                );
            },
        },
        {
            lookup: [{ name: 'name', value: 'robots' }],
            valueAttr: 'content',
            setter: (cfg, _all, existing) => {
                const r = cfg.seo?.robots;
                if (!r) return existing;
                const parts = [
                    r.index ? 'index' : 'noindex',
                    r.follow ? 'follow' : 'nofollow',
                ];
                if (r.allow?.length) parts.push('allow: ' + r.allow.join(', '));
                if (r.disallow?.length)
                    parts.push('disallow: ' + r.disallow.join(', '));
                return parts.join(', ');
            },
        },
        {
            lookup: [{ name: 'name', value: 'classification' }],
            valueAttr: 'content',
            setter: (cfg, _all, existing) =>
                cfg.seo?.classification ?? existing,
        },
        {
            lookup: [{ name: 'name', value: 'target' }],
            valueAttr: 'content',
            setter: (cfg, _all, existing) => cfg.seo?.target ?? existing,
        },
        {
            lookup: [{ name: 'name', value: 'rating' }],
            valueAttr: 'content',
            setter: (cfg, _all, existing) => cfg.seo?.rating ?? existing,
        },
        {
            lookup: [{ name: 'name', value: 'twitter:title' }],
            valueAttr: 'content',
            setter: (cfg, _all, existing) =>
                cfg.seo?.twitter?.title ?? existing,
        },
        {
            lookup: [{ name: 'name', value: 'twitter:description' }],
            valueAttr: 'content',
            setter: (cfg, _all, existing) =>
                cfg.seo?.twitter?.description ?? existing,
        },
        {
            lookup: [{ name: 'name', value: 'twitter:image' }],
            valueAttr: 'content',
            setter: (cfg, _all, existing) =>
                cfg.seo?.twitter?.image ?? existing,
        },
        {
            lookup: [{ name: 'name', value: 'twitter:image:alt' }],
            valueAttr: 'content',
            setter: (cfg, _all, existing) =>
                cfg.seo?.twitter?.image_alt ?? existing,
        },
        {
            lookup: [{ name: 'name', value: 'twitter:site' }],
            valueAttr: 'content',
            setter: (cfg, _all, existing) => cfg.seo?.twitter?.site ?? existing,
        },
        {
            lookup: [{ name: 'name', value: 'twitter:card' }],
            valueAttr: 'content',
            setter: (cfg, _all, existing) => cfg.seo?.twitter?.card ?? existing,
        },

        // Open Graph / profile <meta property="…">
        {
            lookup: [{ name: 'property', value: 'og:type' }],
            valueAttr: 'content',
            setter: (cfg, _all, existing) =>
                cfg.seo?.open_graph?.type ?? existing,
        },
        {
            lookup: [{ name: 'property', value: 'og:title' }],
            valueAttr: 'content',
            setter: (cfg, _all, existing) => cfg.seo?.title ?? existing,
        },
        {
            lookup: [{ name: 'property', value: 'og:description' }],
            valueAttr: 'content',
            setter: (cfg, _all, existing) => cfg.seo?.description ?? existing,
        },
        {
            lookup: [{ name: 'property', value: 'og:url' }],
            valueAttr: 'content',
            setter: (cfg, _all, existing) => cfg.seo?.url ?? existing,
        },
        {
            lookup: [{ name: 'property', value: 'og:site_name' }],
            valueAttr: 'content',
            setter: (cfg, _all, existing) =>
                cfg.seo?.open_graph?.site_name ?? existing,
        },
        {
            lookup: [{ name: 'property', value: 'og:locale' }],
            valueAttr: 'content',
            setter: (_cfg, _all, existing) => existing || 'en_US',
        },
        {
            lookup: [{ name: 'property', value: 'og:image' }],
            valueAttr: 'content',
            setter: (cfg, _all, existing) => cfg.seo?.author?.image ?? existing,
        },
        {
            lookup: [{ name: 'property', value: 'og:image:alt' }],
            valueAttr: 'content',
            setter: (cfg, _all, existing) =>
                cfg.seo?.author?.image_alt ?? existing,
        },
        {
            lookup: [{ name: 'property', value: 'og:image:type' }],
            valueAttr: 'content',
            setter: (cfg, _all, existing) =>
                cfg.seo?.author?.image_type ?? existing,
        },
        {
            lookup: [{ name: 'property', value: 'profile:first_name' }],
            valueAttr: 'content',
            setter: (cfg, _all, existing) =>
                cfg.seo?.author?.first_name ?? existing,
        },
        {
            lookup: [{ name: 'property', value: 'profile:last_name' }],
            valueAttr: 'content',
            setter: (cfg, _all, existing) =>
                cfg.seo?.author?.last_name ?? existing,
        },
        {
            lookup: [{ name: 'property', value: 'profile:username' }],
            valueAttr: 'content',
            setter: (cfg, _all, existing) =>
                cfg.seo?.author?.username ?? existing,
        },
        {
            lookup: [{ name: 'property', value: 'profile:email' }],
            valueAttr: 'content',
            setter: (cfg, _all, existing) => cfg.seo?.author?.email ?? existing,
        },
        {
            lookup: [{ name: 'property', value: 'profile:image' }],
            valueAttr: 'content',
            setter: (cfg, _all, existing) => cfg.seo?.author?.image ?? existing,
        },
        {
            lookup: [{ name: 'property', value: 'profile:description' }],
            valueAttr: 'content',
            setter: (cfg, _all, existing) => cfg.seo?.description ?? existing,
        },
        {
            lookup: [{ name: 'property', value: 'profile:twitter' }],
            valueAttr: 'content',
            setter: (cfg, _all, existing) =>
                cfg.seo?.author?.twitter ?? existing,
        },
        {
            lookup: [{ name: 'property', value: 'profile:facebook' }],
            valueAttr: 'content',
            setter: (cfg, _all, existing) =>
                cfg.seo?.author?.facebook ?? existing,
        },
        {
            lookup: [{ name: 'property', value: 'profile:linkedin' }],
            valueAttr: 'content',
            setter: (cfg, _all, existing) =>
                cfg.seo?.author?.linkedin ?? existing,
        },
        {
            lookup: [{ name: 'property', value: 'profile:github' }],
            valueAttr: 'content',
            setter: (cfg, _all, existing) =>
                cfg.seo?.author?.github ?? existing,
        },
        {
            lookup: [{ name: 'property', value: 'profile:instagram' }],
            valueAttr: 'content',
            setter: (cfg, _all, existing) =>
                cfg.seo?.author?.instagram ?? existing,
        },
        {
            lookup: [{ name: 'property', value: 'profile:youtube' }],
            valueAttr: 'content',
            setter: (cfg, _all, existing) =>
                cfg.seo?.author?.youtube ?? existing,
        },
    ],
};
