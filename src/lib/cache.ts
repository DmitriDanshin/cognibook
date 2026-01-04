/**
 * Universal in-memory LRU cache
 * Can be used for any data that needs caching
 */

interface CacheEntry<T> {
    value: T;
    expiresAt: number;
}

export class LRUCache<T = unknown> {
    private cache: Map<string, CacheEntry<T>>;
    private readonly maxSize: number;
    private readonly defaultTtlMs: number;

    constructor(maxSize = 100, defaultTtlMs = 5 * 60 * 1000) {
        this.cache = new Map();
        this.maxSize = maxSize;
        this.defaultTtlMs = defaultTtlMs;
    }

    get(key: string): T | undefined {
        const entry = this.cache.get(key);
        if (!entry) return undefined;

        if (Date.now() > entry.expiresAt) {
            this.cache.delete(key);
            return undefined;
        }

        // Move to end (most recently used)
        this.cache.delete(key);
        this.cache.set(key, entry);

        return entry.value;
    }

    set(key: string, value: T, ttlMs?: number): void {
        this.cache.delete(key);

        if (this.cache.size >= this.maxSize) {
            const oldestKey = this.cache.keys().next().value;
            if (oldestKey !== undefined) {
                this.cache.delete(oldestKey);
            }
        }

        this.cache.set(key, {
            value,
            expiresAt: Date.now() + (ttlMs ?? this.defaultTtlMs),
        });
    }

    has(key: string): boolean {
        return this.get(key) !== undefined;
    }

    delete(key: string): boolean {
        return this.cache.delete(key);
    }

    deleteByPrefix(prefix: string): void {
        for (const key of this.cache.keys()) {
            if (key.startsWith(prefix)) {
                this.cache.delete(key);
            }
        }
    }

    clear(): void {
        this.cache.clear();
    }

    get size(): number {
        return this.cache.size;
    }
}

// Global cache instance (200 items, 10 min TTL)
export const cache = new LRUCache<unknown>(200, 10 * 60 * 1000);
