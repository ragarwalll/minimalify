import fg from 'fast-glob';
import { type MinimalifyConfig } from '@/config/struct.js';
import {
    GLOB_CSS,
    GLOB_HTML,
    GLOB_IMG,
    GLOB_INGORE,
    GLOB_JS,
    GLOB_MD,
    GLOB_TEMPLATES,
} from './constants/glob.js';
import { CONFIG_FILE_NAME } from './constants/file-name.js';

/**
 * Gather all HTML pages in the source directory.
 * @param cfg the minimalify config
 * @returns an array of HTML pages
 */
export const gatherHtmlPages = async (cfg: MinimalifyConfig) => {
    return await fg(GLOB_HTML, {
        cwd: cfg.srcDir,
        ignore: [
            ...GLOB_INGORE,
            `**/${cfg.templates?.dir}/**`,
            ...(cfg.html.ignore ?? []),
        ],
        absolute: true,
    });
};

/**
 * Gather all CSS files in the source directory.
 * @param cfg the minimalify config
 * @returns an array of CSS files
 */
export const gatherCssFiles = async (cfg: MinimalifyConfig) => {
    return await fg(GLOB_CSS, {
        cwd: cfg.srcDir,
        ignore: [...GLOB_INGORE, ...(cfg.css.ignore ?? [])],
        absolute: true,
    });
};

/**
 * Gather all JS files in the source directory.

 * @param cfg the minimalify config
 * @returns an array of JS files
 */
export const gatherJsFiles = async (cfg: MinimalifyConfig) => {
    return await fg(GLOB_JS, {
        cwd: cfg.srcDir,
        ignore: [...GLOB_INGORE, CONFIG_FILE_NAME, ...(cfg.js.ignore ?? [])],
        absolute: true,
    });
};

/**
 * Gather all image files in the source directory.
 * @param cfg the minimalify config
 * @returns an array of image files
 */
export const gatherImgFiles = async (cfg: MinimalifyConfig) => {
    return await fg(
        `${GLOB_IMG.replace('{SUPPORTED_IMG_EXTENSIONS}', (cfg.images?.supportedFormats ?? []).join(','))}`,
        {
            cwd: cfg.srcDir,
            ignore: [...GLOB_INGORE, ...(cfg.images.ignore ?? [])],
            absolute: true,
        },
    );
};

/**
 * Gather all template files in the source directory.
 * @param cfg the minimalify config
 * @returns an array of template files
 */
export const gatherTemplateFiles = async (cfg: MinimalifyConfig) => {
    return await fg(
        `${GLOB_TEMPLATES.replace('{TEMPLATE_DIR}', cfg.templates?.dir ?? 'templates')}`,
        {
            cwd: cfg.srcDir,
            ignore: GLOB_INGORE,
            absolute: true,
        },
    );
};

/**
 * Gather all Markdown files in the source directory.
 * @param cfg the minimalify config
 * @returns an array of Markdown files
 */
export const gatherMdFiles = async (cfg: MinimalifyConfig) => {
    return await fg(`${GLOB_MD}`, {
        cwd: cfg.srcDir,
        ignore: [...GLOB_INGORE, `**/${cfg.templates?.dir}/**`],
        absolute: true,
    });
};

/**
 * Gather local CSS or JS assets from the source directory.
 * @param cwd the current working directory
 * @param cfg the minimalify config
 * @param type the type of asset to gather (css or js)
 * @returns an array of asset URIs
 */
export const gatherLocalAsstesUri = async (
    cfg: MinimalifyConfig,
    type: 'css' | 'js' | 'img',
) => {
    if (type === 'css') {
        return await gatherCssFiles(cfg);
    } else if (type === 'js') {
        return await gatherJsFiles(cfg);
    } else if (type === 'img') {
        return await gatherImgFiles(cfg);
    }
    throw new Error(`Unsupported asset type: ${type}`);
};
