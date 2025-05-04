import { LRUCache } from 'lru-cache';

interface CacheOptions {
  max: number;  // Maximum number of items
  ttl: number;  // Time to live in milliseconds
}

interface CachedItem<T> {
  data: T;
  timestamp: number;
  source: 'cache' | 'fresh';
}

class CacheService {
  private cache: LRUCache<string, any>;
  private static instance: CacheService;

  private constructor(options: CacheOptions) {
    this.cache = new LRUCache({
      max: options.max,
      ttl: options.ttl,
      updateAgeOnGet: true
    });
  }

  static getInstance(options: CacheOptions = { max: 100, ttl: 1000 * 60 * 15 }): CacheService {
    if (!CacheService.instance) {
      CacheService.instance = new CacheService(options);
    }
    return CacheService.instance;
  }

  async get<T>(key: string): Promise<CachedItem<T> | null> {
    const cached = this.cache.get(key);
    if (cached) {
      return {
        data: cached,
        timestamp: Date.now(),
        source: 'cache'
      };
    }
    return null;
  }

  async set<T>(key: string, data: T): Promise<void> {
    this.cache.set(key, data);
  }

  async invalidate(key: string): Promise<void> {
    this.cache.delete(key);
  }

  async invalidateAll(): Promise<void> {
    this.cache.clear();
  }

  generateKey(queries: Array<{ queryId: string; naturalQuery: string }>): string {
    return queries
      .map(q => `${q.queryId}:${q.naturalQuery}`)
      .sort()
      .join('|');
  }
}

export default CacheService; 