import mongoose from 'mongoose';

const userSchema = new mongoose.Schema(
  {
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    name: { type: String, required: true, trim: true },
    passwordHash: { type: String, required: false },
    googleId: { type: String, required: false, unique: true, sparse: true},
    // Raised to invalidate every session cookie issued before it.
    sessionVersion: { type: Number, default: 0 },
  },
  { timestamps: true },
);

export default mongoose.model('User', userSchema);
