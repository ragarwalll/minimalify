/**
 * Requestly: a minimal Axios‐like HTTP client using Fetch API.
 *
 * Usage:
 *   import Requestly, {
 *     type RequestlyRequestConfig,
 *     type RequestlyResponse
 *   } from '@/lib/requestly.js'
 *
 *   const res = await Requestly.get<string>('https://...', {
 *     headers: { 'If-None-Match': '...' },
 *     validateStatus: s => s < 500,
 *     responseType: 'text'
 *   })
 *   console.log(res.status, res.data)
 */

export interface RequestlyRequestConfig {
    headers?: Record<string, string>;
    validateStatus?: (status: number) => boolean;
    responseType?: 'text' | 'json';
}

export interface RequestlyResponse<T = any> {
    status: number;
    data: T;
    headers: Record<string, string>;
}

const get = async <T = any>(
    url: string,
    config: RequestlyRequestConfig = {},
): Promise<RequestlyResponse<T>> => {
    const { headers, validateStatus, responseType } = config;
    const res = await fetch(url, { method: 'GET', headers });

    const status = res.status;
    const ok = validateStatus?.(status) ?? (status >= 200 && status < 300);

    let data: any;
    if (responseType === 'json') {
        data = await res.json();
    } else {
        data = await res.text();
    }

    const h: Record<string, string> = {};
    res.headers.forEach((v, k) => {
        h[k.toLowerCase()] = v;
    });

    if (!ok) {
        const err: any = new Error(`Request failed with status ${status}`);
        err.response = { status, data, headers: h };
        throw err;
    }

    return { status, data: data as T, headers: h };
};

const Requestly = { get };

export default Requestly;
