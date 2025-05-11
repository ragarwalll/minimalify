import path from 'path';
import fs from 'fs';
import os from 'os';
import postcss from 'postcss';
import autoprefixer from 'autoprefixer';
import cssnano from 'cssnano';
import pLimit from 'p-limit';
import { HTTPCache } from '@/cache-manager/http-cache.js';
import { type MinimalifyConfig } from '@/config/struct.js';
import { GraphError } from '@/error/graph-error.js';
import { minify as minifyHtml } from 'html-minifier-terser';
import { BuildGraph } from '@/graph/build-graph.js';
import { MinimalifyPluginManager } from '@/plugins/manager.js';
import { cleanDir, ensureDir } from '@/utils/dir.js';
import {
    type DefaultTreeAdapterMap,
    parseFragment,
    parse,
    serialize,
} from 'parse5';
import { gatherLocalAsstesUri } from '@/utils/glob.js';
import { minify } from 'terser';
import { BundleError } from '@/error/bundle-error.js';
import { PurgeCSS } from 'purgecss';
import { createHash } from 'crypto';
import { LRUCache } from 'lru-cache';
import {
    CSS_BUNDLE_NAME,
    IMG_BUNDLE_DIR,
    JS_BUNDLE_NAME,
} from '@/utils/constants/bundle.js';
import { HTMLError } from '@/error/html-error.js';
import MarkdownIt from 'markdown-it';
import { logger } from '@/utils/logger.js';
import pkg from 'bloom-filters';
import { CACHE_DIR } from '@/utils/constants/cache.js';
import {
    isCssValidForProcessing,
    isImgValidForProcessing,
    isJsValidForProcessing,
    isObjectValidForProcessing,
} from '@/utils/assets-detector.js';
import chalk from 'chalk';
import { walkHtmlTree } from '@/utils/html-walk.js';
import { MATCH_TEMPLATE_REGEX } from '@/utils/constants/regex.js';
import { formatImageName } from '@/utils/assets-name-formatter.js';

const { BloomFilter } = pkg;

const MATCH_CHILDREN_REGEX = /\{\{children\}\}/g;

const concurrency = os.cpus().length;
const limit = pLimit(concurrency);

// Bloom filter for URLs
const urlBloom = BloomFilter.create(1000, 0.01);

// LRU caches for transform results
const cssCache = new LRUCache<string, string>({ max: 100 });
const jsCache = new LRUCache<string, string>({ max: 100 });
const htmlCache = new LRUCache<string, string>({ max: 100 });

/**
 * Builder class for building the project.
 * It handles the following tasks:
 * 1. Initialize the builder
 * 2. Build the CSS assets
 * 3. Build the JS assets
 * 4. Build the HTML pages
 * 5. Incremental build
 */
export class Builder {
    cfg: MinimalifyConfig;
    graph!: BuildGraph;
    httpCache: HTTPCache;
    plugins: MinimalifyPluginManager;
    templates: Record<string, string> = {};

    /**
     * @param cfg  the configuration object
     */
    constructor(cfg: MinimalifyConfig) {
        this.cfg = cfg;
        this.httpCache = new HTTPCache(
            cfg,
            path.join(process.cwd(), CACHE_DIR),
        );
        this.plugins = new MinimalifyPluginManager();
    }

    /**
     * Initialize the builder.
     *
     */
    async init() {
        logger.spinner.update('initializing builder');
        await this.plugins.loadPlugins(this.cfg);

        logger.spinner.update('loading templates');
        this.templates = this._buildTemplates();

        if (Object.keys(this.templates).length > 0)
            logger.info(
                `templates loaded → ${chalk.underline(Object.keys(this.templates).join(', '))}`,
            );
        else logger.warn('no templates found, skipping template build');

        logger.spinner.update('processing builder...');
        await this.plugins.callHook('onPreConfig', this.cfg);

        this.graph = new BuildGraph(this.cfg);

        await this.graph.init();
    }

