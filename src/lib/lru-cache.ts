/**
 * A simple, robust LRU (Least Recently Used) cache.
 * Usage:
 *   import { LRUCache } from './lru-cache.js'
 *   const cache = new LRUCache<string, string>({ max: 100 })
 *   cache.set('a', '1')
 *   cache.get('a') // '1'
 *   cache.has('a') // true
 *   cache.delete('a')
 *   cache.clear()
 */

export interface LRUCacheOptions {
    /** Maximum number of entries in cache */
    max: number;
}

interface Entry<K, V> {
    key: K;
    value: V;
    prev: Entry<K, V> | null;
    next: Entry<K, V> | null;
}

export class LRUCache<K, V> {
    private max: number;
    private cache = new Map<K, Entry<K, V>>();
    private head: Entry<K, V> | null = null;
    private tail: Entry<K, V> | null = null;

    constructor(options: LRUCacheOptions) {
        if (options.max <= 0) {
            throw new Error('LRUCache max must be > 0');
        }
        this.max = options.max;
    }

    /** Number of items in cache */
    get size(): number {
        return this.cache.size;
    }

    /**
     * Returns true if key exists in cache.
     * Does not alter recency order.
     */
    has(key: K): boolean {
        return this.cache.has(key);
    }

    /**
     * Get a value by key. Marks it as most-recently used.
     */
    get(key: K): V | undefined {
        const entry = this.cache.get(key);
        if (!entry) return undefined;
        this.moveToHead(entry);
        return entry.value;
    }

    /**
     * Set a value by key. If new, may evict LRU item.
     */
    set(key: K, value: V): this {
        let entry = this.cache.get(key);
        if (entry) {
            entry.value = value;
            this.moveToHead(entry);
        } else {
            entry = { key, value, prev: null, next: null };
            this.cache.set(key, entry);
            this.addToHead(entry);
            if (this.cache.size > this.max) {
                this.removeLRU();
            }
        }
        return this;
    }

    /**
     * Delete an entry by key.
     */
    delete(key: K): boolean {
        const entry = this.cache.get(key);
        if (!entry) return false;
        this.unlink(entry);
        this.cache.delete(key);
        return true;
    }

    /** Clear the entire cache. */
    clear(): void {
        this.cache.clear();
        this.head = null;
        this.tail = null;
    }

    /** Internal: move entry to head (most-recently used) */
    private moveToHead(entry: Entry<K, V>): void {
        if (entry === this.head) return;
        this.unlink(entry);
        this.addToHead(entry);
    }

    /** Internal: add entry at head */
    private addToHead(entry: Entry<K, V>): void {
        entry.next = this.head;
        entry.prev = null;
        if (this.head) {
            this.head.prev = entry;
        }
        this.head = entry;
        if (!this.tail) {
            this.tail = entry;
        }
    }

    /** Internal: remove the tail entry (LRU item) */
    private removeLRU(): void {
        if (!this.tail) return;
        const lru = this.tail;
        this.unlink(lru);
        this.cache.delete(lru.key);
    }

    /** Internal: unlink entry from the list */
    private unlink(entry: Entry<K, V>): void {
        const { prev, next } = entry;
        if (prev) {
            prev.next = next;
        } else {
            this.head = next;
        }
        if (next) {
            next.prev = prev;
        } else {
            this.tail = prev;
        }
        entry.prev = null;
        entry.next = null;
    }
}
