// src/shared/command-base.ts

import { ChatInputCommandInteraction } from "discord.js";
import { ApiService } from "@services/ApiService";
import { ValidationService } from "@services/ValidationService";
import { InteractionUtils, handleCommandError } from "@shared/utils";
import { CustomEmbed } from "@shared/config";
import { MESSAGES } from "@shared/messages";
import { ApiServerError } from "@shared/error";
import { DanbooruPost } from "@shared/types";

/**
 * Shared execution logic for image-fetching commands (fetch, search, waifu, custom tags).
 * Handles validation, API calls, and error responses consistently across all image commands.
 */
export async function executeImageCommand(
  interaction: ChatInputCommandInteraction,
  commandName: string,
  tags: string = "",
  rating: "q" | "s" | null = null
): Promise<void> {
  const isValid = await InteractionUtils.validateContext(interaction, {
    requireEphemeral: false,
  });
  if (!isValid) return;

  try {
    // Validate tags if provided
    if (tags) {
      const tagValidation = ValidationService.validateTags(tags);
      if (!tagValidation.isValid) {
        const errorEmbed = new CustomEmbed("error")
          .withError("Invalid Tag", tagValidation.error!)
          .withStandardFooter(interaction.user);
        await InteractionUtils.safeReply(interaction, { embeds: [errorEmbed] });
        return;
      }
    }

    // Determine and validate rating
    const targetRating = ValidationService.determineRating(
      rating,
      interaction.channel as any
    );
    const ratingValidation = ValidationService.validateChannelRating(
      targetRating,
      interaction.channel
    );
    if (!ratingValidation.isValid) {
      const errorEmbed = new CustomEmbed("error")
        .withError("Content Restricted", ratingValidation.error!)
        .withStandardFooter(interaction.user);
      await InteractionUtils.safeReply(interaction, { embeds: [errorEmbed] });
      return;
    }

    // Fetch image with timeout protection
    const apiService = new ApiService();
    let post: DanbooruPost | null = null;

    try {
      post = await Promise.race([
        apiService.fetchRandomImage(tags, targetRating),
        new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error("API request timeout")), 8000)
        ),
      ]);
    } catch (error) {
      if (error instanceof ApiServerError) {
        if (error.status === 422) {
          const errorEmbed = new CustomEmbed("error")
            .withError("NSFW Content", MESSAGES.ERROR.NSFW_TAG_IN_SFW)
            .withStandardFooter(interaction.user);
          await InteractionUtils.safeReply(interaction, {
            embeds: [errorEmbed],
          });
          return;
        }
        if (error.message.includes("Rate limit")) {
          const errorEmbed = new CustomEmbed("error")
            .withError("Rate Limited", MESSAGES.ERROR.RATE_LIMIT)
            .withStandardFooter(interaction.user);
          await InteractionUtils.safeReply(interaction, {
            embeds: [errorEmbed],
          });
          return;
        }
      }
      throw error;
    }

    if (!post?.file_url) {
      const errorEmbed = new CustomEmbed("warning")
        .withWarning(
          "No Image Found",
          `${MESSAGES.ERROR.NO_IMAGE}\n*Tag searched: \`${tags || "random"}\`*`
        )
        .withStandardFooter(interaction.user);
      await InteractionUtils.safeReply(interaction, { embeds: [errorEmbed] });
      return;
    }

    // Final rating validation
    const finalRatingValidation = ValidationService.validateChannelRating(
      post.rating,
      interaction.channel
    );
    if (!finalRatingValidation.isValid) {
      const errorEmbed = new CustomEmbed("error")
        .withError("Content Restricted", finalRatingValidation.error!)
        .withStandardFooter(interaction.user);
      await InteractionUtils.safeReply(interaction, { embeds: [errorEmbed] });
      return;
    }

    await InteractionUtils.safeReply(interaction, { content: post.file_url });
  } catch (error) {
    await handleCommandError(interaction, commandName, error);
  }
}

/**
 * Shared execution logic for fetching specific posts by ID.
 * Validates post IDs and handles content rating restrictions.
 */
export async function executePostCommand(
  interaction: ChatInputCommandInteraction,
  commandName: string,
  postId: string
): Promise<void> {
  const isValid = await InteractionUtils.validateContext(interaction, {
    requireEphemeral: false,
  });
  if (!isValid) return;

  try {
    if (!ValidationService.isValidPostId(postId)) {
      const errorEmbed = new CustomEmbed("error")
        .withError("Invalid Post ID", MESSAGES.ERROR.INVALID_POST_ID)
        .withStandardFooter(interaction.user);
      await InteractionUtils.safeReply(interaction, { embeds: [errorEmbed] });
      return;
    }

    const apiService = new ApiService();
    let post: DanbooruPost | null = null;

    try {
      post = await Promise.race([
        apiService.fetchPostById(postId),
        new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error("API request timeout")), 8000)
        ),
      ]);
    } catch (error) {
      if (error instanceof ApiServerError && error.status >= 500) {
        const errorEmbed = new CustomEmbed("error")
          .withError("API Server Error", MESSAGES.ERROR.API_SERVER_ERROR)
          .withStandardFooter(interaction.user);
        await InteractionUtils.safeReply(interaction, { embeds: [errorEmbed] });
        return;
      }
      throw error;
    }

    if (!post?.file_url) {
      const errorEmbed = new CustomEmbed("error")
        .withError("Post Not Found", MESSAGES.ERROR.POST_NOT_FOUND)
        .withStandardFooter(interaction.user);
      await InteractionUtils.safeReply(interaction, { embeds: [errorEmbed] });
      return;
    }

    // Validate rating for channel
    const ratingValidation = ValidationService.validateChannelRating(
      post.rating,
      interaction.channel
    );
    if (!ratingValidation.isValid) {
      const errorEmbed = new CustomEmbed("error")
        .withError("Content Restricted", ratingValidation.error!)
        .withStandardFooter(interaction.user);
      await InteractionUtils.safeReply(interaction, { embeds: [errorEmbed] });
      return;
    }

    await InteractionUtils.safeReply(interaction, { content: post.file_url });
  } catch (error) {
    await handleCommandError(interaction, commandName, error);
  }
}
