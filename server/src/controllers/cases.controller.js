import * as cases from '../services/case.service.js';
import { toCaseSummary, toPublicCase } from '../serializers/case.serializer.js';

// Controllers only: take validated input, call the service, serialize through the whitelist, respond.
export async function create(req, res) {
  const { premise, difficulty } = req.body;
  const doc = await cases.createCase({
    ai: req.app.locals.ai,
    premise,
    difficulty,
    playerId: req.playerId,
    userId: req.user?.id,
  });
  res.status(201).json({ case: toPublicCase(doc) });
}

export async function get(req, res) {
  res.json({ case: toPublicCase(await cases.loadOwned(req.params.id, req)) });
}

export async function list(req, res) {
  res.json({ cases: (await cases.listCases(req)).map(toCaseSummary) });
}
