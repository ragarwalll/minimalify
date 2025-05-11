import { FileError } from '@/error/file-error.js';
import { promises as fs } from 'fs';

/**
 * Dynamically load a module by path.  Works in both ESM and CJS.
 *
 * @param modulePath - A relative or absolute path, or package specifier
 */
export async function dynamicImport<T = any>(modulePath: string): Promise<T> {
    // In a CJS build, `require` should be available.
    // In an ESM build, `require` is undefined and `import()` works.
    // We also guard against bundlers swallowing the import by adding webpackIgnore.
    if (typeof require === 'function') {
        // Note: require is sync, but we wrap in a Promise to unify the API.
        // eslint-disable-next-line @typescript-eslint/no-require-imports
        return Promise.resolve(require(modulePath) as T);
    } else {
        // webpackIgnore prevents Webpack from trying to statically analyze this import
        // so that it truly happens at runtime.
        // Other bundlers may need their own pragmas.
        return (await import(/* webpackIgnore: true */ modulePath)) as T;
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
