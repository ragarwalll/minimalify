import fs from 'fs';
import path from 'path';
import chalk from 'chalk';
import { defaultConfig } from '@/config/struct.js';
import { CONFIG_FILE_NAME } from '@/utils/constants/file-name.js';
import { logger } from '@/utils/logger.js';

/**
 * Initialize the minimalify configuration file.
 * This will create a minimalify.config.js file in the current working directory.
 * The file will contain the default configuration object.
 * Assumes that the file does not already exist.
 * If the file already exists, it will not be overwritten.
 * @param cwd the current working directory
 */
export const init = async (cwd: string, force: boolean = false) => {
    const cfg = Object.assign({}, defaultConfig);

    // delete not required properties
    delete cfg.html?.ignore;
    delete cfg.css?.ignore;
    delete cfg.js?.ignore;
    delete cfg.images?.ignore;
    delete cfg.templates?.ignore;
    delete cfg.js?.minifyOptions;

    const minimalifyConfig =
        `module.exports = ${JSON.stringify(cfg, null, 2)}`.trim();

    // overwrite the file if it exists, overwrite it
    if (fs.existsSync(path.join(cwd, CONFIG_FILE_NAME))) {
        if (!force) {
            logger.error(
                `Config file ${chalk.underline(CONFIG_FILE_NAME)} already exists. Use --force to overwrite it.`,
            );
            return;
        }
    }

    // create the file
    fs.writeFileSync(
        path.join(cwd, CONFIG_FILE_NAME),
        minimalifyConfig,
        'utf8',
    );

    // inform the user
    logger.info(`creating ${chalk.underline(CONFIG_FILE_NAME)} in ${cwd}`);

    // insert new line
    logger.info(
        `you can now start using minimalify by running ${chalk.bold.underline('minimalify build')}`,
    );
};
