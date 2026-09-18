import mongoose from 'mongoose';

// A player's card collection and credit balance. `playerId` is currently a
// browser-generated id sent in the X-Player-Id header; once auth exists it
// becomes the user id and nothing else here needs to change.
const ownedCardSchema = new mongoose.Schema(
  {
    cardId: { type: String, required: true }, // 'car:<carId>' | 'part:<partId>'
    count: { type: Number, required: true, default: 1 },
    firstAt: { type: Date, required: true },
  },
  { _id: false },
);

const playerSchema = new mongoose.Schema(
  {
    playerId: { type: String, required: true, unique: true },
    credits: { type: Number, required: true, default: 0 },
    lastDailyClaim: { type: String, default: null }, // 'YYYY-MM-DD' (UTC)
    packsOpened: { type: Number, default: 0 },
    cards: { type: [ownedCardSchema], default: [] },
  },
  { timestamps: true },
);

export default mongoose.model('Player', playerSchema);
