import { type SupportedPlugins } from '@/utils/constants/supported-plugins.js';

/**
 * MinimalifyConfig is the configuration object for minimalify
 */
interface HTMLMinifierOptions {
    collapseWhitespace: boolean;
    removeComments: boolean;
    removeRedundantAttributes: boolean;
    minifyCSS: boolean;
    minifyJS: boolean;
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
    htmlMinify: HTMLMinifierOptions;

    // templates dir
    templatesDir: string;

    // images opts
    images: {
        optimize: boolean;
        outDir: string;
        supportedFormats: string[];
    };

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
    htmlMinify: {
        collapseWhitespace: true,
        removeComments: true,
        removeRedundantAttributes: true,
        minifyCSS: true,
        minifyJS: true,
    },
    templatesDir: 'templates',
    images: {
        optimize: false,
        outDir: 'images',
        supportedFormats: ['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg', 'ico'],
    },
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
