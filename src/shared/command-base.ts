// src/shared/command-base.ts

import { ChatInputCommandInteraction } from 'discord.js';
import { ApiService } from '@services/ApiService';
import { ValidationService } from '@services/ValidationService';
import { InteractionUtils, handleCommandError } from '@shared/utils';
import { CustomEmbed } from '@shared/config';
import { MESSAGES } from '@shared/messages';

/**
 * Shared execution logic for image-fetching commands (fetch, search, waifu, custom tags).
 * Handles validation, API calls, and error responses consistently across all image commands.
 */
export async function executeImageCommand(
  interaction: ChatInputCommandInteraction,
  commandName: string,
  tags: string = '',
  rating: 'q' | 's' | null = null
): Promise<void> {
  const isValid = await InteractionUtils.validateContext(interaction, { requireEphemeral: false });
  if (!isValid) return;

  try {
    // Validate tags if provided
    if (tags) {
      const tagValidation = ValidationService.validateTags(tags);
      if (!tagValidation.isValid) {
        const errorEmbed = new CustomEmbed('error')
          .withError('Invalid Tag', tagValidation.error!)
          .withStandardFooter(interaction.user);
        return void await interaction.editReply({ embeds: [errorEmbed] });
      }
    }

    // Determine and validate rating
    const targetRating = ValidationService.determineRating(rating, interaction.channel as any);
    const ratingValidation = ValidationService.validateChannelRating(targetRating, interaction.channel);
    if (!ratingValidation.isValid) {
      const errorEmbed = new CustomEmbed('error')
        .withError('Content Restricted', ratingValidation.error!)
        .withStandardFooter(interaction.user);
      return void await interaction.editReply({ embeds: [errorEmbed] });
    }

    // Fetch image
    const apiService = new ApiService();
    const post = await apiService.fetchRandomImage(tags, targetRating);

    if (!post?.file_url) {
      const errorEmbed = new CustomEmbed('error')
        .withError('No Image Found', MESSAGES.ERROR.NO_IMAGE)
        .withStandardFooter(interaction.user);
      return void await interaction.editReply({ embeds: [errorEmbed] });
    }

    // Final rating validation
    const finalRatingValidation = ValidationService.validateChannelRating(post.rating, interaction.channel);
    if (!finalRatingValidation.isValid) {
      const errorEmbed = new CustomEmbed('error')
        .withError('Content Restricted', finalRatingValidation.error!)
        .withStandardFooter(interaction.user);
      return void await interaction.editReply({ embeds: [errorEmbed] });
    }

    await interaction.editReply({ content: post.file_url });
  } catch (error) {
    await handleCommandError(interaction, commandName, error);
  }
}

/**
 * Shared execution logic for fetching specific posts by ID.
 * Validates post IDs and handles content rating restrictions.
 */
export async function executePostCommand(
  interaction: ChatInputCommandInteraction,
  commandName: string,
  postId: string
): Promise<void> {
  const isValid = await InteractionUtils.validateContext(interaction, { requireEphemeral: false });
  if (!isValid) return;

  try {
    if (!ValidationService.isValidPostId(postId)) {
      const errorEmbed = new CustomEmbed('error')
        .withError('Invalid Post ID', MESSAGES.ERROR.INVALID_POST_ID)
        .withStandardFooter(interaction.user);
      return void await interaction.editReply({ embeds: [errorEmbed] });
    }

    const apiService = new ApiService();
    const post = await apiService.fetchPostById(postId);

    if (!post?.file_url) {
      const errorEmbed = new CustomEmbed('error')
        .withError('Post Not Found', MESSAGES.ERROR.POST_NOT_FOUND)
        .withStandardFooter(interaction.user);
      return void await interaction.editReply({ embeds: [errorEmbed] });
    }

    // Validate rating for channel
    const ratingValidation = ValidationService.validateChannelRating(post.rating, interaction.channel);
    if (!ratingValidation.isValid) {
      const errorEmbed = new CustomEmbed('error')
        .withError('Content Restricted', ratingValidation.error!)
        .withStandardFooter(interaction.user);
      return void await interaction.editReply({ embeds: [errorEmbed] });
    }

    await interaction.editReply({ content: post.file_url });
  } catch (error) {
    await handleCommandError(interaction, commandName, error);
  }
}