    /**
     * Build the project.
     *
     * @returns  the build result
     */
    async build() {
        if (!this.graph) {
            throw new GraphError('graph is not initialized');
        }

        // 1. Clean the output directory
        ensureDir(this.cfg.outDir);
        cleanDir(this.cfg.outDir);

        logger.debug(`calling ${chalk.underline('pre-build')} hook`);
        await this.plugins.callHook('onPreBuild', this.cfg);

        logger.debug(
            `cleaning output directory → ${chalk.underline(path.basename(this.cfg.outDir))}`,
        );

        const { sharedCssUri, sharedJsUri, sharedImgUri } =
            await this._getSharedAssetsUri();

        if (
            sharedCssUri.length === 0 &&
            sharedJsUri.length === 0 &&
            sharedImgUri.length === 0
        ) {
            logger.warn(
                'no shared assets found. Skipping CSS, JS and IMG build...',
            );
        } else {
            logger.info(
                `shared CSS assets found → ${chalk.underline(sharedCssUri.join(', '))}`,
            );
            logger.info(
                `shared JS assets found → ${chalk.underline(sharedJsUri.join(', '))}`,
            );
            logger.info(
                `shared IMG assets found → ${chalk.underline(sharedImgUri.join(', '))}`,
            );
        }

        logger.spinner.update('building & minifying CSS, JS and IMG assets');

        // parallelize independent steps
        await Promise.all([
            this._buildCss(sharedCssUri),
            this._buildJs(sharedJsUri),
            this._copyAssets(sharedImgUri),
        ]);

        logger.spinner.update('processing HTML pages...');

        // build pages in DAG order (smallest subtree first)
        const pages = this.graph.getAllPages();
        pages.sort(
            (a, b) => this.graph.subtreeSize(a) - this.graph.subtreeSize(b),
        );

        logger.debug(
            `building ${chalk.underline(pages.length.toString())} pages in parallel`,
        );

        // build pages in parallel
        await Promise.all(pages.map((rel) => this._buildPage(rel)));

        // log that pages are built

        logger.debug(
            `html pages built → ${chalk.underline(pages.length.toString())}`,
        );
        logger.debug(
            `html pages rendered → ${chalk.underline(pages.map((p) => path.basename(p)).join(', '))}`,
        );

        logger.debug(`calling ${chalk.underline('post-build')} hook`);
        await this.plugins.callHook('onPostBuild', this.cfg);
    }

    /**
     * Build the CSS assets.
     *
     * @param sharedCssUri - the shared CSS assets URI
     * @returns {Promise<void>} - the build result
     */
    private _buildCss(sharedCssUri: string[]) {
        return this._buildStyleAndScript({
            type: 'css',
            assetsUri: sharedCssUri,
        });
    }

    /**
     * Build the JS assets.
     *
     * @param sharedJsUri - the shared JS assets URI
     * @returns {Promise<void>} - the build result
     */
    private _buildJs(sharedJsUri: string[]) {
        return this._buildStyleAndScript({
            type: 'js',
            assetsUri: sharedJsUri,
        });
    }

    /**
     * Copy the assets to the output directory.
     *
     * @returns {Promise<void>} - the build result
     */
    private async _copyAssets(assetsUri: string[] = []) {
        // 1. Clean & ensure the output directory
        const outDir = path.join(this.cfg.outDir, IMG_BUNDLE_DIR);
        ensureDir(outDir);
        cleanDir(outDir);

        // 2. Download & load shared assets & call the hook
        await Promise.all(
            assetsUri.map((uri) =>
                limit(async () => {
                    if (urlBloom.has(uri)) {
                        logger.debug(
                            `skipping asset ${uri} as it is already processed`,
                        );
                        return;
                    }
                    urlBloom.add(uri);

                    const data = await this.httpCache.fetch(uri);

                    const hex = createHash('md5').update(uri).digest('hex');
                    const dst = path.join(outDir, `${hex}${path.extname(uri)}`);
                    logger.debug(`copying asset to disk → ${dst}`);

                    ensureDir(path.dirname(dst));
                    fs.writeFileSync(dst, data);

                    await this.plugins.callHook(
                        'onAsset',
                        this.cfg,
                        'image',
                        data,
                        dst,
                    );
                }),
            ),
        );

        // 3. Gather local assets
        let localAssetsUri = await gatherLocalAsstesUri(this.cfg, 'img');
        await Promise.all(
            localAssetsUri.map((uri) =>
                limit(async () => {
                    if (urlBloom.has(uri)) {
                        logger.debug(
                            `skipping asset ${uri} as it is already processed`,
                        );
                        return;
                    }
                    urlBloom.add(uri);

                    const data = fs.readFileSync(uri);

                    const dst = path.join(
                        outDir,
                        path.relative(this.cfg.srcDir, uri),
                    );
                    logger.debug(`copying asset to disk → ${dst}`);

                    ensureDir(path.dirname(dst));
                    fs.writeFileSync(dst, data);

                    await this.plugins.callHook(
                        'onAsset',
                        this.cfg,
                        'image',
                        '',
                        dst,
                    );
                }),
            ),
        );

        logger.debug(`proccessed ${assetsUri.length} assets`);
        logger.debug(`proccessed ${localAssetsUri.length} local assets`);
    }

