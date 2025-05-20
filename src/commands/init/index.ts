import fs from 'fs';
import path from 'path';
import { defaultConfig } from '@/config/struct.js';
import {
    CONFIG_FILE_NAME,
    CONFIG_FILE_NAME_JSON,
} from '@/utils/constants/file-name.js';
import { logger } from '@/utils/logger.js';
import { terminalPretty } from '@/lib/terminal-pretty.js';

/**
 * Initialize the minimalify configuration file.
 * This will create a minimalify.config.js file in the current working directory.
 * The file will contain the default configuration object.
 * Assumes that the file does not already exist.
 * If the file already exists, it will not be overwritten.
 * @param cwd the current working directory
 */
export const init = async (
    cwd: string,
    force: boolean = false,
    type: 'js' | 'json',
) => {
    const cfg = Object.assign({}, defaultConfig);

    // delete not required properties
    delete cfg.html?.ignore;
    delete cfg.css?.ignore;
    delete cfg.js?.ignore;
    delete cfg.images?.ignore;
    delete cfg.templates?.ignore;
    delete cfg.js?.minify_options;

    const minimalifyConfig =
        type === 'js'
            ? `module.exports = ${JSON.stringify(cfg, null, 2)}`.trim()
            : JSON.stringify(
                  Object.assign(
                      {
                          $schema:
                              'https://therahulagarwal.com/minimalify/dist/schema/minimalify@latest.json',
                      },
                      cfg,
                  ),
                  null,
                  2,
              );

    // overwrite the file if it exists, overwrite it
    if (
        fs.existsSync(
            path.join(
                cwd,
                type === 'js' ? CONFIG_FILE_NAME : CONFIG_FILE_NAME_JSON,
            ),
        )
    ) {
        if (!force) {
            logger.error(
                `Config file ${terminalPretty.underline(path.basename(type === 'js' ? CONFIG_FILE_NAME : CONFIG_FILE_NAME_JSON))} already exists. Use --force to overwrite it.`,
            );
            return;
        }
    }

    // create the file
    fs.writeFileSync(
        path.join(
            cwd,
            type === 'js' ? CONFIG_FILE_NAME : CONFIG_FILE_NAME_JSON,
        ),
        minimalifyConfig,
        'utf8',
    );

    // inform the user
    logger.info(
        `creating ${terminalPretty.underline(type === 'js' ? CONFIG_FILE_NAME : CONFIG_FILE_NAME_JSON)} in ${cwd}`,
    );

    // insert new line
    logger.info(
        `you can now start using minimalify by running ${terminalPretty.bold.underline('minimalify build')}`,
    );
};
