// src/commands/application/add.ts

import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  InteractionContextType,
  PermissionFlagsBits
} from 'discord.js';
import { CustomTagsService } from '@services/CustomTagsService';
import { ValidationService } from '@services/ValidationService';
import { handleCommandError, InteractionUtils } from '@shared/utils';
import { CONFIG, CustomEmbed, format } from '@shared/config';
import { MESSAGES } from '@shared/messages';
import { env } from '@shared/env';

export const data = new SlashCommandBuilder()
  .setName('add')
  .setDescription('Adds a custom command to search for a specific tag.')
  .setContexts([InteractionContextType.Guild])
  .setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages)
  .addStringOption(option =>
    option.setName('name')
      .setDescription('The name of the new command (e.g., "neko").')
      .setRequired(true)
  )
  .addStringOption(option =>
    option.setName('tag')
      .setDescription('The Danbooru tag to search for (e.g., "cat_girl").')
      .setRequired(true)
      .setAutocomplete(true)
  )
  .addStringOption(option =>
    option.setName('description')
      .setDescription('An optional custom description for the command.')
      .setRequired(false)
  );

export async function execute(interaction: ChatInputCommandInteraction): Promise<void> {
  const isValid = await InteractionUtils.validateContext(interaction, {
    requireGuild: true,
    requireEphemeral: true,
  });
  if (!isValid) return;

  try {
    const name = interaction.options.getString('name', true).toLowerCase().replace(/\s+/g, '_');
    const tag = interaction.options.getString('tag', true).toLowerCase().replace(/\s+/g, '_');
    const description = interaction.options.getString('description');

    const nameValidation = CustomTagsService.validateTagName(name);
    if (!nameValidation.isValid) {
      const errorEmbed = new CustomEmbed('error')
        .withError('Invalid Command Name', nameValidation.error)
        .withStandardFooter(interaction.user);
      return void await interaction.editReply({ embeds: [errorEmbed] });
    }

    const tagValidation = ValidationService.validateTags(tag);
    if (!tagValidation.isValid) {
      const errorEmbed = new CustomEmbed('error')
        .withError('Invalid Tag', tagValidation.error)
        .withStandardFooter(interaction.user);
      return void await interaction.editReply({ embeds: [errorEmbed] });
    }

    const existingTags = await CustomTagsService.getGuildTags(
      interaction.guild!.id,
      interaction.client.user.id,
      env.TOKEN
    );

    if (existingTags.length >= CONFIG.BOT.MAX_CUSTOM_TAGS) {
      const errorEmbed = new CustomEmbed('warning')
        .withWarning('Server Limit Reached', MESSAGES.ERROR.MAX_TAGS_REACHED)
        .withStandardFooter(interaction.user);
      return void await interaction.editReply({ embeds: [errorEmbed] });
    }

    try {
      await CustomTagsService.registerTagCommand(
        interaction.guild!.id,
        interaction.client.user.id,
        env.TOKEN,
        name,
        tag,
        description
      );

      const embed = new CustomEmbed('success')
        .withCommandSuccess(MESSAGES.SUCCESS.COMMAND_ADDED)
        .setDescription(`Successfully created the ${format.inlineCode('/' + name)} command for this server!`)
        .addFields(
          { name: '🏷️ Target Tag', value: format.inlineCode(tag), inline: true },
          { name: '📝 Description', value: description || 'Auto-generated description', inline: true },
          { name: '🎯 Usage', value: `Use ${format.inlineCode('/' + name)} to search for ${format.bold(tag.replace(/_/g, ' '))} images`, inline: false }
        )
        .withStandardFooter(interaction.user);

      await interaction.editReply({ embeds: [embed] });
    } catch (deployError) {
      const errorEmbed = new CustomEmbed('error')
        .withError('Registration Failed', MESSAGES.ERROR.REGISTRATION_FAILED)
        .withStandardFooter(interaction.user);

      await interaction.editReply({ embeds: [errorEmbed] });
    }
  } catch (error) {
    await handleCommandError(interaction, 'add', error);
  }
}

export { tagAutocomplete as autocomplete } from '@shared/autocomplete';
