import path from 'path';

const DIST_DIR = (() => {
    // CommonJS (__dirname is defined)
    if (typeof __dirname !== 'undefined') {
        // __dirname is already normalized
        return __dirname;
    }

    // ESM (import.meta.url is defined)
    if (typeof import.meta?.url === 'string') {
        // file://C:/… on Windows comes in with an extra leading slash
        // @ts-ignore
        const filePath = new URL(import.meta.url).pathname;

        // On Windows, pathname starts with "/" before drive letter
        const normalized = filePath.replace(/^\/([A-Za-z]:\/)/, '$1');
        return path.dirname(decodeURIComponent(normalized));
    }

    // Fallback
    return process.cwd();
})();

export const CLI_DIR = (() => {
    // Always start from the distribution directory
    const cliDir = path.join(DIST_DIR, '..');

    // In dev, strip off everything from the last "src" onward
    if (process.env.NODE_ENV === 'development') {
        const srcIndex = cliDir.lastIndexOf('src');
        if (srcIndex !== -1) {
            return cliDir.slice(0, srcIndex);
        }
        return cliDir;
    }

    // In production, just return the dist path
    return cliDir;
})();
