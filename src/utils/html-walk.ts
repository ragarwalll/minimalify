import { type DefaultTreeAdapterMap } from 'parse5';

type Element = DefaultTreeAdapterMap['element'];
type Fn = (node: Element, parent?: Element) => Promise<void> | void;

interface HandlerDef {
    /** string exact match or regex test against tagName */
    match: string | RegExp;
    /** functions to call on match (legacy hook, runs between pre and post) */
    fns?: Fn[];
    /** functions to call before descending into children */
    pre?: Fn[];
    /** functions to call after descending into children */
    post?: Fn[];
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
 * Single-pass HTML tree walker with pre/post/legacy hooks.
 */
export const walkHtmlTree = async (
    node: Element,
    options: WalkOptions,
): Promise<void> => {
    const { handlers, defaultDescend = true } = options;
    const tag = node.tagName;

    // find all handlers that match this tagName
    const matched = handlers.filter((h) =>
        typeof h.match === 'string' ? tag === h.match : h.match.test(tag),
    );

    // run all pre-visit hooks
    for (const h of matched) {
        for (const fn of h.pre ?? []) {
            await fn(node, node.parentNode as Element);
        }
    }

    // run all legacy fns (original behavior)
    for (const h of matched) {
        for (const fn of h.fns ?? []) {
            await fn(node, node.parentNode as Element);
        }
    }

    // decide whether to descend
    const explicitFlags = matched
        .map((h) => h.descendChildren)
        .filter((d): d is boolean => d !== undefined);
    const shouldDescend =
        explicitFlags.length > 0
            ? explicitFlags.every(Boolean)
            : defaultDescend;

    if (shouldDescend && node.childNodes) {
        for (const child of node.childNodes) {
            if (typeof (child as any).tagName === 'string') {
                await walkHtmlTree(child as Element, options);
            }
        }
    }

    // run all post-visit hooks
    for (const h of matched) {
        for (const fn of h.post ?? []) {
            await fn(node, node.parentNode as Element);
        }
    }
};
