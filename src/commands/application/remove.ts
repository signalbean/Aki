// src/commands/application/remove.ts

import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  InteractionContextType,
  MessageFlags,
  PermissionFlagsBits,
  AutocompleteInteraction,
} from 'discord.js';
import { CustomTagsService } from '@services/CustomTagsService';
import { handleCommandError, InteractionUtils, logger } from '@shared/utils';
import { CustomEmbed, format, MESSAGES } from '@shared/config';
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
  if (!InteractionUtils.checkGuildContext(interaction) || !interaction.memberPermissions) {
    return void await interaction.reply({
      content: MESSAGES.ERROR.GUILD_ONLY,
      flags: MessageFlags.Ephemeral,
    });
  }

  await InteractionUtils.deferEphemeral(interaction);

  try {
    const name = interaction.options.getString('name', true).toLowerCase();

    if (!interaction.memberPermissions.has(PermissionFlagsBits.ManageMessages)) {
      const errorEmbed = new CustomEmbed('error')
        .withError('Permission Denied')
        .setDescription('You need the "Manage Messages" permission to remove custom commands.')
        .withStandardFooter(interaction.user);

      return void await interaction.editReply({ embeds: [errorEmbed] });
    }

    const existingTags = await CustomTagsService.getGuildTags(
      interaction.guild!.id,
      interaction.client.user.id,
      env.TOKEN
    );

    const commandToRemove = existingTags.find(cmd => cmd.name === name);
    if (!commandToRemove) {
      const notFoundEmbed = new CustomEmbed('warning')
        .withWarning('Command Not Found')
        .setDescription(`The command ${format.inlineCode('/' + name)} doesn't exist in this server.`)
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
        .withError('Removal Failed')
        .setDescription('An error occurred while communicating with Discord. Please try again later.')
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
    const focusedValue = interaction.options.getFocused().toLowerCase();
    const tags = await CustomTagsService.getGuildTags(
      interaction.guild.id,
      interaction.client.user.id,
      env.TOKEN!
    );

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

    await interaction.respond(filtered);
  } catch (error) {
    logger.warn(`Autocomplete error for remove command: ${error instanceof Error ? error.message : String(error)}`);
    await interaction.respond([]).catch(() => {});
  }
}
