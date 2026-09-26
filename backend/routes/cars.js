import { Router } from 'express';
import { getCars } from '../data/store.js';
import { performanceCard } from '../sim/performance.js';

const router = Router();

router.get('/', (req, res) => {
  res.json(getCars().map((c) => ({
    id: c.id,
    name: c.name,
    hp: c.hp,
    torque: c.torque,
    mass: c.mass,
    drive: c.drive.toUpperCase(),
    ev: c.ev,
    tireGrip: c.tireGrip,
    topSpeed: c.topSpeed,
    class: c.class,
    country: c.country,
    year: c.year,
    powerToWeight: Math.round((c.hp / c.mass) * 1000) / 1000, // hp per kg
    performance: performanceCard(c),
  })));
});

export default router;