    /**
     * Build the templates. md files are converted to HTML.
     * @returns {Promise<void>} - the build result
     */
    private _buildTemplates() {
        const mdHandler = new MarkdownIt();
        const templates: Record<string, string> = {};

        if (
            this.cfg.templatesDir &&
            this.cfg.templatesDir.length > 0 &&
            fs.existsSync(path.join(this.cfg.srcDir, this.cfg.templatesDir))
        ) {
            const files = fs.readdirSync(
                path.join(this.cfg.srcDir, this.cfg.templatesDir),
            );

            for (const file of files) {
                if (!file.endsWith('.html') && !file.endsWith('.md')) {
                    continue;
                }

                let txt = fs.readFileSync(
                    path.join(this.cfg.srcDir, this.cfg.templatesDir, file),
                    'utf8',
                );

                if (file.endsWith('.md')) txt = mdHandler.render(txt);
                templates[file.replace(/\.(html|md)$/, '')] = txt;
            }
        }
        return templates;
    }

    /**
     * Build the style and script assets.
     *
     * @param param0 - the parameters
     * @param param0.type - the type of the asset (CSS or JS)
     * @param param0.assetsUri - the assets URI
     * @returns {Promise<void>} - the build result
     */
    private async _buildStyleAndScript({
        type,
        assetsUri,
    }: {
        type: 'css' | 'js';
        assetsUri: string[];
    }) {
        // 1. Clean & ensure the output directory
        const outDir = path.join(this.cfg.outDir, type);
        ensureDir(outDir);

        // 2. Download & load shared assets & call the hook
        const assets = [];

        for (let uri of assetsUri) {
            if (!urlBloom.has(uri)) urlBloom.add(uri);
            const data = await this.httpCache.fetch(uri);
            await this.plugins.callHook(
                'onAsset',
                this.cfg,
                type,
                data,
                outDir,
            );
            assets.push(data);
        }

        // 3. Gather local assets
        let localAssetsUri = await gatherLocalAsstesUri(this.cfg, type);
        if (localAssetsUri.length > 0) {
            logger.debug(
                `local ${type} assets found → ${chalk.underline(
                    localAssetsUri.join(', '),
                )}`,
            );
        } else {
            logger.debug(`no local ${type} assets found`);
        }

        localAssetsUri =
            (await this.plugins.callHook(
                'onBundle',
                this.cfg,
                type,
                localAssetsUri,
            )) || localAssetsUri;

        // 4. Bundle & minify the assets
        const localAssets = localAssetsUri.map((f) =>
            fs.readFileSync(f, 'utf8'),
        );
        let bundle = await this._bundleAndMinify(
            type,
            assets.concat(localAssets).join('\n'),
        );

        logger.debug(`calling ${chalk.underline('post-bundle')} hook`);
        bundle =
            (await this.plugins.callHook(
                'onPostBundle',
                this.cfg,
                type,
                bundle,
            )) || bundle;

        logger.debug(
            `writing bundle to disk → ${chalk.underline(path.relative(process.cwd(), outDir))}`,
        );
        fs.writeFileSync(
            path.join(
                outDir,
                type === 'css' ? CSS_BUNDLE_NAME : JS_BUNDLE_NAME,
            ),
            bundle,
            'utf8',
        );
    }

