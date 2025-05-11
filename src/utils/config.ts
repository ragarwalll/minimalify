import path from 'path';
import { loadConfig } from '@/config/loader.js';

/**
 * Loads the config file from the given path.
 *
 * @param cfgPath the path to the config file
 * @returns {Promise<MinimalifyConfig>} the parsed config object
 */
export const parseCfg = (cfgPath: string) => {
    const baseDir =
        process.env.NODE_ENV === 'development'
            ? path.join(process.cwd(), 'testing')
            : process.cwd();
    return loadConfig(baseDir, cfgPath);
};
