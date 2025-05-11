import { type DefaultTreeAdapterMap } from 'parse5';

type Element = DefaultTreeAdapterMap['element'];
type Fn = (node: Element, parent?: Element) => Promise<void> | void;

interface HandlerDef {
    /** string exact match or regex test against tagName */
    match: string | RegExp;
    /** functions to call on match */
    fns: Fn[];
    /**
     * Optional override for whether to descend into children.
     * If ANY matched handlerDef has descendChildren,
     * we AND them together; otherwise use defaultDescend.
     */
    descendChildren?: boolean;
}

interface WalkOptions {
    handlers: HandlerDef[];
    defaultDescend?: boolean; // defaults to true
}

/**
 * Single-pass HTML tree walker. Matches each node against all
 * handlerDefs (string or regex), invokes their fns, then
 * descends according to the AND of any explicit descendChildren flags
 * or the defaultDescend.
 */
export const walkHtmlTree = async (node: Element, options: WalkOptions) => {
    const { handlers, defaultDescend = true } = options;
    const tag = node.tagName;

    // collect all handlers that match this tag
    const matched = handlers.filter((h) =>
        typeof h.match === 'string' ? tag === h.match : h.match.test(tag),
    );

    // invoke all fns
    for (const h of matched) {
        for (const fn of h.fns) {
            await fn(node, node.parentNode as Element);
        }
    }

    // determine whether to descend:
    // if any handlerDef provided descendChildren, AND them all;
    // otherwise fall back to defaultDescend
    const explicit = matched
        .map((h) => h.descendChildren)
        .filter((d): d is boolean => d !== undefined);

    const shouldDescend =
        explicit.length > 0 ? explicit.every(Boolean) : defaultDescend;

    if (!shouldDescend) return;

    // recurse into element‐like children
    if (node.childNodes) {
        for (const child of node.childNodes) {
            if (typeof (child as any).tagName === 'string') {
                await walkHtmlTree(child as Element, options);
            }
        }
    }
};
