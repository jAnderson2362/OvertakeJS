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
import garageRoutes from './routes/garage.js';
import { attachMultiplayer } from './multiplayer/socket.js';

const app = express();
const PORT = process.env.PORT || 5000;
const PROD = process.env.NODE_ENV === 'production';
const CLIENT_URL = process.env.CLIENT_URL || 'http://localhost:5173';

// Number of proxies in front of the app (1 on most hosts). Rate limits key on
// the client IP, so this must match the real setup or the IP can be spoofed.
app.set('trust proxy', Number(process.env.TRUST_PROXY) || 0);

// Middleware
app.use(helmet());
// Only the app's own frontend may make credentialed cross-origin calls.
app.use(cors({ origin: CLIENT_URL, credentials: true }));
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
app.use('/api/garage', garageRoutes);

// Unknown API routes and uncaught errors (bad JSON bodies, oversized
// requests, a failed session lookup) answer in JSON like every other route.
// Express's defaults are HTML pages with a stack trace outside production.
app.use('/api', (req, res) => res.status(404).json({ error: 'Not found.' }));
app.use((err, req, res, next) => {
  const status = Number(err.status ?? err.statusCode) || 500;
  if (status >= 500) console.error('Request failed:', err);
  if (res.headersSent) return next(err);
  res.status(status).json({
    error: status === 413 ? 'That request is too large.' : status < 500 ? 'That request is not valid.' : 'Something went wrong.',
  });
});

const connected = await connectDB();
// The in-memory fallback loses every account on restart; never run on it live.
if (PROD && !connected) {
  console.error('MongoDB is required in production. Exiting.');
  process.exit(1);
}
await initStore(connected);

const server = app.listen(PORT, () => {
  console.log(`OvertakeJS server running on port ${PORT}`);
  for (const t of getTracks()) {
    console.log(`  track: ${t.name} — ${t.length} m`);
  }
});
// Multiplayer rooms run over WebSockets on the same port (/api/multiplayer).
attachMultiplayer(server, { allowedOrigin: CLIENT_URL });
