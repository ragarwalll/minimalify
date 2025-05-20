import { terminalPretty } from '@/lib/terminal-pretty.js';
import ora, { type Ora } from 'ora';
import { SingleBar, Presets } from 'cli-progress';
// eslint-disable-next-line import/no-named-as-default
import Table from 'cli-table3';
import { codeFrameColumns } from '@babel/code-frame';
import { isKnownError, toKnownError } from '@/error/index.js';
import stripAnsi from '@/lib/strip-ansi.js';

//Define the log levels
export type LogLevel = 'debug' | 'info' | 'success' | 'warn' | 'error';

const LEVELS: Record<LogLevel, number> = {
    debug: 10,
    info: 20,
    success: 25,
    warn: 30,
    error: 40,
};

const LEVEL_COLORS: Record<LogLevel, keyof typeof terminalPretty> = {
    debug: 'magenta',
    info: 'blue',
    success: 'green',
    warn: 'yellow',
    error: 'red',
};

export interface LoggerOptions {
    json?: boolean;
    level?: LogLevel;
    pretty?: boolean;
    supportsColor?: boolean;
    spinner?: boolean;
    progress?: boolean;
}

export interface SpinnerInterface {
    start(text: string): void;
    update(text: string): void;
    getText(): string | undefined;
    stop(): void;
    succeed(text: string): void;
}

export interface ProgressOptions {
    total?: number;
    format?: string;
}

export interface ProgressInterface {
    start(opts?: ProgressOptions): void;
    update(value: number, meta?: any): void;
    stop(): void;
}

/**
 * BaseLogger is an abstract class that provides a common interface for logging.
 */
export abstract class BaseLogger {
    public json: boolean;
    public level: LogLevel;
    public pretty: boolean;
    public indent: number;
    public supportsColor: boolean;
    public spinnerSupported: boolean;
    public progressSupported: boolean;

    public spinner: SpinnerInterface;
    public progress: ProgressInterface;

    constructor(opts: LoggerOptions = {}) {
        this.json = opts.json ?? false;
        this.level = opts.level ?? 'info';
        this.pretty = opts.pretty ?? false;
        this.indent = 0;
        this.supportsColor = opts.supportsColor ?? false;
        this.spinnerSupported = opts.spinner ?? false;
        this.progressSupported = opts.progress ?? false;

        // no-op defaults
        this.spinner = {
            start: () => {},
            stop: () => {},
            succeed: () => {},
            update: () => {},
            getText: () => undefined,
        };
        this.progress = { start: () => {}, update: () => {}, stop: () => {} };
    }

    /**
     * Abstract method to write log messages.
     * @param {LogLevel} level - The log level.
     * @param {string} msg - The log message.
     */
    protected abstract _write(level: LogLevel, msg: string): void;

    /**
     * Log a message with the specified level and optional metadata.
     * @param {LogLevel} level - The log level.
     * @param {string} msg - The log message.
     * @param {any} meta - Optional metadata.
     */
    public log(level: LogLevel, msg: string, meta?: any): void {
        if (LEVELS[level] < LEVELS[this.level]) return;
        const raw = String(msg);
        // if we're in JSON mode, strip any ANSI escapes
        const message = this.json ? stripAnsi(raw) : raw;
        const record: any = {
            time: new Date().toISOString(),
            level,
            msg: message,
        };
        if (meta !== undefined) record.meta = meta;
        if (this.json) {
            console.log(JSON.stringify(record));
        } else {
            this._write(level, raw); // keep colored output for "pretty"
        }
    }

    /**
     * Log a message with the specified level and optional metadata.
     * @param {LogLevel} level - The log level.
     * @param {string} msg - The log message.
     * @param {any} meta - Optional metadata.
     */
    public debug(msg: string, meta?: any): void {
        this.log('debug', msg, meta);
    }

    /**
     * Log a message with the specified level and optional metadata.
     * @param {string} msg - The log message.
     * @param {any} meta - Optional metadata.
     */
    public info(msg: string, meta?: any): void {
        this.log('info', msg, meta);
    }

