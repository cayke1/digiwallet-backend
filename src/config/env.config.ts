import { z } from 'zod';
import 'dotenv/config';

const envSchema = z.object({
  PORT: z.string().regex(/^\d+$/).transform(Number),
  NODE_ENV: z.enum(['development', 'production', 'test']),
  DATABASE_HOST: z.string(),
  DATABASE_PORT: z.string().regex(/^\d+$/).transform(Number),
  DATABASE_USER: z.string(),
  DATABASE_PASSWORD: z.string(),
  DATABASE_NAME: z.string(),
  DATABASE_URL: z.string(),
  JWT_SECRET: z.string().min(32),
  JWT_ACCESS_EXPIRATION: z.string().default('15m'),
  JWT_REFRESH_EXPIRATION: z.string().default('7d'),
});

export const env = envSchema.parse(process.env);

export type Env = z.infer<typeof envSchema>;
