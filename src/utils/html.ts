import { parseFragment, serialize } from 'parse5';

export const preserveHtml = (value: string) => {
    // parse as a fragment, then serialize back.
    // any unbalanced tags will get fixed or dropped,
    // but valid inline tags like <strike> will stay.
    const frag = parseFragment(value);
    return serialize(frag);
};
