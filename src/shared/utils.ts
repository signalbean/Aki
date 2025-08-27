import { promises as fs, createWriteStream, existsSync, mkdirSync, WriteStream } from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';
import { ChatInputCommandInteraction, MessageContextMenuCommandInteraction, MessageFlags, PermissionFlagsBits } from 'discord.js';
import { MESSAGES, REGEX_PATTERNS } from '@shared/config';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = process.cwd();
const IS_PROD = __dirname.includes(path.sep + 'dist' + path.sep);
const CODE_BASE_DIR = path.join(PROJECT_ROOT, IS_PROD ? 'dist' : 'src');

// Path utilities
export const paths = {
  assets: () => path.join(PROJECT_ROOT, 'assets'),
  logs: () => path.join(PROJECT_ROOT, 'logs'),
  commands: () => path.join(CODE_BASE_DIR, 'commands'),
  applicationCommands: () => path.join(CODE_BASE_DIR, 'commands', 'application'),
  contextCommands: () => path.join(CODE_BASE_DIR, 'commands', 'context'),
  waifus: () => path.join(PROJECT_ROOT, 'assets', 'waifus.txt'),
};

// File operations
export const fileOps = {
  async readText(filePath: string): Promise<string | null> {
    try {
      return await fs.readFile(filePath, 'utf-8');
    } catch (error) {
      const nodeError = error as NodeJS.ErrnoException;
      if (nodeError.code !== 'ENOENT') {
        logger.error(`Failed to read text file ${filePath}: ${nodeError.message}`);
      }
      return null;
    }
  },

  async getDirFiles(dirPath: string): Promise<string[]> {
    try {
      const files = await fs.readdir(dirPath);
      return files.filter(file => /\.(ts|js)$/i.test(file))
                 .map(file => path.join(dirPath, file));
    } catch (error) {
      const nodeError = error as NodeJS.ErrnoException;
      if (nodeError.code !== 'ENOENT') {
        logger.error(`Failed to read directory ${dirPath}: ${nodeError.message}`);
      }
      return [];
    }
  },
};

// Logger
type LogLevel = 'INFO' | 'ERROR' | 'WARN';

class Logger {
  private readonly logsDir = paths.logs();
  private streams = new Map<LogLevel, WriteStream>();

  constructor() {
    this.initializeLogger();
  }

  private initializeLogger(): void {
    try {
      if (!existsSync(this.logsDir)) {
        mkdirSync(this.logsDir, { recursive: true });
      }

      const logFiles: Record<LogLevel, string> = {
        INFO: 'info.log',
        ERROR: 'error.log',
        WARN: 'warn.log',
      };
      
      for (const [level, file] of Object.entries(logFiles)) {
        const stream = createWriteStream(path.join(this.logsDir, file), { flags: 'a' });
        stream.on('error', (err) => console.error(`Logger stream error for ${level}:`, err));
        this.streams.set(level as LogLevel, stream);
      }
    } catch (error) {
      console.error('Failed to initialize logger:', error);
    }
  }

  public log(message: string, level: LogLevel = 'INFO'): void {
    const timestamp = new Date().toISOString();
    const formatted = `[${timestamp}] ${level}: ${message}`;

    const stream = this.streams.get(level);
    if (stream) {
      stream.write(formatted + '\n');
    }

    const consoleMethod = level.toLowerCase() as 'error' | 'warn' | 'log';
    console[consoleMethod](formatted);
  }

  public error(message: string): void { this.log(message, 'ERROR'); }
  public warn(message: string): void { this.log(message, 'WARN'); }

  public destroy(): void {
    for (const stream of this.streams.values()) {
      stream.end();
    }
  }
}

export const logger = new Logger();

type InteractionType = ChatInputCommandInteraction | MessageContextMenuCommandInteraction;

