import mongoose from 'mongoose';

// A player's custom car: one owned car card as the base plus at most one part
// card per slot. Stats aren't stored; they're derived from the catalog when
// read, so rebalancing a part updates every build that uses it.
const buildSchema = new mongoose.Schema(
  {
    userId: { type: String, required: true, index: true },
    name: { type: String, required: true, trim: true },
    carCardId: { type: String, required: true }, // 'car:<carId>'
    // Filled slots only: { <slotId>: 'part:<partId>' } (slots in data/cards.js).
    parts: { type: mongoose.Schema.Types.Mixed, default: {} },
  },
  { timestamps: true },
);

export default mongoose.model('Build', buildSchema);
