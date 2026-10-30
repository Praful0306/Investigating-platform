import { env, isProd } from './config/env.js';
import { connectDB } from './db/connect.js';
import { createApp } from './app.js';

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

try {
  await connectDB(env.MONGODB_URI);
} catch (err) {
  console.error('Could not connect to MongoDB:', err.message);
  process.exit(1);
}

createApp().listen(env.PORT, () => console.log(`API listening on :${env.PORT} (${env.NODE_ENV})`));
