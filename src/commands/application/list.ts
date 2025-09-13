// src/commands/application/list.ts

import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  InteractionContextType,
  ApplicationCommand,
} from 'discord.js';
import { CustomTagsService } from '@services/CustomTagsService';
import { handleCommandError, InteractionUtils } from '@shared/utils';
import { CustomEmbed, format, CONFIG } from '@shared/config';
import { MESSAGES } from '@shared/messages';
import { env } from '@shared/env';

export const data = new SlashCommandBuilder()
  .setName('list')
  .setDescription('Lists all available custom tag commands in this server.')
  .setContexts([InteractionContextType.Guild]);

export async function execute(interaction: ChatInputCommandInteraction): Promise<void> {
  const isValid = await InteractionUtils.validateContext(interaction, {
    requireGuild: true,
    requireEphemeral: true,
  });
  if (!isValid) return;

  try {
    let tags: ApplicationCommand[];
    try {
      tags = await CustomTagsService.getGuildTags(
        interaction.guild!.id,
        interaction.client.user.id,
        env.TOKEN
      );
    } catch (error) {
      const errorEmbed = new CustomEmbed('error')
        .withError('Service Error', 'Failed to fetch custom commands. Please try again later.')
        .withStandardFooter(interaction.user);
      await InteractionUtils.safeReply(interaction, { embeds: [errorEmbed] });
      return;
    }

    if (tags.length === 0) {
      const emptyEmbed = new CustomEmbed('warning')
        .withWarning(MESSAGES.INFO.NO_CUSTOM_COMMANDS)
        .setDescription('This server doesn\'t have any custom tag commands yet!')
        .addFields({
          name: '🚀 Getting Started',
          value: format.bullet([
            `Use ${format.inlineCode('/add name:neko tag:cat_girl')} to create your first command`,
            `You can create up to ${CONFIG.BOT.MAX_CUSTOM_TAGS} custom commands per server`,
            'Popular tags like `1girl`, `landscape`, or `cat_girl` work great!'
          ])
        })
        .withStandardFooter(interaction.user);

      await InteractionUtils.safeReply(interaction, { embeds: [emptyEmbed] });
      return;
    }

    // Group commands by first letter for better organization
    const groupedCommands = tags.reduce((acc, command) => {
      const actualTag = CustomTagsService.getTagFromCommand(command);
      const firstLetter = command.name[0].toUpperCase();

      if (!acc[firstLetter]) acc[firstLetter] = [];
      acc[firstLetter].push({
        name: command.name,
        tag: actualTag || '???',
        description: command.description
      });

      return acc;
    }, {} as Record<string, Array<{name: string, tag: string, description: string}>>);

    const embed = new CustomEmbed('info')
      .setTitle(`🏷️ Custom Commands for ${interaction.guild!.name}`)
      .setDescription(
        `Found ${format.bold(tags.length.toString())} custom command${tags.length === 1 ? '' : 's'}. ` +
        `You can create ${format.bold((CONFIG.BOT.MAX_CUSTOM_TAGS - tags.length).toString())} more.`
      );

    // Add fields for each letter group
    Object.keys(groupedCommands).sort().forEach(letter => {
      const commands = groupedCommands[letter];
      const commandList = commands.map(cmd =>
        `${format.inlineCode('/' + cmd.name)} → ${format.inlineCode(cmd.tag)}`
      ).join('\n');

      embed.addFields({
        name: `📁 ${letter.toUpperCase()}`,
        value: commandList,
        inline: true
      });
    });

    embed.addFields({
      name: '💡 Pro Tips',
      value: format.bullet([
        `Use ${format.inlineCode('/remove')} to delete unwanted commands`,
        'Right-click any bot image for quick actions',
        `Commands support ${format.inlineCode('rating:')} parameter for content filtering`
      ]),
      inline: false
    }).withStandardFooter(interaction.user);

    await InteractionUtils.safeReply(interaction, { embeds: [embed] });
  } catch (error) {
    await handleCommandError(interaction, 'list', error);
  }
}
