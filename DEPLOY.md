# Deploying the backend (T-20)

Everything below was rehearsed locally: the real server booted in production mode (`NODE_ENV=production`) behind a stand-in AI, and `server/scripts/smoke.mjs` passed 22/22 checks on all three difficulties. What is left needs **your** accounts. Nothing here is pushed or deployed yet; the single final push comes first (see "Order" at the bottom).

## 1. MongoDB Atlas (database)
1. Create a free **M0** cluster (region near Singapore/Mumbai).
2. **Database Access** → add a user with a long random password (letters and digits only avoids URL-encoding trouble) and the role *Read and write to any database*.
3. **Network Access** → *Allow access from anywhere* (`0.0.0.0/0`). Render's free service has no fixed outgoing IP, so an IP allow-list cannot work; the strong password is the protection.
4. **Connect → Drivers** → copy the `mongodb+srv://…` string, put the database name before the `?`: `…mongodb.net/mysteryroom?retryWrites=true&w=majority`, and fill in the password. This is `MONGODB_URI`. Never paste it in chat, in a file in the repo, or in client code.

## 2. Render (the API)
1. Push the repo to GitHub (after everything is verified; see the order below).
2. Render → **New → Blueprint** → pick the repo. It reads `render.yaml` (free Node web service, folder `server`, region Singapore, health check `/api/health`, Node 22).
3. Render asks for the values marked `sync: false`:

| Variable | Value |
|---|---|
| `MONGODB_URI` | from step 1 |
| `GEMINI_API_KEY` | your key from Google AI Studio |
| `CLIENT_URL` | `https://<your-app>.vercel.app` (comma-separate more origins if needed) |
| `FIREBASE_PROJECT_ID` | your Firebase project id (public; leave empty to run without sign-in) |
| `TURNSTILE_SECRET` | optional; leave empty for no bot check |

   Already set by the blueprint: `NODE_ENV=production`, `AI_PROVIDERS=gemini`, `GEMINI_MODEL=gemini-2.5-flash`, `TRUST_PROXY=2`.
   **Check `GEMINI_MODEL`**: Google retires model names. Open AI Studio, confirm the current Flash model, and change the value in Render if it differs.
4. Deploy, then open `https://<service>.onrender.com/api/health`. Expected: `{"ok":true,"db":"up",…}`. The first request after the service slept can take about a minute.

## 3. Check it (run from this repo, no keys needed on your side)
```bash
node server/scripts/smoke.mjs https://<service>.onrender.com easy
node server/scripts/smoke.mjs https://<service>.onrender.com medium
node server/scripts/smoke.mjs https://<service>.onrender.com hard
```
Each run makes **one** real AI call. 22 ticks = healthy. A ✗ names the problem (database down, missing security headers, a secret in a response, cookie not HttpOnly, someone else able to open the case, a second accusation accepted).
Then in Render → Logs, make one request and read the `ip=` at the end of the line: it must be *your* IP. If every line shows the same address, change `TRUST_PROXY`.

## 4. Things that can still go wrong (and the fix)
- **Free instance sleeps** after ~15 min idle (slow first request). The Home page already wakes it. For the grading window, ping `/api/health` every 10 minutes (cron-job.org, or a Cloudflare Worker cron).
- **Gemini quota / 429**: the app shows a friendly message and retries on its own; a second provider (`AI_PROVIDERS=gemini,openai_compat` plus its three variables) is the fallback.
- **Deploys cut a running generation?** No: on a redeploy the server finishes running requests (up to 25 s), then closes the database and exits.
- **502s at random**: already handled (the server keeps idle connections open longer than Render's proxy).
- **Sign-in on the live site**: add the Vercel domain in Firebase → Authentication → Settings → *Authorized domains*, and enable Email/Password and Google there.

## Order (so nothing is half-done)
1. Finish and verify everything locally (done up to T-19; T-08, Firebase and Turnstile live checks still need your keys).
2. One push to GitHub as the owner.
3. Atlas → Render (this file) → smoke test.
4. T-21: Vercel (`client/vercel.json` rewrite to the Render address), then the same smoke test against the Vercel address.
5. T-22: final QA, README, tag `v1.0-submission`.

## What to send me when you have them
Not the secrets themselves. Tell me only: the Render service address (`https://….onrender.com`), the Vercel address, and whether the smoke test printed 22/22 or which line failed.
