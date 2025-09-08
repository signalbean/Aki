// src/commands/application/post.ts

import {
  ChatInputCommandInteraction,
  SlashCommandBuilder,
  InteractionContextType
} from 'discord.js';
import { executePostCommand } from '@shared/command-base';

export const data = new SlashCommandBuilder()
  .setName('post')
  .setDescription('Fetch an image from Danbooru by post ID')
  .setContexts([InteractionContextType.Guild])
  .addStringOption(option =>
    option.setName('id')
      .setDescription('Fetch by post ID')
      .setRequired(true)
  );

export async function execute(interaction: ChatInputCommandInteraction): Promise<void> {
  const id = interaction.options.getString('id', true);
  await executePostCommand(interaction, 'post', id);
}
