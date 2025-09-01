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
  .setName('Remove Message')
  .setType(ApplicationCommandType.Message)
  .setContexts([InteractionContextType.Guild, InteractionContextType.BotDM]);

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
      return void await interaction.editReply({ embeds: [errorEmbed] });
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
      return void await interaction.editReply({ embeds: [errorEmbed] });
    }

    await message.delete();
    await interaction.deleteReply();
  } catch (error) {
    try {
      const errorEmbed = new CustomEmbed('error')
        .withError('Unexpected Error', MESSAGES.ERROR.GENERIC_ERROR)
        .withStandardFooter(interaction.user);
      await interaction.editReply({ embeds: [errorEmbed] });
    } catch {
      // Ignore
    }
  }
}
