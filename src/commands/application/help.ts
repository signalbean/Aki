// src/commands/application/help.ts

import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  StringSelectMenuBuilder,
  StringSelectMenuOptionBuilder,
  ActionRowBuilder,
  ComponentType,
  StringSelectMenuInteraction,
  InteractionContextType,
  MessageFlags,
} from 'discord.js';
import { CONFIG, CustomEmbed, format, MESSAGES } from '@shared/config';
import { CustomTagsService } from '@services/CustomTagsService';
import { handleCommandError, InteractionUtils } from '@shared/utils';
import { ChannelUtils } from '@services/ValidationService';
import { env } from '@shared/env';

export const data = new SlashCommandBuilder()
  .setName('help')
  .setDescription('Get help using the Aki bot')
  .setContexts([InteractionContextType.Guild]);

const createSelectMenu = () => new ActionRowBuilder<StringSelectMenuBuilder>()
  .addComponents(
    new StringSelectMenuBuilder()
      .setCustomId('help_menu')
      .setPlaceholder('🎯 Choose a topic...')
      .addOptions(
        new StringSelectMenuOptionBuilder().setLabel('Commands').setValue('commands').setEmoji('⚡'),
        new StringSelectMenuOptionBuilder().setLabel('Custom Tags').setValue('custom_tags').setEmoji('🏷️'),
        new StringSelectMenuOptionBuilder().setLabel('Ratings & Safety').setValue('ratings').setEmoji('🔒'),
        new StringSelectMenuOptionBuilder().setLabel('Context Menus').setValue('context').setEmoji('🖱️'),
        new StringSelectMenuOptionBuilder().setLabel('Bot Statistics').setValue('stats').setEmoji('📊'),
        new StringSelectMenuOptionBuilder().setLabel('Usage Examples').setValue('examples').setEmoji('💡')
      )
  );

const createEmbedForValue = (value: string, isNSFW: boolean, interaction: ChatInputCommandInteraction, customTagCount: number): CustomEmbed => {
  switch (value) {
    case 'commands':
      return new CustomEmbed('info')
        .setTitle('⚡ Available Commands')
        .addFields(
          { name: '🖼️ Image Commands', value: format.bullet([
            `${format.inlineCode('/fetch')} - Search Danbooru with tags`,
            `${format.inlineCode('/waifu')} - Random waifu images`,
          ])},
          { name: '🏷️ Custom Tag Management', value: format.bullet([
            `${format.inlineCode('/add')} - Create custom commands*`,
            `${format.inlineCode('/list')} - View server's custom commands`,
            `${format.inlineCode('/remove')} - Delete custom commands*`,
          ]) + '\n*Requires "Manage Messages" permission*'},
          { name: '❓ Utility', value: format.inlineCode('/help') + ' - Shows this help menu' }
        );

    case 'custom_tags':
      return new CustomEmbed('info')
        .setTitle('🏷️ Custom Tag System')
        .setDescription(`Create personalized commands for your favorite tags! Your server has ${format.bold(customTagCount.toString())} custom commands.`)
        .addFields(
          { name: '📝 Creating Commands', value: format.bullet([
            'Use `/add name:neko tag:cat_girl` to create `/neko`',
            'Commands search for your specified tag automatically',
            `Server limit: ${CONFIG.BOT.MAX_CUSTOM_TAGS} custom commands`,
          ])},
          { name: '🎯 Best Practices', value: format.bullet([
            'Use descriptive names for easy recognition',
            'Test tags with `/fetch` first to verify results',
            'Popular tags give better, more varied results',
          ])}
        );

    case 'ratings':
      return new CustomEmbed('warning')
        .setTitle('🔒 Content Ratings & Safety')
        .setDescription(isNSFW ?
          'This NSFW channel has access to all content ratings.' :
          'This SFW channel is restricted to safe content only.')
        .addFields(
          { name: '🏷️ Rating Types', value: format.bullet([
            `${format.bold('General (g)')} - Safe for work content`,
            `${format.bold('Sensitive (s)')} - Suggestive but not explicit`,
            `${format.bold('Questionable (q)')} - Borderline explicit content`,
            `${format.bold('Explicit (e)')} - Not safe for work`,
          ])},
          { name: '🛡️ Channel Restrictions', value: isNSFW ?
            'NSFW channels can access all rating types by adding `rating:` parameter to commands.' :
            'SFW channels automatically filter to safe content. Use NSFW channels for other ratings.'
          }
        );

    case 'context':
      return new CustomEmbed('info')
        .setTitle('🖱️ Context Menu Actions')
        .setDescription('Right-click any bot image message to access these quick actions:')
        .addFields(
          { name: '📊 Information', value: format.bullet([
            `${format.bold('Image Info')} - View post details and stats`,
            `${format.bold('Show Tags')} - Display all image tags`,
          ])},
          { name: '💾 Actions', value: format.bullet([
            `${format.bold('Save Image')} - DM the image to yourself`,
            `${format.bold('Remove Message')} - Delete the bot message`,
          ])}
        );

    case 'stats':
      return new CustomEmbed('info')
        .setTitle('📊 Bot Statistics')
        .addFields(
          { name: '⏱️ Performance', value: format.bullet([
            `Uptime: ${Math.floor(process.uptime() / 3600)}h ${Math.floor((process.uptime() % 3600) / 60)}m`,
            `Ping: ${interaction.client.ws.ping}ms`,
            `Memory: ${Math.round(process.memoryUsage().heapUsed / 1024 / 1024)}MB`,
          ]), inline: true },
          { name: '🌐 Network', value: format.bullet([
            `Servers: ${interaction.client.guilds.cache.size}`,
            `Users: ${interaction.client.users.cache.size.toLocaleString()}`,
            `Commands: ${customTagCount + 10} total`,
          ]), inline: true },
        );

    case 'examples':
      return new CustomEmbed('info')
        .setTitle('💡 Usage Examples')
        .addFields(
          { name: '🔍 Basic Search', value: format.codeBlock('/fetch search:cat_girl') },
          { name: '🎯 With Rating Filter', value: format.codeBlock('/fetch search:landscape rating:Sensitive') },
          { name: '🆔 By Post ID', value: format.codeBlock('/fetch id:1234567') },
          { name: '🏷️ Creating Custom Command', value: format.codeBlock('/add name:foxgirl tag:fox_girl description:Cute fox girls') },
          { name: '🎲 Random Waifu', value: format.codeBlock('/waifu rating:Sensitive') }
        );

    default:
      return new CustomEmbed();
  }
};

