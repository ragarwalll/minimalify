import {
    PACKAGE_DESCRIPTION,
    PACKAGE_NAME,
    PACKAGE_VERSION,
} from '@/utils/constants/package-details.js';
import { Command } from 'commander';
import chalk from 'chalk';
import { AFTER_ALL } from '@/utils/constants/cli/text.js';
import {
    COMMAND_BUILD,
    COMMAND_BUILD_DESCRIPTION,
    COMMAND_DEV,
    COMMAND_DEV_DESCRIPTION,
    COMMAND_INIT,
    COMMAND_INIT_DESCRIPTION,
} from '@/utils/constants/cli/commands.js';
import {
    availableFlags,
    type UserInputMetadataConfirm,
    type UserInputMetadataInput,
} from '@/utils/constants/cli/flags.js';
import { formatOptionInput } from '@/utils/transformer.js';
import { initLogger, logError, logger } from '@/utils/logger.js';
import { init } from '@/commands/init/index.js';
import { Builder } from '@/commands/builder/build.js';
import { parseCfg } from '@/utils/config.js';
import { dev } from '@/commands/dev/index.js';

const shutdown = () => {
    logger.spinner.stop();
    logger.warn('shutting down minimalify cli...');
    afterCommand();
};

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
process.on('uncaughtException', shutdown);
process.on('unhandledRejection', shutdown);

/**
 * This function initializes the CLI commands and options.
 * It sets up the program name, version, description, and available commands.
 */
export const initCommands = () => {
    const program = new Command().name(PACKAGE_NAME);
    program
        // set program description
        .description(PACKAGE_DESCRIPTION)
        // set program version
        .version(PACKAGE_VERSION)
        // set after all text
        .addHelpText(
            'afterAll',
            `\n ${AFTER_ALL.description[0]} ${chalk.bold(
                `${AFTER_ALL.description[1]}`,
            )} ${AFTER_ALL.description[2]} ${chalk.underline(
                `${AFTER_ALL.description[3]}`,
            )}`,
        )
        // add verbose option
        .option(
            formatOptionInput({
                ...availableFlags.verbose.name,
            }),
            availableFlags.verbose.description,
            (availableFlags.verbose as UserInputMetadataConfirm).confirm,
        )
        // add json option
        .option(
            formatOptionInput({
                ...availableFlags.json.name,
            }),
            availableFlags.json.description,
            (availableFlags.json as UserInputMetadataConfirm).confirm,
        );

    _bakeInitCommand(program);
    _bakeBuildCommand(program);
    _bakeDevCommand(program);

    program
        // Parse user cmd option
        .parse(process.argv);
};

/**
 * Bake the initialization command.
 * @param {Command} program the program instance
 */
export const _bakeInitCommand = (program: Command) => {
    // prepare build command
    const buildCommand = program.command(COMMAND_INIT);

    buildCommand
        // set build command description
        .description(COMMAND_INIT_DESCRIPTION)
        // set build command options
        .option(
            formatOptionInput({ ...availableFlags.force.name }),
            availableFlags.force.description,
            (availableFlags.force as UserInputMetadataConfirm).confirm,
        )

        // set build command action
        .action((options: { force: boolean }) => {
            try {
                // start the init process
                beforeCommand(program.opts());
                init(process.cwd(), options.force);
                afterCommand();

                // exiting the process
                process.exit(0);
            } catch (error) {
                // handle the error
                handleError(error);
                process.exit(1);
            }
        });
};

/**
 * Bake the build command.
 * @param {Command} program the program instance
 */
export const _bakeBuildCommand = (program: Command) => {
    // prepare build command
    const buildCommand = program.command(COMMAND_BUILD);

    buildCommand
        // set build command description
        .description(COMMAND_BUILD_DESCRIPTION)
        // set build command options
        .option(
            formatOptionInput({
                ...availableFlags.config.name,
                extra: '<file>',
            }),
            availableFlags.config.description,
            (availableFlags.config as UserInputMetadataInput).input,
        )

        // set build command action
        .action(async (options: { config: string }) => {
            const startTime = performance.now();

            // inform user
            beforeCommand(program.opts());
            logger.spinner.start('minimalify build process started');
            logger.info(
                `using the config file → ${chalk.bold.underline(options.config)}`,
            );

            // get the config file path
            const configFilePath = options.config;

            // check if the config file path is valid
            if (!configFilePath) {
                logger.error(
                    'invalid config file path, please provide a valid path',
                );
                process.exit(1);
            }

            try {
                const builder = new Builder(await parseCfg(configFilePath));
                await builder.init();
                await builder.build();

                const endTime = performance.now();
                const timeTaken = ((endTime - startTime) / 1000).toFixed(2);
                logger.spinner.succeed(
                    `minimalify build process completed (took ${timeTaken}s)`,
                );

                afterCommand();
            } catch (error) {
                logError(error);
                logger.spinner.stop();
                if (!program.opts().verbose)
                    logger.error(
                        'error occurred while building the project, please run --verbose for more details',
                    );
                process.exit(1);
            }
        });
};

/**
 * Bake the development command.
 * @param {Command} program the program instance
 */
export const _bakeDevCommand = (program: Command) => {
    // prepare dev command
    const devCommand = program.command(COMMAND_DEV);

    devCommand
        // set dev command description
        .description(COMMAND_DEV_DESCRIPTION)
        // set dev command options
        .option(
            formatOptionInput({
                ...availableFlags.config.name,
                extra: '<file>',
            }),
            availableFlags.config.description,
            (availableFlags.config as UserInputMetadataInput).input,
        )

        // set dev command action
        .action(
            async (options: {
                config: string;
                json: boolean;
                verbose: boolean;
            }) => {
                // inform user
                beforeCommand(program.opts());

                logger.spinner.start('starting the minimalify dev server');
                logger.info(
                    `using the config file → ${chalk.bold.underline(options.config)}`,
                );

                // get the config file path
                const configFilePath = options.config;

                // check if the config file path is valid
                if (!configFilePath) {
                    logger.error(
                        'invalid config file path, please provide a valid path',
                    );
                    process.exit(1);
                }

                try {
                    process.env.MINIMALIFY_DEV = 'true';

                    await dev(configFilePath);
                } catch (error) {
                    logError(error);
                    logger.spinner.stop();
                    if (!program.opts().verbose)
                        logger.error(
                            'error occurred while building the project, please run --verbose for more details',
                        );
                    process.exit(1);
                }
            },
        );
};

const beforeCommand = ({
    json,
    verbose,
}: {
    json: boolean;
    verbose: boolean;
}) => {
    initLogger({ json, level: verbose ? 'debug' : 'info', pretty: true });
};

const afterCommand = () => {
    console.log();
    console.log(
        `For more information, visit ${chalk.blue.underline('https://therahulagarwal.com/minimalify')}`,
    );
    console.log(
        `Made with no ♥️  only boredom, ${chalk.bold('Happy Coding! 🚀')}`,
    );
};

const handleError = (e: any) => {
    logger.error(chalk.red('error occurred while executing command'), e);
};
