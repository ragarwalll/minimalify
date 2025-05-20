import { clearLine, cursorTo } from 'readline';
import { type WriteStream } from 'tty';

/**
 * Minimal Terminal Spinner.
 */
export interface TerminalSpinner {
    text: string;
    isSpinning: boolean;
    start(): TerminalSpinner;
    stop(): TerminalSpinner;
    clear(): TerminalSpinner;
    render(): TerminalSpinner;
    succeed(text?: string): TerminalSpinner;
}

interface TerminalSpinnerOptions {
    text?: string;
    spinner?: string[];
    interval?: number;
    stream?: WriteStream;
}

const DEFAULT_FRAMES = ['|', '/', '-', '\\'];
const DEFAULT_INTERVAL = 100;

export default (opts: TerminalSpinnerOptions = {}): TerminalSpinner => {
    const stream = opts.stream ?? (process.stdout as WriteStream);
    let text = opts.text ?? '';
    let spinning = false;
    let timer: ReturnType<typeof setInterval> | null = null;
    let frameIndex = 0;
    const frames = opts.spinner ?? DEFAULT_FRAMES;
    const interval = opts.interval ?? DEFAULT_INTERVAL;

    const clear = (): TerminalSpinner => {
        if (stream.isTTY) {
            clearLine(stream, 0);
            cursorTo(stream, 0);
        }
        return api;
    };

    const render = (): TerminalSpinner => {
        if (!spinning) return api;
        clear();
        stream.write(`${frames[frameIndex]} ${text}`);
        frameIndex = (frameIndex + 1) % frames.length;
        return api;
    };

    const start = (): TerminalSpinner => {
        if (spinning) return api;
        spinning = true;
        frameIndex = 0;
        timer = setInterval(render, interval);
        return api;
    };

    const stop = (): TerminalSpinner => {
        if (timer) {
            clearInterval(timer);
            timer = null;
        }
        spinning = false;
        return api;
    };

    const succeed = (msg?: string): TerminalSpinner => {
        if (msg !== undefined) text = msg;
        stop();
        clear();
        stream.write(`\u2714 ${text}\n`);
        return api;
    };

    const api: TerminalSpinner = {
        get text() {
            return text;
        },
        set text(v: string) {
            text = v;
        },
        get isSpinning() {
            return spinning;
        },
        start,
        stop,
        clear,
        render,
        succeed,
    };

    return api;
};
