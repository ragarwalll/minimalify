import { CSS_BUNDLE_NAME } from '@/utils/constants/bundle.js';
import { type SupportedPlugins } from '@/utils/constants/supported-plugins.js';
import { type MinifyOptions } from 'terser';

/**
 * HTMLConfig is the configuration object for html minification
 */
interface HTMLConfig {
    minify: boolean;
    ignore: string[];
}

/**
 * JSConfig is the configuration object for js minification
 */
interface JSConfig {
    minify: boolean;
    minifyOptions: MinifyOptions;
    ignore: string[];
}

/**
 * CSSConfig is the configuration object for css minification
 */
interface CSSConfig {
    minify: boolean;
    ignore: string[];
}

/**
 * ImageConfig is the configuration object for image optimization
 */
interface ImageConfig {
    optimize: boolean;
    outDir: string;
    supportedFormats: string[];
    ignore: string[];
}

interface TemplatesConfig {
    dir: string;
    sharedUri: string[];
    ignore: string[];
}

/**
 * MinimalifyConfig is the configuration object for minimalify
 */
export interface MinimalifyConfig {
    // the starting point of the project
    srcDir: string;

    // the output directory of the project
    outDir: string;

    // the processable assets domains
    sharedDomains: string[];

    // html minifier options
    html: Partial<HTMLConfig>;

    // js minifier options
    js: Partial<JSConfig>;

    // css minifier options
    css: Partial<CSSConfig>;

    // the images config
    images: Partial<ImageConfig>;

    // the templates config
    templates: Partial<TemplatesConfig>;

    // dev options
    dev: {
        port: number;
    };

    customDomain?: string;

    seo?: {
        siteUrl: string;
        title: string;
        description: string;
        titleSuffix: string;
        defaultDescription: string;
        twitterCard: string;
    };

    // minimalify plugins
    plugins: SupportedPlugins[];

    // cache options
    cache?: boolean;
}

// the available directories in the config
export type AvailableDirectories = Pick<
    MinimalifyConfig,
    'srcDir' | 'templates'
>;

// the available directories in the config as array
export type AvailableDirectoriesArray = Array<keyof AvailableDirectories>;

/**
 * defaultConfig is the default configuration object for minimalify
 * @type {MinimalifyConfig}
 */
export const defaultConfig: MinimalifyConfig = {
    srcDir: '.',
    outDir: 'dist',
    sharedDomains: ['https://therahulagarwal.com'],
    html: {
        minify: true,
        ignore: [],
    },
    css: {
        minify: true,
        ignore: [],
    },
    js: {
        minify: true,
        minifyOptions: {},
        ignore: [],
    },
    images: {
        optimize: true,
        outDir: CSS_BUNDLE_NAME,
        supportedFormats: ['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg'],
        ignore: [],
    },
    templates: {
        dir: 'templates',
        sharedUri: [],
        ignore: [],
    },
    dev: {
        port: 3000,
    },
    cache: true,
    plugins: [
        'accessibility',
        'bundle-analyzer',
        'custom-domain',
        'image-optimizer',
        'markdown',
        'perf-monitor',
        'seo',
        'sitemap',
        'spa',
        'version-assets',
    ],
};
