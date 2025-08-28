// src/shared/config.ts

import { EmbedBuilder, User } from 'discord.js';

// Configuration constants
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

export const BLACKLISTED_TAGS = new Set([
  'loli', 'shota', 'lolicon', 'shotacon', 'underage', 'child', 'minor', 'kid', 'baby', 'toddler', 'child_porn', 'cp',
  'gore', 'guro', 'snuff', 'death', 'murder', 'torture', 'blood', 'violence', 'rape_gore', 'cannibalism', 'necrophilia',
  'non_con', 'forced', 'unwilling', 'mind_control', 'hypnosis', 'drugged',
  'scat', 'poop', 'defecation', 'urine', 'watersports', 'piss', 'toilet', 'diaper'
]);

export const nsfwPatterns = [/nude/, /sex/, /porn/, /hentai/, /ecchi/, /bikini/, /underwear/, /suggestive/, /erotic/, /nsfw/];

export const MESSAGES = {
  ERROR: {
    NO_IMAGE: '📷 No image found. The post might be gone or doesn\'t exist.',
    NO_IMAGE_CONTEXT: '📷 No image URL found in this message.',
    BLACKLISTED_TAG: '❌ Your search contains a blacklisted tag. Try again.',
    TOO_MANY_TAGS: `⚠️ Maximum ${CONFIG.BOT.MAX_USER_TAGS} search tag allowed due to API limitations.`,
    NSFW_IN_SFW: '❌ NSFW content can only be viewed in NSFW channels.',
    NSFW_TAG_IN_SFW: '❌ This command seems to be for NSFW content. To use it, you need to be in an NSFW channel.',
    DM_FAILED: `❌ Failed to DM you.`,
    GENERIC_ERROR: '❌ Congrats you got an unusual error. Now report it.',
    MISSING_PERMISSIONS: `❌ Invalid permissions, you can't use this command.`,
    GUILD_ONLY: '❌ This command only works in servers, not in DMs.',
    BOT_MESSAGES_ONLY: '❌ I can only perform this action on messages that I have sent.',
    COMMAND_NOT_FOUND: '❌ Could not find command information. Please try again in a moment.',
    INVALID_CUSTOM_TAG: '❌ This does not appear to be a valid custom tag command.',
    POST_NOT_FOUND: '❌ This image no longer exists on Danbooru or the post was deleted.',
    ACCESS_DENIED: '❌ Access Denied. You do not have permission to use this command.',
    RATE_LIMIT: '⏱️ Too many requests. Please wait a moment and try again.',
    API_SERVER_ERROR: '❌ The API server is currently experiencing issues. Please try again later.',
  },
  SUCCESS: {
    COMMAND_ADDED: 'Custom Command Added',
    COMMAND_REMOVED: 'Custom Command Removed',
  },
  INFO: {
    NO_CUSTOM_COMMANDS: '📋 No Custom Commands Found',
    IMAGE_INFO: '📊 Image Information',
    TAGS_INFO: '🏷️ Tags Information',
  },
} as const;

export const REGEX_PATTERNS = {
  VALID_POST_ID: /^\d+$/,
  VALID_TAG_NAME: /^[a-z0-9_:]{1,64}$/,
  IMAGE_URL: /https?:\/\/\S+\.(?:png|jpg)(?:\?id=(\d+))?/i,
  ID_FROM_URL: /\?id=(\d+)/,
} as const;

export const RESERVED_COMMAND_NAMES = new Set(['fetch', 'help', 'add', 'list', 'remove', 'waifu']);
export const TAG_PREFIX = 'Tag:';
export const UNKNOWN_ARTIST = 'Unknown';

// Embed helper
const COLORS = {
  PRIMARY: 0xe40206,
  SUCCESS: 0x00ff88,
  WARNING: 0xffa500,
  ERROR: 0xff4444,
  INFO: 0x5865f2,
} as const;

type EmbedType = 'default' | 'success' | 'error' | 'warning' | 'info';

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

  public withError(title: string): this {
    this.setTitle(`❌ ${title}`);
    return this;
  }

  public withWarning(title: string): this {
    this.setTitle(`⚠️ ${title}`);
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

// Common embed builders
export const EmbedBuilders = {
  guildOnlyError: (user: User) => new CustomEmbed('error')
    .withError('Guild Only')
    .setDescription(MESSAGES.ERROR.GUILD_ONLY)
    .withStandardFooter(user),
    
  botMessagesOnlyError: (user: User) => new CustomEmbed('error')
    .withError('Access Denied')
    .setDescription(MESSAGES.ERROR.BOT_MESSAGES_ONLY)
    .withStandardFooter(user),
    
  noImageFoundError: (user: User, context: 'message' | 'post' = 'message') => new CustomEmbed('warning')
    .withWarning(context === 'post' ? 'Post Not Found' : 'No Image Found')
    .setDescription(context === 'post' ? MESSAGES.ERROR.POST_NOT_FOUND : MESSAGES.ERROR.NO_IMAGE_CONTEXT)
    .withStandardFooter(user),
};
