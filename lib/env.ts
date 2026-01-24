import 'server-only';

import dotenv from 'dotenv';
import { z } from 'zod';

dotenv.config();

const envSchema = z.object({
  APP_ENV: z.enum(['dev', 'staging', 'prod']).default('dev'),
  BASE_URL: z.string().url(),
  AUTH_SECRET: z.string().min(16),
  DATABASE_URL: z.string().optional(),
  SQLITE_PATH: z.string().optional(),
  ENHANCED_SERVICE_URL: z.string().url().optional(),
  ENHANCED_CORE_SECRET: z.string().min(16).optional(),
  CORE_INSTANCE_ID: z.string().min(1).optional()
});

const parsed = envSchema.safeParse(process.env);
if (!parsed.success) {
  const messages = parsed.error.issues
    .map((issue) => `${issue.path.join('.') || '(root)'}: ${issue.message}`)
    .join('\n');
  throw new Error(`Invalid environment variables:\n${messages}`);
}

const DATABASE_URL =
  parsed.data.DATABASE_URL ||
  (parsed.data.SQLITE_PATH ? `file:${parsed.data.SQLITE_PATH}` : undefined);

if (!DATABASE_URL) {
  throw new Error('Invalid environment variables:\nDATABASE_URL is required');
}

export const env = {
  ...parsed.data,
  DATABASE_URL
};
