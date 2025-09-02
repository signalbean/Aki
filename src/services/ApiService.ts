// src/services/ApiService.ts

import {
  CONFIG,
  BLACKLISTED_TAGS,
  UNKNOWN_ARTIST,
} from '@shared/config';
import {
  DanbooruPost,
  ContentRating,
  DanbooruTag,
} from '@shared/types';
import { ApiServerError } from '@shared/error';
import { logger } from '@shared/utils';
import { CacheService } from '@services/CacheService';

const rateLimiter = new Map<string, number>();
const RATE_WINDOW = 60000;
const MAX_REQUESTS = 30;

function checkRateLimit(): boolean {
  const now = Date.now();
  const windowStart = Math.floor(now / RATE_WINDOW) * RATE_WINDOW;
  const requests = rateLimiter.get(windowStart.toString()) || 0;
  
  if (requests >= MAX_REQUESTS) return false;
  
  rateLimiter.set(windowStart.toString(), requests + 1);
  for (const [key] of rateLimiter) {
    if (parseInt(key) < now - RATE_WINDOW) rateLimiter.delete(key);
  }
  return true;
}

async function fetchWithTimeout(url: string): Promise<Response> {
  if (!checkRateLimit()) throw new Error('Rate limit exceeded. Please try again later.');
  
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), CONFIG.API.TIMEOUT_MS);

  try {
    return await fetch(url, {
      headers: { 
        'User-Agent': CONFIG.API.USER_AGENT,
        'Accept': 'application/json'
      },
      signal: controller.signal,
    });
  } catch (error) {
    if (error instanceof Error) {
      if (error.name === 'AbortError') {
        throw new Error('Request timeout');
      }
      if (error.message.includes('fetch failed')) {
        throw new Error('Network connection failed');
      }
    }
    throw error;
  } finally {
    clearTimeout(timeout);
  }
}

function normalizePost(post: unknown): DanbooruPost | null {
  if (!post || typeof post !== 'object') return null;

  const data = post as Record<string, unknown>;
  const imageUrl = data.file_url || data.large_file_url || data.preview_file_url;
  
  if (!imageUrl || typeof imageUrl !== 'string' || !data.tag_string || !data.id) return null;

  const tags = String(data.tag_string).toLowerCase().split(' ');
  if (tags.some(tag => BLACKLISTED_TAGS.has(tag))) return null;

  return Object.freeze({
    id: Number(data.id),
    file_url: `${imageUrl.split('?')[0]}?id=${data.id}`,
    score: Number(data.score) || 0,
    rating: (data.rating as ContentRating) || 'g',
    tag_string: String(data.tag_string),
    tag_string_artist: String(data.tag_string_artist) || UNKNOWN_ARTIST,
    fav_count: Number(data.fav_count) || 0,
  });
}

function buildSearchParams(tags: string, rating: ContentRating): string {
  const baseFilter = `-status:deleted rating:${rating} filetype:png,jpg score:>50`;
  const cleanTags = tags ? tags.replace(/\s+/g, '_') : '';
  const searchTags = cleanTags ? ` ${cleanTags}` : '';

  return new URLSearchParams({
    limit: '1',
    random: 'true',
    tags: `${baseFilter}${searchTags}`,
  }).toString();
}

export class ApiService {
  private readonly abortControllers = new Map<string, AbortController>();

  async fetchPostById(id: string): Promise<DanbooruPost | null> {
    const cached = CacheService.get<DanbooruPost>('posts', id);
    if (cached) return cached;

    try {
      const url = `${CONFIG.API.BASE_URL}${CONFIG.API.ENDPOINTS.POST_BY_ID(id)}`;
      const response = await fetchWithTimeout(url);

      if (!response.ok) {
        if (response.status >= 500) {
          throw new ApiServerError(`API server error (${response.status})`, response.status);
        }
        if (response.status === 404) return null;
        if (response.status === 503) {
          throw new ApiServerError('Service temporarily unavailable', response.status);
        }
        logger.warn(`API request failed with status ${response.status} for ID: ${id}`);
        return null;
      }

      const post = normalizePost(await response.json());
      if (post) CacheService.set('posts', id, post, CONFIG.API.RANDOM_IMAGE_CACHE_TTL_MS);
      return post;
    } catch (error) {
      if (error instanceof ApiServerError) throw error;
      
      const errorMessage = error instanceof Error ? error.message : String(error);
      if (errorMessage.includes('timeout') || errorMessage.includes('Network connection failed')) {
        throw new ApiServerError('Connection timeout - please try again', 408);
      }
      
      logger.error(`Failed to fetch post ${id}: ${errorMessage}`);
      return null;
    }
  }

