// src/scripts/manage-commands.ts

import { REST } from 'discord.js';
import { Routes } from 'discord-api-types/v10';
import { readdir } from 'fs/promises';
import { join } from 'path';
import { pathToFileURL } from 'url';
import { env } from '@shared/env';
import { CommandData, LoadedCommand } from '@shared/types';

class CommandManager {
  private rest: REST;
  private clientId: string;

  constructor() {
    this.rest = new REST({ version: '10' }).setToken(env.TOKEN);
    this.clientId = env.CLIENT_ID;
  }

  private async loadCommands(): Promise<{
    application: LoadedCommand[];
    context: LoadedCommand[];
  }> {
    const commands = {
      application: [] as LoadedCommand[],
      context: [] as LoadedCommand[]
    };

    const commandTypes = [
      { type: 'application', path: 'dist/commands/application' },
      { type: 'context', path: 'dist/commands/context' }
    ];

    for (const { type, path } of commandTypes) {
      try {
        const files = await readdir(path, { withFileTypes: true });
        const jsFiles = files
          .filter(file => file.isFile() && file.name.endsWith('.js'))
          .map(file => file.name);

        console.log(`📁 Found ${jsFiles.length} ${type} command file(s)`);

        for (const file of jsFiles) {
          try {
            const filePath = join(process.cwd(), path, file);
            const fileUrl = pathToFileURL(filePath).href;
            const commandModule = await import(fileUrl);
            
            // Check for both default export and named export patterns
            let commandData = null;
            
            if (commandModule.data?.toJSON) {
              // Named export: export const data = SlashCommandBuilder...
              commandData = commandModule.data;
            } else if (commandModule.default?.data?.toJSON) {
              // Default export: export default { data: SlashCommandBuilder... }
              commandData = commandModule.default.data;
            }
            
            if (commandData) {
              commands[type as keyof typeof commands].push({
                data: commandData,
                filePath: file
              });
            } else {
              console.warn(`⚠️  Skipping ${file}: No valid command data found`);
            }
          } catch (error) {
            console.error(`❌ Failed to load ${file}:`, error instanceof Error ? error.message : error);
          }
        }
      } catch (error) {
        console.warn(`⚠️  Directory ${path} not found or inaccessible`);
      }
    }

    return commands;
  }

  private formatCommands(commands: CommandData[]): string {
    if (commands.length === 0) return 'No commands found';
    
    return commands
      .map(cmd => `${cmd.name} (${cmd.id || 'no-id'})`)
      .join('\n');
  }

  private async deployCommands(guildId?: string): Promise<void> {
    const commands = await this.loadCommands();
    const allCommands = [...commands.application, ...commands.context];
    
    if (allCommands.length === 0) {
      console.log('📭 No commands to deploy');
      return;
    }

    const commandData = allCommands.map(cmd => cmd.data.toJSON());

    try {
      const route = guildId 
        ? Routes.applicationGuildCommands(this.clientId, guildId)
        : Routes.applicationCommands(this.clientId);

      const deployedCommands = await this.rest.put(route, { 
        body: commandData 
      }) as CommandData[];

      const target = guildId ? `guild ${guildId}` : 'globally';
      console.log(`\n🚀 Successfully deployed ${deployedCommands.length} commands ${target}\n`);

      // Separate deployed commands by type
      const appCommands = deployedCommands.filter(cmd => !cmd.type || cmd.type === 1);
      const contextCommands = deployedCommands.filter(cmd => cmd.type && cmd.type !== 1);

      console.log('<-- Application Commands -->');
      console.log(this.formatCommands(appCommands));
      
      console.log('\n<-- Context Menu Commands -->');
      console.log(this.formatCommands(contextCommands));

    } catch (error) {
      console.error('❌ Failed to deploy commands:', error instanceof Error ? error.message : error);
      process.exit(1);
    }
  }

  private async deleteAllCommands(guildId?: string): Promise<void> {
    try {
      const route = guildId 
        ? Routes.applicationGuildCommands(this.clientId, guildId)
        : Routes.applicationCommands(this.clientId);

      await this.rest.put(route, { body: [] });

      const target = guildId ? `guild ${guildId}` : 'globally';
      console.log(`🗑️  Successfully deleted all commands ${target}`);
    } catch (error) {
      console.error('❌ Failed to delete commands:', error instanceof Error ? error.message : error);
      process.exit(1);
    }
  }

