// src/handlers/customTagHandler.ts

import {
  ChatInputCommandInteraction,
  ApplicationCommand,
} from 'discord.js';
import { ApiService } from '@services/ApiService';
import { ValidationService, ChannelUtils } from '@services/ValidationService';
import { CustomTagsService } from '@services/CustomTagsService';
import { MESSAGES } from '@shared/config';
import { handleCommandError, InteractionUtils } from '@shared/utils';
import { ApiServerError } from '@shared/error';

export async function handleCustomTag(interaction: ChatInputCommandInteraction): Promise<void> {
  const isValid = await InteractionUtils.validateContext(interaction, { requireEphemeral: false });
  if (!isValid) return;

  try {
    const command: ApplicationCommand | undefined = interaction.guild!.commands.cache.get(interaction.commandId)
      ?? await interaction.guild!.commands.fetch(interaction.commandId);

    if (!command) {
      return void await interaction.editReply({
        content: MESSAGES.ERROR.COMMAND_NOT_FOUND,
      });
    }

    const tagName = CustomTagsService.getTagFromCommand(command);
    if (!tagName) {
      return void await interaction.editReply({
        content: MESSAGES.ERROR.INVALID_CUSTOM_TAG,
      });
    }

    const requestedRating = interaction.options.getString('rating') as 'q' | 's' | null;
    const targetRating = ValidationService.determineRating(requestedRating, interaction.channel as any);

    const ratingValidation = ValidationService.validateChannelRating(targetRating, interaction.channel);
    if (!ratingValidation.isValid) {
      return void await interaction.editReply({ content: ratingValidation.error! });
    }

    const isSfwChannel = !ChannelUtils.isNSFWChannel(interaction.channel);
    if (isSfwChannel && !requestedRating && ValidationService.isPotentiallyNSFWTag(tagName)) {
      return void await interaction.editReply({
        content: MESSAGES.ERROR.NSFW_TAG_IN_SFW
      });
    }

    const apiService = new ApiService();
    let post;
    try {
      post = await apiService.fetchRandomImage(tagName, targetRating);
    } catch (error) {
      if (error instanceof ApiServerError) {
        if (error.status === 422 && isSfwChannel) {
          return void await interaction.editReply({ content: MESSAGES.ERROR.NSFW_TAG_IN_SFW });
        }
        if (error.message.includes('Rate limit')) {
          return void await interaction.editReply({ content: MESSAGES.ERROR.RATE_LIMIT });
        }
      }
      throw error;
    }

    if (!post?.file_url) {
      return void await interaction.editReply({
        content: `${MESSAGES.ERROR.NO_IMAGE}\n*Tag searched: \`${tagName}\`*`,
      });
    }

    const finalRatingValidation = ValidationService.validateChannelRating(post.rating, interaction.channel);
    if (!finalRatingValidation.isValid) {
      return void await interaction.editReply({ content: finalRatingValidation.error! });
    }

    await interaction.editReply({ content: post.file_url });
  } catch (error) {
    await handleCommandError(interaction, `custom-tag:${interaction.commandName}`, error);
  }
}
