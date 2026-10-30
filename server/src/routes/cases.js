import { Router } from 'express';
import { z } from 'zod';
import { validate } from '../middleware/validate.js';
import { sanitizePremise } from '../services/ai/prompt.js';
import * as ctrl from '../controllers/cases.controller.js';

// Every client value that can reach a DB filter is a regex-checked string, so operator injection is impossible.
const PREMISE_MSG = 'Premise must be 10–300 characters.';
const CreateCaseBody = z.strictObject({
  premise: z.string().transform(sanitizePremise).pipe(z.string().min(10, PREMISE_MSG).max(300, PREMISE_MSG)),
  difficulty: z.enum(['easy', 'medium', 'hard']),
  turnstileToken: z.string().max(2048).optional(),
});
const IdParam = z.object({ id: z.string().regex(/^[a-f\d]{24}$/i, 'Invalid case id') });
const ClueParam = IdParam.extend({ clueId: z.string().regex(/^c\d{1,2}$/, 'Invalid clue id') });
const AccuseBody = z.strictObject({ suspectId: z.string().regex(/^s\d$/, 'Invalid suspect id') });

// `limiters` and `turnstile` are built per app (see app.js) so every app, and every test, has its own counters.
export function createCasesRouter({ limiters, turnstile }) {
  const router = Router();

  // Limiters first (every attempt counts, valid or not), then validation, then the bot check (see turnstile.js).
  router.post('/', limiters.create, limiters.daily, validate({ body: CreateCaseBody }), turnstile, ctrl.create);
  router.get('/', ctrl.list);
  router.get('/:id', validate({ params: IdParam }), ctrl.get);
  router.post('/:id/clues/:clueId/discover', validate({ params: ClueParam }), ctrl.discover);
  router.post('/:id/hints', validate({ params: IdParam }), ctrl.hint);
  router.post('/:id/accuse', validate({ params: IdParam, body: AccuseBody }), ctrl.accuse);
  router.get('/:id/result', validate({ params: IdParam }), ctrl.result);

  return router;
}
