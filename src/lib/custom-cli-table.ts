interface CustomTableOptions {
    head?: string[];
    chars?: {
        top: string;
        'top-mid': string;
        'top-left': string;
        'top-right': string;
        bottom: string;
        'bottom-mid': string;
        'bottom-left': string;
        'bottom-right': string;
        left: string;
        'left-mid': string;
        mid: string;
        'mid-mid': string;
        right: string;
        'right-mid': string;
        middle: string;
    };
    colWidths?: number[]; // Not implemented in this simplified version
}

export class CustomTable {
    private headers: string[];
    private rows: any[][];
    private chars: Required<NonNullable<CustomTableOptions['chars']>>;

    constructor(options: CustomTableOptions = {}) {
        this.headers = options.head ?? [];
        this.rows = [];
        const defaultChars = {
            top: '─',
            'top-mid': '┬',
            'top-left': '┌',
            'top-right': '┐',
            bottom: '─',
            'bottom-mid': '┴',
            'bottom-left': '└',
            'bottom-right': '┘',
            left: '│',
            'left-mid': '├',
            mid: '─',
            'mid-mid': '┼',
            right: '│',
            'right-mid': '┤',
            middle: '│',
        };
        this.chars = { ...defaultChars, ...(options.chars ?? {}) } as Required<
            NonNullable<CustomTableOptions['chars']>
        >;
    }

    public push(row: any[]): void {
        this.rows.push(row);
    }

    private getColumnWidths(): number[] {
        const numCols = this.headers.length || (this.rows[0]?.length ?? 0);
        const widths: number[] = new Array(numCols).fill(0);

        if (this.headers.length > 0) {
            this.headers.forEach((header, i) => {
                widths[i] = Math.max(widths[i] ?? 0, String(header).length);
            });
        }

        this.rows.forEach((row) => {
            row.forEach((cell, i) => {
                widths[i] = Math.max(widths[i] ?? 0, String(cell).length);
            });
        });
        return widths;
    }

    public toString(): string {
        const colWidths = this.getColumnWidths();
        const lines: string[] = [];

        const createLine = (
            left: string,
            mid: string,
            right: string,
            sep: string,
        ): string => {
            let line = left;
            colWidths.forEach((width, i) => {
                line += sep.repeat(width + 2); // +2 for padding
                if (i < colWidths.length - 1) {
                    line += mid;
                }
            });
            line += right;
            return line;
        };

        // Top border
        if (this.headers.length > 0) {
            lines.push(
                createLine(
                    this.chars['top-left'],
                    this.chars['top-mid'],
                    this.chars['top-right'],
                    this.chars.top,
                ),
            );

            // Header row
            let headerLine = this.chars.left;
            this.headers.forEach((header, i) => {
                headerLine += ` ${String(header).padEnd(colWidths[i] ?? 0)} ${
                    this.chars.middle
                }`;
            });
            // Fix for last char if it's middle, should be right
            if (
                headerLine.endsWith(this.chars.middle) &&
                this.headers.length > 0
            ) {
                headerLine = headerLine.slice(0, -1) + this.chars.right;
            } else if (this.headers.length === 0) {
                headerLine = this.chars.left + this.chars.right;
            }

            lines.push(headerLine);

            // Middle border (after header)
            lines.push(
                createLine(
                    this.chars['left-mid'],
                    this.chars['mid-mid'],
                    this.chars['right-mid'],
                    this.chars.mid,
                ),
            );
        } else if (this.rows.length > 0) {
            // Top border if no headers but rows exist
            lines.push(
                createLine(
                    this.chars['top-left'],
                    this.chars['top-mid'],
                    this.chars['top-right'],
                    this.chars.top,
                ),
            );
        }

        // Data rows
        this.rows.forEach((row, rowIndex) => {
            let rowLine = this.chars.left;
            row.forEach((cell, i) => {
                rowLine += ` ${String(cell).padEnd(colWidths[i] ?? 0)} ${
                    this.chars.middle
                }`;
            });
            if (rowLine.endsWith(this.chars.middle) && row.length > 0) {
                rowLine = rowLine.slice(0, -1) + this.chars.right;
            } else if (row.length === 0) {
                rowLine = this.chars.left + this.chars.right;
            }
            lines.push(rowLine);

            if (rowIndex < this.rows.length - 1 && this.headers.length === 0) {
                // Separator line between rows if no headers
                lines.push(
                    createLine(
                        this.chars['left-mid'],
                        this.chars['mid-mid'],
                        this.chars['right-mid'],
                        this.chars.mid,
                    ),
                );
            }
        });

        // Bottom border
        if (this.headers.length > 0 || this.rows.length > 0) {
            lines.push(
                createLine(
                    this.chars['bottom-left'],
                    this.chars['bottom-mid'],
                    this.chars['bottom-right'],
                    this.chars.bottom,
                ),
            );
        }

        return lines.join('\n');
    }
}