    /**
     * Get the shared assets URI from HTML pages
     * @returns {Promise<void>} - the build result
     */
    private async _getSharedAssetsUri(): Promise<{
        sharedCssUri: string[];
        sharedJsUri: string[];
        sharedImgUri: string[];
    }> {
        const pages = this.graph?.getAllPages();
        if (!pages || pages.length === 0) {
            throw new GraphError('no html pages found to be processed');
        }

        const sharedCss = new Set<string>();
        const sharedJs = new Set<string>();
        const sharedImg = new Set<string>();

        for (const page of pages) {
            // read the html page
            const rawHtml = fs.readFileSync(
                path.join(this.cfg.srcDir, page),
                'utf8',
            );

            // parse the html page
            const doc = parseFragment(
                rawHtml,
            ) as unknown as DefaultTreeAdapterMap['element'];

            await walkHtmlTree(doc, {
                defaultDescend: true,
                handlers: [
                    {
                        match: 'link',
                        fns: [
                            (node) => {
                                const { isValid, value } =
                                    isCssValidForProcessing({
                                        node,
                                        cfg: this.cfg,
                                        checkLocalUri: false,
                                    });
                                if (isValid) sharedCss.add(value);
                            },
                        ],
                    },
                    {
                        match: 'script',
                        fns: [
                            (node) => {
                                const { isValid, value } =
                                    isJsValidForProcessing({
                                        node,
                                        cfg: this.cfg,
                                        checkLocalUri: false,
                                    });
                                if (isValid) sharedJs.add(value);
                            },
                        ],
                    },
                    {
                        match: 'img',
                        fns: [
                            (node) => {
                                const { isValid, value } =
                                    isImgValidForProcessing({
                                        node,
                                        cfg: this.cfg,
                                        checkLocalUri: false,
                                    });
                                if (isValid) sharedImg.add(value);
                            },
                        ],
                    },
                    {
                        match: 'object',
                        fns: [
                            (node) => {
                                const { isValid, value } =
                                    isObjectValidForProcessing({
                                        node,
                                        cfg: this.cfg,
                                        checkLocalUri: false,
                                    });
                                if (isValid) sharedImg.add(value);
                            },
                        ],
                    },
                ],
            });
        }

        return {
            sharedCssUri: Array.from(sharedCss),
            sharedJsUri: Array.from(sharedJs),
            sharedImgUri: Array.from(sharedImg),
        };
    }

    /**
     * Bundle and minify the assets
     *
     * @param type - The type of the asset (CSS or JS)
     * @param bundle - The bundle string
     * @returns {Promise<string>} - The minified bundle string
     */
    private _bundleAndMinify = async (type: 'js' | 'css', bundle: string) => {
        if (!bundle || bundle.trim() == '') return '';
        if (type === 'css' && this.cfg.css.minify == true) {
            // Purge unused selectors
            const purge = new PurgeCSS();
            const purged = await purge.purge({
                content: this.graph
                    .getAllPages()
                    .map((p) => path.join(this.cfg.srcDir, p)),
                css: [{ raw: bundle }],
            });

            bundle = purged[0]?.css ?? bundle;

            // PostCSS + cssnano w/ LRU cache
            const hash = createHash('md5').update(bundle).digest('hex');
            let finalCss = cssCache.get(hash);
            logger.debug(`bundle hash → ${hash}`);

            if (!finalCss) {
                logger.debug(`minifying CSS bundle using PostCSS + cssnano...`);

                const res = await limit(() =>
                    postcss([autoprefixer, cssnano]).process(bundle, {
                        from: undefined,
                    }),
                );
                finalCss = res.css;
                cssCache.set(hash, finalCss);
            } else {
                logger.debug(`CSS bundle found in cache → ${hash}`);
            }

            if (!finalCss) {
                throw new BundleError('failed to minify the CSS bundle');
            }

            return finalCss;
        } else if (type === 'js' && this.cfg.js.minify == true) {
            const hash = createHash('md5').update(bundle).digest('hex');
            let finalJs = jsCache.get(hash);

            logger.debug(`bundle hash → ${hash}`);

            if (!finalJs) {
                logger.debug(`minifying JS bundle using Terser...`);
                const res = await limit(() =>
                    minify(bundle, this.cfg.js.terserOptions),
                );

                if (res.code === undefined) {
                    throw new BundleError('failed to minify the JS bundle');
                }

                finalJs = res.code;
                jsCache.set(hash, finalJs);
            } else {
                logger.debug(`JS bundle found in cache → ${hash}`);
            }

            if (!finalJs) {
                throw new BundleError('failed to minify the JS bundle');
            }

            return finalJs;
        }
        return bundle;
    };

