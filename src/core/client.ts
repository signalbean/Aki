// src/core/client.ts

import {
  Client,
  GatewayIntentBits,
  Interaction,
  Partials,
  Collection,
} from 'discord.js';
import { ApiService } from '@services/ApiService';
import { CacheService } from '@services/CacheService';
import { paths, fileOps, logger, handleCommandError } from '@shared/utils';
import { handleCustomTag } from '@handlers/customTagHandler';
import { CONFIG } from '@shared/config';
import { ApplicationCommand, ContextCommand } from '@shared/types';
import { initializeWaifus } from '@commands/application/waifu';
import { pathToFileURL } from 'url';
import { env } from '@shared/env';

/**
 * Dynamically loads all command modules from the commands directory.
 * Separates application commands (slash commands) from context menu commands.
 */
const loadCommands = async (): Promise<{
  commands: Collection<string, ApplicationCommand>;
  contextCommands: Collection<string, ContextCommand>;
}> => {
  const commands = new Collection<string, ApplicationCommand>();
  const contextCommands = new Collection<string, ContextCommand>();

  const commandDirs = [
    { path: paths.applicationCommands(), isContext: false },
    { path: paths.contextCommands(), isContext: true },
  ];

  for (const { path: dirPath, isContext } of commandDirs) {
    const files = await fileOps.getDirFiles(dirPath);
    
    await Promise.all(files.map(async (filePath) => {
      try {
        const commandModule = await import(pathToFileURL(filePath).href);
        
        if ('data' in commandModule && 'execute' in commandModule) {
          const name = commandModule.data.name;
          if (isContext) {
            contextCommands.set(name, commandModule);
          } else {
            commands.set(name, commandModule);
          }
        }
      } catch (error) {
        logger.error(`Failed to load command at ${filePath}: ${(error as Error).message}`);
      }
    }));
  }

  return { commands, contextCommands };
};

export class BotClient {
  private readonly client: Client;
  private commands = new Collection<string, ApplicationCommand>();
  private contextCommands = new Collection<string, ContextCommand>();

  constructor() {
    this.client = new Client({
      intents: [
        GatewayIntentBits.Guilds, 
        GatewayIntentBits.DirectMessages,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent
      ],
      partials: [Partials.Channel],
    });
  }

  private async handleInteraction(interaction: Interaction): Promise<void> {
    try {
      if (interaction.isChatInputCommand()) {
        const command = this.commands.get(interaction.commandName);
        const handler = command?.execute ?? handleCustomTag;
        
        await handler(interaction).catch((err) =>
          handleCommandError(interaction, interaction.commandName, err)
        );
      }
      else if (interaction.isMessageContextMenuCommand()) {
        const command = this.contextCommands.get(interaction.commandName);
        if (command) {
          await command.execute(interaction).catch((err) =>
            handleCommandError(interaction, interaction.commandName, err)
          );
        }
      }
      else if (interaction.isAutocomplete()) {
        const command = this.commands.get(interaction.commandName);
        if (command?.autocomplete) {
          await command.autocomplete(interaction).catch((err) =>
            logger.error(`Autocomplete error for ${interaction.commandName}: ${(err as Error).message}`)
          );
        }
      }
    } catch (err) {
      logger.error(`Unhandled interaction error: ${(err as Error).message}`);
    }
  }

  async start(): Promise<void> {
    const { commands, contextCommands } = await loadCommands();
    this.commands = commands;
    this.contextCommands = contextCommands;

    this.client.once('clientReady', async (bot) => {
      logger.log(`Logged in as ${bot.user.tag}`);

      CacheService.initialize();

      try {
        await initializeWaifus();
      } catch (err) {
        logger.error(`Waifu initialization failed: ${(err as Error).message}`);
      }

      bot.user.setPresence({
        status: CONFIG.DISCORD.PRESENCE.status,
      });
    });

    this.client.on('interactionCreate', this.handleInteraction.bind(this));
    await this.client.login(env.TOKEN);
  }

  async stop(): Promise<void> {
    logger.log('Shutting down bot...');
    
    await this.client.destroy();
    new ApiService().cleanup();
    CacheService.destroy();

    logger.log('Bot shutdown complete.');
  }

  getClient(): Client {
    return this.client;
  }
}
