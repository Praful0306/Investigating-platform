import * as cases from '../services/case.service.js';
import { toCaseSummary, toProgress, toPublicCase, toPublicClue, toResult } from '../serializers/case.serializer.js';

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

export async function discover(req, res) {
  const { doc, clue, alreadyDiscovered } = await cases.discoverClue(req.params.id, req.params.clueId, req);
  res.json({ clue: toPublicClue(clue, true), progress: toProgress(doc), alreadyDiscovered });
}

export async function hint(req, res) {
  const { doc, hint: revealed } = await cases.takeHint(req.params.id, req);
  res.json({ hint: revealed, progress: toProgress(doc) });
}

export async function accuse(req, res) {
  res.json({ result: toResult(await cases.accuse(req.params.id, req.body.suspectId, req)) });
}

export async function result(req, res) {
  res.json({ result: toResult(await cases.getResult(req.params.id, req)) });
}
