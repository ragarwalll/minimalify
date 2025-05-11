import { type SupportedPlugins } from '@/utils/constants/supported-plugins.js';
import { type MinifyOptions } from 'terser';

/**
 * HTMLConfig is the configuration object for html minification
 */
interface HTMLConfig {
    minify: boolean;
}

/**
 * JSConfig is the configuration object for js minification
 */
interface JSConfig {
    minify: boolean;
    terserOptions: MinifyOptions;
}

/**
 * CSSConfig is the configuration object for css minification
 */
interface CSSConfig {
    minify: boolean;
}

/**
 * ImageConfig is the configuration object for image optimization
 */
interface ImageConfig {
    optimize: boolean;
    outDir: string;
    supportedFormats: string[];
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
    html: HTMLConfig;

    // js minifier options
    js: JSConfig;

    // css minifier options
    css: CSSConfig;

    // the images config
    images: ImageConfig;

    // templates dir
    templatesDir: string;

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
    'srcDir' | 'templatesDir'
>;

// the available directories in the config as array
export type AvailableDirectoriesArray = Array<keyof AvailableDirectories>;

/**
 * defaultConfig is the default configuration object for minimalify
 * @type {MinimalifyConfig}
 */
export const defaultConfig: MinimalifyConfig = {
    srcDir: 'src',
    outDir: 'dist',
    sharedDomains: ['https://therahulagarwal.com'],
    html: {
        minify: true,
    },
    css: {
        minify: true,
    },
    js: {
        minify: true,
        terserOptions: {},
    },
    images: {
        optimize: false,
        outDir: 'images',
        supportedFormats: ['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg'],
    },
    templatesDir: 'templates',
    dev: {
        port: 3000,
    },
    plugins: [
        'bundle-analyzer',
        'image-optimizer',
        'accessibility',
        'seo',
        'sitemap',
        'version-assets',
        'markdown',
        'spa',
        'perf-monitor',
    ],
};
