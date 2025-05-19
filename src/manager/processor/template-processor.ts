import { gatherTemplateFiles } from '@/utils/glob.js';
import {
    AssetProcessor,
    type AssetNode,
    type AssetProcessorContext,
} from './processor.js';
import path from 'path';
import MarkdownIt from 'markdown-it';
import fs from 'fs';
import { logger } from '@/utils/logger.js';
import { type DefaultTreeAdapterMap, parseFragment, serialize } from 'parse5';
import {
    MATCH_CHILDREN_REGEX,
    MATCH_TEMPLATE_REGEX,
} from '@/utils/constants/regex.js';
import { walkHtmlTree } from '@/utils/html-walk.js';
import chalk from 'chalk';
import { preserveHtml } from '@/utils/html.js';
import { appendPath, parseAttrs } from '@/utils/other.js';
import { type EmitterEventType } from '@/utils/types.js';

type Element = DefaultTreeAdapterMap['element'];
type ElementNode = DefaultTreeAdapterMap['node'];

interface TemplateListing {
    name: string;
    isDirectory: boolean;
}

export class TemplateProcessor extends AssetProcessor {
    _nodeType = 'tmpl' as const;
    private _tmplNameToAbsPath: Map<string, string> = new Map();
    private _inDegree: Map<string, number> = new Map();
    private _templates: Map<string, string> = new Map();

    async init(ctx: AssetProcessorContext) {
        const absFiles = await gatherTemplateFiles(this._cfg);

        // if the template dir is set, we need to read the listing.json file
        if (
            this._cfg.templates?.shared_uri &&
            this._cfg.templates?.shared_uri.length !== 0
        ) {
            for (const uri of this._cfg.templates.shared_uri) {
                const listings = appendPath(uri, 'listing.json');
                let listing: string | undefined;
                try {
                    listing = await this._cache.fetch(listings);
                    // eslint-disable-next-line @typescript-eslint/no-unused-vars
                } catch (_e) {
                    logger.error(
                        `failed to fetch listing.json from ${listings}`,
                    );
                }
                if (listing) {
                    const listingData = JSON.parse(
                        listing,
                    ) as TemplateListing[];
                    for (const { isDirectory, name } of listingData) {
                        if (isDirectory) continue;

                        const url = appendPath(uri, name);
                        absFiles.push(url);
                    }
                }
            }
        }

        for (const absPath of absFiles) {
            const node = {
                type: this._nodeType,
                name: this.formatNodeName(absPath),
                absPath,
            } as AssetNode;
            ctx.addNode(node);

            // build the template
            // does prechecking for the template path
            // calulates the dependencies
            // and adds the node to the graph
            this._tmplNameToAbsPath.set(node.name, absPath);
            await this._parseAndIndex(ctx, node);
        }
        await this._expandAll(ctx);
    }

    override async patchNode(
        ctx: AssetProcessorContext,
        absPath: string,
        _eventType: EmitterEventType,
    ) {
        logger.debug(`patching node ${absPath} with event type ${_eventType}`);
        if (_eventType === 'unlink') {
            const nodeName = this.formatNodeName(absPath);
            // 1) Remove from our own maps
            this._templates.delete(nodeName);
            this._inDegree.delete(nodeName);
            this._tmplNameToAbsPath.delete(nodeName);

            // 2) For every template that depended on this one,
            //    remove the edge and decrement its in-degree
            const dependents = ctx.getDependents(nodeName);
            for (const dep of dependents) {
                // fix up our own in-degree map
                const old = this._inDegree.get(dep) ?? 0;
                this._inDegree.set(dep, Math.max(0, old - 1));
            }

            // 3) Incrementally re-expand the dependents (and downstream)
            for (const dep of dependents) {
                this._expandFrom(ctx, dep);
            }

            return Promise.resolve({
                type: this._nodeType,
                name: nodeName,
                absPath,
            } as AssetNode);
        } else if (_eventType === 'addDir') {
            return Promise.resolve({
                type: this._nodeType,
                name: this.formatNodeName(absPath),
                absPath,
            } as AssetNode);
        }
        const node: AssetNode = {
            type: this._nodeType,
            name: this.formatNodeName(absPath),
            absPath,
        };
        ctx.addNode(node);
        this._tmplNameToAbsPath.set(node.name, absPath);
        await this._parseAndIndex(ctx, node, true);
        await this._expandFrom(ctx, node.name);
        return node;
    }

    /**
     * Expand all nodes in the graph.
     * @param ctx the context for the asset processor
     */
    private async _expandAll(ctx: AssetProcessorContext) {
        const inDeg = new Map(this._inDegree);
        const q: string[] = [];

        for (const [node, deg] of inDeg.entries()) if (deg === 0) q.push(node);

        while (q.length) {
            const name = q.shift()!;

            await this._expandOne(ctx, name);

            for (const dep of ctx.getDependents(name)) {
                if (dep.endsWith('.html')) continue;
                const newDegree = inDeg.get(dep)! - 1;
                inDeg.set(dep, newDegree);
                if (newDegree === 0) q.push(dep);
            }
        }

        // cycle check
        const remaining = [...inDeg.entries()]
            .filter(([, d]) => d > 0)
            .map(([n]) => n);

        if (remaining.length) {
            logger.error(
                `seems like you have a cycle in your templates → ${remaining.join(', ')}`,
            );
        }
    }

