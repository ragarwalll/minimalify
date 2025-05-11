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
    'perf-monitor',
] as const;

export type SupportedPlugins = (typeof plugins)[number];