    /**
     * Build/Rebuild the HTML pages.
     *
     * @param rel - the relative path of the page
     * @returns {Promise<void>} - the build result
     */
    private async _buildPage(rel: string) {
        const absPage = path.join(this.cfg.srcDir, rel);
        const raw = fs.readFileSync(absPage, 'utf8');

        // Parse the HTML page as AST
        const doc = parse(raw) as unknown as DefaultTreeAdapterMap['element'];
        await this.plugins.callHook('onPage', this.cfg, absPage, doc);

        // replace the <include-*> tags with the template content
        // rewrite the <img> and <object> tags with the absolute path
        await this._processHtmlPageForTmplImg(rel, doc);

        // Get the head and body nodes
        const { head, body } = this._getHeadAndBody(doc);

        const removeNodes = (n: DefaultTreeAdapterMap['childNode']) => {
            const node = n as DefaultTreeAdapterMap['element'];
            if (node.tagName === 'link') {
                const { isValid } = isCssValidForProcessing({
                    node,
                    cfg: this.cfg,
                });
                return !isValid;
            } else if (node.tagName === 'script') {
                const { isValid } = isJsValidForProcessing({
                    node,
                    cfg: this.cfg,
                });
                return !isValid;
            }
            return true;
        };

        // remove the style and script tags from the body
        logger.debug(`total child nodes in head → ${head.childNodes.length}`);
        head.childNodes = head.childNodes.filter(removeNodes);
        logger.debug(
            `total child nodes in head after filtering → ${head.childNodes.length}`,
        );

        // remove the style and script tags from the body
        logger.debug(`total child nodes in body → ${body.childNodes.length}`);
        body.childNodes = body.childNodes.filter(removeNodes);
        logger.debug(
            `total child nodes in body after filtering → ${body.childNodes.length}`,
        );

        // Push the new style and script tags to the head and body
        head.childNodes.push(
            parseFragment(
                `<link rel="stylesheet" href="css/${CSS_BUNDLE_NAME}">`,
            ).childNodes[0] ??
                (() => {
                    throw new HTMLError('failed to parse link fragment');
                })(),
        );

        body.childNodes.push(
            parseFragment(`<script src="js/${JS_BUNDLE_NAME}" defer></script>`)
                .childNodes[0] ??
                (() => {
                    throw new HTMLError('failed to parse script fragment');
                })(),
        );

        // Serialize back to HTML string
        let outHtml = serialize(doc);
        logger.debug(`serializing HTML page → ${rel}`);
        logger.debug(
            `total child nodes after processing → ${doc.childNodes.length}`,
        );

        // apply onPreHtmlMinify hook
        logger.debug(`calling ${chalk.underline('pre-html-minify')} hook`);
        outHtml =
            (await this.plugins.callHook(
                'onPreHtmlMinify',
                this.cfg,
                outHtml,
            )) || outHtml;

        // HTML-minify with LRU cache
        const hash = createHash('md5').update(outHtml).digest('hex');
        let minifiedHtml = htmlCache.get(hash);
        logger.debug(`html hash → ${hash}`);

        // if not in cache, minify and store in cache
        if (!minifiedHtml) {
            logger.debug(`HTML page not found in cache → ${hash}`);
            logger.debug(`minifying HTML page using html-minifier...`);
            minifiedHtml = await limit(() => minifyHtml(outHtml));
            htmlCache.set(hash, minifiedHtml);
        } else {
            logger.debug(`HTML page found in cache → ${hash}`);
        }

        // Write to disk
        const dst = path.join(this.cfg.outDir, rel);
        logger.debug(
            `writing HTML page to disk → ${path.relative(process.cwd(), dst)}`,
        );

        ensureDir(path.dirname(dst));
        fs.writeFileSync(dst, minifiedHtml, 'utf8');
    }

