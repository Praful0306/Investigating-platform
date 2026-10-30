// Runs before every test file, before any src import: env.js freezes process.env at import time.
process.env.NODE_ENV = 'test';
process.env.AI_PROVIDERS = 'mock';
process.env.TURNSTILE_SECRET = ''; // a developer's .env must never switch the bot check on during tests
