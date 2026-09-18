import { Router } from 'express';
import { getCars } from '../data/store.js';

const router = Router();

router.get('/', (req, res) => {
  res.json(getCars().map((c) => ({
    id: c.id,
    name: c.name,
    hp: c.hp,
    mass: c.mass,
    drive: c.drive.toUpperCase(),
    ev: c.ev,
    tireGrip: c.tireGrip,
    topSpeed: c.topSpeed,
    class: c.class,
    year: c.year,
    powerToWeight: Math.round((c.hp / c.mass) * 1000) / 1000, // hp per kg
  })));
});

export default router;
