import mongoose from 'mongoose';

// Serverless-safe Mongoose connection. On Vercel each function invocation may
// reuse a warm container, so we cache the connection promise on `global` to
// avoid opening a new pool on every request (which would exhaust Atlas limits).
//
// This is separate from lib/mongodb.js (the raw MongoClient used by the Auth.js
// adapter). Both point at the same MONGODB_URI / database; Mongoose powers the
// application models (classes, enrollments, orders, …).

const MONGODB_URI = process.env.MONGODB_URI;

let cached = global._mongoose;
if (!cached) {
  cached = global._mongoose = { conn: null, promise: null };
}

export default async function dbConnect() {
  if (cached.conn) return cached.conn;

  if (!MONGODB_URI) {
    throw new Error('MONGODB_URI is not set.');
  }

  if (!cached.promise) {
    cached.promise = mongoose
      .connect(MONGODB_URI, { bufferCommands: false })
      .then((m) => m);
  }
  cached.conn = await cached.promise;
  return cached.conn;
}
