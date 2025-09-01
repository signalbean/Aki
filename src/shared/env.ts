// src/shared/env.ts

import { readFileSync } from 'fs';
import { resolve } from 'path';
import { logger } from '@shared/utils';

/**
 * Loads environment variables from a .env file into process.env.
 * This function replicates the basic functionality of the `dotenv` package.
 */
function loadEnv(): void {
  const envPath = resolve(process.cwd(), '.env');

  try {
    const fileContent = readFileSync(envPath, { encoding: 'utf-8' });
    const lines = fileContent.split('\n');

    for (const line of lines) {
      const trimmedLine = line.trim();
      if (trimmedLine.startsWith('#') || !trimmedLine.includes('=')) {
        continue;
      }

      const [key, ...valueParts] = trimmedLine.split('=');
      const value = valueParts.join('=').trim();

      if (process.env[key] === undefined) {
        process.env[key] = value;
      }
    }
  } catch (error) {
    const nodeError = error as NodeJS.ErrnoException;
    if (nodeError.code !== 'ENOENT') {
      logger.warn(`An error occurred while reading the .env file: ${nodeError.message}`);
    }
  }
}

loadEnv();

const REQUIRED_ENV = ['TOKEN', 'CLIENT_ID'];

const missing = REQUIRED_ENV.filter(key => !process.env[key]);

if (missing.length > 0) {
  logger.error(`❌ Missing required environment variables: ${missing.join(', ')}`);
  process.exit(1);
}

interface Environment {
  TOKEN: string;
  CLIENT_ID: string;
  GUILD_ID?: string | undefined;
}

export const env: Environment = {
  TOKEN: process.env.TOKEN!,
  CLIENT_ID: process.env.CLIENT_ID!,
  GUILD_ID: process.env.GUILD_ID,
};
