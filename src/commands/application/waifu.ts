// src/commands/application/waifu.ts

import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  InteractionContextType,
} from 'discord.js';
import { logger, fileOps, paths } from '@shared/utils';
import { executeImageCommand } from '@shared/command-base';

// Array to store waifu character tags loaded from assets/waifus.txt
export let waifuTags: string[] = [];

/**
 * Loads waifu character tags from the assets/waifus.txt file.
 * These tags are used to provide random waifu images when the /waifu command is used.
 */
export async function initializeWaifus(): Promise<void> {
  try {
    const content = await fileOps.readText(paths.waifus());
    if (content) {
      waifuTags = content
        .split('\n')
        .map(line => line.trim())
        .filter(line => line && !line.startsWith('#'));
    }
  } catch (error) {
    logger.error(`Failed to load waifu tags: ${(error as Error).message}`);
  }
}

export const data = new SlashCommandBuilder()
  .setName('waifu')
  .setDescription('Get a random waifu image')
  .setContexts([InteractionContextType.Guild])
  .addStringOption(option =>
    option.setName('rating')
      .setDescription('Content rating')
      .setRequired(false)
      .addChoices(
        { name: 'Questionable', value: 'q' },
        { name: 'Sensitive', value: 's' }
      )
  );

export async function execute(interaction: ChatInputCommandInteraction): Promise<void> {
  const rating = interaction.options.getString('rating') as 'q' | 's' | null;
  const searchTag = waifuTags.length > 0 
    ? waifuTags[Math.floor(Math.random() * waifuTags.length)]
    : '1girl';

  await executeImageCommand(interaction, 'waifu', searchTag, rating);
}
