// src/shared/autocomplete.ts

import { AutocompleteInteraction } from 'discord.js';
import { ApiService } from '@services/ApiService';
import { CustomTagsService } from '@services/CustomTagsService';
import { logger } from '@shared/utils';
import { env } from '@shared/env';

/**
 * Wraps promises with a timeout to prevent hanging autocomplete requests.
 * Discord requires autocomplete responses within 3 seconds.
 */
const withTimeout = <T>(promise: Promise<T>, ms = 2000): Promise<T> => {
  const timeoutPromise = new Promise<never>((_, reject) => {
    setTimeout(() => reject(new Error('Autocomplete timeout')), ms);
  });
  return Promise.race([promise, timeoutPromise]);
};

/**
 * Provides autocomplete suggestions for Danbooru tags.
 * Fetches popular tags matching the user's input from the API.
 */
export const tagAutocomplete = async (interaction: AutocompleteInteraction): Promise<void> => {
  try {
    const focusedOption = interaction.options.getFocused(true);
    if (focusedOption.name !== 'tag') {
      return void await interaction.respond([]);
    }

    const input = focusedOption.value.toString().trim();
    if (!input) {
      return void await interaction.respond([]);
    }

    const apiService = new ApiService();
    const suggestions = await withTimeout(apiService.autocomplete(input));

    const choices = suggestions.slice(0, 5).map(tag => ({
      name: tag.name,
      value: tag.name
    }));

    if (!interaction.responded) {
      await interaction.respond(choices);
    }
  } catch (error) {
    const errorMessage = (error as Error).message;
    if (!errorMessage.includes('Unknown interaction') && !errorMessage.includes('timeout')) {
      logger.warn(`Tag autocomplete error: ${errorMessage}`);
    }

    if (!interaction.responded) {
      await interaction.respond([]).catch(() => {});
    }
  }
};

/**
 * Provides autocomplete for custom commands when using the /remove command.
 * Shows existing custom commands in the current server with their associated tags.
 */
export const customCommandAutocomplete = async (interaction: AutocompleteInteraction): Promise<void> => {
  if (!interaction.guild) return;

  try {
    const focusedValue = interaction.options.getFocused().toLowerCase();
    
    const tags = await withTimeout(
      CustomTagsService.getGuildTags(
        interaction.guild.id,
        interaction.client.user.id,
        env.TOKEN
      )
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

    if (!interaction.responded) {
      await interaction.respond(filtered);
    }
  } catch (error) {
    const errorMessage = (error as Error).message;
    if (!errorMessage.includes('Unknown interaction') && !errorMessage.includes('timeout')) {
      logger.warn(`Custom command autocomplete error: ${errorMessage}`);
    }
    
    if (!interaction.responded) {
      await interaction.respond([]).catch(() => {});
    }
  }
};
