const ANSI_HIDE_CURSOR = '\x1b[?25l';
const ANSI_SHOW_CURSOR = '\x1b[?25h';
const ANSI_CLEAR_LINE = '\x1b[2K';
const ANSI_CURSOR_TO_COL_0 = '\x1b[0G';

export interface CustomSingleBarOptions {
    format?: string;
    hideCursor?: boolean;
    barCompleteChar?: string;
    barIncompleteChar?: string;
    barSize?: number; // In characters
}

export class CustomSingleBar {
    private options: Required<CustomSingleBarOptions>;
    private total: number = 100;
    private current: number = 0;
    private stream: NodeJS.WriteStream = process.stdout;
    private lastRenderedString: string = '';

    constructor(options: CustomSingleBarOptions = {}, _preset?: any) {
        this.options = {
            format: options.format ?? '{bar} {percentage}% | {value}/{total}',
            hideCursor: options.hideCursor ?? false,
            barCompleteChar: options.barCompleteChar ?? '=',
            barIncompleteChar: options.barIncompleteChar ?? ' ',
            barSize: options.barSize ?? 40,
        };
    }

    private render(): void {
        if (!this.stream.isTTY) {
            return; // Don't render if not a TTY
        }

        const percentage = Math.floor((this.current / this.total) * 100);
        const filledSize = Math.round(
            (this.current / this.total) * this.options.barSize,
        );
        const emptySize = this.options.barSize - filledSize;

        const bar =
            this.options.barCompleteChar.repeat(Math.max(0, filledSize)) +
            this.options.barIncompleteChar.repeat(Math.max(0, emptySize));

        let output = this.options.format
            .replace('{bar}', bar)
            .replace('{percentage}', String(percentage).padStart(3))
            .replace('{value}', String(this.current))
            .replace('{total}', String(this.total));

        // Clear previous line, move cursor to start, write new line
        this.stream.write(ANSI_CLEAR_LINE + ANSI_CURSOR_TO_COL_0 + output);
        this.lastRenderedString = output;
    }

    public start(total: number, initialValue: number): void {
        this.total = total;
        this.current = initialValue;
        if (this.options.hideCursor && this.stream.isTTY) {
            this.stream.write(ANSI_HIDE_CURSOR);
        }
        this.render();
    }

    public update(value: number, _meta?: any): void {
        this.current = Math.min(value, this.total); // Cap value at total
        this.render();
    }

    public stop(): void {
        if (this.stream.isTTY) {
            // Persist the final progress bar state by writing a newline
            // or clear it if you prefer. Here, we ensure it's on its own line.
            if (this.lastRenderedString) {
                this.stream.write('\n');
            }
            if (this.options.hideCursor) {
                this.stream.write(ANSI_SHOW_CURSOR);
            }
        }
        this.lastRenderedString = ''; // Reset for next potential use
    }
}

// To match the import `Presets.shades_classic`
export const Presets = {
    shades_classic: {}, // This is a dummy, options are handled in CustomSingleBar
};
