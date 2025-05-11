import { type MinimalifyConfig } from '@/config/struct.js';
import { type SupportedPlugins } from '@/utils/constants/supported-plugins.js';
import { type DefaultTreeAdapterMap } from 'parse5';

/**
 * Core plugin interface. Plugins can hook into every major step.
 */
export interface MinimalifyPlugin {
    name: SupportedPlugins;

    /** mutate config before anything runs */
    onPreConfig?: (cfg: MinimalifyConfig) => Promise<void> | void;

    /** after config is loaded but before build starts */
    onPreBuild?: (cfg: MinimalifyConfig) => Promise<void> | void;

    /** before each asset download/copy */
    onAsset?: (
        cfg: MinimalifyConfig,
        type: 'css' | 'js' | 'image',
        src: string,
        dest: string,
    ) => Promise<void> | void;

    /** before bundling CSS/JS */
    onBundle?: (
        cfg: MinimalifyConfig,
        type: 'css' | 'js',
        inputs: string[],
    ) => Promise<string[]> | string[];

    /** after bundling, before writing to disk */
    onPostBundle?: (
        cfg: MinimalifyConfig,
        type: 'css' | 'js',
        content: string,
    ) => Promise<string> | string;

    /** on each page AST, before html rewrite */
    onPage?: (
        cfg: MinimalifyConfig,
        pagePath: string,
        doc: DefaultTreeAdapterMap['element'],
    ) => Promise<void> | void;

    /** after HTML is serialized, before minify */
    onPreHtmlMinify?: (
        cfg: MinimalifyConfig,
        html: string,
    ) => Promise<string> | string;

    /** after full build is done */
    onPostBuild?: (cfg: MinimalifyConfig) => Promise<void> | void;

    /** dev server hooks */
    onDevStart?: (cfg: MinimalifyConfig) => Promise<void> | void;
    onFileChange?: (
        cfg: MinimalifyConfig,
        file: string,
    ) => Promise<void> | void;
}
