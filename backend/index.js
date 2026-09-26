import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import helmet from 'helmet';

import { connectDB } from './config/db.js';
import { initStore, getTracks, isDbReady } from './data/store.js';
import { authenticate } from './auth/session.js';
import authRoutes from './routes/auth.js';
import carRoutes from './routes/cars.js';
import trackRoutes from './routes/tracks.js';
import raceRoutes from './routes/races.js';
import cardRoutes from './routes/cards.js';

const app = express();
const PORT = process.env.PORT || 5000;
const PROD = process.env.NODE_ENV === 'production';

// Number of proxies in front of the app (1 on most hosts). Rate limits key on
// the client IP, so this must match the real setup or the IP can be spoofed.
app.set('trust proxy', Number(process.env.TRUST_PROXY) || 0);

// Middleware
app.use(helmet());
// Only the app's own frontend may make credentialed cross-origin calls.
app.use(cors({ origin: process.env.CLIENT_URL || 'http://localhost:5173', credentials: true }));
app.use(express.json({ limit: '10kb' }));
app.use(cookieParser());
app.use(authenticate);

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'OvertakeJS server running', db: isDbReady() ? 'mongodb' : 'in-memory' });
});

app.use('/api/auth', authRoutes);
app.use('/api/cars', carRoutes);
app.use('/api/tracks', trackRoutes);
app.use('/api/races', raceRoutes);
app.use('/api/cards', cardRoutes);

const connected = await connectDB();
// The in-memory fallback loses every account on restart; never run on it live.
if (PROD && !connected) {
  console.error('MongoDB is required in production. Exiting.');
  process.exit(1);
}
await initStore(connected);

app.listen(PORT, () => {
  console.log(`OvertakeJS server running on port ${PORT}`);
  for (const t of getTracks()) {
    console.log(`  track: ${t.name} — ${t.length} m`);
  }
});
