import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(cors());
app.use(express.json());

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'OvertakeJS server running' });
});

// TODO: Add routes
// app.use('/api/cars', carRoutes);
// app.use('/api/tracks', trackRoutes);
// app.use('/api/races', raceRoutes);

app.listen(PORT, () => {
  console.log(`OvertakeJS server running on port ${PORT}`);
});