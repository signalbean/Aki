// src/core/index.ts

import { BotClient } from '@core/client';
import { logger } from '@shared/utils';

const bot = new BotClient();

/**
 * Main entry point for the bot
 */
async function main(): Promise<void> {
  try {
    await bot.start();
  } catch (error: unknown) {
    logger.error(`Failed to start bot: ${error instanceof Error ? error.message : String(error)}`);
    process.exit(1);
  }
}

/**
 * Graceful shutdown handler
 */
async function shutdown(): Promise<void> {
  logger.log('Shutting down bot...');
  await bot.stop();
  process.exit(0);
}

// Error handling
process.on('unhandledRejection', (reason: unknown, promise: Promise<unknown>) => {
  logger.error(`Unhandled rejection at: ${promise}, reason: ${String(reason)}`);
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
