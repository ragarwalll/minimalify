import express, { static as expressStatic } from 'express';
import fs from 'fs';
import path from 'path';
import { type FSWatcher, watch as chokidarWatch } from 'chokidar';
import debounce from 'lodash.debounce';
import { WebSocketServer } from 'ws';
import { parseCfg } from '@/utils/config.js';
import { logger } from '@/utils/logger.js';
import { CSS_BUNDLE_NAME } from '@/utils/constants/bundle.js';
import { type Server, type IncomingMessage, type ServerResponse } from 'http';
import { Builder } from '../builder/build.js';
import { type EmitterEventType } from '@/utils/types.js';
import { terminalPretty } from '@/lib/terminal-pretty.js';

let server: Server<typeof IncomingMessage, typeof ServerResponse>;
let wss: WebSocketServer;
let watcher: FSWatcher;

const shutdown = () => {
    logger.spinner.update('shutting down server...');

    watcher?.close();

    wss?.clients?.forEach((client) => client?.close());
    wss?.close();

    server?.close(() => {
        logger.spinner.succeed('server closed gracefully.');
    });
};

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
process.on('uncaughtException', shutdown);
process.on('unhandledRejection', shutdown);

const LIVE_SNIPPET = `
  <script>
    (function(){
    console.log('HMR: live reload enabled');
    const ws = new WebSocket(
      (location.protocol === 'https:' ? 'wss' : 'ws')
      + '://' + location.host + '/__hmr'
    );

    ws.onmessage = async (e) => {
    console.log('HMR: message received');
      const msg = JSON.parse(e.data);
      if (msg.type === 'css-update') {
        document.querySelectorAll('link[rel=stylesheet]').forEach(link => {
          if (link.href.includes(msg.path)) {
            const url = new URL(link.href);
            url.search = '?t=' + Date.now();
            link.href = url;
          }
        });
        return;
      }

      if (msg.type === 'reload') {
        location.reload();
        return;
      }

      if (msg.type === 'page-update' && msg.path === location.pathname) {
        // 1) Parse the incoming full HTML
        const parser = new DOMParser();
        const newDoc = parser.parseFromString(msg.content, 'text/html');

        // 2) Dynamically import morphdom
          const { default: md } = await import(
            '/_modules/morphdom/morphdom-esm.js'
          );

        // 3) Morph the <html> of the current document into the new one
        md(
          document.documentElement,
          newDoc.documentElement,
          {
            // optional hooks, e.g. to preserve certain elements:
            onBeforeElUpdated: (fromEl, toEl) => {
              // e.g. skip <script> tags so they don’t get re-evaluated
              if (fromEl.tagName === 'SCRIPT') return false;
              return true;
            }
          }
        );
      }
    };
  })();
  </script></body>`;

/**
 * Start the dev server
 * @param cfgPath path to the config file
 */
export const dev = async (cfgPath: string) => {
    const startTime = performance.now();

    const cfg = await parseCfg(cfgPath);
    const builder = new Builder(cfg);

    // Initialize the builder
    await builder.init();
    await builder.build();

    // Start the server
    const app = express();

    logger.spinner.update('watching for changes...');

    // expose node_modules under /_modules so imports are same‐origin
    // Serve only specific subdirectories or files from node_modules
    app.use(
        '/_modules/morphdom',
        expressStatic(
            path.resolve(process.cwd(), 'node_modules/morphdom/dist'),
        ),
    );

    app.get(/^\/(.+\.html)$/, (req, res, next) => {
        try {
            const resolvedPath = path.resolve(cfg.out_dir, '.' + req.path); // Normalize the path
            if (!resolvedPath.startsWith(cfg.out_dir)) {
                // Ensure the path is within cfg.out_dir
                res.status(403).send('Forbidden');
                return;
            }
            if (!fs.existsSync(resolvedPath)) return next();
            let html = fs.readFileSync(resolvedPath, 'utf8');
            html = html.replace(/<\/body>/, LIVE_SNIPPET);
            res.send(html);
            // eslint-disable-next-line @typescript-eslint/no-unused-vars
        } catch (_err: unknown) {
            res.status(500).send('Internal Server Error');
        }
    });

    app.use(expressStatic(cfg.out_dir));
    // Watch for changes in the source directory
    server = app.listen(cfg.dev.port, () => {
        const endTime = performance.now();
        const timeTaken = ((endTime - startTime) / 1000).toFixed(2);

        logger.info(
            `minimalify dev server started on port ${cfg.dev.port} (took ${timeTaken}s)`,
        );
        logger.info(
            `open your browser at ${terminalPretty.bold.underline(`http://localhost:${cfg.dev.port}/index.html`)}`,
        );
        logger.info('press Ctrl+C to stop the server');
    });

    // Create the websocket server
    wss = new WebSocketServer({ noServer: true });

    server.on('upgrade', (req, sock, head) => {
        if (req.url === '/__hmr') {
            wss.handleUpgrade(req, sock, head, (ws) =>
                ws.send(JSON.stringify({ type: 'connected' })),
            );
        } else {
            sock.destroy();
        }
    });

    // Debounced, coalesced watch events
    watcher = chokidarWatch(cfg.src_dir, {
        ignored: [cfg.out_dir, '**/node_modules/**'],
        ignoreInitial: true,
        usePolling: false,
        interval: 100,
    });

    const onChange = debounce(async (evt: string, fp: string) => {
        logger.spinner.update('rebundling...');
        const startTime = performance.now();

        const abs = path.resolve(fp);
        const rebuilt = await builder.incrementalBuild(
            abs,
            evt as EmitterEventType,
        );

        for (const client of wss.clients) {
            if (fp.endsWith('.css')) {
                logger.debug(
                    `rebuilt css file → ${path.relative(process.cwd(), fp)}`,
                );
                client.send(
                    JSON.stringify({
                        type: 'css-update',
                        path: path.join('css', CSS_BUNDLE_NAME),
                    }),
                );
            } else if (fp.endsWith('.js')) {
                logger.debug(
                    `rebuilt js file → ${path.relative(process.cwd(), fp)}`,
                );
                client.send(JSON.stringify({ type: 'reload' }));
            } else {
                for (const url of rebuilt) {
                    logger.debug(
                        `rebuilt page → ${path.relative(process.cwd(), url)}`,
                    );
                    const file = path.join(cfg.out_dir, url);
                    if (fs.existsSync(file)) {
                        const content = fs.readFileSync(file, 'utf8');
                        client.send(
                            JSON.stringify({
                                type: 'page-update',
                                path: url,
                                content,
                            }),
                        );
                    }
                }
            }
        }
        const endTime = performance.now();
        const timeTaken = ((endTime - startTime) / 1000).toFixed(2);

        logger.info(
            `file changed → ${terminalPretty.underline(path.relative(process.cwd(), fp))} (${evt}) (took ${timeTaken}s)`,
        );
        logger.spinner.update(`watching for changes...`);
    }, 100);

    watcher.on('all', onChange);
};
