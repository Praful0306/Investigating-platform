import { Router } from 'express';
import { dbState } from '../db/connect.js';

export const healthRouter = Router();

// 200 only when the database is connected. A 503 with ok:false lets Render's health check and an uptime monitor see a
// broken instance (any answer still wakes a sleeping one, which is all the wake-up pings need).
healthRouter.get('/', (_req, res) => {
  const db = dbState();
  res.status(db === 'up' ? 200 : 503).json({ ok: db === 'up', db, time: new Date().toISOString() });
});
