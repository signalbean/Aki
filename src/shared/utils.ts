// src/shared/utils.ts

import { promises as fs, createWriteStream, existsSync, mkdirSync, WriteStream } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { 
  ChatInputCommandInteraction, 
  MessageContextMenuCommandInteraction, 
  MessageFlags, 
  PermissionFlagsBits,
  Channel,
  ChannelType
} from 'discord.js';
import { REGEX_PATTERNS, CustomEmbed, EmbedBuilders } from '@shared/config';
import { MESSAGES } from '@shared/messages';
import { InteractionType } from '@shared/types';

const __dirname = dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = process.cwd();
const IS_PROD = __dirname.includes('/dist/');
const CODE_BASE_DIR = join(PROJECT_ROOT, IS_PROD ? 'dist' : 'src');

// Consolidated path utilities
export const paths = Object.freeze({
  assets: () => join(PROJECT_ROOT, 'assets'),
  logs: () => join(PROJECT_ROOT, 'logs'),
  commands: () => join(CODE_BASE_DIR, 'commands'),
  applicationCommands: () => join(CODE_BASE_DIR, 'commands', 'application'),
  contextCommands: () => join(CODE_BASE_DIR, 'commands', 'context'),
  waifus: () => join(PROJECT_ROOT, 'assets', 'waifus.txt'),
});

// Optimized file operations
export const fileOps = Object.freeze({
  async readText(filePath: string): Promise<string | null> {
    try {
      return await fs.readFile(filePath, 'utf-8');
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
        logger.error(`Failed to read ${filePath}: ${(error as Error).message}`);
      }
      return null;
    }
  },

  async getDirFiles(dirPath: string): Promise<string[]> {
    try {
      const files = await fs.readdir(dirPath);
      return files
        .filter(file => /\.(ts|js)$/i.test(file))
        .map(file => join(dirPath, file));
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
        logger.error(`Failed to read directory ${dirPath}: ${(error as Error).message}`);
      }
      return [];
    }
  },
});

// Optimized logger with better performance
class Logger {
  private readonly streams = new Map<string, WriteStream>();
  private readonly logsDir = paths.logs();

  constructor() {
    this.initializeLogger();
  }

  private initializeLogger(): void {
    try {
      if (!existsSync(this.logsDir)) {
        mkdirSync(this.logsDir, { recursive: true });
      }

      const logFiles = { INFO: 'info.log', ERROR: 'error.log', WARN: 'warn.log' };
      
      for (const [level, file] of Object.entries(logFiles)) {
        const stream = createWriteStream(join(this.logsDir, file), { flags: 'a' });
        stream.on('error', (err) => console.error(`Logger error [${level}]:`, err));
        this.streams.set(level, stream);
      }
    } catch (error) {
      console.error('Logger initialization failed:', error);
    }
  }

  private writeLog(message: string, level: string): void {
    const timestamp = new Date().toISOString();
    const formatted = `[${timestamp}] ${level}: ${message}`;
    
    this.streams.get(level)?.write(formatted + '\n');
    console[level.toLowerCase() as 'log' | 'error' | 'warn'](formatted);
  }

  log = (message: string): void => this.writeLog(message, 'INFO');
  error = (message: string): void => this.writeLog(message, 'ERROR');
  warn = (message: string): void => this.writeLog(message, 'WARN');

  destroy(): void {
    for (const stream of this.streams.values()) {
      stream.end();
    }
  }
}

export const logger = new Logger();

// Channel utilities
export const ChannelUtils = Object.freeze({
  isNSFW: (channel: Channel | null): boolean => 
    channel?.type === ChannelType.GuildText && (channel as any).nsfw === true,
  
  isDM: (channel: Channel | null): boolean => 
    channel?.type === ChannelType.DM,
});

