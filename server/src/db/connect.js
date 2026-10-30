import mongoose from 'mongoose';

mongoose.set('strictQuery', true);
// NOTE: do NOT enable mongoose.set('sanitizeFilter', true) globally: it also wraps our own guard
// operators ($lt, $size) in $eq and silently breaks the atomic updates. Operator injection is
// prevented instead by zod: every client value reaching a filter is a regex-checked string.
export async function connectDB(uri) {
  await mongoose.connect(uri, { serverSelectionTimeoutMS: 10000, maxPoolSize: 10 });
  return mongoose.connection;
}

export function dbState() {
  return mongoose.connection.readyState === 1 ? 'up' : 'down';
}
