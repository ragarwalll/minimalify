/**
 * Minimal gradient-string clone.
 */

type RGB = { r: number; g: number; b: number };
type GradientFn = {
    (text: string): string;
    multiline(text: string): string;
};

/** ANSI 24-bit foreground color */
const ansiColor = (r: number, g: number, b: number): string =>
    `\u001b[38;2;${r};${g};${b}m`;
const RESET = '\u001b[0m';

/** Parse hex "#RGB" or "#RRGGBB" to RGB */
function hexToRgb(hex: string): RGB {
    let h = hex.replace(/^#/, '');
    if (h.length === 3) {
        h = h
            .split('')
            .map((c) => c + c)
            .join('');
    }
    const v = parseInt(h, 16);
    return {
        r: (v >> 16) & 0xff,
        g: (v >> 8) & 0xff,
        b: v & 0xff,
    };
}

/** Linearly interpolate between a and b by t in [0,1] */
const lerp = (a: number, b: number, t: number): number =>
    Math.round(a + (b - a) * t);

/**
 * Create a gradient function from an array of hex colors.
 */
export default function gradient(colors: string[]): GradientFn {
    if (colors.length < 2) {
        throw new Error('gradient requires at least two colors');
    }
    const rgbs = colors.map(hexToRgb);
    const segments = rgbs.length - 1;

    const applyGradient = (text: string): string => {
        const len = text.length;
        if (len === 0) return '';
        return (
            text
                .split('')
                .map((char, i) => {
                    const t = len === 1 ? 0 : i / (len - 1);
                    const pos = Math.min(
                        Math.floor(t * segments),
                        segments - 1,
                    );
                    const localT = t * segments - pos;
                    const c1 = rgbs[pos];
                    const c2 = rgbs[pos + 1];

                    // check if c1 or c2 is undefined
                    if (c1 === undefined || c2 === undefined) {
                        throw new Error('c1 or c2 is undefined');
                    }

                    const r = lerp(c1.r, c2.r, localT);
                    const g = lerp(c1.g, c2.g, localT);
                    const b = lerp(c1.b, c2.b, localT);
                    return `${ansiColor(r, g, b)}${char}`;
                })
                .join('') + RESET
        );
    };

    const fn = ((text: string) => applyGradient(text)) as GradientFn;

    fn.multiline = (text: string): string =>
        text
            .split('\n')
            .map((line) => applyGradient(line))
            .join('\n');

    return fn;
}
