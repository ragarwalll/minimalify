const ANSI_RED = '\x1b[31m';
const ANSI_RESET = '\x1b[0m';
const ANSI_BOLD = '\x1b[1m';

interface Position {
    line: number; // 1-based
    column?: number; // 1-based
}

export interface Location {
    start: Position;
    end?: Position;
}

export interface CodeFrameOptions {
    highlightCode?: boolean;
    linesAbove?: number;
    linesBelow?: number;
    message?: string; // Not used in this simplified version
}

export function customCodeFrameColumns(
    rawLines: string,
    loc: Location,
    opts: CodeFrameOptions = {},
): string {
    const highlightCode = opts.highlightCode ?? false;
    const linesAbove = opts.linesAbove ?? 2;
    const linesBelow = opts.linesBelow ?? 3;

    const lines = rawLines.split('\n');
    const startLine = loc.start.line; // 1-based
    const startColumn = loc.start.column; // 1-based or undefined
    const endLine = loc.end?.line ?? startLine; // 1-based
    const endColumn = loc.end?.column; // 1-based or undefined

    let output: string[] = [];

    const firstLineToPrint = Math.max(1, startLine - linesAbove);
    const lastLineToPrint = Math.min(lines.length, endLine + linesBelow);

    const maxGutterWidth = String(lastLineToPrint).length;

    for (let i = firstLineToPrint; i <= lastLineToPrint; ++i) {
        const lineContent = lines[i - 1] ?? ''; // 0-based access, ensure string
        const isErrorLine = i >= startLine && i <= endLine;
        const gutter = `${String(i).padStart(maxGutterWidth)} | `;
        let lineOutput = isErrorLine ? `> ${gutter}` : `  ${gutter}`;

        if (isErrorLine) {
            let currentLinePointer = '';
            if (startColumn !== undefined) {
                const colStart = i === startLine ? startColumn - 1 : 0; // 0-based for string ops
                const colEnd =
                    i === endLine && endColumn !== undefined
                        ? endColumn - 1
                        : i === startLine && startColumn !== undefined
                          ? colStart + 1
                          : lineContent.length;

                const pre = lineContent.substring(0, colStart);
                const highlight = lineContent.substring(colStart, colEnd);
                const post = lineContent.substring(colEnd);

                lineOutput += pre;
                if (highlightCode) lineOutput += ANSI_BOLD + ANSI_RED;
                lineOutput += highlight;
                if (highlightCode) lineOutput += ANSI_RESET;
                lineOutput += post;

                currentLinePointer =
                    ' '.repeat(colStart) +
                    '^'.repeat(Math.max(1, colEnd - colStart));
            } else {
                // Highlight whole line if no column
                if (highlightCode) lineOutput += ANSI_BOLD + ANSI_RED;
                lineOutput += lineContent;
                if (highlightCode) lineOutput += ANSI_RESET;
                currentLinePointer = '^'.repeat((lineContent ?? '').length);
            }
            output.push(lineOutput);
            if (currentLinePointer) {
                const pointerGutter = isErrorLine
                    ? `> ${' '.repeat(maxGutterWidth)} | `
                    : `  ${' '.repeat(maxGutterWidth)} | `;
                let pointerLine = pointerGutter + currentLinePointer;
                if (highlightCode)
                    pointerLine =
                        ANSI_BOLD + ANSI_RED + pointerLine + ANSI_RESET;
                output.push(pointerLine);
            }
        } else {
            lineOutput += lineContent;
            output.push(lineOutput);
        }
    }
    return output.join('\n');
}
