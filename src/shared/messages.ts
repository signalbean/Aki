// src/shared/messages.ts

import { CONFIG } from '@shared/config';

export const MESSAGES = {
  ERROR: {
    NO_IMAGE: 'No image found. The post might be gone or doesn\'t exist.',
    NO_IMAGE_CONTEXT: 'No image URL found in this message.',
    BLACKLISTED_TAG: 'Your search contains a blacklisted tag. Please try again.',
    TOO_MANY_TAGS: `Maximum ${CONFIG.BOT.MAX_USER_TAGS} search tag allowed due to API limitations.`,
    NSFW_IN_SFW: 'NSFW content can only be viewed in NSFW channels.',
    NSFW_TAG_IN_SFW: 'This command seems to be for NSFW content. To use it, you need to be in an NSFW channel.',
    DM_FAILED: `Failed to DM you.`,
    GENERIC_ERROR: 'An unexpected error occurred. Please report this.',
    MISSING_PERMISSIONS: `You do not have permission to use this command.`,
    BOT_MISSING_PERMISSIONS: `I do not have the required permissions to perform this action.`,
    GUILD_ONLY: 'This command only works in servers, not in DMs.',
    BOT_MESSAGES_ONLY: 'I can only perform this action on messages that I have sent.',
    COMMAND_NOT_FOUND: 'Could not find command information. Please try again in a moment.',
    INVALID_CUSTOM_TAG: 'This does not appear to be a valid custom tag command.',
    POST_NOT_FOUND: 'This image no longer exists on Danbooru or the post was deleted.',
    ACCESS_DENIED: 'Access Denied. You do not have permission to use this command.',
    RATE_LIMIT: 'Too many requests. Please wait a moment and try again.',
    API_SERVER_ERROR: 'The API server is currently experiencing issues. Please try again later.',
    REMOVAL_DENIED: 'Only the person who used the command to generate this message can remove it.',
    MAX_TAGS_REACHED: `This server has reached the maximum limit of ${CONFIG.BOT.MAX_CUSTOM_TAGS} custom commands. Please remove an existing command before adding a new one.`,
    REGISTRATION_FAILED: 'Failed to register the command with Discord. Please try again later.',
    REMOVAL_FAILED: 'An error occurred while communicating with Discord. Please try again later.',
    INVALID_POST_ID: 'Please provide a valid numeric post ID.',
    NO_IMAGE_IN_MESSAGE: 'No image found in this message.',
  },
  SUCCESS: {
    COMMAND_ADDED: 'Custom Command Added',
    COMMAND_REMOVED: 'Custom Command Removed',
  },
  INFO: {
    NO_CUSTOM_COMMANDS: 'No Custom Commands Found',
    IMAGE_INFO: 'Image Information',
    TAGS_INFO: 'Tags Information',
  },
  INTERACTION: {
    NOT_FOR_YOU: 'This menu is not for you.',
  }
} as const;
