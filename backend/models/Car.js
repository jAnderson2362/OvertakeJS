import mongoose from 'mongoose';

const carSchema = new mongoose.Schema(
  {
    id: { type: String, required: true, unique: true }, // stable slug, e.g. 'porsche-911-gt3'
    name: { type: String, required: true },
    hp: { type: Number, required: true },
    power: { type: Number, required: true },      // kW
    torque: { type: Number },                     // lb-ft (display only)
    mass: { type: Number, required: true },       // kg incl. driver
    dragArea: { type: Number, required: true },   // Cd * A, m^2
    liftArea: { type: Number, default: 0 },       // -Cl * A (downforce), m^2
    tireGrip: { type: Number, required: true },   // peak lateral mu
    topSpeed: { type: Number, required: true },   // km/h
    drive: { type: String, enum: ['fwd', 'rwd', 'awd'], required: true },
    ev: { type: Boolean, default: false },
    fuelPerKm: { type: Number, default: 0 },      // kg/km at race pace
    consistency: { type: Number, default: 0.003 },
    class: String,
    country: String,
    year: Number,
    image: String, // optional URL/path for the car thumbnail

  },
  { timestamps: true },
);

export default mongoose.model('Car', carSchema);
