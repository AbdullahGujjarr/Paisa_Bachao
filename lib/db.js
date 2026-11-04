import mongoose from 'mongoose';

const cache = (globalThis.__pbMongoose ||= { conn: null, promise: null });

/** Connects once per process and reuses the connection across requests. */
export async function dbConnect() {
  if (cache.conn) return cache.conn;
  const uri = process.env.MONGODB_URI;
  if (!uri) throw new Error('MONGODB_URI is not set. Add it to .env.local (see .env.example).');
  cache.promise ||= mongoose.connect(uri, {
    maxPoolSize: 10,
    serverSelectionTimeoutMS: 8000,
    autoIndex: true,
  });
  try {
    cache.conn = await cache.promise;
  } catch (err) {
    cache.promise = null;
    throw err;
  }
  return cache.conn;
}
