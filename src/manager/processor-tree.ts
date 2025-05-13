import { type MinimalifyConfig } from '@/config/struct.js';
import { DependencyGraph } from './dependency-graph.js';
import {
    type AssetProcessor,
    type NodeType,
    type AssetProcessorContext,
    type AssetNode,
} from './processor/processor.js';
import { logger } from '@/utils/logger.js';
import path from 'path';
import { type EmitterEventType } from '@/utils/types.js';

/**
 * BuildGraph builds a DAG of dependencies:
 *   page:xxx → css:yyy, js:zzz, tmpl:aaa, img:bbb
 */
export class ProcessorTree {
    // stores the dependency graph
    private deps = new DependencyGraph();

    // stores the node names for each node
    private absPathToNode = new Map<string, AssetNode>();

    // stores the node names for each node
    private assetNameToNode = new Map<string, AssetNode>();

    // minimalify config object
    private config: MinimalifyConfig;

    // stores the asset processors for each node type
    private assetProcessor = new Map<NodeType, AssetProcessor>();

    public ctx: AssetProcessorContext = {
        addNode: ({ name, absPath, type }) => {
            // check if the node already exists
            if (this.absPathToNode.has(absPath)) {
                logger.debug(`node ${name} already exists, skipping`);
                return;
            }

            // add the node to the graph
            const node = { name, type, absPath };
            this.absPathToNode.set(absPath, node);
            this.assetNameToNode.set(name, node);
            logger.debug(`added node ${name} of type ${type}`);
        },

        addDependency: (from, to) => {
            this.deps.addDependency(from, to);
        },

        getDependencies: (node) => {
            return Array.from(this.deps.getDependencies(node) || []);
        },

        getDependents: (node) => {
            return Array.from(this.deps.getDependents(node) || []);
        },

        getNodeByName: (name) => {
            return this.assetNameToNode.get(name);
        },

        getNodeByAbsPath: (absPath) => {
            return this.absPathToNode.get(absPath);
        },
    };

    /**
     * ProcessorTree constructor
     * @param {MinimalifyConfig} config the minimalify config object
     */
    constructor(config: MinimalifyConfig) {
        this.config = config;
    }

    /**
     * Register a new processor for a specific node type.
     * @param {NodeType} type the type of the node
     * @param {AssetProcessor} processor the asset processor
     */
    registerProcessor(type: NodeType, processor: AssetProcessor) {
        if (this.assetProcessor.has(type))
            logger.debug(`processor for ${type} already registered, skipping`);

        this.assetProcessor.set(type, processor);
        logger.debug(`registered processor for ${type}`);
    }

    /**
     * Start the processing of the asset tree.
     */
    async init() {
        await Promise.all(
            Array.from(this.assetProcessor.entries()).map(
                async ([type, processor]) => {
                    logger.debug(`initializing processor for ${type}`);
                    await processor.init(this.ctx);
                },
            ),
        );
    }

    /**
     * Get the node of a file.
     * @param filePath the absolute path of the file
     * @returns the node of the file
     */
    getNode(filePath: string): AssetNode | undefined {
        return this.absPathToNode.get(filePath);
    }

    /**
     * Get a node or create a new one if it doesn't exist.
     * @param filePath the absolute path of the file
     * @param eventType the type of the event
     * @returns the node of the file
     */
    async patchNode(filePath: string, eventType: EmitterEventType) {
        const { ext } = ProcessorTree.parseAbsPath({
            cfg: this.config,
            absPath: filePath,
        });

        const processor = this.assetProcessor.get(ext);
        if (processor === undefined) {
            console.debug(`processor for ${ext} not found while patching`);
            return undefined;
        }
        return await processor.patchNode(this.ctx, filePath, eventType);
    }

    /**
     * Parse the absolute path of a file.
     * @param param0 the parameters
     * @param param0.cfg the minimalify config object
     * @param param0.absPath the absolute path of the file
     * @returns the parsed absolute path
     */
    static parseAbsPath({
        cfg,
        absPath,
    }: {
        cfg: MinimalifyConfig;
        absPath: string;
    }) {
        if (
            cfg.templatesDir !== undefined &&
            absPath.startsWith(path.join(cfg.srcDir, cfg.templatesDir))
        ) {
            const templateDir = path.join(cfg.srcDir, cfg.templatesDir);
            return {
                ext: 'tmpl' as NodeType,
                relPath: path.relative(templateDir, absPath),
            };
        }

        const ext = path.extname(absPath).substring(1);
        const relPath = path.relative(cfg.srcDir, absPath);
        return {
            ext: ext === 'html' ? 'page' : (ext as NodeType),
            relPath,
        };
    }

    /**
     * Get all pages in the graph.
     * @returns the html pages in the graph
     */
    async getAllPages() {
        const pages = new Set<string>();
        for (const [, { type, name }] of this.absPathToNode?.entries()) {
            if (type === 'page') {
                pages.add(name);
            }
        }
        return Array.from(pages);
    }

    /**
     * Get all stale nodes in the graph for a given node.
     * @param nodeName the name of the node
     * @param filter the filter to apply
     * @returns the stale nodes in the graph
     */
    getStaleNodes(nodeName: string, filter: NodeType = 'page') {
        return this.deps
            .getStaleNodes(nodeName)
            .filter((node) => this.assetNameToNode.get(node)?.type === filter);
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
        for (const dep of this.deps.getDependencies(node) || [])
            size += this.subtreeSize(dep, seen);
        return size;
    }
}
