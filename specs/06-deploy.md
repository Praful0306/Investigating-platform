# 06 — Deploy spec

Target: **Vercel** (client, required by guide) → same-origin `/api/*` rewrite → **Render free web service** (server; alternative: Zoho Catalyst AppSail) → **MongoDB Atlas M0**.
Deploy a skeleton early (end of day 1) so surprises show up while there's time to fix them.

```
Browser ──► https://ai-mystery-room.vercel.app  (static React build)
              └─ /api/*  ──rewrite──►  https://ai-mystery-room-api.onrender.com/api/*  ──► Atlas M0
                                                    └─► Gemini (primary) ─► fallback provider (optional)
```
Why the rewrite: the browser only ever talks to the Vercel domain, so cookies are first-party (`SameSite=Lax` works, no third-party-cookie blocking in Safari/Chrome), and CORS is a non-issue.

## 1. Accounts (one each, T-02)
Google AI Studio (Gemini key) · MongoDB Atlas · GitHub · Vercel (sign in with GitHub) · Render (sign in with GitHub) *or* Zoho Catalyst · optional: Cloudflare (Turnstile / Workers AI / keep-alive cron) · optional: Groq or xAI key for fallback.

## 2. Backend on Render (T-20)
1. Push repo to GitHub (public).
2. Render → New → Web Service → pick repo.
   - Root directory: `server` · Runtime: Node · Build: `npm ci` · Start: `npm start` · Instance: Free · Region: Singapore (closest to India).
   - Health check path: `/api/health`.
3. Environment variables:
   ```
   NODE_ENV=production
   MONGODB_URI=<atlas uri>
   GEMINI_API_KEY=<key>
   GEMINI_MODEL=gemini-2.5-flash         # or the current Flash model in AI Studio
   AI_PROVIDERS=gemini                   # add ,openai_compat once fallback keys are set
   CLIENT_URL=https://<your-app>.vercel.app
   JWT_SECRET=<48 random bytes base64url>
   TRUST_PROXY=2
   ```
   (Render sets `PORT` itself; `env.js` reads it.)
4. Deploy → open `https://<service>.onrender.com/api/health` → `{"ok":true,"db":"up"}`.
5. Free instances sleep after ~15 min idle; first request can take ~1 min. Mitigations: Home page wake ping (built in), and during the grading window an external ping every 10 min (e.g. a Cloudflare Worker cron trigger or cron-job.org calling `/api/health`). Check Render's current free-tier policy before relying on this.

### Alternative: Zoho Catalyst AppSail
- `npm i -g zcatalyst-cli` → `catalyst login` → `catalyst init` (choose AppSail, Node) inside `server/`.
- Start command `node src/index.js`; the app must listen on `process.env.X_ZOHO_CATALYST_LISTEN_PORT || PORT` (confirm the variable name in current Catalyst docs).
- Set the same env vars in the AppSail console → `catalyst deploy` → test `/api/health`.
- Pick **one** production backend (Render or AppSail) and point the Vercel rewrite at it.

## 3. Frontend on Vercel (T-21)
`client/vercel.json`
```json
{
  "rewrites": [
    { "source": "/api/:path*", "destination": "https://<service>.onrender.com/api/:path*" },
    { "source": "/((?!api/).*)", "destination": "/index.html" }
  ],
  "headers": [
    { "source": "/(.*)", "headers": [
      { "key": "X-Content-Type-Options", "value": "nosniff" },
      { "key": "Referrer-Policy", "value": "strict-origin-when-cross-origin" },
      { "key": "X-Frame-Options", "value": "DENY" },
      { "key": "Permissions-Policy", "value": "camera=(), microphone=(), geolocation=()" }
    ] }
  ]
}
```
Vercel → Add New Project → repo → Root directory `client` → Framework preset Vite → Build `npm run build` → Output `dist` → Env `VITE_API_BASE_URL=/api` (and `VITE_TURNSTILE_SITE_KEY` if used) → Deploy.

**Fallback if the rewrite misbehaves** (e.g. long generation timing out at the proxy): set `VITE_API_BASE_URL=https://<service>.onrender.com/api`, and on the server set cookies with `sameSite: 'none', secure: true` (env flag `CROSS_SITE_COOKIES=true`) and keep CORS `credentials: true` with the Vercel origin. Test in Safari afterwards.

## 4. Post-deploy checks (T-21)
```bash
curl -s https://<your-app>.vercel.app/api/health            # through the rewrite
node server/scripts/smoke.mjs https://<your-app>.vercel.app easy
node server/scripts/smoke.mjs https://<your-app>.vercel.app medium
node server/scripts/smoke.mjs https://<your-app>.vercel.app hard
```
Then in a browser: hard refresh on `/case/<id>` (SPA fallback works), DevTools leak check, phone test. Look at Render logs: `req.ip` should be your real IP (if every request shows the same Vercel IP, raise `TRUST_PROXY`).

## 5. Optional extras that fit the stack
| Service | Use | Required? |
|---|---|---|
| Cloudflare Turnstile | bot check on Generate (free) | optional |
| Cloudflare Workers AI | `openai_compat` fallback LLM (`https://api.cloudflare.com/client/v4/accounts/<id>/ai/v1`) | optional |
| Cloudflare Worker cron | keep-alive ping during grading | optional |
| Groq | `openai_compat` fallback LLM (`https://api.groq.com/openai/v1`) with a free tier | optional |
| xAI Grok | `openai_compat` fallback (`https://api.x.ai/v1`) — usually needs credits | optional |
| Zoho Catalyst | AppSail backend host, or an LLM endpoint if your project exposes an OpenAI-compatible one | optional |
| GitHub Actions | CI from `05-tests.md` §8 | recommended |

Gemini stays the primary generator in production because the brief requires it.

## 6. Rollback
- Vercel: Deployments → previous → Promote to Production.
- Render: Events → previous deploy → Rollback.
- Keep `main` deployable; tag the submission commit `v1.0-submission`.
