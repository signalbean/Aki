// src/commands/application/waifu.ts

import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  InteractionContextType,
} from 'discord.js';
import { ApiService } from '@services/ApiService';
import { ValidationService } from '@services/ValidationService';
import { MESSAGES } from '@shared/config';
import { handleCommandError, logger, fileOps, paths, InteractionUtils } from '@shared/utils';

export let waifuTags: string[] = [];

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
    logger.error(`Failed to load waifu tags: ${error instanceof Error ? error.message : String(error)}`);
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
  const isValid = await InteractionUtils.validateContext(interaction, {
    requireGuild: true,
    requireEphemeral: false,
  });
  if (!isValid) return;

  try {
    const rating = interaction.options.getString('rating') as 'q' | 's' | null;

    let searchTag = '';
    if (waifuTags.length > 0) {
      searchTag = waifuTags[Math.floor(Math.random() * waifuTags.length)];
    } else {
      searchTag = '1girl';
    }

    const tagValidation = ValidationService.validateTags(searchTag);
    if (!tagValidation.isValid) {
      return void await interaction.editReply({ content: tagValidation.error! });
    }

    const targetRating = ValidationService.determineRating(rating, interaction.channel as any);
    const ratingValidation = ValidationService.validateChannelRating(targetRating, interaction.channel);
    if (!ratingValidation.isValid) {
      return void await interaction.editReply({ content: ratingValidation.error! });
    }

    const apiService = new ApiService();
    const post = await apiService.fetchRandomImage(searchTag, targetRating);

    if (!post?.file_url) {
      return void await interaction.editReply({ content: MESSAGES.ERROR.NO_IMAGE });
    }

    const finalRatingValidation = ValidationService.validateChannelRating(post.rating, interaction.channel);
    if (!finalRatingValidation.isValid) {
      return void await interaction.editReply({ content: finalRatingValidation.error! });
    }

    await interaction.editReply({ content: post.file_url });
  } catch (error) {
    await handleCommandError(interaction, 'waifu', error);
  }
}
