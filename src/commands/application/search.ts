import {
  ChatInputCommandInteraction,
  SlashCommandBuilder,
  InteractionContextType,
  AutocompleteInteraction
} from 'discord.js';
import { ApiService } from '@services/ApiService';
import { ValidationService } from '@services/ValidationService';
import { handleCommandError, InteractionUtils, logger } from '@shared/utils';
import { CustomEmbed } from '@shared/config';
import { MESSAGES } from '@shared/messages';

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
  const isValid = await InteractionUtils.validateContext(interaction, { requireEphemeral: false });
  if (!isValid) return;

  try {
    const tag = interaction.options.getString('tag');
    const rating = interaction.options.getString('rating') as 'q' | 's' | null;

    const apiService = new ApiService();

    const tagValidation = ValidationService.validateTags(tag || '');
    if (!tagValidation.isValid) {
      const errorEmbed = new CustomEmbed('error')
        .withError('Invalid Tag', tagValidation.error)
        .withStandardFooter(interaction.user);
      return void await interaction.editReply({ embeds: [errorEmbed] });
    }

    const targetRating = ValidationService.determineRating(rating, interaction.channel as any);
    const ratingValidation = ValidationService.validateChannelRating(targetRating, interaction.channel);
    if (!ratingValidation.isValid) {
      const errorEmbed = new CustomEmbed('error')
        .withError('Content Restricted', ratingValidation.error)
        .withStandardFooter(interaction.user);
      return void await interaction.editReply({ embeds: [errorEmbed] });
    }

    const post = await apiService.fetchRandomImage(tag || '', targetRating);

    if (!post?.file_url) {
      const errorEmbed = new CustomEmbed('error')
        .withError('No Image Found', MESSAGES.ERROR.NO_IMAGE)
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
    await handleCommandError(interaction, 'search', error);
  }
}

export async function autocomplete(interaction: AutocompleteInteraction): Promise<void> {
  try {
    if (!interaction.isAutocomplete()) {
      return;
    }

    const focusedOption = interaction.options.getFocused(true);

    if (focusedOption.name !== 'tag') {
      return void await interaction.respond([]).catch(() => {});
    }

    const input = focusedOption.value.toString().trim();
    if (input.length === 0) {
      return void await interaction.respond([]).catch(() => {});
    }

    const timeoutPromise = new Promise<never>((_, reject) => {
      setTimeout(() => reject(new Error('Autocomplete timeout')), 2000);
    });

    const apiService = new ApiService();
    const suggestions = await Promise.race([
      apiService.Autocomplete(input),
      timeoutPromise
    ]);

    const choices = suggestions.slice(0, 5).map(tag => ({
      name: `${tag.name}`,
      value: tag.name
    }));

    if (interaction.responded || !interaction.isAutocomplete()) {
      return;
    }

    await interaction.respond(choices);
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    if (!errorMessage.includes('Unknown interaction') && !errorMessage.includes('timeout')) {
      logger.warn(`Autocomplete error for search command: ${errorMessage}`);
    }

    if (!interaction.responded) {
      await interaction.respond([]).catch(() => {});
    }
  }
}
