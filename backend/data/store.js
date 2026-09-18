// Runtime data store.
//
// On startup: connect to MongoDB, sync the seed data into it (upsert by
// slug, so edits to the seed files propagate in dev), then load everything
// into an in-memory cache with track geometry precomputed. Routes and the
// simulation engine read synchronously from the cache — the DB is the
// source of truth, the cache is the hot path.
//
// If MongoDB is unreachable the store falls back to the seed files, so the
// app keeps working without a database (races just aren't persisted).

import mongoose from 'mongoose';
import Car from '../models/Car.js';
import Track from '../models/Track.js';
import { seedCars } from './cars.js';
import { seedTracks, buildTrackGeometry } from './tracks.js';

let cars = [];
let tracks = [];
let dbReady = false;

export const isDbReady = () => dbReady;

async function syncSeeds() {
  await Promise.all([
    ...seedCars.map((c) =>
      Car.updateOne({ id: c.id }, { $set: c }, { upsert: true }),
    ),
    ...seedTracks.map((t) =>
      Track.updateOne({ id: t.id }, { $set: t }, { upsert: true }),
    ),
  ]);
}

/** Populate the cache. `connected` is the result of connectDB(). */
export async function initStore(connected) {
  dbReady = connected && mongoose.connection.readyState === 1;

  let rawCars = seedCars;
  let rawTracks = seedTracks;
  if (dbReady) {
    await syncSeeds();
    rawCars = await Car.find().lean();
    rawTracks = await Track.find().lean();
  }

  cars = rawCars;
  tracks = rawTracks.map(buildTrackGeometry);

  console.log(`Store ready (${dbReady ? 'MongoDB' : 'in-memory seed'}): ${cars.length} cars, ${tracks.length} tracks`);
}

export const getCars = () => cars;
export const getCarById = (id) => cars.find((c) => c.id === id);
export const getTrackById = (id) => tracks.find((t) => t.id === id);

/** Track list shaped for the API: geometry downsampled for rendering. */
export function getTracks() {
  return tracks.map((t) => ({
    id: t.id,
    name: t.name,
    location: t.location,
    description: t.description,
    width: t.width,
    length: Math.round(t.centerline.length),
    // Every 3rd sample (~15 m) is plenty for drawing.
    path: t.centerline.points
      .filter((_, i) => i % 3 === 0)
      .map(([x, y]) => [Math.round(x * 10) / 10, Math.round(y * 10) / 10]),
  }));
}