    /**
     * Log a message with the specified level and optional metadata.
     * @param {string} msg - The log message.
     * @param {any} meta - Optional metadata.
     */
    public success(msg: string, meta?: any): void {
        this.log('success', msg, meta);
    }

    /**
     * Log a message with the specified level and optional metadata.
     * @param {string} msg - The log message.
     * @param {any} meta - Optional metadata.
     */
    public warn(msg: string, meta?: any): void {
        this.log('warn', msg, meta);
    }

    /**
     * Log a message with the specified level and optional metadata.
     * @param {string} msg - The log message.
     * @param {any} meta - Optional metadata.
     */
    public error(msg: string, meta?: any): void {
        this.log('error', msg, meta);
    }

    /**
     * Start a new log group.
     * @param {string} label - The label for the group.
     */
    public group(label: string): void {
        this.log('info', label);
        this.indent++;
    }

    /**
     * End the current log group.
     */
    public groupEnd(): void {
        if (this.indent > 0) this.indent--;
    }

    /**
     * Log a table with the specified headers and rows.
     * @param {string[]} headers - The table headers.
     * @param {any[][]} rows - The table rows.
     */
    public table(headers: string[], rows: any[][]): void {
        console.table(rows, headers);
    }

    /**
     * Log an error with a code frame.
     * @param {Error} err - The error object.
     * @param {string} code - The code to display in the frame.
     * @param {object} loc - The location of the error in the code.
     */
    public errorWithFrame(
        _err: Error,
        code: string,
        loc: Parameters<typeof codeFrameColumns>[1],
    ): void {
        const frame = codeFrameColumns(code, loc, {
            highlightCode: this.supportsColor,
        });
        this.error(frame);
    }
}

/**
 * FancyLogger is a concrete implementation of BaseLogger that provides
 */
export class FancyLogger extends BaseLogger {
    private nativeSpinner: Ora | null = null;
    private nativeProgress: SingleBar | null = null;

    constructor(opts: LoggerOptions) {
        super(opts);
        this._initSpinner();
        this._initProgress();
    }

    override _write(level: LogLevel, msg: string): void {
        const color = LEVEL_COLORS[level];
        const lvl = level.toUpperCase().padEnd(7);
        const indent = '  '.repeat(this.indent);
        const line = `${indent}${(terminalPretty as any)[color](lvl)} ${msg}`;

        // If a spinner is active, clear → log → render
        if (this.nativeSpinner?.isSpinning) {
            this.nativeSpinner.clear();
            console.log(line);
            this.nativeSpinner.render();
        } else {
            console.log(line);
        }
    }

    private _initSpinner(): void {
        // JSON‐mode spinner: no TTY, emit JSON events and store last text
        if (this.json) {
            let lastText: string | undefined;
            this.spinner = {
                start: (text) => {
                    lastText = text;
                    this.log('info', text, { spinner: 'start' });
                },
                update: (text) => {
                    lastText = text;
                    this.log('info', text, { spinner: 'update' });
                },
                stop: () => {
                    lastText = undefined;
                    this.log('info', '', { spinner: 'stop' });
                },
                succeed: (text) => {
                    lastText = text;
                    this.log('info', text, { spinner: 'succeed' });
                },
                getText: () => lastText,
            };
            return;
        }

        // Non-TTY fallback: just log and store last text
        if (!this.spinnerSupported) {
            let lastText: string | undefined;
            this.spinner = {
                start: (text) => {
                    lastText = text;
                    this.info(text);
                },
                update: (text) => {
                    lastText = text;
                    this.info(text);
                },
                stop: () => {
                    lastText = undefined;
                },
                succeed: (text) => {
                    lastText = text;
                    this.success(text);
                },
                getText: () => lastText,
            };
            return;
        }

        // Real ora spinner
        this.spinner = {
            start: (text) => {
                this.nativeSpinner = ora({ text }).start();
            },
            update: (text) => {
                if (this.nativeSpinner?.isSpinning) {
                    this.nativeSpinner.text = text;
                    this.nativeSpinner.render();
                } else {
                    // fallback if spinner was not running
                    this.info(text);
                }
            },
            stop: () => {
                if (this.nativeSpinner?.isSpinning) {
                    this.nativeSpinner.stop();
                }
            },
            succeed: (text) => {
                if (this.nativeSpinner?.isSpinning) {
                    this.nativeSpinner.succeed(text);
                } else {
                    this.success(text);
                }
            },
            getText: () => this.nativeSpinner?.text,
        };
    }