    /**
     * Walk the HTML tree and find shared assets
     * @param relPage - the relative path of the page
     * @param node - the current node in the HTML document
     * @param parent - the parent node of the current node
     */
    private async _processHtmlPageForTmplImg(
        relPage: string,
        node: DefaultTreeAdapterMap['element'],
    ) {
        await walkHtmlTree(node, {
            defaultDescend: true,
            handlers: [
                {
                    match: MATCH_TEMPLATE_REGEX,
                    fns: [
                        (node, parent) => {
                            const m = MATCH_TEMPLATE_REGEX.exec(node.tagName);
                            if (!m || !m[1]) {
                                logger.debug(
                                    `could not find template tag for → ${chalk.underline(node.tagName)}`,
                                );
                                return;
                            }

                            const templateTagName = m[1];
                            const template = this.templates[templateTagName];

                            if (!template) {
                                logger.debug(
                                    `template not found → ${templateTagName}`,
                                );
                                return;
                            }

                            const attrStr =
                                (node.attrs || [])
                                    .map((a: any) => `${a.name}="${a.value}"`)
                                    .join(' ') || '';
                            const params = parseAttrs(attrStr);

                            // serialize any innerHTML
                            const innerHTML =
                                node.childNodes
                                    ?.map((c: any) => serialize(c))
                                    .join('') || '';

                            // perform {{children}} and {{param}} substitution
                            let inst = template.replace(
                                MATCH_CHILDREN_REGEX,
                                innerHTML,
                            );
                            for (const [k, v] of Object.entries(params)) {
                                const esc = v
                                    .replace(/&/g, '&amp;')
                                    .replace(/</g, '&lt;')
                                    .replace(/>/g, '&gt;');
                                inst = inst.replace(
                                    new RegExp(`\\{\\{${k}\\}\\}`, 'g'),
                                    esc,
                                );
                            }

                            // parse substituted HTML into a fragment
                            const fragment = parseFragment(inst);

                            // replace the <include-*> node in parent's childNodes
                            if (parent && parent.childNodes) {
                                parent.childNodes = parent.childNodes.flatMap(
                                    (c) =>
                                        c === node ? fragment.childNodes : c,
                                );
                            }

                            // record dependency for HMR/incremental
                            this.graph.deps.addDependency(
                                `page:${relPage}`,
                                `tmpl:${templateTagName}`,
                            );
                        },
                    ],
                },
                {
                    match: 'img',
                    descendChildren: false,
                    fns: [
                        (node) => {
                            const { isValid, value } = isImgValidForProcessing({
                                node,
                                cfg: this.cfg,
                            });
                            if (isValid && value) {
                                const { filePath } = formatImageName(
                                    this.cfg,
                                    value,
                                    relPage,
                                );
                                node.attrs = node.attrs.map((a: any) => {
                                    if (a.name === 'src') {
                                        a.value = filePath;
                                    }
                                    return a;
                                });
                            }
                        },
                    ],
                },
                {
                    match: 'object',
                    fns: [
                        (node) => {
                            const { isValid, value } =
                                isObjectValidForProcessing({
                                    node,
                                    cfg: this.cfg,
                                });
                            if (isValid && value) {
                                const { filePath } = formatImageName(
                                    this.cfg,
                                    value,
                                    relPage,
                                );
                                node.attrs = node.attrs.map((a: any) => {
                                    if (a.name === 'data') {
                                        a.value = filePath;
                                    }
                                    return a;
                                });
                            }
                        },
                    ],
                },
            ],
        });
    }

    /**
     * Get the head and body nodes from the document
     * @param doc the document to parse
     * @returns the head and body nodes
     * @throws HTMLError if the head or body node is not found
     * */
    private _getHeadAndBody(doc: DefaultTreeAdapterMap['element']) {
        let htmlNode = doc.childNodes.find((n: any) => n.tagName === 'html');

        if (!htmlNode) {
            throw new HTMLError('HTML node not found');
        }

        htmlNode = htmlNode as DefaultTreeAdapterMap['element'];

        // Find the head node
        const head = htmlNode.childNodes.find((n: any) => n.tagName === 'head');
        if (!head) {
            throw new HTMLError('head node not found');
        }

        // Find the body node
        const body = htmlNode.childNodes.find((n: any) => n.tagName === 'body');
        if (!body) {
            throw new HTMLError('body node not found');
        }

        return {
            head: head as DefaultTreeAdapterMap['element'],
            body: body as DefaultTreeAdapterMap['element'],
        };
    }

    /**
     * Incremental build: given an absolute file path,
     * re‐bundle CSS/JS or rebuild only affected pages
     */
    async incrementalBuild(absFile: string): Promise<string[]> {
        const node = this.graph.getNodeFromFilePath(absFile);
        if (!node) return [];
        const type = this.graph.getNodeType(node);
        const { sharedCssUri, sharedJsUri, sharedImgUri } =
            await this._getSharedAssetsUri();
        if (type === 'css') {
            await this._buildCss(sharedCssUri);
            return [];
        }
        if (type === 'js') {
            await this._buildJs(sharedJsUri);
            return [];
        }
        if (type === 'img') {
            await this._copyAssets(sharedImgUri);
            return [];
        }

        // page or template
        const rels =
            type === 'page'
                ? [path.relative(this.cfg.srcDir, absFile)]
                : this.graph
                      .getAffectedPages(node)
                      .map((n) => n?.split(':')[1] ?? '');

        for (const rel of rels) {
            if (rel) {
                await this._buildPage(rel);
            }
        }
        return rels.map((r) => `/${r}`);
    }
}

/**
 * Parse the attributes from a string
 * @param str the string to parse
 * @returns an object with the attributes
 */
const parseAttrs = (str: string): Record<string, string> => {
    const out: Record<string, string> = {};
    const re = /([\w-]+)\s*=\s*"([^"]*)"/g;
    let m: RegExpExecArray | null;
    while ((m = re.exec(str))) {
        if (m[1] !== undefined) {
            out[m[1]] = m[2] || '';
        }
    }
    return out;
};
