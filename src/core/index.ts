// src/core/index.ts

import { BotClient } from '@core/client';
import { logger } from '@shared/utils';

const bot = new BotClient();

/**
 * Main entry point - initializes and starts the Discord bot.
 */
const main = async (): Promise<void> => {
  try {
    await bot.start();
  } catch (error) {
    logger.error(`Failed to start bot: ${(error as Error).message}`);
    process.exit(1);
  }
};

/**
 * Shutdown handler - ensures proper cleanup of resources.
 */
const shutdown = async (): Promise<void> => {
  logger.log('Shutting down bot...');
  await bot.stop();
  process.exit(0);
};

// Error handling
process.on('unhandledRejection', (reason: unknown) => {
  logger.error(`Unhandled rejection: ${String(reason)}`);
});

process.on('uncaughtException', (error: Error) => {
  logger.error(`Uncaught exception: ${error.stack}`);
  process.exit(1);
});

// Graceful shutdown
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);

// Start the bot
main();
