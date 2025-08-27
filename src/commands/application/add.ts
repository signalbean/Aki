// src/commands/application/add.ts

import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  InteractionContextType,
  PermissionFlagsBits,
  MessageFlags,
  AutocompleteInteraction,
} from 'discord.js';
import { CustomTagsService } from '@services/CustomTagsService';
import { ValidationService } from '@services/ValidationService';
import { handleCommandError, InteractionUtils, logger } from '@shared/utils';
import { CONFIG, CustomEmbed, format, MESSAGES } from '@shared/config';
import { ApiService } from '@services/ApiService';
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
  if (!InteractionUtils.checkGuildContext(interaction)) {
    return void await interaction.reply({
      content: MESSAGES.ERROR.GUILD_ONLY,
      flags: MessageFlags.Ephemeral,
    });
  }

  await InteractionUtils.deferEphemeral(interaction);

  try {
    const name = interaction.options.getString('name', true).toLowerCase().replace(/\s+/g, '_');
    const tag = interaction.options.getString('tag', true).toLowerCase().replace(/\s+/g, '_');
    const description = interaction.options.getString('description');

    const nameValidation = CustomTagsService.validateTagName(name);
    if (!nameValidation.isValid) {
      return void await interaction.editReply({ content: nameValidation.error! });
    }

    const tagValidation = ValidationService.validateTags(tag);
    if (!tagValidation.isValid) {
      return void await interaction.editReply({ content: tagValidation.error! });
    }
    
    const existingTags = await CustomTagsService.getGuildTags(
      interaction.guild!.id,
      interaction.client.user.id,
      env.TOKEN
    );

    if (existingTags.length >= CONFIG.BOT.MAX_CUSTOM_TAGS) {
      return void await interaction.editReply({
        content: `❌ This server has reached the maximum limit of ${CONFIG.BOT.MAX_CUSTOM_TAGS} custom commands. Please remove an existing command before adding a new one.`,
      });
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
        .withError('Registration Failed')
        .setDescription('Failed to register the command with Discord. Please try again later.')
        .withStandardFooter(interaction.user);
      
      await interaction.editReply({ embeds: [errorEmbed] });
    }
  } catch (error) {
    await handleCommandError(interaction, 'add', error);
  }
}

export async function autocomplete(interaction: AutocompleteInteraction): Promise<void> {
  try {
    const focusedOption = interaction.options.getFocused(true);
    
    if (focusedOption.name !== 'tag') {
      return void await interaction.respond([]);
    }

    const input = focusedOption.value.toString().trim();
    if (input.length === 0) return void await interaction.respond([]);

    const apiService = new ApiService();
    const suggestions = await apiService.Autocomplete(input);
    
    const choices = suggestions.slice(0, 5).map(tag => ({
      name: `${tag.name}`,
      value: tag.name
    }));

    await interaction.respond(choices);
  } catch (error) {
    logger.warn(`Autocomplete error for add command: ${error instanceof Error ? error.message : String(error)}`);
    await interaction.respond([]).catch(() => {});
  }
}
