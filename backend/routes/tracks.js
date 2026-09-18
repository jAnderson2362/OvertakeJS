import { Router } from 'express';
import { getTracks } from '../data/store.js';

const router = Router();

router.get('/', (req, res) => {
  res.json(getTracks());
});

export default router;
