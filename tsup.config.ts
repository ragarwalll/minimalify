import { defineConfig } from 'tsup';

const isDev = process.env.npm_lifecycle_event === 'dev';

export default defineConfig({
    clean: true,
    dts: true,
    entry: ['src/index.ts'],
    format: ['esm', 'cjs'],
    minify: !isDev,
    metafile: !isDev,
    sourcemap: true,
    target: 'esnext',
    outDir: 'dist',
    banner: {
        js: '#!/usr/bin/env node',
    },
    onSuccess: isDev ? 'node dist/index.js' : undefined,
});
