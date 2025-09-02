// src/handlers/customTagHandler.ts

import {
  ChatInputCommandInteraction,
  ApplicationCommand,
} from 'discord.js';
import { ApiService } from '@services/ApiService';
import { ValidationService, ChannelUtils } from '@services/ValidationService';
import { CustomTagsService } from '@services/CustomTagsService';
import { handleCommandError, InteractionUtils } from '@shared/utils';
import { CustomEmbed } from '@shared/config';
import { MESSAGES } from '@shared/messages';
import { ApiServerError } from '@shared/error';

export async function handleCustomTag(interaction: ChatInputCommandInteraction): Promise<void> {
  const isValid = await InteractionUtils.validateContext(interaction, { requireEphemeral: false });
  if (!isValid) return;

  try {
    let command: ApplicationCommand | undefined;
    
    try {
      command = interaction.guild!.commands.cache.get(interaction.commandId) || 
                await interaction.guild!.commands.fetch(interaction.commandId);
    } catch (fetchError) {
      const errorEmbed = new CustomEmbed('error')
        .withError('Command Not Found', MESSAGES.ERROR.COMMAND_NOT_FOUND)
        .withStandardFooter(interaction.user);
      return void await interaction.editReply({ embeds: [errorEmbed] });
    }

    if (!command) {
      const errorEmbed = new CustomEmbed('error')
        .withError('Command Not Found', MESSAGES.ERROR.COMMAND_NOT_FOUND)
        .withStandardFooter(interaction.user);
      return void await interaction.editReply({ embeds: [errorEmbed] });
    }

    const tagName = CustomTagsService.getTagFromCommand(command);
    if (!tagName) {
      const errorEmbed = new CustomEmbed('error')
        .withError('Invalid Custom Tag', MESSAGES.ERROR.INVALID_CUSTOM_TAG)
        .withStandardFooter(interaction.user);
      return void await interaction.editReply({ embeds: [errorEmbed] });
    }

    const requestedRating = interaction.options.getString('rating') as 'q' | 's' | null;
    const targetRating = ValidationService.determineRating(requestedRating, interaction.channel as any);

    const ratingValidation = ValidationService.validateChannelRating(targetRating, interaction.channel);
    if (!ratingValidation.isValid) {
      const errorEmbed = new CustomEmbed('error')
        .withError('Content Restricted', ratingValidation.error)
        .withStandardFooter(interaction.user);
      return void await interaction.editReply({ embeds: [errorEmbed] });
    }

    const isSfwChannel = !ChannelUtils.isNSFWChannel(interaction.channel);
    if (isSfwChannel && !requestedRating && ValidationService.isPotentiallyNSFWTag(tagName)) {
      const errorEmbed = new CustomEmbed('error')
        .withError('NSFW Content', MESSAGES.ERROR.NSFW_TAG_IN_SFW)
        .withStandardFooter(interaction.user);
      return void await interaction.editReply({ embeds: [errorEmbed] });
    }

    const apiService = new ApiService();
    let post;
    try {
      post = await apiService.fetchRandomImage(tagName, targetRating);
    } catch (error) {
      if (error instanceof ApiServerError) {
        if (error.status === 422 && isSfwChannel) {
          const errorEmbed = new CustomEmbed('error')
            .withError('NSFW Content', MESSAGES.ERROR.NSFW_TAG_IN_SFW)
            .withStandardFooter(interaction.user);
          return void await interaction.editReply({ embeds: [errorEmbed] });
        }
        if (error.message.includes('Rate limit')) {
          const errorEmbed = new CustomEmbed('error')
            .withError('Rate Limited', MESSAGES.ERROR.RATE_LIMIT)
            .withStandardFooter(interaction.user);
          return void await interaction.editReply({ embeds: [errorEmbed] });
        }
        if (error.status >= 500) {
          const errorEmbed = new CustomEmbed('error')
            .withError('API Server Error', MESSAGES.ERROR.API_SERVER_ERROR)
            .withStandardFooter(interaction.user);
          return void await interaction.editReply({ embeds: [errorEmbed] });
        }
      }
      throw error;
    }

    if (!post?.file_url) {
      const errorEmbed = new CustomEmbed('warning')
        .withWarning('No Image Found', `${MESSAGES.ERROR.NO_IMAGE}\n*Tag searched: \`${tagName}\`*`)
        .withStandardFooter(interaction.user);
      return void await interaction.editReply({ embeds: [errorEmbed] });
    }

    const finalRatingValidation = ValidationService.validateChannelRating(post.rating, interaction.channel);
    if (!finalRatingValidation.isValid) {
      const errorEmbed = new CustomEmbed('error')
        .withError('Content Restricted', finalRatingValidation.error)
        .withStandardFooter(interaction.user);
      return void await interaction.editReply({ embeds: [errorEmbed] });
    }

    await interaction.editReply({ content: post.file_url });
  } catch (error) {
    await handleCommandError(interaction, `custom-tag:${interaction.commandName}`, error);
  }
}
