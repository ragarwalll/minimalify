/**
 * A minimal debounce implementation.
 */

type Timer = ReturnType<typeof setTimeout>;

export interface DebouncedFunc<T extends (...args: any[]) => any> {
    (...args: Parameters<T>): void;
    cancel(): void;
}

/**
 * Creates a debounced function that delays invoking `fn`
 * until `wait` milliseconds have elapsed since the last call.
 */
const debounce = <T extends (...args: any[]) => any>(
    fn: T,
    wait = 0,
): DebouncedFunc<T> => {
    let timer: Timer | null = null;

    const debounced = ((...args: Parameters<T>) => {
        if (timer) clearTimeout(timer);
        timer = setTimeout(() => {
            fn(...args);
            timer = null;
        }, wait);
    }) as DebouncedFunc<T>;

    debounced.cancel = () => {
        if (timer) {
            clearTimeout(timer);
            timer = null;
        }
    };

    return debounced;
};

export default debounce;
