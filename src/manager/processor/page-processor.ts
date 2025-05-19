import { gatherHtmlPages } from '@/utils/glob.js';
import {
    AssetProcessor,
    type GetPages,
    type AssetNode,
    type AssetProcessorContext,
    type TemplatesAssetContext,
} from './processor.js';
import fs from 'fs';
import path from 'path';
import { logger } from '@/utils/logger.js';
import { minify as minifyHtml } from 'html-minifier-terser';
import {
    isCssValidForProcessing,
    isImgValidForProcessing,
    isJsValidForProcessing,
    isObjectValidForProcessing,
} from '@/utils/assets-detector.js';
import { walkHtmlTree } from '@/utils/html-walk.js';
import {
    type DefaultTreeAdapterMap,
    parse,
    parseFragment,
    serialize,
} from 'parse5';
import { LRUCache } from 'lru-cache';
import { fingerprint } from '@/utils/hasher.js';
import { limit, parseAttrs } from '@/utils/other.js';
import chalk from 'chalk';
import { ensureDir } from '@/utils/dir.js';
import {
    MATCH_CHILDREN_REGEX,
    MATCH_TEMPLATE_REGEX,
} from '@/utils/constants/regex.js';
import { preserveHtml } from '@/utils/html.js';
import { HTMLError } from '@/error/html-error.js';
import { CSS_BUNDLE_NAME, JS_BUNDLE_NAME } from '@/utils/constants/bundle.js';
import { type EmitterEventType } from '@/utils/types.js';

const _lruCache = new LRUCache<string, string>({ max: 100 });
type Element = DefaultTreeAdapterMap['element'];

export class PageProcessor extends AssetProcessor {
    _nodeType = 'page' as const;
    private externalCssUri = new Set<string>();
    private externalJsUri = new Set<string>();
    private externalImgUri = new Set<string>();

    /**
     * Initialize the page processor.
     * @param {AssetProcessorContext} ctx the context for the asset processor
     */
    async init(ctx: AssetProcessorContext) {
        const absFiles = await gatherHtmlPages(this._cfg);

        for (const absPath of absFiles) {
            ctx.addNode({
                type: this._nodeType,
                name: this.formatNodeName(absPath),
                absPath,
            });
        }
    }

    override async getAssets<T>(
        type: 'external' | 'local',
        pagesFn: GetPages,
    ): Promise<T> {
        if (type === 'local') {
            logger.error(
                `local assets are not supported for page processor. please use external assets.`,
            );
            return Promise.resolve({} as T);
        }
        const pages = await pagesFn();
        if (!pages || pages.length === 0) {
            logger.error(
                `no pages found in the config. please check your config file.`,
            );
            return Promise.resolve({} as T);
        }

        return {
            cssUris: Array.from(this.externalCssUri),
            jsUris: Array.from(this.externalJsUri),
            imgUris: Array.from(this.externalImgUri),
        } as T;
    }

    override patchNode(
        _ctx: AssetProcessorContext,
        absPath: string,
        _eventType: EmitterEventType,
    ): Promise<AssetNode> {
        return Promise.resolve({
            type: this._nodeType,
            name: this.formatNodeName(absPath),
            absPath,
        });
    }

    override async minify(
        bundle: string,
        _getAllPages: GetPages,
    ): Promise<string> {
        if (!this._cfg.html.minify) return bundle;

        // 1. Call the pre-bundle hook
        logger.debug(`calling ${chalk.underline('pre-html-minify')} hook`);
        bundle =
            (await this._pluginManager.callHook(
                'onPreHtmlMinify',
                this._cfg,
                bundle,
            )) || bundle;

        // 2. Check if the bundle is already cached
        const hash = await fingerprint(bundle);
        if (_lruCache.has(hash)) {
            logger.debug(`html found in cache → ${hash}`);
            return _lruCache.get(hash) as string;
        }

        // 2. Minify the bundle
        bundle = await limit(() =>
            minifyHtml(bundle, {
                removeAttributeQuotes: true,
                collapseInlineTagWhitespace: true,
                collapseWhitespace: true,
                conservativeCollapse: true,
                html5: true,
                noNewlinesBeforeTagClose: false,
                removeComments: true,
                removeEmptyAttributes: true,
                removeEmptyElements: true,
                removeOptionalTags: false,
                removeRedundantAttributes: true,
            }),
        );

        // 4. Cache the bundle
        _lruCache.set(hash, bundle);

        return bundle;
    }

    override async write(bundle: string, relPath?: string) {
        if (relPath == undefined) return;

        const dst = path.join(this._cfg.out_dir, relPath);
        logger.debug(
            `writing HTML page to disk → ${path.relative(process.cwd(), dst)}`,
        );

        ensureDir(path.dirname(dst));
        fs.writeFileSync(dst, bundle, 'utf8');
    }

