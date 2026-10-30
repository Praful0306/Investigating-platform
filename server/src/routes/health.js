import { Router } from 'express';
import { dbState } from '../db/connect.js';

export const healthRouter = Router();

healthRouter.get('/', (_req, res) => {
  res.json({ ok: true, db: dbState(), time: new Date().toISOString() });
});
