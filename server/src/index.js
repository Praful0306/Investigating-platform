import { env, isProd } from './config/env.js';
import { connectDB } from './db/connect.js';
import mongoose from 'mongoose';
import { createApp } from './app.js';
import { startKeepAlive } from './keep-alive.js';
import { createShutdown, tuneServer } from './server-lifecycle.js';
import { buildProvidersFromEnv, createAiService } from './services/ai/index.js';

if (isProd) {
  const missing = [];
  if (!env.MONGODB_URI) missing.push('MONGODB_URI');
  if (env.AI_PROVIDERS.split(',').includes('gemini') && !env.GEMINI_API_KEY) missing.push('GEMINI_API_KEY');
  if (missing.length) {
    console.error(`Missing required env in production: ${missing.join(', ')}`);
    process.exit(1);
  }
}
if (!env.MONGODB_URI) {
  console.error('MONGODB_URI is not set. Copy server/.env.example to server/.env and fill it in.');
  process.exit(1);
}

const providers = buildProvidersFromEnv(env);
if (!providers.length) {
  console.error('No AI provider is configured. Set AI_PROVIDERS and its keys in server/.env (see .env.example).');
  process.exit(1);
}

try {
  await connectDB(env.MONGODB_URI);
} catch (err) {
  console.error('Could not connect to MongoDB:', err.message);
  process.exit(1);
}

const server = tuneServer(
  createApp({ ai: createAiService(providers) }).listen(env.PORT, () => console.log(`API listening on :${env.PORT} (${env.NODE_ENV})`)),
);

// A free Render service sleeps after 15 idle minutes. While it is awake it pings its own public address (which Render
// provides as RENDER_EXTERNAL_URL) every 10 minutes, so visitors and examiners do not wait for a cold start.
const stopKeepAlive = isProd && env.KEEP_ALIVE === 'true' && env.RENDER_EXTERNAL_URL ? startKeepAlive({ baseUrl: env.RENDER_EXTERNAL_URL }) : () => {};

// Render stops the service with SIGTERM on every redeploy: finish running requests, close the database, then exit.
const shutdown = createShutdown({ server, disconnect: () => mongoose.disconnect() });
for (const signal of ['SIGTERM', 'SIGINT']) {
  process.on(signal, () => {
    stopKeepAlive();
    shutdown(signal);
  });
}
// A bug in one request must be visible in the logs, not silently swallowed (only the message: never request data).
process.on('unhandledRejection', (reason) => console.error(`Unhandled rejection: ${reason?.message ?? reason}`));