    override async build(
        ctx: AssetProcessorContext & TemplatesAssetContext,
        relPath: string,
    ) {
        if (relPath === undefined || relPath.length == 0) return '';

        // 1. Read the HTML file
        const absPage = path.join(this._cfg.src_dir, relPath);
        const raw = fs.readFileSync(absPage, 'utf8');

        // Parse the HTML page as AST
        let doc = parse(raw) as unknown as DefaultTreeAdapterMap['element'];
        doc =
            (await this._pluginManager.callHook(
                'onPage',
                this._cfg,
                absPage,
                doc,
            )) || doc;

        // 2. Build the HTML page
        await this._buildFragment(ctx, doc, relPath);

        // 3. Format the HTML page
        const formattedHtml = await this._formatUri(doc, relPath);

        const bundle = await this.minify(formattedHtml, () =>
            Promise.resolve([]),
        );
        await this.write(bundle, relPath);
        return bundle;
    }

    async _buildFragment(
        ctx: AssetProcessorContext & TemplatesAssetContext,
        node: Element,
        relPage: string,
    ) {
        await walkHtmlTree(node, {
            defaultDescend: true,
            handlers: [
                {
                    match: MATCH_TEMPLATE_REGEX,
                    post: [
                        async (node, parent) => {
                            await this._buildTemplateFragment(
                                ctx,
                                node,
                                parent,
                                relPage,
                            );
                        },
                    ],
                },
                {
                    match: 'img',
                    descendChildren: false,
                    fns: [
                        (node, parent) => {
                            this._buildImgFragment(ctx, node, parent, relPage);
                        },
                    ],
                },
                {
                    match: 'object',
                    fns: [
                        (node, parent) => {
                            this._buildObjFragment(ctx, node, parent, relPage);
                        },
                    ],
                },
                {
                    match: 'link',
                    fns: [
                        (node, parent) => {
                            this._buildCssFragment(ctx, node, parent, relPage);
                        },
                    ],
                },
                {
                    match: 'script',
                    fns: [
                        (node, parent) => {
                            this._buildJsFragment(ctx, node, parent, relPage);
                        },
                    ],
                },
            ],
        });
    }

    /**
     * Build the image fragment by replacing the src attribute with the
     * formatted path.
     * @param node the node to process
     * @param relPage the relative page path
     */
    async _buildImgFragment(
        ctx: AssetProcessorContext,
        node: Element,
        _parent: Element | undefined,
        relPage: string,
    ) {
        {
            const { isValid, value } = isImgValidForProcessing({
                node,
                cfg: this._cfg,
                checkRemoteUri: false,
            });
            if (isValid) {
                const imgRelPath = path.resolve(this._cfg.src_dir, value);
                if (fs.existsSync(imgRelPath)) {
                    const imgNode = `img:${path.relative(this._cfg.src_dir, imgRelPath)}`;
                    ctx.addDependency(relPage, imgNode);
                }
            }
        }
        {
            const { isValid, value } = isImgValidForProcessing({
                node,
                cfg: this._cfg,
                checkLocalUri: false,
            });
            if (isValid) this.externalImgUri.add(value);
        }
    }

    /**
     * Build the object fragment by replacing the data attribute with the
     * formatted path.
     * @param node the node to process
     * @param relPage the relative page path
     */
    async _buildObjFragment(
        ctx: AssetProcessorContext,
        node: Element,
        _parent: Element | undefined,
        relPage: string,
    ) {
        {
            const { isValid, value } = isObjectValidForProcessing({
                node,
                cfg: this._cfg,
                checkRemoteUri: false,
            });
            if (isValid) {
                const objRelPath = path.resolve(this._cfg.src_dir, value);
                if (fs.existsSync(objRelPath)) {
                    const objNode = `img:${path.relative(this._cfg.src_dir, objRelPath)}`;
                    ctx.addDependency(relPage, objNode);
                }
            }
        }
        {
            const { isValid, value } = isObjectValidForProcessing({
                node,
                cfg: this._cfg,
                checkLocalUri: false,
            });
            if (isValid) this.externalImgUri.add(value);
        }
    }

    /**
     * Build the CSS fragment by replacing the href attribute with the
     * formatted path.
     * @param node the node to process
     * @param relPage the relative page path
     */
    async _buildCssFragment(
        ctx: AssetProcessorContext,
        node: Element,
        _parent: Element | undefined,
        relPage: string,
    ) {
        {
            const { isValid, value } = isCssValidForProcessing({
                node,
                cfg: this._cfg,
                checkLocalUri: false,
            });
            if (isValid) this.externalCssUri.add(value);
        }
        {
            const { isValid, value } = isCssValidForProcessing({
                node,
                cfg: this._cfg,
                checkRemoteUri: false,
            });
            if (isValid) {
                const absFile = path.resolve(this._cfg.src_dir, value);
                if (fs.existsSync(absFile)) {
                    const cssNode = `css:${path.relative(this._cfg.src_dir, absFile)}`;
                    ctx.addDependency(relPage, cssNode);
                }
            }
        }
    }

