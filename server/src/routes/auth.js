import { Router } from 'express';
import { optionalAuth, requireAuth } from '../middleware/auth.js';
import { claimGuestCases } from '../services/case.service.js';

// Sign-up, sign-in, password reset and sign-out all happen in Firebase. The only thing the API does is, once after a
// sign-in, hand this browser's anonymous cases to the account. The limiter runs first so bad tokens count too.
export function createAuthRouter({ limiters, verify }) {
  const router = Router();

  router.post('/session', limiters.auth, optionalAuth(verify), requireAuth, async (req, res) => {
    const claimed = await claimGuestCases({ playerId: req.playerId, userId: req.user.id });
    res.json({ user: req.user, claimed });
  });

  return router;
}
