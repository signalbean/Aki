// src/commands/application/search.ts

import {
  ChatInputCommandInteraction,
  SlashCommandBuilder,
  InteractionContextType
} from 'discord.js';
import { executeImageCommand } from '@shared/command-base';

export const data = new SlashCommandBuilder()
  .setName('search')
  .setDescription('Search Danbooru for an image by tag')
  .setContexts([InteractionContextType.Guild])
  .addStringOption(option =>
    option.setName('tag')
      .setDescription('Search tag (e.g. 1girl) - max 1 tag due to API limits')
      .setRequired(true)
      .setAutocomplete(true)
  )
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
  const tag = interaction.options.getString('tag') || '';
  const rating = interaction.options.getString('rating') as 'q' | 's' | null;
  await executeImageCommand(interaction, 'search', tag, rating);
}

export { tagAutocomplete as autocomplete } from '@shared/autocomplete';
