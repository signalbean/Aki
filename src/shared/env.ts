// src/shared/env.ts

import { config } from 'dotenv';
import { logger } from '@shared/utils';

config();

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
