import { type MinimalifyConfig } from '@/config/struct.js';
import { type MinimalifyPlugin } from './typings.js';
import { logError, logger } from '@/utils/logger.js';
import chalk from 'chalk';
import { plugins } from './lib/index.js';
import { PluginError } from '@/error/plugin-error.js';

/**
 * MinimalifyPluginManager is a class that manages the loading and execution of plugins.
 * It loads plugins from the config file and executes their
 * hooks when needed.
 */
export class MinimalifyPluginManager {
    private plugins: MinimalifyPlugin[] = [];

    /**
     * Load plugins from the config file.
     *
     * @param config The config object that contains the plugins to load.
     * @returns void
     */
    async loadPlugins(config: MinimalifyConfig) {
        if (process.env.MINIMALIFY_DEV === 'true') return;

        if (!config.plugins) {
            return;
        }

        const failedPlugins = [];
        for (const plugin of config.plugins) {
            try {
                const loadedPlugin = plugins[plugin];

                if (!loadedPlugin) {
                    failedPlugins.push(plugin);
                    throw new PluginError(`plugin ${plugin} not found`);
                }

                this.plugins.push(loadedPlugin);
                logger.spinner.update(
                    `loaded plugin ${chalk.underline(plugin)}`,
                );
            } catch (e) {
                logError(e);
            }
        }
        if (failedPlugins.length > 0) {
            logger.error(
                `failed to load the following plugins → ${failedPlugins.join(', ')}`,
            );
        }

        logger.info(
            `loaded plugins → ${this.plugins.map((plugin) => plugin.name).join(', ')}`,
        );
    }

    /**
     * Call a hook on all loaded plugins.
     *
     * @param hook The name of the hook to call.
     * @param args The arguments to pass to the hook.
     * @returns void
     */
    async callHook<K extends keyof MinimalifyPlugin>(
        hook: K,
        ...args: Parameters<Extract<MinimalifyPlugin[K], (...args: any) => any>>
    ): Promise<ReturnType<
        Extract<MinimalifyPlugin[K], (...args: any) => any>
    > | void> {
        if (process.env.MINIMALIFY_DEV === 'true') return;
        let result: any = undefined;
        for (const plugin of this.plugins) {
            if (plugin[hook] && typeof plugin[hook] === 'function') {
                // eslint-disable-next-line @typescript-eslint/no-unsafe-function-type
                result = await (plugin[hook] as Function)(
                    ...(Array.isArray(result) ? result : args),
                );
            }
        }
        return result;
    }
}
