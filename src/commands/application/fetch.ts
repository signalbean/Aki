// src/commands/application/fetch.ts

import {
  ChatInputCommandInteraction,
  SlashCommandBuilder,
  InteractionContextType,
  AutocompleteInteraction,
} from 'discord.js';
import { ApiService } from '@services/ApiService';
import { ValidationService } from '@services/ValidationService';
import { MESSAGES } from '@shared/config';
import { handleCommandError, InteractionUtils, logger } from '@shared/utils';

export const data = new SlashCommandBuilder()
  .setName('fetch')
  .setDescription('Fetch a random image from Danbooru')
  .setContexts([InteractionContextType.Guild])
  .addStringOption(option =>
    option.setName('search')
      .setDescription('Search tag (e.g. 1girl) - max 1 tag due to API limits')
      .setRequired(false)
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
  )
  .addStringOption(option =>
    option.setName('id')
      .setDescription('Fetch by post ID')
      .setRequired(false)
  );

export async function execute(interaction: ChatInputCommandInteraction): Promise<void> {
  // Validation
  const isValid = await InteractionUtils.validateContext(interaction, { requireEphemeral: false });
  if (!isValid) return;

  try {
    const id = interaction.options.getString('id');
    const search = interaction.options.getString('search');
    const rating = interaction.options.getString('rating') as 'q' | 's' | null;

    if (id && !ValidationService.isValidPostId(id)) {
      return void await interaction.editReply({
        content: MESSAGES.ERROR.INVALID_POST_ID,
      });
    }

    if (!id) {
      const tagValidation = ValidationService.validateTags(search || '');
      if (!tagValidation.isValid) {
        return void await interaction.editReply({ content: tagValidation.error! });
      }
    }

    const apiService = new ApiService();

    if (id) {
      const post = await apiService.fetchPostById(id);
      if (!post?.file_url) {
        return void await interaction.editReply({ content: MESSAGES.ERROR.NO_IMAGE });
      }
      const ratingValidation = ValidationService.validateChannelRating(post.rating, interaction.channel);
      if (!ratingValidation.isValid) {
        return void await interaction.editReply({ content: ratingValidation.error! });
      }
      return void await interaction.editReply({ content: post.file_url });
    }
  } catch (error) {
    await handleCommandError(interaction, 'fetch', error);
  }
}

export async function autocomplete(interaction: AutocompleteInteraction): Promise<void> {
  try {
    const focusedOption = interaction.options.getFocused(true);

    if (focusedOption.name !== 'search') {
      return void await interaction.respond([]);
    }

    const input = focusedOption.value.toString().trim();
    if (input.length === 0) return void await interaction.respond([]);

    const apiService = new ApiService();
    const suggestions = await apiService.Autocomplete(input);

    const choices = suggestions.slice(0, 5).map(tag => ({
      name: `${tag.name} (${tag.post_count.toLocaleString()} posts)`,
      value: tag.name
    }));

    await interaction.respond(choices);
  } catch (error) {
    logger.warn(`Autocomplete error for fetch command: ${error instanceof Error ? error.message : String(error)}`);
    await interaction.respond([]).catch(() => {});
  }
}
