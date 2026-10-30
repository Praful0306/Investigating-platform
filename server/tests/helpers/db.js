import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { afterAll, afterEach, beforeAll } from 'vitest';
import { connectDB } from '../../src/db/connect.js';

// Call at the top of a test file that needs a database. Never touches Atlas.
export function useMemoryDb() {
  let mongod;
  beforeAll(async () => {
    mongod = await MongoMemoryServer.create();
    await connectDB(mongod.getUri());
  });
  afterEach(async () => {
    for (const c of Object.values(mongoose.connection.collections)) await c.deleteMany({});
  });
  afterAll(async () => {
    await mongoose.disconnect();
    await mongod?.stop();
  });
}
