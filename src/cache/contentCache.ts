/**
 * In-memory cache with TTL (default 60 seconds).
 */

interface CacheEntry<T> {
  data: T;
  expiresAt: number;
}

export class ContentCache<T = unknown> {
  private cache = new Map<string, CacheEntry<T>>();
  private ttlMs: number;

  constructor(ttlSeconds: number = 60) {
    this.ttlMs = ttlSeconds * 1000;
  }

  get(key: string): T | null {
    const entry = this.cache.get(key);
    if (!entry) return null;

    if (Date.now() > entry.expiresAt) {
      this.cache.delete(key);
      return null;
    }

    return entry.data;
  }

  set(key: string, data: T): void {
    this.cache.set(key, {
      data,
      expiresAt: Date.now() + this.ttlMs,
    });
  }

  clear(): void {
    this.cache.clear();
  }
}
