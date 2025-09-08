// src/commands/application/fetch.ts

import {
  ChatInputCommandInteraction,
  SlashCommandBuilder,
  InteractionContextType
} from 'discord.js';
import { executeImageCommand } from '@shared/command-base';

export const data = new SlashCommandBuilder()
  .setName('fetch')
  .setDescription('Fetch a random image from Danbooru')
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
  await executeImageCommand(interaction, 'fetch', '', rating);
}