  private async deleteCommand(commandId: string, guildId?: string): Promise<void> {
    try {
      const route = guildId 
        ? Routes.applicationGuildCommand(this.clientId, guildId, commandId)
        : Routes.applicationCommand(this.clientId, commandId);

      await this.rest.delete(route);

      const target = guildId ? `from guild ${guildId}` : 'globally';
      console.log(`🗑️  Successfully deleted command ${commandId} ${target}`);
    } catch (error) {
      console.error('❌ Failed to delete command:', error instanceof Error ? error.message : error);
      process.exit(1);
    }
  }

  public async run(args: string[]): Promise<void> {
    const flags = this.parseArguments(args);

    if (flags.global) {
      console.log('🌍 Deploying commands globally...');
      await this.deployCommands();
    } else if (flags.guildId) {
      console.log(`🏠 Deploying commands to guild ${flags.guildId}...`);
      await this.deployCommands(flags.guildId);
    } else if (flags.deleteGlobal) {
      console.log('🌍 Deleting all global commands...');
      await this.deleteAllCommands();
    } else if (flags.deleteGuildId) {
      console.log(`🏠 Deleting all commands from guild ${flags.deleteGuildId}...`);
      await this.deleteAllCommands(flags.deleteGuildId);
    } else if (flags.deleteCommandId) {
      const target = flags.deleteFromGuild ? `from guild ${flags.deleteFromGuild}` : 'globally';
      console.log(`🗑️  Deleting command ${flags.deleteCommandId} ${target}...`);
      await this.deleteCommand(flags.deleteCommandId, flags.deleteFromGuild);
    } else {
      this.showHelp();
    }
  }

  private parseArguments(args: string[]): {
    global?: boolean;
    guildId?: string;
    deleteGlobal?: boolean;
    deleteGuildId?: string;
    deleteCommandId?: string;
    deleteFromGuild?: string;
  } {
    const flags: any = {};

    for (let i = 0; i < args.length; i++) {
      const arg = args[i];
      
      switch (arg) {
        case '--g':
          flags.global = true;
          break;
        case '--id':
          if (i + 1 < args.length) {
            flags.guildId = args[++i];
          } else {
            console.error('❌ --id requires a guild ID parameter');
            process.exit(1);
          }
          break;
        case '--dg':
          flags.deleteGlobal = true;
          break;
        case '--did':
          if (i + 1 < args.length) {
            flags.deleteGuildId = args[++i];
          } else {
            console.error('❌ --did requires a guild ID parameter');
            process.exit(1);
          }
          break;
        case '--cid':
          if (i + 1 < args.length) {
            flags.deleteCommandId = args[++i];
            // Check if next argument exists and is not a flag (optional guild ID)
            if (i + 1 < args.length && !args[i + 1].startsWith('--')) {
              flags.deleteFromGuild = args[++i];
            }
          } else {
            console.error('❌ --cid requires a command ID parameter');
            process.exit(1);
          }
          break;
        default:
          // Handle cases where guild ID is provided without explicit flag for package.json scripts
          if (!arg.startsWith('--') && !flags.guildId && !flags.deleteGuildId) {
            if (flags.global === undefined && flags.deleteGlobal === undefined) {
              // This might be a guild ID for --id or --did
              const prevArg = args[i - 1];
              if (prevArg === '--id') {
                flags.guildId = arg;
              } else if (prevArg === '--did') {
                flags.deleteGuildId = arg;
              }
            }
          }
          break;
      }
    }

    return flags;
  }

  private showHelp(): void {
    console.log(`
🤖 Discord Bot Command Management

Usage:
  node dist/scripts/manage-commands.js [options]

Options:
  --g                    Deploy commands globally
  --id <guild_id>        Deploy commands to specific guild
  --dg                   Delete all global commands
  --did <guild_id>       Delete all guild commands
  --cid <command_id> [guild_id]  Delete single command (optionally from specific guild)

Examples:
  npm run deploy                          # Deploy globally
  npm run deploy:guild 123456789          # Deploy to guild
  npm run delete                          # Delete all global commands
  npm run delete:guild 123456789          # Delete all guild commands
  npm run delete:one 123456789            # Delete specific command globally
  npm run delete:one 123456789 987654321  # Delete specific command from guild

Environment Variables Required:
  TOKEN      - Discord bot token
  CLIENT_ID  - Discord application client ID
    `);
  }
}

const manager = new CommandManager();
const args = process.argv.slice(2);
  
manager.run(args).catch(error => {
  console.error('❌ Unexpected error:', error);
  process.exit(1);
});
