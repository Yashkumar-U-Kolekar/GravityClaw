import { config as loadDotenv } from 'dotenv';
import { z } from 'zod';
import { logger } from '../utils/logger.js';

// Load environment variables from .env file
loadDotenv();

const envSchema = z.object({
  TELEGRAM_BOT_TOKEN: z.string().min(1, 'TELEGRAM_BOT_TOKEN is required in .env'),
  TELEGRAM_ALLOWED_USER_IDS: z
    .string()
    .min(1, 'TELEGRAM_ALLOWED_USER_IDS is required in .env')
    .transform((val) => {
      const ids = val
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean)
        .map((s) => {
          const num = Number(s);
          if (isNaN(num)) {
            throw new Error(`Invalid user ID in TELEGRAM_ALLOWED_USER_IDS: "${s}" is not a valid number.`);
          }
          return num;
        });

      if (ids.length === 0) {
        throw new Error('TELEGRAM_ALLOWED_USER_IDS must contain at least one valid numerical user ID.');
      }
      return ids;
    }),
  OPENROUTER_API_KEY: z.string().min(1, 'OPENROUTER_API_KEY is required in .env'),
  OPENROUTER_MODEL: z.string().default('anthropic/claude-3.5-sonnet'),
  MAX_AGENT_ITERATIONS: z
    .string()
    .optional()
    .default('10')
    .transform((val) => {
      const num = parseInt(val, 10);
      return isNaN(num) || num <= 0 ? 10 : num;
    }),
  LOG_LEVEL: z
    .enum(['debug', 'info', 'warn', 'error'])
    .optional()
    .default('info'),
});

export type EnvConfig = {
  telegramBotToken: string;
  allowedUserIds: Set<number>;
  openrouterApiKey: string;
  openrouterModel: string;
  maxAgentIterations: number;
  logLevel: 'debug' | 'info' | 'warn' | 'error';
};

export function loadConfig(): EnvConfig {
  const result = envSchema.safeParse(process.env);

  if (!result.success) {
    console.error('\n❌ Configuration Error: Missing or invalid environment variables:');
    for (const issue of result.error.issues) {
      console.error(`  - [${issue.path.join('.')}] ${issue.message}`);
    }
    console.error('\nPlease copy .env.example to .env and configure all required variables.\n');
    process.exit(1);
  }

  const { data } = result;

  // Initialize logger level
  logger.setLevel(data.LOG_LEVEL);

  return {
    telegramBotToken: data.TELEGRAM_BOT_TOKEN,
    allowedUserIds: new Set(data.TELEGRAM_ALLOWED_USER_IDS),
    openrouterApiKey: data.OPENROUTER_API_KEY,
    openrouterModel: data.OPENROUTER_MODEL,
    maxAgentIterations: data.MAX_AGENT_ITERATIONS,
    logLevel: data.LOG_LEVEL,
  };
}
