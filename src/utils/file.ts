import { FileError } from '@/error/file-error.js';
import { promises as fs } from 'fs';
import { createRequire } from 'module';
import path from 'path';
import { pathToFileURL } from 'url';

const requireCJS = createRequire(import.meta.url);

export async function dynamicImport<T = any>(modulePath: string): Promise<T> {
    const ext = path.extname(modulePath).toLowerCase();

    // JSON can always be loaded via CJS require
    if (ext === '.json') {
        return requireCJS(modulePath) as T;
    }

    // .cjs → CJS
    if (ext === '.cjs') {
        return requireCJS(modulePath) as T;
    }

    // Try to require (this will throw ERR_REQUIRE_ESM if module is ESM)
    try {
        return requireCJS(modulePath) as T;
    } catch (err: any) {
        if (err.code === 'ERR_REQUIRE_ESM') {
            // Handle ESM .js
            const url = pathToFileURL(modulePath).href;
            // JSON import assertions only matter if we import JSON via import()
            if (ext === '.json') {
                const mod = await import(/* webpackIgnore: true */ url, {
                    assert: { type: 'json' },
                });
                return mod.default as T;
            }
            const mod = await import(/* webpackIgnore: true */ url);
            return (mod.default ?? mod) as T;
        }
        throw err;
    }
}

/**
 * Read a local file dynamically.
 * @param filePath the path to the file
 * @returns the file contents as a string
 */
export const readFile = async (filePath: string): Promise<string> => {
    try {
        const fileContents = await fs.readFile(filePath, 'utf-8');
        return fileContents;
    } catch (err) {
        throw new FileError(
            `Failed to read file at ${filePath}: ${(err as Error).message}`,
        );
    }
};