export const InteractionUtils = {
  /**
   * Check if interaction is in a guild context
   */
  checkGuildContext: (interaction: InteractionType) => {
    return interaction.guild !== null;
  },

  /**
   * Check if the bot has required permissions in the channel
   */
  checkBotPermissions: (interaction: InteractionType, requiredPermissions: (keyof typeof PermissionFlagsBits)[] = ['ViewChannel']) => {
    const botMember = interaction.guild?.members.me;
    if (!botMember || !interaction.channel || !('permissionsFor' in interaction.channel)) {
      return false;
    }

    const botPermissions = interaction.channel.permissionsFor(botMember);
    return requiredPermissions.every(permission => botPermissions?.has(PermissionFlagsBits[permission]));
  },

  /**
   * Common defer patterns
   */
  deferReply: async (interaction: InteractionType, ephemeral = false) => {
    await interaction.deferReply({ flags: ephemeral ? MessageFlags.Ephemeral : undefined });
  },

  deferEphemeral: async (interaction: InteractionType) => {
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });
  },

  /**
   * Permission and context validation
   */
  async validateContext(interaction: InteractionType, options: {
    requireGuild?: boolean;
    requirePermissions?: (keyof typeof PermissionFlagsBits)[];
    requireEphemeral?: boolean;
  } = {}): Promise<boolean> {
    const {
      requireGuild = true,
      requirePermissions = ['ViewChannel'],
      requireEphemeral = false
    } = options;

    if (requireGuild && !this.checkGuildContext(interaction)) {
      await interaction.reply({
        content: MESSAGES.ERROR.GUILD_ONLY,
        flags: MessageFlags.Ephemeral,
      });
      return false;
    }

    if (requirePermissions.length > 0 && !this.checkBotPermissions(interaction, requirePermissions)) {
      await interaction.reply({
        content: MESSAGES.ERROR.MISSING_PERMISSIONS,
        flags: MessageFlags.Ephemeral,
      });
      return false;
    }

    if (requireEphemeral) {
      await this.deferEphemeral(interaction);
    } else {
      await this.deferReply(interaction);
    }

    return true;
  },
};

export const utils = {
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
        return { url: url.split('?')[0], id: idMatch ? idMatch[1] : null };
      }
    }

    if (message.attachments && message.attachments.size > 0) {
      const attachment = message.attachments.first();
      if (attachment?.url) {
        const idMatch = attachment.url.match(REGEX_PATTERNS.ID_FROM_URL);
        return { url: attachment.url.split('?')[0], id: idMatch ? idMatch[1] : null };
      }
    }

    return { url: null, id: null };
  },
};

export async function handleCommandError(
  interaction: InteractionType,
  commandName: string,
  error?: unknown
): Promise<void> {
  const errorMessage = error instanceof Error ? error.message : 'Unknown error';
  logger.error(`${commandName} command error: ${errorMessage}`);

  // Check for specific API server errors and provide appropriate responses
  let content: string = MESSAGES.ERROR.GENERIC_ERROR;
  
  if (errorMessage.includes('API server error (500)') || errorMessage.includes('server error')) {
    content = MESSAGES.ERROR.API_SERVER_ERROR;
  } else if (errorMessage.includes('Rate limit') || errorMessage.includes('Too many requests')) {
    content = MESSAGES.ERROR.RATE_LIMIT;
  } else if (errorMessage.includes('Content not suitable for this channel')) {
    content = MESSAGES.ERROR.NSFW_TAG_IN_SFW;
  }

  try {
    if (interaction.deferred || interaction.replied) {
      await interaction.editReply({ content });
    } else {
      await interaction.reply({
        content,
        flags: MessageFlags.Ephemeral,
      });
    }
  } catch (replyError) {
    const replyErrorMessage = replyError instanceof Error ? replyError.message : 'Unknown reply error';
    if (!replyErrorMessage.includes('Unknown interaction') && !replyErrorMessage.includes('interaction has already been acknowledged')) {
      logger.error(`Failed to send error reply: ${replyErrorMessage}`);
    }
  }
}

process.on('exit', () => logger.destroy());
