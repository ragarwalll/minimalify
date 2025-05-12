import { gatherTemplateFiles } from '@/utils/glob.js';
import {
    AssetProcessor,
    type AssetNode,
    type AssetProcessorContext,
} from './processor.js';
import path from 'path';
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
import { parseAttrs } from '@/utils/other.js';

type Element = DefaultTreeAdapterMap['element'];
type ElementNode = DefaultTreeAdapterMap['node'];

export class TemplateProcessor extends AssetProcessor {
    _nodeType = 'tmpl' as const;
    private _inDegree: Map<string, number> = new Map();
    private _templates: Map<string, string> = new Map();

    async init(ctx: AssetProcessorContext) {
        const absFiles = await gatherTemplateFiles(this._cfg);

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
            this._parseAndIndex(ctx, node);
        }
        await this._expandAll(ctx);
    }

    override async addAssetNode(ctx: AssetProcessorContext, absPath: string) {
        const node: AssetNode = {
            type: this._nodeType,
            name: this.formatNodeName(absPath),
            absPath,
        };
        ctx.addNode(node);
        this._parseAndIndex(ctx, node);
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
     * @returns void
     */
    private _parseAndIndex(ctx: AssetProcessorContext, node: AssetNode) {
        if (
            !this._cfg.templatesDir ||
            !node.absPath.startsWith(
                path.join(this._cfg.srcDir, this._cfg.templatesDir),
            )
        ) {
            return;
        }

        // parse the template file
        const { node: dom, data } = this._readFile(node.absPath);

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
    private _readFile(absPath: string) {
        const tmpl = fs.readFileSync(absPath, 'utf-8');
        if (!tmpl) {
            logger.warn(`template file ${path.basename(absPath)} is empty`);
            return {
                node: parseFragment('') as Element,
                data: '',
            };
        }

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
