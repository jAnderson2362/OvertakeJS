import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';

import { connectDB } from './config/db.js';
import { initStore, getTracks, isDbReady } from './data/store.js';
import carRoutes from './routes/cars.js';
import trackRoutes from './routes/tracks.js';
import raceRoutes from './routes/races.js';
import cardRoutes from './routes/cards.js';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(cors());
app.use(express.json());

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'OvertakeJS server running', db: isDbReady() ? 'mongodb' : 'in-memory' });
});

app.use('/api/cars', carRoutes);
app.use('/api/tracks', trackRoutes);
app.use('/api/races', raceRoutes);
app.use('/api/cards', cardRoutes);

const connected = await connectDB();
await initStore(connected);

app.listen(PORT, () => {
  console.log(`OvertakeJS server running on port ${PORT}`);
  for (const t of getTracks()) {
    console.log(`  track: ${t.name} — ${t.length} m`);
  }
});
