import { type MinimalifyConfig } from '@/config/struct.js';
import { type DefaultTreeAdapterMap } from 'parse5';
import path from 'path';

export interface AssetDetection {
    node: DefaultTreeAdapterMap['element'];
    cfg: MinimalifyConfig;
    checkLocalUri?: boolean;
    checkRemoteUri?: boolean;
}

export interface AssetDetectionResult {
    isValid: boolean;
    value: string;
}

/**
 * CSS
 */
export const isCssValidForProcessing = ({
    node,
    cfg,
    checkLocalUri = true,
    checkRemoteUri = true,
}: AssetDetection): AssetDetectionResult => {
    if (node.tagName !== 'link') {
        return { isValid: false, value: '' };
    }

    if (
        !node.attrs.some(
            (a) => a.name === 'rel' && a.value.toLowerCase() === 'stylesheet',
        )
    ) {
        return { isValid: false, value: '' };
    }

    const hrefAttr = node.attrs.find((a) => a.name === 'href');
    if (!hrefAttr || !hrefAttr.value) {
        return { isValid: false, value: '' };
    }

    const value = hrefAttr.value;
    const isLocal = !/^https?:\/\//.test(value);
    const isShared = cfg.sharedDomains.some((d) => value.startsWith(d));

    const isValid = (checkLocalUri && isLocal) || (checkRemoteUri && isShared);

    return { isValid, value };
};

/**
 * JS
 */
export const isJsValidForProcessing = ({
    node,
    cfg,
    checkLocalUri = true,
    checkRemoteUri = true,
}: AssetDetection): AssetDetectionResult => {
    if (node.tagName !== 'script') {
        return { isValid: false, value: '' };
    }

    const srcAttr = node.attrs.find((a) => a.name === 'src');
    if (!srcAttr || !srcAttr.value) {
        return { isValid: false, value: '' };
    }

    const value = srcAttr.value;
    const isLocal = !/^https?:\/\//.test(value);
    const isShared = cfg.sharedDomains.some((d) => value.startsWith(d));

    const isValid = (checkLocalUri && isLocal) || (checkRemoteUri && isShared);

    return { isValid, value };
};

/**
 * IMG
 */
export const isImgValidForProcessing = ({
    node,
    cfg,
    checkLocalUri = true,
    checkRemoteUri = true,
}: AssetDetection): AssetDetectionResult => {
    if (node.tagName !== 'img') {
        return { isValid: false, value: '' };
    }

    const srcAttr = node.attrs.find((a) => a.name === 'src');
    if (!srcAttr || !srcAttr.value) {
        return { isValid: false, value: '' };
    }
    const value = srcAttr.value;

    const ext = path.extname(value).replace(/^\./, '').toLowerCase();
    const isLocal = !/^https?:\/\//.test(value);
    const isShared =
        cfg.sharedDomains.some((d) => value.startsWith(d)) &&
        (cfg.images?.supportedFormats ?? []).includes(ext);

    const isValid = (checkLocalUri && isLocal) || (checkRemoteUri && isShared);
    return { isValid, value };
};

/**
 * OBJECT
 */
export const isObjectValidForProcessing = ({
    node,
    cfg,
    checkLocalUri = true,
    checkRemoteUri = true,
}: AssetDetection): AssetDetectionResult => {
    if (node.tagName !== 'object') {
        return { isValid: false, value: '' };
    }

    const dataAttr = node.attrs.find((a) => a.name === 'data');
    if (!dataAttr || !dataAttr.value) {
        return { isValid: false, value: '' };
    }
    const value = dataAttr.value;

    const ext = path.extname(value).replace(/^\./, '').toLowerCase();
    const isLocal = !/^https?:\/\//.test(value);
    const isShared =
        cfg.sharedDomains.some((d) => value.startsWith(d)) &&
        (cfg.images?.supportedFormats ?? []).includes(ext);

    const isValid = (checkLocalUri && isLocal) || (checkRemoteUri && isShared);
    return { isValid, value };
};
