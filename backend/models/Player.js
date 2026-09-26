import mongoose from 'mongoose';

// A player's card collection and credit balance. `playerId` is the signed-in
// user's id.
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
