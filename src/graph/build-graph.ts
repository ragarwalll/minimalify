import path from 'path';
import fs from 'fs';
import { type MinimalifyConfig } from '@/config/struct.js';
import { DependencyGraph } from './dependency-graph.js';
import {
    gatherCssFiles,
    gatherHtmlPages,
    gatherImgFiles,
    gatherJsFiles,
    gatherTemplateFiles,
} from '@/utils/glob.js';
import { type DefaultTreeAdapterMap, parse } from 'parse5';
import {
    isCssValidForProcessing,
    isImgValidForProcessing,
    isJsValidForProcessing,
    isObjectValidForProcessing,
} from '@/utils/assets-detector.js';
import { walkHtmlTree } from '@/utils/html-walk.js';
import { MATCH_TEMPLATE_REGEX } from '@/utils/constants/regex.js';

export type NodeType = 'css' | 'js' | 'tmpl' | 'page' | 'img';
const regexCheckTemplatesDir = /\.(html|md)$/;

/**
 * BuildGraph builds a DAG of dependencies:
 *   page:xxx → css:yyy, js:zzz, tmpl:aaa, img:bbb
 */
export class BuildGraph {
    public deps = new DependencyGraph();
    private fileToNode = new Map<string, string>();
    private nodeType = new Map<string, NodeType>();
    private config: MinimalifyConfig;

    /**
     * @param cfg  the configuration object
     */
    constructor(cfg: MinimalifyConfig) {
        this.config = cfg;
    }

    async init() {
        // 1. User Templates
        await this._buildTemplateNodes();

        // 2. User CSS
        await this._buildCssNodes();

        // 3. User JS
        await this._buildJsNodes();

        // 4. User Images
        await this._buildImgNodes();

        // 5. User HTML
        await this._buildPageNodes();
    }

    /**
     * Build the template nodes.
     */
    private async _buildTemplateNodes() {
        const localTemplatesFiles = await gatherTemplateFiles(this.config);

        for (const templateFilePath of localTemplatesFiles) {
            if (!regexCheckTemplatesDir.test(templateFilePath)) continue;

            const rel = path.relative(
                this.config.srcDir,
                templateFilePath.replace(regexCheckTemplatesDir, ''),
            );
            const node = `tmpl:${rel}`;

            this.fileToNode.set(templateFilePath, node);
            this.nodeType.set(node, 'tmpl');
        }
    }

    /**
     * Build the CSS nodes.
     */
    private async _buildCssNodes() {
        const localCssFiles = await gatherCssFiles(this.config);

        for (const cssFilePath of localCssFiles) {
            const rel = path.relative(this.config.srcDir, cssFilePath);
            const node = `css:${rel}`;

            this.fileToNode.set(cssFilePath, node);
            this.nodeType.set(node, 'css');
        }
    }

    /**
     * Build the JavaScript nodes.
     */
    private async _buildJsNodes() {
        const localJsFiles = await gatherJsFiles(this.config);

        for (const jsFilePath of localJsFiles) {
            const rel = path.relative(this.config.srcDir, jsFilePath);
            const node = `js:${rel}`;

            this.fileToNode.set(jsFilePath, node);
            this.nodeType.set(node, 'js');
        }
    }

    /**
     * Build the image nodes.
     */
    private async _buildImgNodes() {
        const localImgFiles = await gatherImgFiles(this.config);

        for (const imgFilePath of localImgFiles) {
            const rel = path.relative(this.config.srcDir, imgFilePath);
            const node = `img:${rel}`;

            this.fileToNode.set(imgFilePath, node);
            this.nodeType.set(node, 'img');
        }
    }

    /**
     * Build the page nodes and scan for dependencies.
     */
    private async _buildPageNodes() {
        const localHtmlFiles = await gatherHtmlPages(this.config);

        for (const htmlFilePath of localHtmlFiles) {
            const rel = path.relative(this.config.srcDir, htmlFilePath);
            const node = `page:${rel}`;

            this.fileToNode.set(htmlFilePath, node);
            this.nodeType.set(node, 'page');

            const raw = fs.readFileSync(htmlFilePath, 'utf-8');
            const doc = parse(
                raw,
            ) as unknown as DefaultTreeAdapterMap['element'];

            await this._scanDeps(doc, htmlFilePath);
        }
    }

