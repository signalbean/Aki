// src/shared/types.d.ts

import {
  AutocompleteInteraction,
  ChatInputCommandInteraction,
  ContextMenuCommandBuilder,
  MessageContextMenuCommandInteraction,
  SlashCommandBuilder,
} from 'discord.js';

export interface DanbooruPost {
  readonly id: number;
  readonly file_url: string;
  readonly score: number;
  readonly rating: 'g' | 's' | 'q' | 'e';
  readonly tag_string: string;
  readonly tag_string_artist: string;
  readonly fav_count: number;
}

export interface DanbooruTag {
  readonly name: string;
  readonly post_count: number;
}

export interface ApplicationCommand {
  readonly data: SlashCommandBuilder | ReturnType<SlashCommandBuilder['toJSON']>;
  execute: (interaction: ChatInputCommandInteraction) => Promise<void>;
  autocomplete?: (interaction: AutocompleteInteraction) => Promise<void>;
}

export interface ContextCommand {
  readonly data: ContextMenuCommandBuilder;
  execute: (interaction: MessageContextMenuCommandInteraction) => Promise<void>;
}

export type ContentRating = 'g' | 's' | 'q' | 'e';

export type ValidationResult = {
  readonly isValid: boolean;
  readonly error?: string;
};
