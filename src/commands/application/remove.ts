// src/commands/application/remove.ts

import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  InteractionContextType,
  PermissionFlagsBits
} from 'discord.js';
import { CustomTagsService } from '@services/CustomTagsService';
import { handleCommandError, InteractionUtils } from '@shared/utils';
import { CustomEmbed, format } from '@shared/config';
import { MESSAGES } from '@shared/messages';
import { env } from '@shared/env';

export const data = new SlashCommandBuilder()
  .setName('remove')
  .setDescription('Remove a custom tag command from this server.')
  .setContexts([InteractionContextType.Guild])
  .setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages)
  .addStringOption(option =>
    option.setName('name')
      .setDescription('Name of the custom command to remove.')
      .setRequired(true)
      .setAutocomplete(true)
  );

export async function execute(interaction: ChatInputCommandInteraction): Promise<void> {
  const isValid = await InteractionUtils.validateContext(interaction, {
    requireGuild: true,
    requireEphemeral: true,
  });
  if (!isValid) return;

  try {
    const name = interaction.options.getString('name', true).toLowerCase();

    let existingTags;
    try {
      existingTags = await CustomTagsService.getGuildTags(
        interaction.guild!.id,
        interaction.client.user.id,
        env.TOKEN
      );
    } catch (error) {
      const errorEmbed = new CustomEmbed('error')
        .withError('Service Error', 'Failed to fetch existing commands. Please try again later.')
        .withStandardFooter(interaction.user);
      await InteractionUtils.safeReply(interaction, { embeds: [errorEmbed] });
      return;
    }

    const commandToRemove = existingTags.find(cmd => cmd.name === name);
    if (!commandToRemove) {
      const notFoundEmbed = new CustomEmbed('warning')
        .withWarning('Command Not Found', `The command ${format.inlineCode('/' + name)} doesn't exist in this server.`)
        .addFields({
          name: '📋 Available Commands',
          value: existingTags.length > 0
            ? `Use ${format.inlineCode('/list')} to see all custom commands.`
            : 'No custom commands exist yet.'
        })
        .withStandardFooter(interaction.user);

      await InteractionUtils.safeReply(interaction, { embeds: [notFoundEmbed] });
      return;
    }

    try {
      await CustomTagsService.unregisterTagCommand(
        interaction.guild!.id,
        interaction.client.user.id,
        env.TOKEN!,
        name
      );

      const targetTag = CustomTagsService.getTagFromCommand(commandToRemove);
      const successEmbed = new CustomEmbed('success')
        .withCommandSuccess(MESSAGES.SUCCESS.COMMAND_REMOVED)
        .setDescription(`Successfully removed the ${format.inlineCode('/' + name)} command from this server.`)
        .addFields(
          { name: '🗑️ Removed Command', value: format.inlineCode('/' + name), inline: true },
          { name: '🏷️ Associated Tag', value: format.inlineCode(targetTag || 'Unknown'), inline: true },
          { name: '📊 Remaining Commands', value: `${existingTags.length - 1} commands left`, inline: true }
        )
        .withStandardFooter(interaction.user);

      await InteractionUtils.safeReply(interaction, { embeds: [successEmbed] });
    } catch (deployError) {
      const errorEmbed = new CustomEmbed('error')
        .withError('Removal Failed', MESSAGES.ERROR.REMOVAL_FAILED)
        .withStandardFooter(interaction.user);

      await InteractionUtils.safeReply(interaction, { embeds: [errorEmbed] });
    }
  } catch (error) {
    await handleCommandError(interaction, 'remove', error);
  }
}

export { customCommandAutocomplete as autocomplete } from '@shared/autocomplete';
