// src/commands/context/imageInfo.ts

import {
  ContextMenuCommandBuilder,
  ApplicationCommandType,
  MessageContextMenuCommandInteraction,
  InteractionContextType,
  PermissionFlagsBits,
} from 'discord.js';
import { MESSAGES, CONFIG, CustomEmbed, format, EmbedBuilders, UNKNOWN_ARTIST } from '@shared/config';
import { handleCommandError, InteractionUtils, utils } from '@shared/utils';
import { ApiService } from '@services/ApiService';
import { MessageUtils } from '@services/ValidationService';

export const data = new ContextMenuCommandBuilder()
  .setName('Image Info')
  .setType(ApplicationCommandType.Message)
  .setContexts([InteractionContextType.Guild]);

export async function execute(interaction: MessageContextMenuCommandInteraction): Promise<void> {
  await InteractionUtils.deferEphemeral(interaction);

  try {
    const message = interaction.targetMessage;
    const botMember = interaction.guild?.members.me;

    if (interaction.channel && 'permissionsFor' in interaction.channel && botMember) {
      const botPermissions = interaction.channel.permissionsFor(botMember);
      if (!botPermissions?.has(PermissionFlagsBits.ViewChannel)) {
        return void await interaction.editReply({ content: MESSAGES.ERROR.MISSING_PERMISSIONS });
      }
    }

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

    const ratingEmojis = { g: '✅', s: '⚠️', q: '🔶', e: '🔞' };
    const ratingNames = { g: 'General', s: 'Sensitive', q: 'Questionable', e: 'Explicit' };
    
    const artistName = post.tag_string_artist.replace(/_/g, ' ') || UNKNOWN_ARTIST;
    const artistDisplay = artistName === UNKNOWN_ARTIST 
      ? UNKNOWN_ARTIST 
      : format.link(artistName, `${CONFIG.API.BASE_URL}/posts?tags=${post.tag_string_artist}`);

    const embed = new CustomEmbed('info')
      .withCommandInfo(`Post #${post.id}`, `${CONFIG.API.BASE_URL}/posts/${post.id}`)
      .setDescription(`${format.bold('Artist:')} ${artistDisplay}`)
      .addFields(
        { 
          name: '📊 Statistics', 
          value: format.bullet([
            `Score: ${format.bold(post.score.toString())}`,
            `Favorites: ${format.bold(post.fav_count.toString())}`,
            `Post ID: ${format.inlineCode(post.id.toString())}`
          ]), 
          inline: true 
        },
        { 
          name: '🏷️ Content Info', 
          value: format.bullet([
            `Rating: ${ratingEmojis[post.rating]} ${ratingNames[post.rating]}`,
            `Tags: ${post.tag_string.split(' ').length} total`,
            `Artist: ${artistName}`
          ]), 
          inline: true 
        },
        {
          name: '🔗 Quick Actions',
          value: format.bullet([
            'Right-click → "Show Tags" to see all tags',
            'Right-click → "Save Image" to DM yourself',
            `Visit ${format.link('Danbooru Page', `${CONFIG.API.BASE_URL}/posts/${post.id}`)} for more details`
          ]),
          inline: false
        }
      )
      .withStandardFooter(interaction.user);

    await interaction.editReply({ embeds: [embed] });
  } catch (error) {
    await handleCommandError(interaction, 'Image Info', error);
  }
}
