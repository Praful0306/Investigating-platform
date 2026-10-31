# 03 — Security spec

Source of truth: SPEC §9. Goal: a grader opening DevTools can't find the culprit, a stranger can't play your case, and nobody can burn our Gemini quota or steal keys.

## 1. Threat model (small scale, honest)
| # | Threat | Control | Test |
|---|---|---|---|
| S1 | Culprit visible in API responses before accusation | `select:false` + whitelist serializers + `toResult` guard | `security.test.js` leak scan |
| S2 | Undiscovered clue text / future hints visible | serializer hides them | leak scan |
| S3 | Score tampering from client | score computed server-side, client never sends score; body `.strict()` | API test sends `score` field → 400 |
| S4 | Double accusation / hint race | guarded `findOneAndUpdate` | parallel hint test, double accuse test |
| S5 | Playing someone else's case by id | ownership check (`playerId` / `userId`) | 403 test with second agent |
| S6 | NoSQL operator injection (`{"suspectId":{"$ne":null}}`) | zod string+regex on every input | API test → 400 |
| S7 | Gemini quota abuse / bot spam | per-player + per-IP rate limits, daily cap, optional Turnstile | limiter test (lower limits in test env) |
| S8 | Prompt injection via premise | length limit, control-char strip, theme-only system prompt, output validation | prompt test: premise text is inside the quoted block |
| S9 | XSS from AI text | React escapes by default; server strips tags; **no `dangerouslySetInnerHTML`** | grep check |
| S10 | Secret leakage (keys in repo or bundle) | `.env` ignored, only `VITE_*` in client, CI grep | `git grep` + bundle grep commands below |
| S11 | Stack traces / provider errors leaked | central error middleware, generic 500 | API test on forced error |
| S12 | Weak auth / forged identity (Tier 2) | Firebase Authentication; server verifies the ID token (RS256 pinned, issuer, audience, expiry); no passwords stored; invalid token = 401, never a guest; claim only unowned cases of this browser; auth rate limit | `auth.test.js` |
| S13 | CSRF on cookie-auth POSTs | `SameSite=Lax` cookies + same-origin via Vercel rewrite + CORS allow-list; POSTs need `content-type: application/json` (reject others with 415) | API test: form-encoded POST → 415 |

