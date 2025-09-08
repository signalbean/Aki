// src/shared/types.d.ts

import {
  AutocompleteInteraction,
  ChatInputCommandInteraction,
  ContextMenuCommandBuilder,
  MessageContextMenuCommandInteraction,
  SlashCommandBuilder,
} from "discord.js";

export interface DanbooruPost {
  readonly id: number;
  readonly file_url: string;
  readonly score: number;
  readonly rating: "g" | "s" | "q" | "e";
  readonly tag_string: string;
  readonly tag_string_artist: string;
  readonly fav_count: number;
}

export interface DanbooruTag {
  readonly name: string;
  readonly post_count: number;
}

export interface ApplicationCommand {
  readonly data:
    | SlashCommandBuilder
    | ReturnType<SlashCommandBuilder["toJSON"]>;
  execute: (interaction: ChatInputCommandInteraction) => Promise<void>;
  autocomplete?: (interaction: AutocompleteInteraction) => Promise<void>;
}

export interface ContextCommand {
  readonly data: ContextMenuCommandBuilder;
  execute: (interaction: MessageContextMenuCommandInteraction) => Promise<void>;
}

export type ContentRating = "g" | "s" | "q" | "e";

export type ValidationResult = {
  readonly isValid: boolean;
  readonly error?: string;
};

export type InteractionType =
  | ChatInputCommandInteraction
  | MessageContextMenuCommandInteraction;

export type EmbedType = "default" | "success" | "error" | "warning" | "info";

export interface Environment {
  TOKEN: string;
  CLIENT_ID: string;
  GUILD_ID?: string | undefined;
}

export interface CacheItem<T> {
  readonly data: T;
  readonly timestamp: number;
  readonly ttl: number;
}

export interface CommandData {
  name: string;
  id?: string;
  type?: number;
}

export interface LoadedCommand {
  data: {
    toJSON(): CommandData;
  };
  filePath: string;
}
