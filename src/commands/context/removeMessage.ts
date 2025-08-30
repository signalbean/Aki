// src/commands/context/removeMessage.ts

import {
  ContextMenuCommandBuilder,
  ApplicationCommandType,
  MessageContextMenuCommandInteraction,
  InteractionContextType,
} from 'discord.js';
import { MESSAGES } from '@shared/config';
import { InteractionUtils } from '@shared/utils';
import { MessageUtils } from '@services/ValidationService';

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
      return void await interaction.editReply({ content: MESSAGES.ERROR.BOT_MESSAGES_ONLY });
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
      return void await interaction.editReply({
        content: MESSAGES.ERROR.REMOVAL_DENIED,
      });
    }

    await message.delete();
    await interaction.deleteReply();
  } catch (error) {
    try {
      await interaction.editReply({ content: MESSAGES.ERROR.GENERIC_ERROR });
    } catch {
      // Ignore
    }
  }
}
