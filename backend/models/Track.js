import mongoose from 'mongoose';

const trackSchema = new mongoose.Schema(
  {
    id: { type: String, required: true, unique: true }, // stable slug, e.g. 'valmont-gp'
    name: { type: String, required: true },
    location: String,
    description: String,
    width: { type: Number, default: 12 }, // meters
    // Closed loop of [x, y] control points (meters); the spline geometry is
    // derived from these at load time, never stored.
    controlPoints: {
      type: [[Number]],
      required: true,
      validate: {
        validator: (pts) => pts.length >= 4 && pts.every((p) => p.length === 2),
        message: 'controlPoints must be at least 4 [x, y] pairs',
      },
    },
  },
  { timestamps: true },
);

export default mongoose.model('Track', trackSchema);