## 2. Implementation checklist (T-11)
- [ ] `helmet()` with defaults (API only; the client's CSP is set by Vercel headers, see §4).
- [ ] CORS: `origin` callback allowing only values in `CLIENT_URL` (comma list) and `undefined` origin (curl/health); `credentials: true`.
- [ ] `express.json({ limit: '10kb' })`; requests with a body but non-JSON content type → 415 `UNSUPPORTED_MEDIA_TYPE`.
- [ ] Rate limits (`express-rate-limit`, `standardHeaders: 'draft-7'`, `legacyHeaders: false`, handler returns our error envelope with 429 `RATE_LIMITED`):
  - global: 600 / min / IP on `/api` (a flood ceiling: behind the Vercel rewrite many visitors share the proxy's address)
  - create: 5 / 10 min keyed by `req.user?.id ?? req.playerId`
  - daily create: 120 / 24 h keyed by IP (a cost ceiling for the AI; stops cookie-clearing bypass; shared by visitors behind the proxy, so the per-player limit below is what limits one person)
  - auth: 300 / 15 min / IP on `/api/auth` (the client calls it once per sign-in, so it is looser than a password-login limit; Firebase rate-limits the actual sign-ins)
  - limits read from config so tests can set them low.
- [ ] `trust proxy` set from `TRUST_PROXY` = **1** on Render (measured: Render appends exactly one address; 2 trusts a value the visitor controls and lets them dodge the per-IP limits). Behind the Vercel rewrite the counted address is the proxy's. Wrong value = everyone shares one IP bucket, so check `req.ip` in logs after deploy.
- [ ] Turnstile (optional): if `TURNSTILE_SECRET` set, `POST /api/cases` requires `turnstileToken`; verify via `POST https://challenges.cloudflare.com/turnstile/v0/siteverify` (form fields `secret`, `response`, `remoteip`), fail → 403 `CAPTCHA_FAILED`. Skipped in test.
- [ ] Cookies: `httpOnly`, `sameSite:'lax'`, `secure: isProd`, `path:'/'`.
- [ ] Error middleware hides details in prod.
- [ ] Logs never print API keys, JWTs, cookies, passwords or the solution. Premise truncated to 50 chars.
- [ ] `FIREBASE_PROJECT_ID` set in production (it is public, not a secret). There is no JWT secret any more.

## 3. Leak test (must exist, must pass) — `tests/api/security.test.js`
```js
const FORBIDDEN_KEYS = ['solution', 'culpritId', 'keyClueIds', 'explanation', 'passwordHash', '"ai"'];
it('never leaks the solution before accusation', async () => {
  const agent = request.agent(app);
  const { body } = await agent.post('/api/cases').send({ premise: 'A missing painting at the city museum', difficulty: 'hard' }).expect(201);
  const id = body.case.id;
  const responses = [body];
  responses.push((await agent.get(`/api/cases/${id}`)).body);
  responses.push((await agent.post(`/api/cases/${id}/clues/c1/discover`)).body);
  responses.push((await agent.post(`/api/cases/${id}/hints`)).body);
  responses.push((await agent.get(`/api/cases`)).body);
  responses.push((await agent.get(`/api/cases/${id}/result`)).body);     // 409 body
  const all = JSON.stringify(responses);
  for (const k of FORBIDDEN_KEYS) expect(all).not.toContain(k);
  expect(all).not.toContain('MOCK_SECRET_EXPLANATION');
  // undiscovered clue c2 text and hint #2 text must be absent
  const full = await Case.findById(id).select('+solution').lean();
  expect(all).not.toContain(full.clues[1].description);
  expect(all).not.toContain(full.hints[1]);
});
```
Plus: injection bodies (`{"suspectId":{"$ne":null}}`, `{"premise":{"$gt":""},"difficulty":"easy"}`) → 400; extra `score` field on accuse → 400; second agent → 403; forced 500 → body has no `stack`.

## 4. Frontend security
- Only `VITE_API_BASE_URL`, `VITE_USE_MOCK`, `VITE_TURNSTILE_SITE_KEY` and the four public `VITE_FIREBASE_*` values in client env.
- No `dangerouslySetInnerHTML`, no `eval`, and our own code stores no tokens in `localStorage`. The Firebase SDK keeps its own session in IndexedDB (its standard behaviour); the ID token is sent only in the `Authorization` header, never in a URL or body. The guest cookie `mr_pid` is httpOnly.
- `vercel.json` headers: `X-Content-Type-Options: nosniff`, `Referrer-Policy: strict-origin-when-cross-origin`, `X-Frame-Options: DENY`, `Permissions-Policy: camera=(), microphone=(), geolocation=()`. Add a CSP only after the UI is final. Fonts are self-hosted now (no Google Fonts origin). Turnstile and Firebase Authentication need allow-listing: `default-src 'self'; script-src 'self' https://challenges.cloudflare.com https://apis.google.com; frame-src https://challenges.cloudflare.com https://*.firebaseapp.com https://accounts.google.com; style-src 'self' 'unsafe-inline'; font-src 'self'; img-src 'self' data: https://*.googleusercontent.com; connect-src 'self' https://identitytoolkit.googleapis.com https://securetoken.googleapis.com https://www.googleapis.com`. Test sign-in (email and Google popup) with the CSP on before shipping it.
- Client-side score preview is labelled "preview" and never sent.

## 5. Verify (T-11)
```bash
cd server && npx vitest run tests/api/security.test.js
# no secrets committed
git grep -nE "AIza[0-9A-Za-z_-]{20,}|mongodb\+srv://[^<]*:[^<]*@|gsk_[0-9A-Za-z]{20,}|xai-[0-9A-Za-z]{20,}" -- . ':!*.md' && echo "SECRET FOUND" || echo "clean"
# no secrets in client bundle
cd ../client && npm run build && grep -rE "AIza|mongodb\+srv|GEMINI|JWT_SECRET" dist/ && echo "LEAK" || echo "bundle clean"
grep -rn "dangerouslySetInnerHTML" src/ && echo "REVIEW" || echo "no raw html"
```
Manual (on production, T-22): open DevTools → Network → create a case and click around → search all responses for the culprit's name next to words like "culprit"; search for `solution`. Nothing before accusing.

## 6. Accounts & terms (read once)
Use **one account per provider** (one Google AI Studio project, one Atlas org, one Cloudflare account, one Vercel, one Render/Catalyst, one Groq/xAI). Most providers' terms forbid opening extra accounts to multiply free limits, and doing so can get every account (and the demo) suspended right before the deadline. Stretch the free tiers the legitimate way instead: a Gemini → fallback-provider chain, rate limits, retry-with-feedback instead of blind regeneration, and the mock provider for all development and tests (zero quota). Student/non-commercial use doesn't change these terms.
