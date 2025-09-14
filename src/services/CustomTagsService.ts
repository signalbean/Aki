// src/services/CustomTagsService.ts

import {
  REST,
  Routes,
  SlashCommandBuilder,
  ApplicationCommand,
} from 'discord.js';
import {
  REGEX_PATTERNS,
  RESERVED_COMMAND_NAMES,
  TAG_PREFIX,
} from '@shared/config';
import { logger } from '@shared/utils';

const restCache = new Map<string, REST>();

const getRest = (token: string): REST => {
  let rest = restCache.get(token);
  if (!rest) {
    rest = new REST({ version: '10' }).setToken(token);
    restCache.set(token, rest);
  }
  return rest;
};

const createTagCommand = (name: string, tag: string, description?: string | null) => {
  const builder = new SlashCommandBuilder()
    .setName(name.toLowerCase())
    .setDescription(`${TAG_PREFIX} ${tag} • ${description || `Meow`}`.slice(0, 100));
  
  builder.addStringOption(option =>
    option.setName('rating')
      .setDescription('Filter by a specific content rating')
      .setRequired(false)
      .addChoices(
        { name: 'Questionable', value: 'q' },
        { name: 'Sensitive', value: 's' }
      )
  );
  
  return builder;
};

export const CustomTagsService = {
  async registerTagCommand(
    guildId: string, clientId: string, token: string,
    name: string, tag: string, description?: string | null
  ): Promise<void> {
    const rest = getRest(token);
    const commandBuilder = createTagCommand(name, tag, description);

    try {
      await rest.post(
        Routes.applicationGuildCommands(clientId, guildId),
        { body: commandBuilder.toJSON() }
      );
    } catch (error) {
      logger.error(`Failed to register command /${name} in guild ${guildId}: ${error instanceof Error ? error.message : String(error)}`);
      throw new Error('Failed to register the command with Discord.');
    }
  },

  async unregisterTagCommand(
    guildId: string, clientId: string, token: string, name: string
  ): Promise<void> {
    const rest = getRest(token);
    try {
      const commands = await this.getGuildTags(guildId, clientId, token);
      const commandToDelete = commands.find(cmd => cmd.name === name);

      if (!commandToDelete) {
        logger.warn(`Command /${name} not found for deletion in guild ${guildId}.`);
        throw new Error('Command not found.');
      }

      await rest.delete(Routes.applicationGuildCommand(clientId, guildId, commandToDelete.id));
    } catch (error) {
      logger.error(`Failed to unregister command /${name} from guild ${guildId}: ${error instanceof Error ? error.message : String(error)}`);
      throw new Error('Failed to unregister the command from Discord.');
    }
  },

  async getGuildTags(guildId: string, clientId: string, token: string): Promise<ApplicationCommand[]> {
    const rest = getRest(token);
    try {
      const allCommands = await rest.get(Routes.applicationGuildCommands(clientId, guildId)) as ApplicationCommand[];
      return allCommands.filter(cmd => cmd.description.startsWith(TAG_PREFIX));
    } catch (error) {
      logger.error(`Failed to get commands for guild ${guildId}: ${error instanceof Error ? error.message : String(error)}`);
      return [];
    }
  },

  validateTagName(name: string): { isValid: boolean, error?: string } {
    if (!REGEX_PATTERNS.VALID_TAG_NAME.test(name)) {
      return {
        isValid: false,
        error: '❌ Command name must be 1-32 characters long and can only contain lowercase letters, numbers, and underscores.',
      };
    }
    if (RESERVED_COMMAND_NAMES.has(name)) {
      return {
        isValid: false,
        error: '❌ This name is reserved and cannot be used.',
      };
    }
    return { isValid: true };
  },

  getTagFromCommand(command: ApplicationCommand): string | null {
    if (!command.description.startsWith(TAG_PREFIX)) return null;
    
    const afterPrefix = command.description.substring(TAG_PREFIX.length).trim();
    const dotIndex = afterPrefix.indexOf('•');
    return dotIndex === -1 ? afterPrefix : afterPrefix.substring(0, dotIndex).trim();
  },
};
