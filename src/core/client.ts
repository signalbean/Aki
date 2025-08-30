// src/core/client.ts

import {
  Client,
  GatewayIntentBits,
  Interaction,
  Partials,
  Collection,
  Message,
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

type LoadedCommands = {
  commands: Collection<string, ApplicationCommand>;
  contextCommands: Collection<string, ContextCommand>;
};

async function loadCommands(): Promise<LoadedCommands> {
  const commands = new Collection<string, ApplicationCommand>();
  const contextCommands = new Collection<string, ContextCommand>();

  const commandDirs = [
    { path: paths.applicationCommands(), isContext: false },
    { path: paths.contextCommands(), isContext: true },
  ];

  for (const { path: dirPath, isContext } of commandDirs) {
    const files = await fileOps.getDirFiles(dirPath);
    
    for (const filePath of files) {
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
        logger.error(`Failed to load command at ${filePath}: ${
          error instanceof Error ? error.message : String(error)
        }`);
      }
    }
  }

  return { commands, contextCommands };
}

export class BotClient {
  private client: Client;
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
            logger.error(`Autocomplete error for ${interaction.commandName}: ${
              err instanceof Error ? err.message : String(err)
            }`)
          );
        }
      }
    } catch (err) {
      logger.error(`Unhandled interaction error: ${
        err instanceof Error ? err.message : String(err)
      }`);
    }
  }

  public async start(): Promise<void> {
    const { commands, contextCommands } = await loadCommands();
    this.commands = commands;
    this.contextCommands = contextCommands;

    this.client.once('clientReady', async (bot) => {
      logger.log(`Logged in as ${bot.user.tag}`);

      CacheService.initialize();

      try {
        await initializeWaifus();
      } catch (err) {
        logger.error(`Waifu initialization failed: ${
          err instanceof Error ? err.message : String(err)
        }`);
      }

      bot.user.setPresence({
        status: CONFIG.DISCORD.PRESENCE.status,
      });
    });

    this.client.on('interactionCreate', this.handleInteraction.bind(this));

    await this.client.login(env.TOKEN);
  }

  public async stop(): Promise<void> {
    logger.log('Shutting down bot...');
    
    await this.client.destroy();
    new ApiService().cleanup();
    CacheService.destroy();

    logger.log('Bot shutdown complete.');
  }

  public getClient(): Client {
    return this.client;
  }
}