export async function execute(interaction: ChatInputCommandInteraction): Promise<void> {
  // Validation
  const isValid = await InteractionUtils.validateContext(interaction, { requireEphemeral: true });
  if (!isValid) return;

  try {
    // NSFW channel check
    const isNSFW = ChannelUtils.isNSFWChannel(interaction.channel);
    const customTags = await CustomTagsService.getGuildTags(
      interaction.guild!.id,
      interaction.client.user.id,
      env.TOKEN
    );

    const selectMenu = createSelectMenu();
    const embed = new CustomEmbed()
      .setTitle('🎌 Welcome to Aki Bot')
      .setDescription(
        `${format.bold('Your Premium Danbooru Experience')} • Fast, smart, and powerful.\n\n` +
        format.codeBlock(
          '✨ Smart Content Filtering  🎯 Advanced Rating Control\n' +
          '⚡ Custom Command System   🎨 Context Menu Actions\n' +
          '🔍 Intelligent Tag Search  🚀 High-Speed Performance'
        ) +
        `\n**Server Status:** ${customTags.length}/${CONFIG.BOT.MAX_CUSTOM_TAGS} custom commands • ${isNSFW ? '🔞 NSFW Enabled' : '✅ SFW Mode'}\n\n` +
        `🌐 **Source Code:** [Github Repo](https://github.com/signalbean/Aki)`
      )
      .withStandardFooter(interaction.user);

    const response = await interaction.editReply({
      embeds: [embed],
      components: [selectMenu],
    });

    const collector = response.createMessageComponentCollector({
      componentType: ComponentType.StringSelect,
      time: CONFIG.BOT.HELP_MENU_TIMEOUT_MS,
    });

    collector.on('collect', async (i: StringSelectMenuInteraction) => {
      if (i.user.id !== interaction.user.id) {
        return void await i.reply({ content: MESSAGES.INTERACTION.NOT_FOR_YOU, flags: MessageFlags.Ephemeral });
      }

      const [value] = i.values;
      const newEmbed = createEmbedForValue(value, isNSFW, interaction, customTags.length);
      await i.update({ embeds: [newEmbed.withStandardFooter(interaction.user)], components: [selectMenu] });
    });

    collector.on('end', async () => {
      const disabledMenu = new ActionRowBuilder<StringSelectMenuBuilder>()
        .addComponents(StringSelectMenuBuilder.from(selectMenu.components[0]).setDisabled(true));
      await interaction.editReply({ components: [disabledMenu] });
    });
  } catch (error) {
    await handleCommandError(interaction, 'help', error);
  }
}
