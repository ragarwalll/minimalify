export const plugins = [
    'bundle-analyzer',
    'image-optimizer',
    'accessibility',
    'seo',
    'sitemap',
    'version-assets',
    'custom-domain',
    'markdown',
    'spa',
    'favicon',
    'perf-monitor',
] as const;

export type SupportedPlugins = (typeof plugins)[number];
