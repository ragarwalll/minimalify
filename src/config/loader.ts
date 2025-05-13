import path from 'path';
import fs from 'fs';
import { Ajv } from 'ajv';
import { type MinimalifyConfig, defaultConfig } from './struct.js';
import { DirError } from '@/error/dir-error.js';
import { MinimalifySchema } from './schema.js';
import { ValidationError } from '@/error/validation-error.js';
import { readFile } from '@/utils/file.js';
import { logger } from '@/utils/logger.js';
import chalk from 'chalk';
import { IMG_BUNDLE_DIR } from '@/utils/constants/bundle.js';

/**
 * Load the minimalify config file.
 * @param cwd the current working directory
 * @param filePath the path to the config file
 */
export const loadConfig = async (cwd: string, filePath: string) => {
    // check if the file exists
    if (!fs.existsSync(filePath)) {
        logger.warn(
            `config file ${chalk.underline(path.relative(cwd, filePath))} does not exist. Using default config.`,
        );
        return defaultConfig;
    }

    // load the config file with cwd as type MinimalifyConfig
    let config = JSON.parse(
        (await readFile(path.join(cwd, filePath))).replace(
            'module.exports = ',
            '',
        ),
    ) as MinimalifyConfig;

    // merge the config with the default config
    config = { ...defaultConfig, ...config };

    if (config.srcDir === undefined || config.srcDir === '')
        config.srcDir = '.';

    if (config.outDir === undefined || config.outDir === '')
        config.outDir = 'dist';

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

    config.srcDir = path.join(cwd, config.srcDir);
    config.outDir = path.join(cwd, config.outDir);

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

    if (config.templates.sharedUri === undefined)
        config.templates.sharedUri = [];

    if (config.images.outDir === undefined)
        config.images.outDir = IMG_BUNDLE_DIR;

    if (config.images.supportedFormats === undefined)
        config.images.supportedFormats = [
            'jpg',
            'jpeg',
            'png',
            'gif',
            'webp',
            'svg',
        ];
    if (config.sharedDomains === undefined) config.sharedDomains = [];
    if (config.customDomain === undefined) config.customDomain = '';
    if (config.plugins === undefined) config.plugins = [];

    logger.debug(
        `using the src directory → ${chalk.bold.underline(config.srcDir)}`,
    );
    logger.debug(
        `using the out directory → ${chalk.bold.underline(path.relative(cwd, config.outDir))}`,
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
        return key === 'srcDir';
    });

    for (const dir of availableDirectories) {
        const dirPath = path.join(cwd, config[dir]);

        // check if the directory exists
        if (!fs.existsSync(dirPath)) {
            if (dir === 'srcDir') {
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
