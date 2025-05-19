import path from 'path';
import fs from 'fs';
import { Ajv } from 'ajv';
import { type MinimalifyConfig, defaultConfig } from './struct.js';
import { DirError } from '@/error/dir-error.js';
import { MinimalifySchema } from './schema.js';
import { ValidationError } from '@/error/validation-error.js';
import { dynamicImport } from '@/utils/file.js';
import { logger } from '@/utils/logger.js';
import chalk from 'chalk';
import {
    CONFIG_FILE_NAME,
    CONFIG_FILE_NAME_JSON,
} from '@/utils/constants/file-name.js';

/**
 * Load the minimalify config file.
 * @param cwd the current working directory
 * @param filePath the path to the config file
 */
export const loadConfig = async (cwd: string, filePath: string) => {
    if (filePath == undefined || filePath === '') {
        if (fs.existsSync(path.join(cwd, CONFIG_FILE_NAME))) {
            filePath = CONFIG_FILE_NAME;
        } else if (fs.existsSync(path.join(cwd, CONFIG_FILE_NAME_JSON))) {
            filePath = CONFIG_FILE_NAME_JSON;
        } else {
            logger.warn(
                `config file ${chalk.underline(path.relative(cwd, filePath))} does not exist. Using default config.`,
            );
            return defaultConfig;
        }
    }

    // check if the file exists
    if (!fs.existsSync(path.join(cwd, filePath))) {
        logger.warn(
            `config file ${chalk.underline(path.relative(cwd, filePath))} does not exist. Using default config.`,
        );
        return defaultConfig;
    }

    logger.info(
        `using the config file → ${chalk.bold.underline(path.relative(cwd, filePath))}`,
    );

    // load the config file with cwd as type MinimalifyConfig
    let config = await dynamicImport<MinimalifyConfig>(
        path.join(cwd, filePath),
    );

    // merge the config with the default config
    if ('$schema' in config) delete config.$schema;
    config = { ...defaultConfig, ...config };

    if (config.src_dir === undefined || config.src_dir === '')
        config.src_dir = '.';

    if (config.out_dir === undefined || config.out_dir === '')
        config.out_dir = 'dist';

    // validate the directories in the config file
    validateAvailableDir(cwd, config);

    // validate with AJV
    const ajv = new Ajv({ allErrors: true });
    const validator = ajv.compile(MinimalifySchema);
    if (!validator(config)) {
        logger.spinner.stop();
        logger.error(
            `config file ${chalk.underline(path.relative(process.cwd(), filePath))} is invalid. please check the errors below.`,
        );

        const tableHeader = ['Property', 'Error'];
        const tableRows = validator.errors?.map((error) => {
            return {
                Property: error.instancePath,
                Error: error.message,
            };
        }) as { Property: string; Error: string }[];

        logger.table(
            tableHeader,
            tableRows.map((row) => [row.Property, row.Error]),
        );

        throw new ValidationError(
            `config file ${path.relative(process.cwd(), filePath)} is invalid. ${ajv.errorsText(validator.errors)}`,
        );
    }

    config.src_dir = path.join(cwd, config.src_dir);
    config.out_dir = path.join(cwd, config.out_dir);

    if (config.css == undefined) config.css = {};
    if (config.js == undefined) config.js = {};
    if (config.html == undefined) config.html = {};
    if (config.images == undefined) config.images = {};
    if (config.templates == undefined) config.templates = {};
    if (config.dev == undefined)
        config.dev = {
            port: 3000,
        };

    if (config.css.ignore == undefined) config.css.ignore = [];
    if (config.js.ignore == undefined) config.js.ignore = [];
    if (config.html.ignore == undefined) config.html.ignore = [];
    if (config.images.ignore == undefined) config.images.ignore = [];
    if (config.templates.ignore == undefined) config.templates.ignore = [];

    if (config.templates.shared_uri === undefined)
        config.templates.shared_uri = [];

    if (config.images.supported_formats === undefined)
        config.images.supported_formats = [
            'jpg',
            'jpeg',
            'png',
            'gif',
            'webp',
            'svg',
        ];
    if (config.shared_domains === undefined) config.shared_domains = [];
    if (config.custom_domain === undefined) config.custom_domain = '';
    if (config.plugins === undefined) config.plugins = [];

    if (
        config.js.minify_options === undefined ||
        Object.keys(config.js.minify_options).length === 0
    ) {
        config.js.minify_options = {
            compress: {
                drop_console: true,
                drop_debugger: true,
                collapse_vars: true,
                reduce_vars: true,
                join_vars: true,
                hoist_funs: true,
                unused: true,
                passes: 2,
                dead_code: true,
                reduce_funcs: true,
                sequences: true,
                side_effects: true,
                toplevel: true,
                if_return: true,
                inline: true,
                comparisons: true,
                conditionals: true,
                directives: true,
                evaluate: true,
                properties: true,
            },
            mangle: true,
            output: {
                comments: false,
            },
        };
    }

    logger.debug(
        `using the src directory → ${chalk.bold.underline(config.src_dir)}`,
    );
    logger.debug(
        `using the out directory → ${chalk.bold.underline(path.relative(cwd, config.out_dir))}`,
    );
    return config;
};

/**
 * Validate the available directories in the config file.
 * @param cwd the current working directory
 * @param {MinimalifyConfig} config the minimalify config object
 */
const validateAvailableDir = (cwd: string, config: MinimalifyConfig): void => {
    const availableDirectories = Object.keys(config).filter((key) => {
        return key === 'src_dir';
    });

    for (const dir of availableDirectories) {
        const dirPath = path.join(cwd, config[dir]);

        // check if the directory exists
        if (!fs.existsSync(dirPath)) {
            if (dir === 'src_dir') {
                throw new DirError(
                    `directory ${path.relative(cwd, dirPath)} does not exist.`,
                );
            } else {
                // inform user using chalk
                logger.warn(
                    `directory ${chalk.underline(path.relative(cwd, dirPath))} does not exist.`,
                );
                continue;
            }
        }

        // check if the directory is a directory
        if (!fs.lstatSync(dirPath).isDirectory()) {
            throw new DirError(
                `path ${path.relative(cwd, dirPath)} is not a directory.`,
            );
        }

        // check if the directory is readable and writable
        try {
            fs.accessSync(dirPath, fs.constants.R_OK | fs.constants.W_OK);
        } catch {
            throw new DirError(
                `directory ${path.relative(cwd, dirPath)} is not readable or writable.`,
            );
        }

        // check if the directory is empty
        if (fs.readdirSync(dirPath).length === 0) {
            throw new DirError(
                `directory ${path.relative(cwd, dirPath)} is empty.`,
            );
        }

        // check if the directory is a symlink
        if (fs.lstatSync(dirPath).isSymbolicLink()) {
            throw new DirError(
                `directory ${path.relative(cwd, dirPath)} is a symlink.`,
            );
        }
    }
};
