import { type MinimalifyConfig } from '@/config/struct.js';
import { type DefaultTreeAdapterMap } from 'parse5';

/**
 * Check if the CSS is valid for processing.
 * @param node the node to check
 * @param cfg the configuration object
 * @returns true if the CSS is valid for processing, false otherwise
 */
export const isCssValidForProcessing = (
    node: DefaultTreeAdapterMap['element'],
    cfg: MinimalifyConfig,
) => {
    // Check if the node is a link element
    if (node.tagName !== 'link') return false;

    // Check if the node has a rel attribute
    if (
        node.attrs.some(
            (attr) => attr.name === 'rel' && attr.value !== 'stylesheet',
        )
    )
        return false;

    // Check if the node has a href attribute
    const hrefAttr = node.attrs.find((attr) => attr.name === 'href');
    if (!hrefAttr) return false;

    // Check if the href attribute value is a valid URL
    const hrefValue = hrefAttr.value;
    if (!hrefValue) return false;
    if (!hrefValue.startsWith('http://') && !hrefValue.startsWith('https://'))
        return true;

    return cfg.sharedDomains.some((d) => hrefValue.startsWith(d));
};

/**
 * Check if the JS is valid for processing.
 * @param node the node to check
 * @param cfg the configuration object
 * @returns true if the JS is valid for processing, false otherwise
 */
export const isJsValidForProcessing = (
    node: DefaultTreeAdapterMap['element'],
    cfg: MinimalifyConfig,
) => {
    // Check if the node is a script element
    if (node.tagName !== 'script') return false;

    // Check if the node has a src attribute
    const srcAttr = node.attrs.find((attr) => attr.name === 'src');
    if (!srcAttr) return false;

    // Check if the src attribute value is a valid URL
    const srcValue = srcAttr.value;
    if (!srcValue) return false;
    if (!srcValue.startsWith('http://') && !srcValue.startsWith('https://'))
        return true;

    return cfg.sharedDomains.some((d) => srcValue.startsWith(d));
};
