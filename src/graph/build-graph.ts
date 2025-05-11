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
            const templateName = templateFilePath.replace(
                regexCheckTemplatesDir,
                '',
            );
            const node = `tmpl:${templateName}`;
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
            this._scanDeps(doc, htmlFilePath);
        }
    }

    /**
     * Scan the HTML document for dependencies.
     * @param node the current node in the HTML document
     * @param htmlFilePath the file path of the HTML document
     */
    private _scanDeps(
        node: DefaultTreeAdapterMap['element'],
        htmlFilePath: string,
    ) {
        if (!node) return;
        if (node.tagName) {
            const relPath = path.relative(this.config.srcDir, htmlFilePath);
            const pageNode = `page:${relPath}`;

            // Scan for <link> tags
            if (node.tagName === 'link') {
                const rel = node.attrs.find(
                    (a: any) => a.name === 'rel',
                )?.value;
                const href = node.attrs.find(
                    (a: any) => a.name === 'href',
                )?.value;
                if (rel === 'stylesheet' && href && !/^https?:/.test(href)) {
                    const abs = path.resolve(this.config.srcDir, href);
                    if (fs.existsSync(abs)) {
                        const cssNode = `css:${path.relative(this.config.srcDir, abs)}`;
                        this.deps.addDependency(pageNode, cssNode);
                    }
                }
            }

            // Scan for <script> tags
            if (node.tagName === 'script') {
                const src = node.attrs.find(
                    (a: any) => a.name === 'src',
                )?.value;
                if (src && !/^https?:/.test(src)) {
                    const abs = path.resolve(this.config.srcDir, src);
                    if (fs.existsSync(abs)) {
                        const jsNode = `js:${path.relative(this.config.srcDir, abs)}`;
                        this.deps.addDependency(pageNode, jsNode);
                    }
                }
            }

            // Scan for <img> tags
            if (node.tagName === 'img') {
                const src = node.attrs.find(
                    (a: any) => a.name === 'src',
                )?.value;
                if (src && !/^https?:/.test(src)) {
                    const abs = path.resolve(this.config.srcDir, src);
                    if (fs.existsSync(abs)) {
                        const imgNode = `img:${path.relative(this.config.srcDir, abs)}`;
                        this.deps.addDependency(pageNode, imgNode);
                    }
                }
            }

            // Scan for <template> tags
            const m = /^include-(.+)$/.exec(node.tagName);
            if (m) {
                const tplNode = `tmpl:${m[1]}`;
                this.deps.addDependency(pageNode, tplNode);
            }
        }
        node.childNodes?.forEach((c: any) => this._scanDeps(c, htmlFilePath));
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
            if (this.getNodeType(node) === 'page') {
                pages.add(node.split(':')[1] ?? '');
            }
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
