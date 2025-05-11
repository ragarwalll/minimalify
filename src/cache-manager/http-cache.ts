import path from 'path';
import fs from 'fs';
import axios, { type AxiosRequestConfig } from 'axios';
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
import { type MinimalifyConfig } from '@/config/struct.js';

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
    private cfg: MinimalifyConfig;
    private enabled: boolean;

    /**
     * Create a new HTTP cache.
     *
     * @param baseDir The base directory to store the cache in.
     */
    constructor(cfg: MinimalifyConfig, baseDir: string) {
        this.cfg = cfg;

        // check if cache is enabled (this.cfg.cache)
        // in key is not enabled, we assume that the cache is enabled
        if (this.cfg.cache === undefined || this.cfg.cache === true) {
            this.enabled = true;
            this.cacheDir = path.join(baseDir, CACHE_POST_DIR);
            ensureDir(this.cacheDir);
            logger.debug(
                `using cache directory → ${chalk.underline(path.relative(process.cwd(), this.cacheDir))}`,
            );
        } else {
            this.enabled = false;
            this.cacheDir = '';
            logger.debug(`cache is disabled, not using cache directory`);
        }
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
        if (!this.enabled) {
            return (
                await this._callUri(url, {
                    responseType: 'text',
                    validateStatus: (s) => s < 500,
                })
            ).data as string;
        }
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
        const res = await this._callUri(url, {
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

    /**
     * Retrives the url for the given URL.
     * @param url the resource URL
     * @param config the axios request config
     * @returns the response
     */
    protected _callUri(url: string, config: AxiosRequestConfig) {
        return axios.get(url, config);
    }
}
