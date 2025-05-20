/**
 * A minimal ANSI styling utility supporting chaining and `.level`.
 */

export type Style =
    | 'bold'
    | 'underline'
    | 'red'
    | 'blue'
    | 'green'
    | 'yellow'
    | 'magenta';

export type LogLevel = 'debug' | 'info' | 'success' | 'warn' | 'error';

export interface TerminalPretty {
    (text: string): string;
    /** 0 = no ANSI, 1 = ANSI on */
    level: number;
    /** change level, preserving current styles */
    setLevel(level: number): TerminalPretty;
    bold: TerminalPretty;
    underline: TerminalPretty;
    red: TerminalPretty;
    blue: TerminalPretty;
    green: TerminalPretty;
    yellow: TerminalPretty;
    magenta: TerminalPretty;
}

const STYLE_NAMES: Style[] = [
    'bold',
    'underline',
    'red',
    'blue',
    'green',
    'yellow',
    'magenta',
];

const ANSI_CODES: Record<Style | 'reset', [string, string] | string> = {
    reset: '\u001b[0m',
    bold: ['\u001b[1m', '\u001b[22m'],
    underline: ['\u001b[4m', '\u001b[24m'],
    red: ['\u001b[31m', '\u001b[39m'],
    blue: ['\u001b[34m', '\u001b[39m'],
    green: ['\u001b[32m', '\u001b[39m'],
    yellow: ['\u001b[33m', '\u001b[39m'],
    magenta: ['\u001b[35m', '\u001b[39m'],
};

function createTerminalPretty(level = 1, styles: Style[] = []): TerminalPretty {
    // the actual formatting logic
    const formatter = (text: string): string => {
        if (level === 0 || styles.length === 0) return text;
        const open = styles
            .map((s) => (ANSI_CODES[s] as [string, string])[0])
            .join('');
        const close = styles
            .slice()
            .reverse()
            .map((s) => (ANSI_CODES[s] as [string, string])[1])
            .join('');
        return `${open}${text}${close}${ANSI_CODES.reset as string}`;
    };

    const handler: ProxyHandler<typeof formatter> = {
        // allow function calls
        apply(_target, _thisArg, args: [string]) {
            return formatter(...args);
        },
        // intercept property access
        get(_target, prop: string) {
            if (prop === 'level') return level;
            if (prop === 'setLevel') {
                return (newLevel: number) =>
                    createTerminalPretty(newLevel, styles);
            }
            if (STYLE_NAMES.includes(prop as Style)) {
                return createTerminalPretty(level, [...styles, prop as Style]);
            }
            return undefined;
        },
    };

    return new Proxy(formatter, handler) as TerminalPretty;
}

export const terminalPretty = createTerminalPretty();

/**
 * Map each LogLevel to one of the style‐methods on `terminalPretty`
 */
export const LEVEL_COLORS: Record<LogLevel, Style> = {
    debug: 'magenta',
    info: 'blue',
    success: 'green',
    warn: 'yellow',
    error: 'red',
};
