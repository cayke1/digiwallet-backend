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
});

export const env = envSchema.parse(process.env);

export type Env = z.infer<typeof envSchema>;
