import path from 'path';
import fs from 'fs';
import axios from 'axios';
import { ensureDir } from '@/utils/dir.js';
import { logError, logger } from '@/utils/logger.js';
import { CACHE_POST_DIR } from '@/utils/constants/cache.js';
import {
    HEADER_ETAG,
    HEADER_IF_MODIFIED_SINCE,
    HEADER_IF_NONE_MATCH,
    HEADER_LAST_MODIFIED,
} from '@/utils/constants/headers.js';
import chalk from 'chalk';

/**
 * Cache metadata for HTTP responses.
 */
interface CacheMeta {
    etag?: string;
    lastModified?: string;
}

/**
 * Simple HTTP cache that stores response bodies and metadata (ETag,
 * Last-Modified) in a local directory so repeated fetches are
 * conditional / no-ops if unchanged.
 */
export class HTTPCache {
    private cacheDir: string;

    /**
     * Create a new HTTP cache.
     *
     * @param baseDir The base directory to store the cache in.
     */
    constructor(baseDir: string) {
        this.cacheDir = path.join(baseDir, CACHE_POST_DIR);
        ensureDir(this.cacheDir);
        logger.debug(
            `using cache directory → ${chalk.underline(path.relative(process.cwd(), this.cacheDir))}`,
        );
    }

    /**
     * Fetches the given URL. If we have a cached copy with ETag or
     * Last-Modified, we issue a conditional GET. On 304 we return
     * the cached body. Otherwise we update the cache.
     *
     * @param url  the resource URL
     * @returns    the response text
     */
    async fetch(url: string): Promise<string> {
        const key = encodeURIComponent(url);
        const bodyPath = path.join(this.cacheDir, key + '.body');
        const metaPath = path.join(this.cacheDir, key + '.json');

        // prepare conditional headers
        const headers: Record<string, string> = {};
        if (fs.existsSync(metaPath)) {
            try {
                const meta = JSON.parse(
                    fs.readFileSync(metaPath, 'utf8'),
                ) as CacheMeta;
                if (meta.etag) {
                    headers[HEADER_IF_NONE_MATCH] = meta.etag;
                }
                if (meta.lastModified) {
                    headers[HEADER_IF_MODIFIED_SINCE] = meta.lastModified;
                }
            } catch (e) {
                // do nothing, just ignore the error
                logError(e);
                logger.warn(
                    `failed to read cache metadata for → ${chalk.underline(url)}`,
                );
            }
        }

        // make request
        const res = await axios.get(url, {
            headers,
            validateStatus: (s) => s < 500,
            responseType: 'text',
        });

        if (res.status === 304 && fs.existsSync(bodyPath)) {
            // not modified → return cached body
            return fs.readFileSync(bodyPath, 'utf8');
        }

        // write new body
        fs.writeFileSync(bodyPath, res.data as string, 'utf8');

        // write new metadata
        const newMeta: CacheMeta = {};

        if (res.headers.etag) {
            newMeta.etag = res.headers.etag;
        }

        if (res.headers[HEADER_LAST_MODIFIED]) {
            newMeta.lastModified = res.headers[HEADER_ETAG] as string;
        }

        fs.writeFileSync(metaPath, JSON.stringify(newMeta), 'utf8');
        return res.data;
    }
}
