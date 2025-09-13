// src/commands/context/removeMessage.ts

import {
  ContextMenuCommandBuilder,
  ApplicationCommandType,
  MessageContextMenuCommandInteraction,
  InteractionContextType,
} from 'discord.js';
import { InteractionUtils } from '@shared/utils';
import { MessageUtils } from '@services/ValidationService';
import { CustomEmbed } from '@shared/config';
import { MESSAGES } from '@shared/messages';

export const data = new ContextMenuCommandBuilder()
  .setName('Remove')
  .setType(ApplicationCommandType.Message)
  .setContexts([InteractionContextType.Guild]);

export async function execute(interaction: MessageContextMenuCommandInteraction): Promise<void> {
  const isValid = await InteractionUtils.validateContext(interaction, {
    requireGuild: false,
    requireEphemeral: true
  });
  if (!isValid) return;

  try {
    const message = interaction.targetMessage;

    if (!MessageUtils.isBotMessage({ author: message.author }, interaction.client.user.id)) {
      const errorEmbed = new CustomEmbed('error')
        .withError('Access Denied', MESSAGES.ERROR.BOT_MESSAGES_ONLY)
        .withStandardFooter(interaction.user);
      await InteractionUtils.safeReply(interaction, { embeds: [errorEmbed] });
      return;
    }

    const messageData: { interactionMetadata?: { user: { id: string } } } = {};
    if (message.interactionMetadata?.user) {
      messageData.interactionMetadata = { user: { id: message.interactionMetadata.user.id } };
    }

    if (!MessageUtils.canUserRemoveMessage(
      messageData,
      interaction.user.id,
      interaction.channel
    )) {
      const errorEmbed = new CustomEmbed('error')
        .withError('Removal Denied', MESSAGES.ERROR.REMOVAL_DENIED)
        .withStandardFooter(interaction.user);
      await InteractionUtils.safeReply(interaction, { embeds: [errorEmbed] });
      return;
    }

    try {
      await message.delete();
      // Only try to delete reply if interaction is still valid
      if (interaction.isRepliable()) {
        await interaction.deleteReply().catch(() => {});
      }
    } catch (deleteError) {
      const errorEmbed = new CustomEmbed('error')
        .withError('Delete Failed', 'Unable to delete the message. It may have already been removed.')
        .withStandardFooter(interaction.user);
      await InteractionUtils.safeReply(interaction, { embeds: [errorEmbed] });
    }
  } catch (error) {
    try {
      // Only try to respond if interaction is still valid
      if (interaction.isRepliable()) {
        const errorEmbed = new CustomEmbed('error')
          .withError('Unexpected Error', MESSAGES.ERROR.GENERIC_ERROR)
          .withStandardFooter(interaction.user);
        await InteractionUtils.safeReply(interaction, { embeds: [errorEmbed] });
      }
    } catch {
      // Silently ignore if we can't respond
    }
  }
}
