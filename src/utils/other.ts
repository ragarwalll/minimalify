import os from 'os';
import pLimit from 'p-limit';

const concurrency = os.cpus().length;
export const limit = pLimit(concurrency);

/**
 * Parse the attributes from a string
 * @param str the string to parse
 * @returns an object with the attributes
 */
export const parseAttrs = (str: string): Record<string, string> => {
    const out: Record<string, string> = {};
    const re = /([\w-]+)\s*=\s*"([^"]*)"/g;
    let m: RegExpExecArray | null;
    while ((m = re.exec(str))) {
        if (m[1] !== undefined) {
            out[m[1]] = m[2] || '';
        }
    }
    return out;
};
