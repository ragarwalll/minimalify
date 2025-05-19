import { HTTPCache } from '@/cache-manager/http-cache.js';
import { type MinimalifyConfig } from '@/config/struct.js';
import { ProcessorTree } from '@/manager/processor-tree.js';
import { CSSProcessor } from '@/manager/processor/css-processor.js';
import { ImagesProcessor } from '@/manager/processor/image-processor.js';
import { JsProcessor } from '@/manager/processor/js-processor.js';
import { PageProcessor } from '@/manager/processor/page-processor.js';
import { TemplateProcessor } from '@/manager/processor/template-processor.js';
import {
    type GetPages,
    type AssetProcessor,
} from '@/manager/processor/processor.js';
import { MinimalifyPluginManager } from '@/plugins/manager.js';
import { CACHE_DIR } from '@/utils/constants/cache.js';
import { logger } from '@/utils/logger.js';
import path from 'path';
import { cleanDir, ensureDir } from '@/utils/dir.js';
import chalk from 'chalk';
import { type EmitterEventType } from '@/utils/types.js';

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
    private _initialized = false;
    cfg: MinimalifyConfig;
    processor: ProcessorTree;
    httpCache: HTTPCache;
    plugins: MinimalifyPluginManager;
    cssProcessor: AssetProcessor;
    jsProcessor: AssetProcessor;
    pageProcessor: AssetProcessor;
    templateProcessor: AssetProcessor;
    imageProcessor: AssetProcessor;

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

        // Initialize the processors
        this.processor = new ProcessorTree(cfg);
        this.cssProcessor = new CSSProcessor(cfg, this.httpCache, this.plugins);
        this.jsProcessor = new JsProcessor(cfg, this.httpCache, this.plugins);
        this.pageProcessor = new PageProcessor(
            cfg,
            this.httpCache,
            this.plugins,
        );
        this.templateProcessor = new TemplateProcessor(
            cfg,
            this.httpCache,
            this.plugins,
        );
        this.imageProcessor = new ImagesProcessor(
            cfg,
            this.httpCache,
            this.plugins,
        );

        // Register the processors
        this.processor.registerProcessor('css', this.cssProcessor);
        this.processor.registerProcessor('js', this.jsProcessor);
        this.processor.registerProcessor('page', this.pageProcessor);
        this.processor.registerProcessor('tmpl', this.templateProcessor);
        this.processor.registerProcessor('img', this.imageProcessor);
    }

    /**
     * Initialize the builder.
     *
     */
    async init() {
        logger.spinner.update('initializing builder');
        await this.plugins.loadPlugins(this.cfg);

        logger.spinner.update('processing builder...');
        await this.plugins.callHook('onPreConfig', this.cfg);

        await this.processor.init();
        console.log('done');
        this._initialized = true;
    }

    /**
     * Build the project.
     *
     * @returns  the build result
     */
    async build() {
        if (!this._initialized) {
            throw new Error(
                'builder is not initialized, please contact the author',
            );
        }

        // 1. Clean the output directory
        ensureDir(this.cfg.out_dir);
        cleanDir(this.cfg.out_dir);

        logger.debug(`calling ${chalk.underline('pre-build')} hook`);
        await this.plugins.callHook('onPreBuild', this.cfg);

        logger.debug(
            `cleaning output directory → ${chalk.underline(path.basename(this.cfg.out_dir))}`,
        );

        // 2. Build the HTML pages
        const pages = await this.processor.getAllPages();
        pages.sort(
            (a, b) =>
                this.processor.subtreeSize(a) - this.processor.subtreeSize(b),
        );

        await Promise.all(
            pages.map((rel) =>
                this.pageProcessor.build(
                    {
                        ...this.processor.ctx,
                        getTemplates: this.templateProcessor.getAssets.bind(
                            this.templateProcessor,
                        ),
                    },
                    rel,
                ),
            ),
        );

        logger.debug(
            `html pages built → ${chalk.underline(pages.length.toString())}`,
        );

        // 3. Build the CSS, JS and IMG assets
        const {
            cssUris: sharedCssUri,
            jsUris: sharedJsUri,
            imgUris: sharedImgUri,
        } = await this.pageProcessor.getAssets<{
            cssUris: string[];
            jsUris: string[];
            imgUris: string[];
        }>('external', this.processor.getAllPages.bind(this.processor));

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

        logger.spinner.update('building assets...');

        const _getCss = () => Promise.resolve(sharedCssUri);
        const _getJs = () => Promise.resolve(sharedJsUri);
        const _getImg = () => Promise.resolve(sharedImgUri);

        await Promise.all([
            this._buildCssPipeline(_getCss.bind(this)),
            this._buildJsPipeline(_getJs.bind(this)),
            this._buildImgPipeline(_getImg.bind(this)),
        ]);

        logger.debug(
            `html pages rendered → ${chalk.underline(pages.map((p) => path.basename(p)).join(', '))}`,
        );

        logger.debug(`calling ${chalk.underline('post-build')} hook`);
        await this.plugins.callHook('onPostBuild', this.cfg);
    }

    /**
     * Build the CSS pipeline.
     * @param _getCss the function to get the CSS assets
     * @returns the CSS assets
     */
    private _buildCssPipeline = async (_getCss: GetPages): Promise<void> => {
        // 1) fetch all external CSS
        const externalCss = await this.cssProcessor.getAssets<string[]>(
            'external',
            _getCss,
        );

        // 2) fetch all internal CSS, using the external result as input
        const internalCss = await this.cssProcessor.getAssets<string[]>(
            'local',
            () => Promise.resolve(externalCss),
        );

        const finalCss = externalCss.concat(internalCss);

        // 3) minify and return
        const bundle = await this.cssProcessor.minify(
            finalCss.join('\n'),
            this.processor.getAllPages.bind(this.processor),
        );

        return this.cssProcessor.write(bundle);
    };

    /**
     * Copy the assets to the output directory.
     * @param assets the assets to copy
     */
    private _buildJsPipeline = async (_getJs: GetPages): Promise<void> => {
        const externalJs = await this.jsProcessor.getAssets<string[]>(
            'external',
            _getJs,
        );

        const internalJs = await this.jsProcessor.getAssets<string[]>(
            'local',
            () => Promise.resolve(externalJs),
        );

        const finalJs = externalJs.concat(internalJs);

        const bundle = await this.jsProcessor.minify(
            finalJs.join('\n'),
            this.processor.getAllPages.bind(this.processor),
        );

        return this.jsProcessor.write(bundle);
    };

    /**
     * Copy the assets to the output directory.
     * @param assets the assets to copy
     */
    private _buildImgPipeline = async (_getImg: GetPages): Promise<void> => {
        const joinedImg = await _getImg().then((img) => img.join('\n'));
        return this.imageProcessor.write(joinedImg);
    };

    /**
     * Incremental build: given an absolute file path,
     * re‐bundle CSS/JS or rebuild only affected pages
     */
    async incrementalBuild(
        absFile: string,
        eventType: EmitterEventType,
    ): Promise<string[]> {
        const node = await this.processor.patchNode(absFile, eventType);
        if (!node) {
            logger.warn(`could not process file ${absFile}`);
            return [];
        }

        // extract the node type
        const { type, name } = node;

        if (type === 'css' || type === 'js' || type === 'img') {
            // TODO: patch node should handle this

            const {
                cssUris: sharedCssUri,
                jsUris: sharedJsUri,
                imgUris: sharedImgUri,
            } = await this.pageProcessor.getAssets<{
                cssUris: string[];
                jsUris: string[];
                imgUris: string[];
            }>('external', this.processor.getAllPages.bind(this.processor));

            const _getCss = () => Promise.resolve(sharedCssUri);
            const _getJs = () => Promise.resolve(sharedJsUri);
            const _getImg = () => Promise.resolve(sharedImgUri);

            const tasks: Promise<void>[] = [];

            if (type === 'css') {
                tasks.push(this._buildCssPipeline(_getCss.bind(this)));
            } else if (type === 'js') {
                tasks.push(this._buildJsPipeline(_getJs.bind(this)));
            } else if (type === 'img') {
                tasks.push(this._buildImgPipeline(_getImg.bind(this)));
            }

            await Promise.all(tasks);

            return [];
        }

        // page or template
        const rels =
            type === 'page'
                ? [path.relative(this.cfg.src_dir, absFile)]
                : this.processor.getStaleNodes(name);

        await Promise.all(
            rels.map((rel) =>
                this.pageProcessor.build(
                    {
                        ...this.processor.ctx,
                        getTemplates: this.templateProcessor.getAssets.bind(
                            this.templateProcessor,
                        ),
                    },
                    rel,
                ),
            ),
        );
        return rels.map((r) => `/${r}`);
    }
}
