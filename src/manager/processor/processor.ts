import path from 'path';
import { type MinimalifyConfig } from '@/config/struct.js';
import { type ProcessorTree } from '../processor-tree.js';
import { type HTTPCache } from '@/cache-manager/http-cache.js';
import { type MinimalifyPluginManager } from '@/plugins/manager.js';
import { type EmitterEventType } from '@/utils/types.js';

// Supported node types for the processor tree
export const supportedNodeTypes = ['css', 'js', 'tmpl', 'page', 'img'] as const;
export type NodeType = (typeof supportedNodeTypes)[number];

export interface AssetNode {
    type: NodeType;
    name: string;
    absPath: string;
}

/**
 * Abstract class for asset processors.
 * It defines the interface for processing assets of a specific type.
 * Each asset processor should extend this class and implement the required methods.
 */
export abstract class AssetProcessor {
    abstract _nodeType: NodeType;
    protected _cfg: MinimalifyConfig;
    protected _cache: HTTPCache;
    protected _pluginManager: MinimalifyPluginManager;

    constructor(
        config: MinimalifyConfig,
        cache: HTTPCache,
        plugins: MinimalifyPluginManager,
    ) {
        this._pluginManager = plugins;
        this._cache = cache;
        this._cfg = config;
    }
    /**
     * The asset processor is responsible for processing assets of a specific type.
     * @param {AssetProcessorContext} ctx the context for the asset processor
     */
    abstract init(ctx: AssetProcessorContext): Promise<void>;

    /**
     * Add an asset node to the processor.
     * @param ctx the context for the asset processor
     * @param absPath the absolute path of the asset
     * @param eventType the type of the event
     */
    abstract patchNode(
        ctx: AssetProcessorContext,
        absPath: string,
        eventType: EmitterEventType,
    ): Promise<AssetNode>;

    abstract getAssets<T>(
        type: 'external' | 'local',
        pagesFn: GetPages,
    ): Promise<T>;

    /**
     * Minify the bundle.
     * @param bundle the bundle to minify
     * @param getAllPages function to get all pages
     */
    abstract minify(bundle: string, getAllPages: GetPages): Promise<string>;

    /**
     * Write the bundle to the output directory.
     * @param bundle the bundle to write
     * @param path the path to write the bundle to
     */
    abstract write(bundle: string, path?: string): Promise<void>;

    /**
     * Build the asset node.
     * @param _ctx the context for the asset processor
     * @param _relPath the relative path of the asset
     * @returns the asset node
     */
    async build(
        _ctx: AssetProcessorContext & TemplatesAssetContext,
        _relPath: string,
    ): Promise<string> {
        return '';
    }

    /**
     * Format the node name for the asset processor.
     * @param absPath the absolute path of the asset
     * @returns the formatted node name
     */
    public formatNodeName(absPath: string): string {
        if (this._nodeType !== 'tmpl') {
            return path.relative(this._cfg.src_dir, absPath);
        }

        // for templates, we need to use the template name
        // take the basename removing the extension
        return path.basename(absPath).replace(path.extname(absPath), '');
    }
}

/**
 * Context for the asset processor.
 * It provides methods to manage the processor tree and its nodes.
 */
export interface AssetProcessorContext {
    /**
     * Add a node to processor tree.
     * @param param0 the parameters
     * @param param0.name the name of the node
     * @param param0.absPath the absolute path of the node
     * @param param0.type the type of the node
     * @returns the created node
     */
    addNode: (type: AssetNode) => void;

    /**
     * Get a node by its name.
     * @param name the name of the node
     * @returns the node if found, undefined otherwise
     */
    getNodeByName: (name: string) => AssetNode | undefined;

    /**
     * Get a node by its absolute path.
     * @param absPath the absolute path of the node
     * @returns the node if found, undefined otherwise
     */
    getNodeByAbsPath: (absPath: string) => AssetNode | undefined;

    /**
     * Add a dependency between two nodes.
     * @param from the node that depends on another node
     * @param to the node that is depended on
     */
    addDependency: (from: string, to: string) => void;

    /**
     * Get the dependencies of a node.
     * @param name the name of the node
     * @returns the dependencies of the node
     */
    getDependencies: (name: string) => string[];

    /**
     * Get the dependents of a node.
     * @param name the name of the node
     * @returns the dependents of the node
     */
    getDependents: (name: string) => string[];
}

export interface TemplatesAssetContext {
    getTemplates: AssetProcessor['getAssets'];
}

export type GetPages = ProcessorTree['getAllPages'];
