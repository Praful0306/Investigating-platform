// Runs the real server on an in-memory MongoDB: local dev without Atlas, and the Playwright web server (T-19).
// Uses the mock AI unless AI_PROVIDERS is set in the shell. Data disappears when the process ends.
import { MongoMemoryServer } from 'mongodb-memory-server';

process.env.AI_PROVIDERS ??= 'mock';
const mongod = await MongoMemoryServer.create();
process.env.MONGODB_URI = mongod.getUri('mysteryroom');

const shutdown = async () => {
  await mongod.stop();
  process.exit(0);
};
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);

await import('../src/index.js');
