import mongoose from 'mongoose';

const DEFAULT_URI = 'mongodb://127.0.0.1:27017/overtakejs';

/**
 * Connect to MongoDB. Returns true on success, false if unreachable —
 * callers fall back to the in-memory seed data so dev works without a DB.
 */
export async function connectDB() {
  const uri = process.env.MONGODB_URI || DEFAULT_URI;
  try {
    await mongoose.connect(uri, { serverSelectionTimeoutMS: 3000 });
    console.log(`MongoDB connected: ${mongoose.connection.host}/${mongoose.connection.name}`);
    return true;
  } catch (err) {
    console.warn(`MongoDB unavailable (${err.message}) — running on in-memory seed data`);
    return false;
  }
}
