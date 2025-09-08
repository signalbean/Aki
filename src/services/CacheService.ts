// src/services/CacheService.ts

import { Collection } from 'discord.js';
import { CONFIG } from '@shared/config';
import { logger } from '@shared/utils';
import { CacheItem } from '@shared/types';

const caches = new Map<string, Collection<string, CacheItem<any>>>();
const DEFAULT_TTL = CONFIG.API.RANDOM_IMAGE_CACHE_TTL_MS;
let cleanupInterval: ReturnType<typeof setInterval> | null = null;

const getCache = <T>(name: string): Collection<string, CacheItem<T>> => {
  if (!caches.has(name)) {
    caches.set(name, new Collection());
  }
  return caches.get(name)!;
};

const cleanupAllCaches = (): void => {
  const now = Date.now();
  for (const [, cache] of caches) {
    for (const [key, item] of cache) {
      if (now - item.timestamp > item.ttl) {
        cache.delete(key);
      }
    }
  }
};

export const CacheService = Object.freeze({
  initialize(): void {
    if (cleanupInterval) return;
    cleanupInterval = setInterval(cleanupAllCaches, 300000); // 5 minutes
  },
  
  destroy(): void {
    if (cleanupInterval) {
      clearInterval(cleanupInterval);
      cleanupInterval = null;
    }
    caches.clear();
    logger.log('CacheService destroyed');
  },
  
  set<T>(cacheName: string, key: string, data: T, ttl = DEFAULT_TTL): void {
    getCache<T>(cacheName).set(key, Object.freeze({ data, timestamp: Date.now(), ttl }));
  },
  
  get<T>(cacheName: string, key: string): T | null {
    const cache = getCache<T>(cacheName);
    const item = cache.get(key);
    
    if (!item) return null;
    if (Date.now() - item.timestamp > item.ttl) {
      cache.delete(key);
      return null;
    }
    
    return item.data;
  },

  getStats(): Record<string, { items: number; totalSize: number }> {
    const stats: Record<string, { items: number; totalSize: number }> = {};
    
    for (const [cacheName, cache] of caches) {
      stats[cacheName] = { items: cache.size, totalSize: cache.size };
    }
    
    return stats;
  },
});