  async fetchRandomImage(tags: string, rating: ContentRating): Promise<DanbooruPost | null> {
    const cacheKey = `${tags}-${rating}`;
    const cached = CacheService.get<DanbooruPost>('random', cacheKey);
    if (cached && Math.random() < CONFIG.API.RANDOM_IMAGE_CACHE_PROBABILITY) return cached;

    try {
      const searchParams = buildSearchParams(tags, rating);
      const url = `${CONFIG.API.BASE_URL}${CONFIG.API.ENDPOINTS.POSTS}?${searchParams}`;
      const response = await fetchWithTimeout(url);

      if (!response.ok) {
        if (response.status >= 500) {
          throw new ApiServerError(`API server error (${response.status})`, response.status);
        }
        if (response.status === 503) {
          throw new ApiServerError('Service temporarily unavailable', response.status);
        }
        if (response.status === 422) {
          throw new ApiServerError('Content not suitable for this channel', response.status);
        }
        if (![404, 403, 429].includes(response.status)) {
          logger.warn(`Random image API request failed with status ${response.status}`);
        }
        return null;
      }

      const posts = await response.json();
      const post = Array.isArray(posts) && posts.length > 0 ? normalizePost(posts[0]) : null;
      
      if (post) CacheService.set('random', cacheKey, post, CONFIG.API.RANDOM_IMAGE_CACHE_TTL_MS);
      return post;
    } catch (error) {
      if (error instanceof ApiServerError) throw error;
      
      const errorMessage = error instanceof Error ? error.message : String(error);
      if (errorMessage.includes('timeout') || errorMessage.includes('Network connection failed')) {
        throw new ApiServerError('Connection timeout - please try again', 408);
      }
      
      logger.error(`Failed to fetch random image: ${errorMessage}`);
      return null;
    }
  }

  async Autocomplete(input: string): Promise<DanbooruTag[]> {
    const cleanInput = input.toLowerCase().trim().replace(/\s+/g, '_');
    if (!cleanInput || cleanInput.length < 1) return [];
    
    const cached = CacheService.get<DanbooruTag[]>('autocomplete', cleanInput);
    if (cached) return cached;

    try {
      const url = `${CONFIG.API.BASE_URL}/tags.json?search[name_matches]=${encodeURIComponent(cleanInput)}*&search[order]=count&limit=10`;
      const response = await fetchWithTimeout(url);

      if (!response.ok) {
        if (response.status >= 500) {
          throw new ApiServerError(`Autocomplete API server error (${response.status})`, response.status);
        }
        if (response.status === 503) {
          throw new ApiServerError('Autocomplete service temporarily unavailable', response.status);
        }
        logger.warn(`Tag autocomplete request failed with status ${response.status} for input: ${input}`);
        return [];
      }

      const data = await response.json();
      const tags = Array.isArray(data) ? data
        .map((item: any) => {
          if (!item?.name || typeof item.name !== 'string') return null;
          if (typeof item.post_count !== 'number') return null;
          if (BLACKLISTED_TAGS.has(item.name.toLowerCase())) return null;
          
          return {
            name: item.name.toLowerCase().replace(/\s+/g, '_'),
            post_count: item.post_count,
          };
        })
        .filter((tag): tag is DanbooruTag => tag !== null)
        .sort((a, b) => b.post_count - a.post_count) : [];
      
      if (tags.length > 0) {
        CacheService.set('autocomplete', cleanInput, tags, CONFIG.API.RANDOM_IMAGE_CACHE_TTL_MS);
      }
      
      return tags;
    } catch (error) {
      if (error instanceof ApiServerError) throw error;
      
      const errorMessage = error instanceof Error ? error.message : String(error);
      if (errorMessage.includes('timeout') || errorMessage.includes('Network connection failed')) {
        return [];
      }
      
      logger.error(`Failed to fetch tag autocomplete for "${input}": ${errorMessage}`);
      return [];
    }
  }

  cleanup(): void {
    for (const controller of this.abortControllers.values()) {
      controller.abort();
    }
    this.abortControllers.clear();
  }
}
