// src/commands/application/remove.ts

import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  InteractionContextType,
  PermissionFlagsBits,
  AutocompleteInteraction
} from 'discord.js';
import { CustomTagsService } from '@services/CustomTagsService';
import { handleCommandError, InteractionUtils, logger } from '@shared/utils';
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
    requirePermissions: ['ManageMessages'],
  });
  if (!isValid) return;

  try {
    const name = interaction.options.getString('name', true).toLowerCase();

    const existingTags = await CustomTagsService.getGuildTags(
      interaction.guild!.id,
      interaction.client.user.id,
      env.TOKEN
    );

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

      return void await interaction.editReply({ embeds: [notFoundEmbed] });
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

      await interaction.editReply({ embeds: [successEmbed] });
    } catch (deployError) {
      const errorEmbed = new CustomEmbed('error')
        .withError('Removal Failed', MESSAGES.ERROR.REMOVAL_FAILED)
        .withStandardFooter(interaction.user);

      await interaction.editReply({ embeds: [errorEmbed] });
    }
  } catch (error) {
    await handleCommandError(interaction, 'remove', error);
  }
}

export async function autocomplete(interaction: AutocompleteInteraction): Promise<void> {
  if (!interaction.guild) return;

  try {
    if (!interaction.isAutocomplete()) {
      return;
    }

    const focusedValue = interaction.options.getFocused().toLowerCase();
    
    const timeoutPromise = new Promise<never>((_, reject) => {
      setTimeout(() => reject(new Error('Autocomplete timeout')), 2000);
    });

    const tags = await Promise.race([
      CustomTagsService.getGuildTags(
        interaction.guild.id,
        interaction.client.user.id,
        env.TOKEN!
      ),
      timeoutPromise
    ]);

    const filtered = tags
      .filter(tag => tag.name.toLowerCase().includes(focusedValue))
      .map(tag => {
        const targetTag = CustomTagsService.getTagFromCommand(tag);
        return {
          name: `${tag.name} → ${targetTag || 'unknown tag'}`,
          value: tag.name
        };
      })
      .slice(0, 25);
    if (interaction.responded || !interaction.isAutocomplete()) {
      return;
    }

    await interaction.respond(filtered);
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    if (!errorMessage.includes('Unknown interaction') && !errorMessage.includes('timeout')) {
      logger.warn(`Autocomplete error for remove command: ${errorMessage}`);
    }
    
    if (!interaction.responded) {
      await interaction.respond([]).catch(() => {});
    }
  }
}
