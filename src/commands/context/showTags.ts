// src/commands/context/showTags.ts

import {
  ContextMenuCommandBuilder,
  ApplicationCommandType,
  MessageContextMenuCommandInteraction,
  InteractionContextType,
} from 'discord.js';
import { CONFIG, CustomEmbed, format, EmbedBuilders } from '@shared/config';
import { handleCommandError, InteractionUtils, utils } from '@shared/utils';
import { ValidationService, MessageUtils } from '@services/ValidationService';
import { ApiService } from '@services/ApiService';

export const data = new ContextMenuCommandBuilder()
  .setName('Show Tags')
  .setType(ApplicationCommandType.Message)
  .setContexts([InteractionContextType.Guild]);

const TAG_LIMIT = 40;

export async function execute(interaction: MessageContextMenuCommandInteraction): Promise<void> {
  const isValid = await InteractionUtils.validateContext(interaction, { requireEphemeral: true });
  if (!isValid) return;

  try {
    const message = interaction.targetMessage;

    if (!MessageUtils.isBotMessage(message, interaction.client.user.id)) {
      return void await interaction.editReply({ 
        embeds: [EmbedBuilders.botMessagesOnlyError(interaction.user)] 
      });
    }

    const { id } = utils.findImageInMessage(message);
    if (!id) {
      return void await interaction.editReply({ 
        embeds: [EmbedBuilders.noImageFoundError(interaction.user, 'message')] 
      });
    }

    const apiService = new ApiService();
    const post = await apiService.fetchPostById(id);
    if (!post) {
      return void await interaction.editReply({ 
        embeds: [EmbedBuilders.noImageFoundError(interaction.user, 'post')] 
      });
    }

    const categorizedTags = ValidationService.categorizeTags(post.tag_string, post.tag_string_artist);
    const totalTags = post.tag_string.split(' ').filter(tag => tag.trim()).length;

    const formatTagList = (tagList: string[], highlight?: string) => {
      return tagList.map(tag => {
        const displayTag = tag.replace(/_/g, ' ');
        if (tag === highlight) {
          return format.bold(`"${displayTag}"`);
        }
        return format.inlineCode(displayTag);
      }).join(' • ');
    };

    const embed = new CustomEmbed('info')
      .withCommandInfo(`Tags for Post #${post.id}`, `${CONFIG.API.BASE_URL}/posts/${post.id}`)
      .setDescription(`Found ${format.bold(totalTags.toString())} tags total.`);

    if (categorizedTags.artist.length > 0) {
      embed.addFields({
        name: '🎨 Artist',
        value: formatTagList(categorizedTags.artist, post.tag_string_artist),
        inline: false
      });
    }

    if (categorizedTags.character.length > 0) {
      embed.addFields({
        name: '👤 Characters & Count',
        value: formatTagList(categorizedTags.character.slice(0, 15)),
        inline: false
      });
    }

    if (categorizedTags.copyright.length > 0) {
      embed.addFields({
        name: '📚 Series/Copyright',
        value: formatTagList(categorizedTags.copyright.slice(0, 10)),
        inline: false
      });
    }

    if (categorizedTags.general.length > 0) {
      const remainingSpace = TAG_LIMIT - categorizedTags.artist.length - categorizedTags.character.length - categorizedTags.copyright.length;
      const displayTags = categorizedTags.general.slice(0, Math.max(remainingSpace, 10));
      embed.addFields({
        name: '🏷️ General Tags',
        value: formatTagList(displayTags),
        inline: false
      });
    }

    if (categorizedTags.meta.length > 0) {
      embed.addFields({
        name: '📝 Meta Tags',
        value: formatTagList(categorizedTags.meta),
        inline: false
      });
    }

    const displayedTags = Object.values(categorizedTags).reduce((sum, arr) => sum + arr.length, 0);
    if (totalTags > displayedTags) {
      embed.addFields({
        name: '⚡ Additional Tags',
        value: `And ${format.bold((totalTags - displayedTags).toString())} more tags. Visit the ${format.link('Danbooru page', `${CONFIG.API.BASE_URL}/posts/${post.id}`)} to see all tags.`,
        inline: false
      });
    }

    embed.addFields({
      name: '💡 Pro Tips',
      value: format.bullet([
        'Use popular tags in your searches for better results',
        `Try ${format.inlineCode('/fetch')} with any of these tags`,
        'Bold tags are highlighted (like the artist name)'
      ]),
      inline: false
    }).withStandardFooter(interaction.user);

    await interaction.editReply({ embeds: [embed] });
  } catch (error) {
    await handleCommandError(interaction, 'Show Tags', error);
  }
}
