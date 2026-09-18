// Track seed data. The MongoDB `tracks` collection is seeded/synced from
// this list at startup, and it doubles as the in-memory fallback when no DB
// is reachable (see data/store.js).
//
// Each track is authored as a closed loop of 2D control points in meters.
// The geometry module interpolates a smooth centerline through them and
// derives curvature, so corner speeds come straight from the drawn shape.

import { buildCenterline, findOvertakeZones } from '../sim/geometry.js';

export const seedTracks = [
  {
    id: 'valmont-gp',
    name: 'Circuit de Valmont',
    location: 'Grand Prix road course',
    description: 'Fast front straight into a sweeping first sector, an esses complex, and a tight final hook. Rewards downforce and braking stability.',
    width: 12,
    controlPoints: [
      [0, 0], [300, 0], [600, 0],
      [750, 40], [820, 160],
      [800, 320], [700, 420],
      [560, 480], [420, 520],
      [300, 620], [280, 760],
      [360, 880], [520, 920],
      [680, 900], [820, 940],
      [920, 1060], [900, 1200],
      [760, 1280], [600, 1260],
      [460, 1180], [320, 1160],
      [140, 1180], [0, 1120],
      [-120, 1000], [-160, 840],
      [-140, 660], [-60, 520],
      [-180, 420], [-260, 300],
      [-240, 160], [-140, 60],
    ],
  },
  {
    id: 'kingsport-street',
    name: 'Kingsport Street Circuit',
    location: 'Temporary street course',
    description: 'Walled 90-degree corners and short bursts. Power counts for less here; braking and agility count for everything.',
    width: 10,
    controlPoints: [
      [0, 0], [200, 0], [420, 0],
      [500, 60], [500, 200],
      [430, 270], [300, 270],
      [230, 340], [230, 500],
      [300, 570], [500, 570],
      [570, 640], [570, 800],
      [500, 870], [300, 880],
      [100, 870], [-60, 880],
      [-140, 800], [-130, 660],
      [-60, 590], [-70, 470],
      [-140, 400], [-140, 240],
      [-100, 100], [-60, 40],
    ],
  },
  {
    id: 'thunder-speedway',
    name: 'Thunder Speedway',
    location: 'High-banked oval',
    description: 'Flat-out oval racing. Top speed and drag decide everything; drafting trains form fast.',
    width: 15,
    controlPoints: [
      [0, 0], [250, 0], [500, 0], [750, 0],
      [900, 55], [965, 200], [900, 345],
      [750, 400], [500, 400], [250, 400], [0, 400],
      [-150, 345], [-215, 200], [-150, 55],
    ],
  },
];

/** Derive spline centerline + overtaking zones from a raw track record. */
export function buildTrackGeometry(def) {
  const centerline = buildCenterline(def.controlPoints, 5);
  const overtakeZones = findOvertakeZones(centerline.curvature, centerline.spacing);
  return { ...def, centerline, overtakeZones };
}
