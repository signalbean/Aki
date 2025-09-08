// src/commands/context/imageInfo.ts

import {
  ContextMenuCommandBuilder,
  ApplicationCommandType,
  MessageContextMenuCommandInteraction,
  InteractionContextType,
} from 'discord.js';
import { CONFIG, CustomEmbed, format, EmbedBuilders, UNKNOWN_ARTIST } from '@shared/config';
import { handleCommandError, InteractionUtils, utils } from '@shared/utils';
import { ApiService } from '@services/ApiService';
import { MessageUtils } from '@services/ValidationService';
import { DanbooruPost } from '@shared/types';

export const data = new ContextMenuCommandBuilder()
  .setName('Info')
  .setType(ApplicationCommandType.Message)
  .setContexts([InteractionContextType.Guild]);

export async function execute(interaction: MessageContextMenuCommandInteraction): Promise<void> {
  const isValid = await InteractionUtils.validateContext(interaction, { 
    requireGuild: true, 
    requireEphemeral: true 
  });
  if (!isValid) return;

  try {
    const message = interaction.targetMessage;

    if (!MessageUtils.isBotMessage(message, interaction.client.user.id)) {
      await InteractionUtils.safeReply(interaction, { 
        embeds: [EmbedBuilders.botMessagesOnlyError(interaction.user)] 
      });
      return;
    }

    const { id } = utils.findImageInMessage(message);
    if (!id) {
      await InteractionUtils.safeReply(interaction, { 
        embeds: [EmbedBuilders.noImageFoundError(interaction.user, 'message')] 
      });
      return;
    }

    const apiService = new ApiService();
    let post: DanbooruPost | null = null;
    try {
      post = await Promise.race([
        apiService.fetchPostById(id),
        new Promise<never>((_, reject) => 
          setTimeout(() => reject(new Error('API request timeout')), 8000)
        )
      ]);
    } catch (error) {
      await InteractionUtils.safeReply(interaction, { 
        embeds: [EmbedBuilders.noImageFoundError(interaction.user, 'post')] 
      });
      return;
    }

    if (!post) {
      await InteractionUtils.safeReply(interaction, { 
        embeds: [EmbedBuilders.noImageFoundError(interaction.user, 'post')] 
      });
      return;
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
            'Right-click → "Tags" to see all tags',
            'Right-click → "Save" to DM yourself',
            `Visit ${format.link('Danbooru Page', `${CONFIG.API.BASE_URL}/posts/${post.id}`)} for more details`
          ]),
          inline: false
        }
      )
      .withStandardFooter(interaction.user);

    await InteractionUtils.safeReply(interaction, { embeds: [embed] });
  } catch (error) {
    await handleCommandError(interaction, 'Info', error);
  }
}