    /**
     * Build the JS fragment by replacing the src attribute with the
     * formatted path.
     * @param node the node to process
     * @param relPage the relative page path
     */
    async _buildJsFragment(
        ctx: AssetProcessorContext,
        node: Element,
        _parent: Element | undefined,
        relPage: string,
    ) {
        {
            const { isValid, value } = isJsValidForProcessing({
                node,
                cfg: this._cfg,
                checkLocalUri: false,
            });
            if (isValid) this.externalJsUri.add(value);
        }
        {
            const { isValid, value } = isJsValidForProcessing({
                node,
                cfg: this._cfg,
                checkRemoteUri: false,
            });
            if (isValid) {
                const absFile = path.resolve(this._cfg.src_dir, value);
                if (fs.existsSync(absFile)) {
                    const jsNode = `js:${path.relative(this._cfg.src_dir, absFile)}`;
                    ctx.addDependency(relPage, jsNode);
                }
            }
        }
    }

    /**
     * Build the template fragment by replacing the src attribute with the
     * formatted path.
     * @param node the node to process
     * @param relPage the relative page path
     */
    async _buildTemplateFragment(
        ctx: AssetProcessorContext & TemplatesAssetContext,
        node: Element,
        parent: Element | undefined,
        relPage: string,
    ) {
        {
            const m = MATCH_TEMPLATE_REGEX.exec(node.tagName);
            if (!m || !m[1]) {
                logger.debug(
                    `could not find template tag for → ${chalk.underline(node.tagName)}`,
                );
                return;
            }

            const templateTagName = m[1];

            const template = (
                await ctx.getTemplates<Map<string, string>>('external', () =>
                    Promise.resolve([]),
                )
            ).get(templateTagName);

            if (!template) {
                logger.debug(`template not found → ${templateTagName}`);
                return;
            }

            const attrStr =
                (node.attrs || [])
                    .map((a: any) => `${a.name}="${a.value}"`)
                    .join(' ') || '';
            const params = parseAttrs(attrStr);

            // serialize any innerHTML
            // create empty div and append child nodes
            const div = parseFragment('<div></div>');
            div.childNodes = node.childNodes || [];

            const innerHTML = serialize(div) || '';

            // perform {{children}} and {{param}} substitution
            let inst = template.replace(MATCH_CHILDREN_REGEX, innerHTML);

            for (const [k, v] of Object.entries(params)) {
                const rendered = preserveHtml(v);
                inst = inst.replace(
                    new RegExp(`\\{\\{${k}\\}\\}`, 'g'),
                    rendered,
                );
            }

            // parse substituted HTML into a fragment
            const fragment = parseFragment(inst);

            // replace the <include-*> node in parent's childNodes
            if (parent && parent.childNodes) {
                parent.childNodes = parent.childNodes.flatMap((c) =>
                    c === node ? fragment.childNodes : c,
                );
            }

            ctx.addDependency(relPage, templateTagName);
        }
    }

    /**
     * Format the HTML page by removing all nodes that are not valid for
     * processing and adding the CSS and JS bundles.
     * @param doc the HTML document to process
     * @param rel the relative path of the HTML page
     */
    private async _formatUri(doc: Element, rel: string) {
        // 1. Find head and body nodes
        let htmlNode = doc.childNodes.find((n: any) => n.tagName === 'html');

        if (!htmlNode) {
            throw new HTMLError('HTML node not found');
        }

        htmlNode = htmlNode as DefaultTreeAdapterMap['element'];

        // Find the head node
        let head = htmlNode.childNodes.find((n: any) => n.tagName === 'head');
        if (!head) {
            throw new HTMLError('head node not found');
        }

        // Find the body node
        let body = htmlNode.childNodes.find((n: any) => n.tagName === 'body');
        if (!body) {
            throw new HTMLError('body node not found');
        }

        // 2. Remove all nodes that are not valid for processing
        const removeNodes = (n: DefaultTreeAdapterMap['childNode']) => {
            const node = n as DefaultTreeAdapterMap['element'];
            if (node.tagName === 'link') {
                const { isValid } = isCssValidForProcessing({
                    node,
                    cfg: this._cfg,
                });
                return !isValid;
            } else if (node.tagName === 'script') {
                const { isValid } = isJsValidForProcessing({
                    node,
                    cfg: this._cfg,
                });
                return !isValid;
            }
            return true;
        };

        head = head as Element;
        body = body as Element;

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

        return outHtml;
    }
}