    private _initProgress(): void {
        if (this.json) {
            this.progress = {
                start: (opts = {}) =>
                    this.log('info', '', { progress: 'start', ...opts }),
                update: (value, meta) =>
                    this.log('info', '', {
                        progress: 'update',
                        value,
                        ...(meta || {}),
                    }),
                stop: () => this.log('info', '', { progress: 'stop' }),
            };
            return;
        }

        if (!this.progressSupported) {
            this.progress = {
                start: () => {},
                update: () => {},
                stop: () => {},
            };
            return;
        }

        this.progress = {
            start: (opts = {}) => {
                this.nativeProgress = new SingleBar(
                    {
                        format:
                            opts.format ??
                            '{bar} {percentage}% | {value}/{total}',
                        hideCursor: true,
                    },
                    Presets.shades_classic,
                );
                this.nativeProgress.start(opts.total ?? 100, 0);
            },
            update: (v, meta) => {
                this.nativeProgress?.update(v, meta);
            },
            stop: () => {
                this.nativeProgress?.stop();
            },
        };
    }

    override table(headers: string[], rows: any[][]): void {
        const t = new Table({ head: headers });
        rows.forEach((r) => t.push(r));
        console.log(t.toString());
    }
}

/**
 * PlainLogger is a concrete implementation of BaseLogger that provides
 * a simple text-based logging interface.
 */
export class PlainLogger extends BaseLogger {
    constructor(opts: LoggerOptions) {
        super({
            ...opts,
            supportsColor: false,
            spinner: false,
            progress: false,
        });
    }

    override _write(level: LogLevel, msg: string): void {
        const lvl = level.toUpperCase().padEnd(7);
        const indent = '  '.repeat(this.indent);
        console.log(`${indent}${lvl} ${msg}`);
    }
}

/**
 * Detect terminal capabilities.
 * @returns { supportsColor: boolean, spinner: boolean, progress: boolean }
 */
const detectCapabilities = () => {
    const supportsColor = terminalPretty.level > 0;
    const isTTY = process.stdout.isTTY;
    return {
        supportsColor,
        spinner: supportsColor && isTTY,
        progress: isTTY,
    };
};

/**
 * Create a logger instance based on the terminal capabilities.
 * @param {LoggerOptions} opts - The logger options.
 * @returns {BaseLogger} - The logger instance.
 */
const createLogger = (opts: LoggerOptions = {}): BaseLogger => {
    const caps = detectCapabilities();
    const o: LoggerOptions = { ...opts, ...caps };
    return caps.supportsColor ? new FancyLogger(o) : new PlainLogger(o);
};

/**
 * Default logger instance.
 * @type {BaseLogger}
 */
export let logger: BaseLogger = createLogger({
    json: false,
    level: 'info',
    pretty: true,
});

let sigintInstalled = false;
function installSigintHandler() {
    if (sigintInstalled) return;
    process.on('SIGINT', () => {
        try {
            logger.spinner.stop();
            logger.progress.stop();
        } catch {}
        process.exit(130);
    });
    sigintInstalled = true;
}

/**
 * Call once at your CLI startup (after parsing flags):
 *   initLogger({ json, level, pretty });
 */
export function initLogger(
    opts: {
        json?: boolean;
        level?: LogLevel;
        pretty?: boolean;
    } = {},
) {
    logger = createLogger(opts);
    installSigintHandler();
}

export const logError = (error: unknown) => {
    logger.spinner.stop();
    if (isKnownError(error)) {
        const knowError = toKnownError(error);
        if (knowError) {
            logger.error(knowError.toString());
            if (knowError.stack) {
                logger.debug(knowError.stack);
            }
        }
        return;
    }

    if (error instanceof Error) {
        logger.error(error.message);
        if (error.stack) {
            logger.debug(error.stack);
        }
    } else {
        logger.error(String(error));
    }
};
