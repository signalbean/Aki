// src/commands/context/saveImage.ts

import {
  ContextMenuCommandBuilder,
  ApplicationCommandType,
  MessageContextMenuCommandInteraction,
  InteractionContextType,
  PermissionFlagsBits,
} from 'discord.js';
import { MESSAGES } from '@shared/config';
import { InteractionUtils, utils } from '@shared/utils';
import { MessageUtils } from '@services/ValidationService';

export const data = new ContextMenuCommandBuilder()
  .setName('Save Image')
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
      return void await interaction.editReply({ content: MESSAGES.ERROR.BOT_MESSAGES_ONLY });
    }

    const { url: imageUrl } = utils.findImageInMessage(message);
    if (!imageUrl) {
      return void await interaction.editReply({ content: MESSAGES.ERROR.NO_IMAGE_IN_MESSAGE });
    }

    try {
      await interaction.user.send({ content: imageUrl });
      await interaction.deleteReply();
    } catch {
      await interaction.editReply({ content: MESSAGES.ERROR.DM_FAILED });
    }
  } catch (error) {
    try {
      await interaction.editReply({ content: MESSAGES.ERROR.GENERIC_ERROR });
    } catch {
      // Ignore
    }
  }
}
