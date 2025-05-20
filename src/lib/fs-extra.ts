/**
 * Minimal fs-extra clone supporting only readJSONSync.
 * Usage:
 *   import fs from '@/lib/fs-extra.js'
 *   const pkg = fs.readJSONSync<PackageJson>(path)
 */

import { readFileSync } from 'fs';

export interface ReadJSONOptions {
    /** File encoding; defaults to 'utf8' */
    encoding?: BufferEncoding | null;
}

/**
 * Synchronously read a JSON file and parse into an object.
 * @param file  Path to the JSON file
 * @param options  Optional encoding (default 'utf8')
 */
export function readJSONSync<T = any>(
    file: string,
    options: ReadJSONOptions = {},
): T {
    const encoding = options.encoding ?? 'utf8';
    const content = readFileSync(file, { encoding });
    return JSON.parse(content) as T;
}

const fsExtra = { readJSONSync };

export default fsExtra;
