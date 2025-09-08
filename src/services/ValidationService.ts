// src/services/ValidationService.ts

import {
  BLACKLISTED_TAGS,
  CONFIG,
  REGEX_PATTERNS,
  nsfwPatterns,
} from '@shared/config';
import { MESSAGES } from '@shared/messages';
import { Channel, ChannelType } from 'discord.js';
import { ValidationResult, ContentRating } from '@shared/types';
import { ChannelUtils } from '@shared/utils';

const tagCache = new Map<string, string[]>();

// Message utilities
export const MessageUtils = Object.freeze({
  isBotMessage: (message: { author: { id: string } }, clientId: string): boolean =>
    message.author.id === clientId,

  canUserRemoveMessage: (
    message: { interactionMetadata?: { user: { id: string } } },
    userId: string,
    channel: Channel | null
  ): boolean => {
    if (ChannelUtils.isDM(channel)) return true;
    return message.interactionMetadata?.user.id === userId;
  },
});

// Optimized validation service
export const ValidationService = Object.freeze({
  validateTags(tags: string): ValidationResult {
    if (!tags?.trim()) return { isValid: true };

    let tagArray = tagCache.get(tags);
    if (!tagArray) {
      tagArray = tags.toLowerCase().split(',').map(t => t.trim()).filter(Boolean);
      if (tagCache.size < 1000) tagCache.set(tags, tagArray);
    }

    if (tagArray.length > CONFIG.BOT.MAX_USER_TAGS) {
      return { isValid: false, error: MESSAGES.ERROR.TOO_MANY_TAGS };
    }

    if (tagArray.some(tag => BLACKLISTED_TAGS.has(tag))) {
      return { isValid: false, error: MESSAGES.ERROR.BLACKLISTED_TAG };
    }

    return { isValid: true };
  },

  validateChannelRating(rating: ContentRating, channel: Channel | null): ValidationResult {
    if (!channel) return { isValid: false, error: 'Channel not found.' };
    
    if (!ChannelUtils.isNSFW(channel) && rating !== 'g') {
      return { isValid: false, error: MESSAGES.ERROR.NSFW_IN_SFW };
    }
    return { isValid: true };
  },

  isValidPostId: (id: string): boolean => REGEX_PATTERNS.VALID_POST_ID.test(id),
  
  isPotentiallyNSFWTag: (tag: string): boolean => 
    nsfwPatterns.some(pattern => pattern.test(tag.toLowerCase())),

  determineRating(requested: 'q' | 's' | null, channel: { type: ChannelType; nsfw?: boolean }): ContentRating {
    if (requested) return requested;
    return ChannelUtils.isNSFW(channel as any) ? CONFIG.BOT.DEFAULT_RATING_NSFW : CONFIG.BOT.DEFAULT_RATING_SFW;
  },

  categorizeTags(tagString: string, artistTag?: string): {
    artist: string[];
    character: string[];
    copyright: string[];
    general: string[];
    meta: string[];
  } {
    const tags = tagString.split(' ').filter(Boolean);
    const categories = {
      artist: [] as string[],
      character: [] as string[],
      copyright: [] as string[],
      general: [] as string[],
      meta: [] as string[],
    };

    const patterns = {
      character: [/^\d+(girl|boy)s?$/, /^multiple_(girls|boys)$/, /_\([^)]+\)$/],
      copyright: [/^(original|touhou|kantai_collection|fate|azur_lane|genshin_impact|pokemon)$/, /_project$/, /_series$/],
      meta: [/^(commentary|translated|translation_request|check_translation)$/, /^(commission|request|sketch|wip)$/, /^(highres|absurdres|incredibly_absurdres)$/, /text$/, /^(monochrome|greyscale|sepia)$/],
    };

    for (const tag of tags) {
      const lowerTag = tag.toLowerCase();
      
      if (artistTag && tag === artistTag) {
        categories.artist.push(tag);
        continue;
      }

      let categorized = false;
      for (const [category, patternList] of Object.entries(patterns)) {
        if (patternList.some(pattern => pattern.test(lowerTag))) {
          categories[category as keyof typeof categories].push(tag);
          categorized = true;
          break;
        }
      }

      if (!categorized) {
        categories.general.push(tag);
      }
    }

    return categories;
  },
});
