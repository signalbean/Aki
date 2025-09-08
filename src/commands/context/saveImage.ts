// src/commands/context/saveImage.ts

import {
  ContextMenuCommandBuilder,
  ApplicationCommandType,
  MessageContextMenuCommandInteraction,
  InteractionContextType,
  PermissionFlagsBits,
} from 'discord.js';
import { InteractionUtils, utils } from '@shared/utils';
import { MessageUtils } from '@services/ValidationService';
import { CustomEmbed } from '@shared/config';
import { MESSAGES } from '@shared/messages';

export const data = new ContextMenuCommandBuilder()
  .setName('Save')
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
      const errorEmbed = new CustomEmbed('error')
        .withError('Access Denied', MESSAGES.ERROR.BOT_MESSAGES_ONLY)
        .withStandardFooter(interaction.user);
      await InteractionUtils.safeReply(interaction, { embeds: [errorEmbed] });
      return;
    }

    const { url: imageUrl } = utils.findImageInMessage(message);
    if (!imageUrl) {
      const errorEmbed = new CustomEmbed('error')
        .withError('No Image Found', MESSAGES.ERROR.NO_IMAGE_IN_MESSAGE)
        .withStandardFooter(interaction.user);
      await InteractionUtils.safeReply(interaction, { embeds: [errorEmbed] });
      return;
    }

    try {
      await interaction.user.send({ content: imageUrl });
      await interaction.deleteReply();
    } catch {
      const errorEmbed = new CustomEmbed('error')
        .withError('DM Failed', MESSAGES.ERROR.DM_FAILED)
        .withStandardFooter(interaction.user);
      await InteractionUtils.safeReply(interaction, { embeds: [errorEmbed] });
    }
  } catch (error) {
    try {
      const errorEmbed = new CustomEmbed('error')
        .withError('Unexpected Error', MESSAGES.ERROR.GENERIC_ERROR)
        .withStandardFooter(interaction.user);
      await InteractionUtils.safeReply(interaction, { embeds: [errorEmbed] });
    } catch {
      // Ignore
    }
  }
}
