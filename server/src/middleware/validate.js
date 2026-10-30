import { AppError } from '../utils/app-error.js';

// validate({ params, body }): zod schemas. The parsed (normalised) body replaces req.body, so handlers only
// ever see values that passed. A bad `:id` is its own error code (SPEC §5.2); everything else is VALIDATION_ERROR.
export function validate({ params, body } = {}) {
  return (req, _res, next) => {
    if (params) {
      const r = params.safeParse(req.params);
      if (!r.success) {
        if (r.error.issues.some((i) => i.path[0] === 'id')) throw new AppError('INVALID_ID', 400, 'Invalid case id.');
        throw r.error;
      }
    }
    if (body) req.body = body.parse(req.body);
    next();
  };
}