    /**
     * Expand a node in the graph with it dependents.
     * @param ctx the context for the asset processor
     * @param name the name of the node to expand
     */
    private async _expandOne(_ctx: AssetProcessorContext, name: string) {
        const template = this._templates.get(name);
        if (!template) {
            logger.debug(`template ${name} not found while expanding`);
            return;
        }

        const node = parseFragment(template) as Element;
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
                            const template =
                                this._templates.get(templateTagName);

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
                            // create empty div and append child nodes
                            const div = parseFragment('<div></div>');
                            div.childNodes = node.childNodes || [];

                            const innerHTML = serialize(div) || '';

                            // perform {{children}} and {{param}} substitution
                            let inst = template.replace(
                                MATCH_CHILDREN_REGEX,
                                innerHTML,
                            );

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
                                parent.childNodes = parent.childNodes.flatMap(
                                    (c) =>
                                        c === node ? fragment.childNodes : c,
                                );
                            }
                        },
                    ],
                },
            ],
        });

        this._templates.set(name, serialize(node) || '');
    }

    /**
     * Expand a node & its dependents in the graph.
     * @param ctx the context for the asset processor
     * @param name the name of the node to expand
     */
    private async _expandFrom(ctx: AssetProcessorContext, startNode: string) {
        const affected = new Set<string>();
        const stack = [startNode];

        // traverse the graph and expand all dependents
        while (stack.length) {
            const cur = stack.pop()!;
            if (affected.has(cur)) continue;
            affected.add(cur);
            for (const d of ctx.getDependents(cur)) {
                if (d.endsWith('.html')) continue;
                stack.push(d);
            }
        }

        // build local indegree
        const localInDeg = new Map<string, number>();
        for (const n of affected) {
            const deps = ctx.getDependencies(n);
            localInDeg.set(n, deps.filter((d) => affected.has(d)).length);
        }

        // find all nodes with in-degree of 0
        const q: string[] = [];
        for (const [n, d] of localInDeg.entries()) {
            if (d === 0) q.push(n);
        }

        const processed: string[] = [];
        while (q.length) {
            const name = q.shift()!;
            processed.push(name);

            // read the template file again
            const { data } = await this._readFile(
                this._tmplNameToAbsPath.get(name)!,
            );
            this._templates.set(name, data);

            // expand the node
            await this._expandOne(ctx, name);
            for (const dep of ctx.getDependents(name)) {
                if (dep.endsWith('.html')) continue;
                if (!affected.has(dep)) continue;

                const newInDeg = (localInDeg.get(dep) ?? 0) - 1;
                localInDeg.set(dep, newInDeg);

                if (newInDeg === 0) q.push(dep);
            }
        }

        // cycle detection
        const remaining = [...localInDeg.entries()]
            .filter(([, d]) => d > 0)
            .map(([n]) => n);
        if (remaining.length) {
            logger.error(
                `seems like you have a cycle in your templates → ${remaining.join(
                    ', ',
                )}`,
            );
        }
    }

    /**
     * Parse and index a template node.
     * @param ctx the context for the asset processor
     * @param node the template node
     * @param force whether to force the parsing
     * @returns void
     */
    private async _parseAndIndex(
        ctx: AssetProcessorContext,
        node: AssetNode,
        force = false,
    ) {
        const isSharedUri = this._cfg.templates?.shared_uri?.some((uri) =>
            node.absPath.startsWith(uri),
        );
        if (
            !this._cfg.templates?.dir ||
            (!node.absPath.startsWith(
                path.join(this._cfg.src_dir, this._cfg.templates?.dir),
            ) &&
                !isSharedUri)
        ) {
            if (!force) {
                logger.debug(
                    `skipping template node ${node.absPath} as it is not in the templates directory`,
                );
                return;
            }
        }

        // parse the template file
        const { node: dom, data } = await this._readFile(node.absPath);

        // set the template
        this._templates.set(node.name, data);

        // clear the in-degree
        this._inDegree.delete(node.name);

        let count = 0;

        /**
         * Walk through the template nodes.
         * @param el the element node
         */
        const walk = (el: ElementNode) => {
            if ('tagName' in el && MATCH_TEMPLATE_REGEX.test(el.tagName)) {
                const dep = RegExp.$1;
                ctx.addDependency(node.name, dep);
                count++;
            }
            if ('childNodes' in el) {
                for (const c of el.childNodes) walk(c);
            }
        };

        walk(dom);
        this._inDegree.set(node.name, count);
    }

    /**
     * Read a template file and return the parsed template.
     * @param absPath absolute path to the template file
     * @returns the parsed template file
     */
    private async _readFile(absPath: string) {
        const mdHandler = new MarkdownIt();
        let tmpl = '';
        if (absPath.startsWith('http') || absPath.startsWith('https')) {
            tmpl = await this._cache.fetch(absPath);
        } else {
            tmpl = fs.readFileSync(absPath, 'utf-8');
        }

        if (!tmpl) {
            logger.warn(`template file ${path.basename(absPath)} is empty`);
            return {
                node: parseFragment('') as Element,
                data: '',
            };
        }

        if (absPath.endsWith('.md')) tmpl = mdHandler.render(tmpl);

        return {
            node: parseFragment(tmpl) as Element,
            data: tmpl,
        };
    }

    override async getAssets<T>(
        _type: 'external' | 'local',
        _get: () => Promise<string[]>,
    ): Promise<T> {
        return this._templates as unknown as T;
    }

    override async minify(
        _data: string,
        _get: () => Promise<string[]>,
    ): Promise<string> {
        return '';
    }

    override async write(_bundle: string): Promise<void> {
        return;
    }
}
