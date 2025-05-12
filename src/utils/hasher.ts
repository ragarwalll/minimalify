import xxhash from 'xxhash-wasm';

const createFingerprintFn = async (): Promise<(s: string) => string> => {
    const { h64ToString } = await xxhash();
    return (s: string) => h64ToString(s);
};

let fingerprintFnPromise: Promise<(s: string) => string>;

/**
 * Compute a 64-bit hex fingerprint of a string.
 */
export const fingerprint = async (s: string): Promise<string> => {
    if (!fingerprintFnPromise) {
        fingerprintFnPromise = createFingerprintFn();
    }
    const fn = await fingerprintFnPromise;
    return fn(s);
};