    /**
     * Scan the HTML document for dependencies.
     * @param node the current node in the HTML document
     * @param htmlFilePath the file path of the HTML document
     */
    private async _scanDeps(
        node: DefaultTreeAdapterMap['element'],
        htmlFilePath: string,
    ) {
        const relPath = path.relative(this.config.srcDir, htmlFilePath);
        const pageNode = `page:${relPath}`;

        await walkHtmlTree(node, {
            defaultDescend: true,
            handlers: [
                {
                    match: 'script',
                    fns: [
                        (node) => {
                            const { isValid, value } = isJsValidForProcessing({
                                node,
                                cfg: this.config,
                                checkRemoteUri: false,
                            });
                            if (isValid) {
                                const jsRelPath = path.resolve(
                                    this.config.srcDir,
                                    value,
                                );
                                if (fs.existsSync(jsRelPath)) {
                                    const jsNode = `js:${path.relative(this.config.srcDir, jsRelPath)}`;
                                    this.deps.addDependency(pageNode, jsNode);
                                }
                            }
                        },
                    ],
                },
                {
                    match: 'link',
                    fns: [
                        (node) => {
                            const { isValid, value } = isCssValidForProcessing({
                                node,
                                cfg: this.config,
                                checkRemoteUri: false,
                            });
                            if (isValid) {
                                const cssRelPath = path.resolve(
                                    this.config.srcDir,
                                    value,
                                );
                                if (fs.existsSync(cssRelPath)) {
                                    const cssNode = `css:${path.relative(this.config.srcDir, cssRelPath)}`;
                                    this.deps.addDependency(pageNode, cssNode);
                                }
                            }
                        },
                    ],
                },
                {
                    match: 'img',
                    fns: [
                        (node) => {
                            const { isValid, value } = isImgValidForProcessing({
                                node,
                                cfg: this.config,
                                checkRemoteUri: false,
                            });
                            if (isValid) {
                                const imgRelPath = path.resolve(
                                    this.config.srcDir,
                                    value,
                                );
                                if (fs.existsSync(imgRelPath)) {
                                    const imgNode = `img:${path.relative(this.config.srcDir, imgRelPath)}`;
                                    this.deps.addDependency(pageNode, imgNode);
                                }
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
                                    cfg: this.config,
                                    checkRemoteUri: false,
                                });
                            if (isValid) {
                                const objectRelPath = path.resolve(
                                    this.config.srcDir,
                                    value,
                                );
                                if (fs.existsSync(objectRelPath)) {
                                    const objectNode = `img:${path.relative(this.config.srcDir, objectRelPath)}`;
                                    this.deps.addDependency(
                                        pageNode,
                                        objectNode,
                                    );
                                }
                            }
                        },
                    ],
                },
                {
                    match: MATCH_TEMPLATE_REGEX,
                    fns: [
                        (node) => {
                            const m = MATCH_TEMPLATE_REGEX.exec(node.tagName);
                            if (m) {
                                const tplNode = `tmpl:${m[1]}`;
                                this.deps.addDependency(pageNode, tplNode);
                            }
                        },
                    ],
                },
            ],
        });
    }

    /**
     * Get the node associated with a file path.
     * @param filePath the file path to check
     * @returns the node associated with the file path, or undefined if not found
     */
    getNodeFromFilePath(filePath: string) {
        return this.fileToNode.get(filePath);
    }

    /**
     * Get the type of a node.
     * @param node the node to check
     * @returns the type of the node, or undefined if not found
     */
    getNodeType(node: string) {
        return this.nodeType.get(node);
    }

    /**
     * Get the dependencies of a node.
     * @param node the node to check
     * @returns an array of dependencies for the node
     */
    getAllPages() {
        const pages = new Set<string>();
        for (const [_, node] of this.fileToNode.entries()) {
            const [type, relPath] = node.split(':');
            if (type == undefined) continue;
            if (relPath == undefined) continue;
            if (type === 'page') pages.add(relPath);
        }
        return Array.from(pages);
    }

    /**
     * Get the affected pages for a node.
     * @param node the node to check
     * @returns an array of affected pages for the node
     */
    getAffectedPages(node: string) {
        const affectedPages = Array.from(this.deps.getAffectedPages(node));
        return affectedPages
            .filter((page) => {
                const nodeType = this.getNodeType(page);
                return nodeType === 'page';
            })
            .map((page) => {
                const filePath = this.getNodeFromFilePath(page);
                return filePath;
            });
    }

    /**
     * Get the size of a subtree.
     * @param node the node to check
     * @param seen a set of seen nodes
     * @returns the size of the subtree
     */
    subtreeSize(node: string, seen = new Set<string>()): number {
        if (seen.has(node)) return 0;
        seen.add(node);
        let size = 1;
        for (const dep of this.deps.getDependencies(node) || []) {
            size += this.subtreeSize(dep, seen);
        }
        return size;
    }
}
