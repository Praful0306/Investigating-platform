import dotenv from 'dotenv';
import { z } from 'zod';

dotenv.config({ quiet: true });

const Env = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().default(5000),
  MONGODB_URI: z.string().min(1).optional(), // optional only in test
  CLIENT_URL: z.string().default('http://localhost:5173'),
  GEMINI_API_KEY: z.string().optional(),
  GEMINI_MODEL: z.string().default('gemini-2.5-flash'),
  AI_PROVIDERS: z.string().default('gemini'),
  OPENAI_COMPAT_BASE_URL: z.string().optional(),
  OPENAI_COMPAT_API_KEY: z.string().optional(),
  OPENAI_COMPAT_MODEL: z.string().optional(),
  FIREBASE_PROJECT_ID: z.string().optional(), // public; empty = sign-in disabled
  TURNSTILE_SECRET: z.string().optional(),
  TRUST_PROXY: z.coerce.number().default(1),
  CROSS_SITE_COOKIES: z.enum(['true', 'false']).default('false'),
});

// Empty values in .env (e.g. `GEMINI_API_KEY=`) mean "unset".
const raw = Object.fromEntries(Object.entries(process.env).filter(([, v]) => v !== ''));
const parsed = Env.safeParse(raw);
if (!parsed.success) {
  const list = parsed.error.issues.map((i) => `  - ${i.path.join('.')}: ${i.message}`).join('\n');
  throw new Error(`Invalid environment configuration:\n${list}`);
}

export const env = Object.freeze(parsed.data);
export const isProd = env.NODE_ENV === 'production';
