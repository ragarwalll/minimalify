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
    minify_options: MinifyOptions;
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
    supported_formats: string[];
    ignore: string[];
}

interface TemplatesConfig {
    dir: string;
    shared_uri: string[];
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
    image_alt: string;
}

interface RobotsConfig {
    index: boolean;
    follow: boolean;
    allow: string[];
    disallow: string[];
    crawl_delay: number;
    user_agent: string[];
}

interface AuthorConfig {
    first_name: string;
    last_name: string;
    username: string;
    email: string;
    image: string;
    image_alt: string;
    image_type: string;
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
    open_graph: Partial<OpenGraphConfig>;
    twitter: Partial<TwitterConfig>;
    robots: Partial<RobotsConfig>;
}

export interface FaviconConfig {
    base: string;
    alt: string;
    settings: {
        favicon_active: 'base' | 'alt';
        favicon_inactive: 'base' | 'alt';
        safari: 'base' | 'alt';
        mstile: 'base' | 'alt';
        pwa: 'base' | 'alt';
        apple: 'base' | 'alt';
    };
    theme_color: string;
    background_color: string;
    svg_current_color: string;
}

/**
 * MinimalifyConfig is the configuration object for minimalify
 */
export interface MinimalifyConfig {
    // the starting point of the project
    src_dir: string;

    // the output directory of the project
    out_dir: string;

    // the processable assets domains
    shared_domains: string[];

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

    custom_domain?: string;

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
    'src_dir' | 'templates'
>;

// the available directories in the config as array
export type AvailableDirectoriesArray = Array<keyof AvailableDirectories>;

/**
 * defaultConfig is the default configuration object for minimalify
 * @type {MinimalifyConfig}
 */
export const defaultConfig: MinimalifyConfig = {
    src_dir: '.',
    out_dir: 'dist',
    shared_domains: ['https://therahulagarwal.com'],
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
        minify_options: {},
        ignore: [],
    },
    images: {
        optimize: true,
        supported_formats: ['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg'],
        ignore: [],
    },
    templates: {
        dir: 'templates',
        shared_uri: [],
        ignore: [],
    },
    seo: {
        title: 'Minimalify',
        description: 'A minimalistic static site generator',
        keywords: ['minimalify', 'static site generator', 'minimalistic'],
        classification: 'static site generator',
        url: 'https://therahulagarwal.com/minimalify',
        rating: 'General',
        target: 'all',
        author: {
            first_name: '<first-name>',
            last_name: '<last-name>',
            username: '<username>',
            email: 'contact@thrahulagarwal.com',
            image: '<link-to-image>',
            image_alt: '<image alt>',
            image_type: 'image/jpeg',
            twitter: 'https://twitter.com/<username>',
            facebook: 'https://www.facebook.com/<username>',
            linkedin: 'https://www.linkedin.com/in/<username>',
            github: 'https://github.com/<username>',
            instagram: 'https://www.instagram.com/<username>',
            youtube: 'https://www.youtube.com/<username>',
        },
        open_graph: {
            type: 'website',
            site_name: 'Minimalify',
        },
        twitter: {
            title: 'Minimalify',
            description: 'A minimalistic static site generator',
            site: '@<username>',
            card: 'summary_large_image',
            image: '<link-to-image>',
            image_alt: '<image alt>',
        },
        robots: {
            index: true,
            follow: true,
            allow: [],
            disallow: [],
            crawl_delay: 0,
            user_agent: ['*'],
        },
    },
    custom_domain: '<link-to-custom-domain>',
    favicon: {
        base: '<link-to-svg/png>',
        alt: '<link-to-svg/png>',
        settings: {
            favicon_active: 'base',
            favicon_inactive: 'alt',
            safari: 'alt',
            mstile: 'base',
            pwa: 'base',
            apple: 'alt',
        },
        theme_color: '#ffffff',
        background_color: '#ffffff',
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
        'favicon',
    ],
};