// Consolidated interaction utilities
export const InteractionUtils = Object.freeze({
  checkGuildContext: (interaction: InteractionType): boolean => 
    interaction.guild !== null,

  checkBotPermissions: (
    interaction: InteractionType, 
    permissions: (keyof typeof PermissionFlagsBits)[] = ['ViewChannel']
  ): boolean => {
    const botMember = interaction.guild?.members.me;
    if (!botMember || !interaction.channel || !('permissionsFor' in interaction.channel)) {
      return false;
    }
    const botPermissions = interaction.channel.permissionsFor(botMember);
    return permissions.every(permission => botPermissions?.has(PermissionFlagsBits[permission]));
  },

  async deferReply(interaction: InteractionType, ephemeral = false): Promise<void> {
    if (interaction.deferred || interaction.replied) return;
    
    try {
      await interaction.deferReply({ flags: ephemeral ? MessageFlags.Ephemeral : undefined });
    } catch (error) {
      const errorMessage = (error as Error).message;
      if (!errorMessage.includes('Unknown interaction')) {
        logger.warn(`Failed to defer reply: ${errorMessage}`);
      }
    }
  },

  async validateContext(
    interaction: InteractionType, 
    options: {
      requireGuild?: boolean;
      requirePermissions?: (keyof typeof PermissionFlagsBits)[];
      requireEphemeral?: boolean;
    } = {}
  ): Promise<boolean> {
    const { requireGuild = true, requirePermissions = ['ViewChannel'], requireEphemeral = false } = options;

    if (requireGuild && !this.checkGuildContext(interaction)) {
      const errorEmbed = EmbedBuilders.guildOnlyError(interaction.user);
      try {
        await interaction.reply({ embeds: [errorEmbed], flags: MessageFlags.Ephemeral });
      } catch {}
      return false;
    }

    if (requirePermissions.length > 0 && !this.checkBotPermissions(interaction, requirePermissions)) {
      const errorEmbed = new CustomEmbed('error')
        .withError('Missing Permissions', MESSAGES.ERROR.BOT_MISSING_PERMISSIONS)
        .withStandardFooter(interaction.user);
      try {
        await interaction.reply({ embeds: [errorEmbed], flags: MessageFlags.Ephemeral });
      } catch {}
      return false;
    }

    await this.deferReply(interaction, requireEphemeral);
    return true;
  },
});

// Utility functions
export const utils = Object.freeze({
  findImageInMessage: (message: { content: string; embeds?: any[]; attachments?: any }) => {
    const sources = [
      message.content,
      ...(message.embeds?.map(e => e.image?.url || e.thumbnail?.url) || []),
    ];

    for (const source of sources) {
      if (!source) continue;
      const urlMatch = source.match(REGEX_PATTERNS.IMAGE_URL);
      if (urlMatch) {
        const url = urlMatch[0];
        const idMatch = url.match(REGEX_PATTERNS.ID_FROM_URL);
        return { url: url.split('?')[0], id: idMatch?.[1] || null };
      }
    }

    if (message.attachments?.size > 0) {
      const attachment = message.attachments.first();
      if (attachment?.url) {
        const idMatch = attachment.url.match(REGEX_PATTERNS.ID_FROM_URL);
        return { url: attachment.url.split('?')[0], id: idMatch?.[1] || null };
      }
    }

    return { url: null, id: null };
  },
});

// Error handler
export async function handleCommandError(
  interaction: InteractionType,
  commandName: string,
  error?: unknown
): Promise<void> {
  const errorMessage = error instanceof Error ? error.message : 'Unknown error';
  
  if (!errorMessage.includes('Unknown interaction') && !errorMessage.includes('interaction has already been acknowledged')) {
    logger.error(`${commandName} error: ${errorMessage}`);
  }

  const getErrorInfo = (msg: string) => {
    if (msg.includes('API server error') || msg.includes('server error')) {
      return { title: 'API Server Error', description: MESSAGES.ERROR.API_SERVER_ERROR };
    }
    if (msg.includes('Rate limit') || msg.includes('Too many requests')) {
      return { title: 'Rate Limited', description: MESSAGES.ERROR.RATE_LIMIT };
    }
    if (msg.includes('Content not suitable for this channel')) {
      return { title: 'NSFW Content', description: MESSAGES.ERROR.NSFW_TAG_IN_SFW };
    }
    return { title: 'Unexpected Error', description: MESSAGES.ERROR.GENERIC_ERROR };
  };

  const { title, description } = getErrorInfo(errorMessage);
  const errorEmbed = new CustomEmbed('error')
    .withError(title, description)
    .withStandardFooter(interaction.user);

  try {
    if (interaction.deferred || interaction.replied) {
      await interaction.editReply({ embeds: [errorEmbed] });
    } else {
      await interaction.reply({ embeds: [errorEmbed], flags: MessageFlags.Ephemeral });
    }
  } catch (replyError) {
    const replyErrorMessage = (replyError as Error).message;
    if (!replyErrorMessage.includes('Unknown interaction') && !replyErrorMessage.includes('interaction has already been acknowledged')) {
      logger.error(`Failed to send error reply: ${replyErrorMessage}`);
    }
  }
}

process.on('exit', () => logger.destroy());
