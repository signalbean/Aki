// src/services/ValidationService.ts

import {
  BLACKLISTED_TAGS,
  CONFIG, MESSAGES,
  REGEX_PATTERNS,
  nsfwPatterns,
} from '@shared/config';
import { Channel, ChannelType } from 'discord.js';
import { ValidationResult, ContentRating } from '@shared/types';

const tagCache = new Map<string, string[]>();

/**
 * Channel utilities
 */
export const ChannelUtils = {
  /**
   * Check if a channel is NSFW
   */
  isNSFWChannel(channel: Channel | null): boolean {
    return channel?.type === ChannelType.GuildText && (channel as any).nsfw === true;
  },

  /**
   * Check if a channel is a DM channel
   */
  isDMChannel(channel: Channel | null): boolean {
    return channel?.type === ChannelType.DM;
  },

  /**
   * Get appropriate rating for channel
   */
  getChannelAppropriateRating(channel: Channel | null): ContentRating {
    if (!channel) return 'g';
    return this.isNSFWChannel(channel) ? CONFIG.BOT.DEFAULT_RATING_NSFW : CONFIG.BOT.DEFAULT_RATING_SFW;
  },
};

/**
 * Message utilities
 */
export const MessageUtils = {
  /**
   * Check if message was sent by the bot
   */
  isBotMessage(message: { author: { id: string } }, clientId: string): boolean {
    return message.author.id === clientId;
  },

  /**
   * Check if user can remove a message (either they generated it or it's in DM)
   */
  canUserRemoveMessage(
    message: { interactionMetadata?: { user: { id: string } } },
    userId: string,
    channel: Channel | null
  ): boolean {
    if (ChannelUtils.isDMChannel(channel)) return true;
    return message.interactionMetadata?.user.id === userId;
  },
};

/**
 * Validation service with tag categorization
 */
export const ValidationService = {
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
    
    if (!ChannelUtils.isNSFWChannel(channel) && rating !== 'g') {
      return { isValid: false, error: MESSAGES.ERROR.NSFW_IN_SFW };
    }
    return { isValid: true };
  },

  isValidPostId: (id: string) => REGEX_PATTERNS.VALID_POST_ID.test(id),
  
  isPotentiallyNSFWTag: (tag: string) => 
    nsfwPatterns.some(pattern => pattern.test(tag.toLowerCase())),

  determineRating(requested: 'q' | 's' | null, channel: { type: ChannelType; nsfw?: boolean }): ContentRating {
    if (requested) return requested;
    return ChannelUtils.isNSFWChannel(channel as any) ? CONFIG.BOT.DEFAULT_RATING_NSFW : CONFIG.BOT.DEFAULT_RATING_SFW;
  },

  /**
   * Tag categorization using Danbooru conventions
   */
  categorizeTags(tagString: string, artistTag?: string): {
    artist: string[];
    character: string[];
    copyright: string[];
    general: string[];
    meta: string[];
  } {
    const tags = tagString.split(' ').filter(tag => tag.trim());
    const categories = {
      artist: [] as string[],
      character: [] as string[],
      copyright: [] as string[],
      general: [] as string[],
      meta: [] as string[],
    };

    const characterPatterns = [
      /^\d+(girl|boy)s?$/,
      /^multiple_(girls|boys)$/,
      /_\([^)]+\)$/,
    ];

    const copyrightPatterns = [
      /^(original|touhou|kantai_collection|fate|azur_lane|genshin_impact|pokemon)$/,
      /_project$/,
      /_series$/,
    ];

    const metaPatterns = [
      /^(commentary|translated|translation_request|check_translation)$/,
      /^(commission|request|sketch|wip)$/,
      /^(highres|absurdres|incredibly_absurdres)$/,
      /text$/,
      /^(monochrome|greyscale|sepia)$/,
    ];

    tags.forEach(tag => {
      const lowerTag = tag.toLowerCase();
      
      if (artistTag && tag === artistTag) {
        categories.artist.push(tag);
        return;
      }

      if (metaPatterns.some(pattern => pattern.test(lowerTag))) {
        categories.meta.push(tag);
        return;
      }

      if (characterPatterns.some(pattern => pattern.test(lowerTag))) {
        categories.character.push(tag);
        return;
      }

      if (copyrightPatterns.some(pattern => pattern.test(lowerTag))) {
        categories.copyright.push(tag);
        return;
      }

      categories.general.push(tag);
    });

    return categories;
  },
};
