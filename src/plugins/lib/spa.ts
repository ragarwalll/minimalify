import fs from 'fs';
import path from 'path';
import fg from 'fast-glob';
import { type MinimalifyPlugin } from '../typings.js';
import { logger } from '@/utils/logger.js';
import { terminalPretty } from '@/lib/terminal-pretty.js';

/**
 * spa plugin
 *
 * Generates a simple service-worker (sw.js) that pre-caches
 * all HTML, CSS, JS and image assets for offline use.
 */
export const spa: MinimalifyPlugin = {
    name: 'spa',

    async onPostBuild(cfg) {
        logger.debug(`${this.name}-plugin: generating service-worker`);

        const outDir = cfg.out_dir;
        // Gather all files to pre-cache
        const cacheFiles: string[] = [];
        const walk = (dir: string) => {
            for (const fn of fs.readdirSync(dir)) {
                const abs = path.join(dir, fn);
                if (fs.statSync(abs).isDirectory()) {
                    walk(abs);
                } else {
                    const rel = path.relative(outDir, abs).replace(/\\/g, '/');
                    cacheFiles.push(`'${rel}'`);
                }
            }
        };
        walk(outDir);

        const sw = `\
const CACHE_NAME = 'statickit-cache-v1';
const ASSETS = [
  ${cacheFiles.join(',\n  ')}
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => cache.addAll(ASSETS))
  );
});

self.addEventListener('fetch', event => {
  event.respondWith(
    caches.match(event.request).then(cached => cached ||
      fetch(event.request))
  );
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.map(k => {
        if (k !== CACHE_NAME) return caches.delete(k);
      }))
    )
  );
});
`;
        // Write service worker file
        fs.writeFileSync(path.join(outDir, 'sw.js'), sw, 'utf8');
        logger.info(
            `${this.name}-plugin: service-worker generated → ${terminalPretty.underline(path.relative(process.cwd(), path.join(outDir, 'sw.js')))}`,
        );

        const registerSnippet = `
<script>
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('sw.js')
    .then(reg=> console.log('SW registered', reg))
    .catch(err=> console.error('SW failed', err));
}
</script>
</body>`;

        const htmlFiles = await fg('**/*.html', {
            cwd: outDir,
            absolute: true,
        });
        for (const htmlPath of htmlFiles) {
            let html = fs.readFileSync(htmlPath, 'utf8');
            if (!html.includes('navigator.serviceWorker.register')) {
                html = html.replace(/<\/body>/i, registerSnippet);
                fs.writeFileSync(htmlPath, html, 'utf8');
            }
        }

        logger.debug(
            `${this.name}-plugin: injected service-worker registration into HTML pages → ${htmlFiles.join(', ')}`,
        );
    },
};
