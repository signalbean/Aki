// src/shared/config.ts

import { EmbedBuilder, User } from 'discord.js';
import { MESSAGES } from '@shared/messages';
import { EmbedType } from '@shared/types';

/**
 * Central configuration object containing all bot settings, API endpoints,
 * timeouts, limits, and other configurable values.
 */
export const CONFIG = {
  API: {
    BASE_URL: 'https://danbooru.donmai.us',
    ENDPOINTS: {
      POSTS: '/posts.json',
      POST_BY_ID: (id: string) => `/posts/${id}.json`,
    },
    TIMEOUT_MS: 15000,
    USER_AGENT: 'Aki (Discord Bot)',
    RANDOM_IMAGE_CACHE_PROBABILITY: 0.3,
    RANDOM_IMAGE_CACHE_TTL_MS: 60000,
  },
  BOT: {
    PREFIX: 'a!',
    MAX_USER_TAGS: 1,
    DEFAULT_RATING_SFW: 'g' as const,
    DEFAULT_RATING_NSFW: 'e' as const,
    HELP_MENU_TIMEOUT_MS: 300000,
    MAX_CUSTOM_TAGS: 25,
  },
  DISCORD: {
    MAX_MESSAGE_LENGTH: 2000,
    PRESENCE: {
      status: 'dnd' as const,
    },
  },
} as const;

// Content filter: Tags that are completely blocked from all searches and results
export const BLACKLISTED_TAGS = new Set([
  'loli', 'shota', 'lolicon', 'shotacon', 'underage', 'child', 'minor', 'kid', 'baby', 'toddler', 'child_porn', 'cp',
  'gore', 'guro', 'snuff', 'death', 'murder', 'torture', 'blood', 'violence', 'rape_gore', 'cannibalism', 'necrophilia',
  'non_con', 'forced', 'unwilling', 'mind_control', 'hypnosis', 'drugged',
  'scat', 'poop', 'defecation', 'urine', 'watersports', 'piss', 'toilet', 'diaper'
]);

// Regex patterns to detect potentially NSFW tags for SFW channel warnings
export const nsfwPatterns = [/nude/, /sex/, /porn/, /hentai/, /ecchi/, /bikini/, /underwear/, /suggestive/, /erotic/, /nsfw/];

// Regular expressions for validating user input and parsing content
export const REGEX_PATTERNS = {
  VALID_POST_ID: /^\d+$/,
  VALID_TAG_NAME: /^[a-z0-9_:]{1,64}$/,
  IMAGE_URL: /https?:\/\/\S+\.(?:png|jpg)(?:\?id=(\d+))?/i,
  ID_FROM_URL: /\?id=(\d+)/,
} as const;

// Command names that cannot be used for custom tag commands
export const RESERVED_COMMAND_NAMES = new Set(['fetch', 'help', 'add', 'list', 'remove', 'waifu']);
// Prefix used to identify custom tag commands in their descriptions
export const TAG_PREFIX = 'Tag:';
// Fallback text when artist information is not available
export const UNKNOWN_ARTIST = 'Unknown';

// Color scheme for Discord embeds based on message type
const COLORS = {
  PRIMARY: 0xe40206,
  SUCCESS: 0x00ff88,
  WARNING: 0xffa500,
  ERROR: 0xff4444,
  INFO: 0x5865f2,
} as const;

export class CustomEmbed extends EmbedBuilder {
  constructor(type: EmbedType = 'default') {
    super();
    this.setColor(this.getColorForType(type)).setTimestamp();
  }

  private getColorForType(type: EmbedType) {
    switch (type) {
      case 'success': return COLORS.SUCCESS;
      case 'error': return COLORS.ERROR;
      case 'warning': return COLORS.WARNING;
      case 'info': return COLORS.INFO;
      default: return COLORS.PRIMARY;
    }
  }

  public withStandardFooter(user: User): this {
    this.setFooter({
      text: `Requested by ${user.displayName}`,
      iconURL: user.displayAvatarURL(),
    });
    return this;
  }

  public withCommandSuccess(commandName: string): this {
    this.setTitle(`✅ ${commandName}`);
    return this;
  }

  public withCommandInfo(title: string, url?: string): this {
    this.setTitle(`📊 ${title}`);
    if (url) this.setURL(url);
    return this;
  }

  public withError(title: string, description?: string): this {
    this.setTitle(`❌ ${title}`);
    if (description) this.setDescription(description);
    return this;
  }

  public withWarning(title: string, description?: string): this {
    this.setTitle(`⚠️ ${title}`);
    if (description) this.setDescription(description);
    return this;
  }
}

export const format = {
  bold: (text: string) => `**${text}**`,
  italic: (text: string) => `*${text}*`,
  inlineCode: (text: string) => `\`${text}\``,
  codeBlock: (text: string, lang = '') => `\`\`\`${lang}\n${text}\n\`\`\``,
  bullet: (items: string[]) => items.map(item => `• ${item}`).join('\n'),
  link: (label: string, url: string) => `[${label}](${url})`,
} as const;

// Pre-built embed templates for common error scenarios
export const EmbedBuilders = {
  guildOnlyError: (user: User) => new CustomEmbed('error')
    .withError('Guild Only', MESSAGES.ERROR.GUILD_ONLY)
    .withStandardFooter(user),

  botMessagesOnlyError: (user: User) => new CustomEmbed('error')
    .withError('Access Denied', MESSAGES.ERROR.BOT_MESSAGES_ONLY)
    .withStandardFooter(user),

  noImageFoundError: (user: User, context: 'message' | 'post' = 'message') => new CustomEmbed('warning')
    .withWarning(
      context === 'post' ? 'Post Not Found' : 'No Image Found',
      context === 'post' ? MESSAGES.ERROR.POST_NOT_FOUND : MESSAGES.ERROR.NO_IMAGE_CONTEXT
    )
    .withStandardFooter(user),
};
