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

interface OpenGraphConfig {
    type: string;
    site_name: string;
}

interface TwitterConfig {
    title: string;
    description: string;
    site: string;
    card: string;
    image: string;
    imageAlt: string;
}

interface RobotsConfig {
    index: boolean;
    follow: boolean;
    allow: string[];
    disallow: string[];
    crawlDelay: number;
    userAgent: string[];
}

interface AuthorConfig {
    firstName: string;
    lastName: string;
    username: string;
    email: string;
    image: string;
    imageAlt: string;
    imageType: string;
    twitter: string;
    facebook: string;
    linkedin: string;
    github: string;
    instagram: string;
    youtube: string;
}

interface SeoConfig {
    title: string;
    description: string;
    keywords: string[];
    classification: string;
    url: string;
    rating: 'General' | 'Mature' | 'Restricted';
    target: 'all' | 'mobile' | 'desktop';
    author: Partial<AuthorConfig>;
    opengraph: Partial<OpenGraphConfig>;
    twitter: Partial<TwitterConfig>;
    robots: Partial<RobotsConfig>;
}

interface FaviconConfig {
    svgPath: string;
    themeColor: string;
    msTileColor: string;
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

    seo?: Partial<SeoConfig>;

    // favicon options
    favicon?: Partial<FaviconConfig>;

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
        supportedFormats: ['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg'],
        ignore: [],
    },
    templates: {
        dir: 'templates',
        sharedUri: [],
        ignore: [],
    },
    seo: {
        title: 'Minimalify',
        description: 'A minimalistic static site generator',
        keywords: ['minimalify', 'static site generator', 'minimalistic'],
        classification: 'static site generator',
        url: 'https://minimalify.dev',
        rating: 'General',
        target: 'all',
        author: {
            firstName: 'Rahul',
            lastName: 'Agarwal',
            username: 'therahulagarwal',
            email: 'contact@thrahulagarwal.com',
            image: 'https://therahulagarwal.com/images/banner.jpg',
            imageAlt: 'Rahul Agarwal',
            imageType: 'image/jpeg',
            twitter: 'https://twitter.com/<username>',
            facebook: 'https://www.facebook.com/<username>',
            linkedin: 'https://www.linkedin.com/in/<username>',
            github: 'https://github.com/<username>',
            instagram: 'https://www.instagram.com/<username>',
            youtube: 'https://www.youtube.com/<username>',
        },
        opengraph: {
            type: 'website',
            site_name: 'Minimalify',
        },
        twitter: {
            title: 'Minimalify',
            description: 'A minimalistic static site generator',
            site: '@therahulagarwal',
            card: 'summary_large_image',
            image: 'https://minimalify.dev/assets/images/thumbnail.png',
            imageAlt: 'Minimalify',
        },
        robots: {
            index: true,
            follow: true,
            allow: [],
            disallow: [],
            crawlDelay: 0,
            userAgent: ['*'],
        },
    },
    customDomain: 'https://therahulagarwal.com',
    favicon: {
        svgPath: 'assets/images/favicon.svg',
        themeColor: '#ffffff',
        msTileColor: '#ffffff',
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
