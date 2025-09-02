import {
  ChatInputCommandInteraction,
  SlashCommandBuilder,
  InteractionContextType
} from 'discord.js';
import { ApiService } from '@services/ApiService';
import { ValidationService } from '@services/ValidationService';
import { handleCommandError, InteractionUtils } from '@shared/utils';
import { CustomEmbed } from '@shared/config';
import { MESSAGES } from '@shared/messages';

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
  const isValid = await InteractionUtils.validateContext(interaction, { requireEphemeral: false });
  if (!isValid) return;

  try {
    const id = interaction.options.getString('id', true);

    const apiService = new ApiService();

    if (!ValidationService.isValidPostId(id)) {
      const errorEmbed = new CustomEmbed('error')
        .withError('Invalid Post ID', MESSAGES.ERROR.INVALID_POST_ID)
        .withStandardFooter(interaction.user);
      return void await interaction.editReply({ embeds: [errorEmbed] });
    }

    const post = await apiService.fetchPostById(id);
    if (!post?.file_url) {
      const errorEmbed = new CustomEmbed('error')
        .withError('No Image Found', MESSAGES.ERROR.NO_IMAGE)
        .withStandardFooter(interaction.user);
      return void await interaction.editReply({ embeds: [errorEmbed] });
    }

    const ratingValidation = ValidationService.validateChannelRating(post.rating, interaction.channel);
    if (!ratingValidation.isValid) {
      const errorEmbed = new CustomEmbed('error')
        .withError('Content Restricted', ratingValidation.error)
        .withStandardFooter(interaction.user);
      return void await interaction.editReply({ embeds: [errorEmbed] });
    }

    await interaction.editReply({ content: post.file_url });
  } catch (error) {
    await handleCommandError(interaction, 'post', error);
  }
}
