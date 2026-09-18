import mongoose from 'mongoose';

// A completed simulation, stored verbatim so past races can be listed and
// replayed. `payload` is the exact response the simulate endpoint returned
// (entries, timeline, events, results).
const raceSchema = new mongoose.Schema(
  {
    seed: { type: Number, required: true },
    trackId: { type: String, required: true },
    trackName: String,
    laps: { type: Number, required: true },
    carIds: { type: [String], required: true },
    winner: {
      carId: String,
      name: String,
      totalTime: Number,
    },
    fastestLap: {
      carId: String,
      time: Number,
    },
    payload: { type: mongoose.Schema.Types.Mixed, required: true },
  },
  { timestamps: true },
);

raceSchema.index({ createdAt: -1 });

export default mongoose.model('Race', raceSchema);
