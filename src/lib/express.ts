/**
 * A minimal Express‐like HTTP server.
 *
 * Usage:
 *   import express, {
 *     serveStatic as expressStatic
 *   } from '@/lib/express.js'
 */

import http, {
    type IncomingMessage,
    type ServerResponse,
    type Server as HTTPServer,
} from 'http';
import { parse as parseUrl } from 'url';
import fs from 'fs';
import path from 'path';

export type Request = IncomingMessage & {
    /** The pathname portion of the URL (decoded) */
    path: string;
    /** The original URL */
    originalUrl: string;
};

export type Response = ServerResponse & {
    status(code: number): Response;
    send(body: string): Response;
};

type NextFunction = () => void;
type Handler = (req: Request, res: Response, next: NextFunction) => void;

class ExpressApp {
    private stack: Array<{
        route?: string | RegExp;
        method?: string;
        handler: Handler;
    }> = [];

    /**
     * Mount middleware or sub-app:
     *   app.use(fn)
     *   app.use(path, fn)
     */
    use(pathOrHandler: string | Handler, maybeHandler?: Handler): this {
        if (typeof pathOrHandler === 'string' && maybeHandler) {
            this.stack.push({ route: pathOrHandler, handler: maybeHandler });
        } else if (typeof pathOrHandler === 'function') {
            this.stack.push({ handler: pathOrHandler as Handler });
        }
        return this;
    }

    /**
     * Define a GET route.
     */
    get(route: string | RegExp, handler: Handler): this {
        this.stack.push({ route, method: 'GET', handler });
        return this;
    }

    /**
     * Start listening on a port.
     * Patches `res.status()` and `res.send()`.
     */
    listen(port: number, cb?: () => void): HTTPServer {
        const server = http.createServer((rawReq, rawRes) => {
            // Cast to our extended types
            const req = rawReq as Request;
            const res = rawRes as Response;

            // patch status/send
            res.status = (code: number) => {
                res.statusCode = code;
                return res;
            };
            res.send = (body: string) => {
                res.end(body);
                return res;
            };

            // set up req.path & req.originalUrl
            req.originalUrl = req.url || '';
            const parsed = parseUrl(req.originalUrl);
            req.path = decodeURIComponent(parsed.pathname || '');

            this.handle(req, res);
        });
        return server.listen(port, cb);
    }

    /** Internal dispatcher */
    private handle(req: Request, res: Response): void {
        let idx = 0;

        const next: NextFunction = () => {
            if (idx >= this.stack.length) {
                // no handler matched
                res.status(404).send('Not Found');
                return;
            }

            const layer = this.stack[idx++];
            const { route, method, handler } = layer!;

            // method check
            if (method && method !== req.method) {
                return next();
            }

            const urlPath = req.path;

            if (!route) {
                // global middleware
                return handler(req, res, next);
            }

            if (typeof route === 'string') {
                if (urlPath.startsWith(route)) {
                    // strip mount prefix
                    const prevUrl = req.url!;
                    const prevPath = req.path;
                    const remainder = urlPath.slice(route.length) || '/';
                    req.url = remainder;
                    req.path = remainder;

                    handler(req, res, () => {
                        // restore for downstream
                        req.url = prevUrl;
                        req.path = prevPath;
                        next();
                    });
                } else {
                    next();
                }
            } else {
                // RegExp route
                if (route.test(urlPath)) {
                    handler(req, res, next);
                } else {
                    next();
                }
            }
        };

        next();
    }
}

/**
 * Create a new app.
 */
export default function express(): ExpressApp {
    return new ExpressApp();
}

/**
 * Serve static files from `root`.
 */
export function serveStatic(root: string): Handler {
    const absRoot = path.resolve(root);
    return (req, res, next) => {
        if (req.method !== 'GET' && req.method !== 'HEAD') {
            return next();
        }
        const relPath = req.path.replace(/^\/+/, '');
        const filePath = path.join(absRoot, relPath);

        // prevent directory traversal
        if (!filePath.startsWith(absRoot)) {
            return res.status(403).send('Forbidden');
        }

        fs.stat(filePath, (err, stats) => {
            if (err || !stats.isFile()) {
                return next();
            }
            const ext = path.extname(filePath).toLowerCase();
            const mime = MIME_TYPES[ext] || 'application/octet-stream';
            res.setHeader('Content-Type', mime);
            const stream = fs.createReadStream(filePath);
            stream.on('error', () => res.end());
            stream.pipe(res);
        });
    };
}

/** Simple MIME‐type map */
const MIME_TYPES: Record<string, string> = {
    '.html': 'text/html; charset=UTF-8',
    '.js': 'application/javascript; charset=UTF-8',
    '.css': 'text/css; charset=UTF-8',
    '.json': 'application/json; charset=UTF-8',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.svg': 'image/svg+xml',
};
