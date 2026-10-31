# Deploying: backend (T-20) and frontend (T-21)

Everything below was rehearsed locally: the real server booted in production mode (`NODE_ENV=production`) behind a stand-in AI, and `server/scripts/smoke.mjs` passed all its checks on all three difficulties. What is left needs **your** accounts. Nothing here is pushed or deployed yet; the single final push comes first (see "Order" at the bottom).

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
Each run makes **one** real AI call. 23 ticks = healthy. A ✗ names the problem (database down, missing security headers, a secret in a response, cookie not HttpOnly, someone else able to open the case, a second accusation accepted).
Then in Render → Logs, make one request and read the `ip=` at the end of the line: it must be *your* IP. If every line shows the same address, change `TRUST_PROXY`.

## 3b. Keeping the free service awake (examiners can open it at any time)
A free Render service goes to sleep after **15 minutes** without requests, and the next visitor waits about a minute. A sleeping server cannot wake itself, so there are three layers:

1. **Built in, nothing to do:** while the server is awake it asks its own public address for `/api/health` every 10 minutes (Render provides the address as `RENDER_EXTERNAL_URL`). It only runs in production and can be switched off with `KEEP_ALIVE=false`. Look for `Keep-alive: pinging https://… every 10 min` in Render's logs after a deploy.
2. **GitHub, free, 1 minute to set up:** `.github/workflows/keep-alive.yml` asks for `/api/health` from outside every 10 minutes, which also wakes the server if it ever slept. In your GitHub repo: **Settings → Secrets and variables → Actions → Variables → New repository variable**, name `KEEP_ALIVE_URL`, value `https://<your-service>.onrender.com` (a variable, not a secret; the address is public). Then **Actions → Keep the API awake → Run workflow** once to test it. Until you add the variable the job just does nothing. GitHub may start these runs a few minutes late, and it switches scheduled jobs off on a public repo after 60 days without any repo activity.
3. **A free monitor (recommended extra, the most reliable):** create a free account at uptimerobot.com → **Add New Monitor** → type *HTTP(s)* → URL `https://<your-app>.vercel.app/api/health` (the website address, so it also tests the whole path through Vercel) → interval **5 minutes**. It also emails you if the site goes down.

Do all three: they cost nothing and cover each other. Render's free plan gives 750 running hours a month, enough for one service to stay up all month; check Render's current free-plan rules before relying on this. If it does sleep anyway, the website's Home page already shows a "waking up" message and wakes it.

## 4. Things that can still go wrong (and the fix)
- **Free instance sleeps** after ~15 min idle (slow first request): see section 3b above.
- **Gemini quota / 429**: the app shows a friendly message and retries on its own; a second provider (`AI_PROVIDERS=gemini,openai_compat` plus its three variables) is the fallback.
- **Deploys cut a running generation?** No: on a redeploy the server finishes running requests (up to 25 s), then closes the database and exits.
- **502s at random**: already handled (the server keeps idle connections open longer than Render's proxy).
- **Sign-in on the live site**: add the Vercel domain in Firebase → Authentication → Settings → *Authorized domains*, and enable Email/Password and Google there.

## 5. Vercel (the website, T-21)
Do this **after** the Render service is up and its health check shows `db: "up"`.
1. Check the address in `client/vercel.json`: the first rewrite sends `/api/*` to `https://investigating-platform.onrender.com`, which is the address of the live service (verified: health shows the database up). Only change it if you ever move the service.
2. Vercel → **Add New → Project** → import the repo → **Root Directory `client`** → Framework **Vite** (build `npm run build`, output `dist`).
3. Environment variables (all public values; leave out any you do not use):

| Variable | Value |
|---|---|
| `VITE_API_BASE_URL` | `/api` (this is what keeps the cookie first-party; do not put the Render address here) |
| `VITE_FIREBASE_API_KEY`, `VITE_FIREBASE_AUTH_DOMAIN`, `VITE_FIREBASE_PROJECT_ID`, `VITE_FIREBASE_APP_ID` | the four values from your Firebase web app; without them the site works for guests only |
| `VITE_TURNSTILE_SITE_KEY` | optional (and set `TURNSTILE_SECRET` on Render) |

4. Deploy. Then give Render the final address: set `CLIENT_URL` to `https://<your-app>.vercel.app` there and redeploy it once.
5. If you use sign-in: Firebase → Authentication → Settings → **Authorized domains** → add `<your-app>.vercel.app`.
6. Check it **through the website address** (this goes through the rewrite):
```bash
curl -s https://<your-app>.vercel.app/api/health
node server/scripts/smoke.mjs https://<your-app>.vercel.app easy
node server/scripts/smoke.mjs https://<your-app>.vercel.app medium
node server/scripts/smoke.mjs https://<your-app>.vercel.app hard
```
7. In a browser: open a case, **refresh the page** on `/case/<id>` and on its result (the app must come back, not a 404), and open DevTools → Console: there should be no red `Content Security Policy` lines. Try it on your phone too.

**What `client/vercel.json` does:** `/api/*` goes to Render; any other path that is not a real file serves `index.html` (so refreshes on deep links work); security headers on every page; files in `/assets` are cached for a year (their names change with every build); and a Content Security Policy, delivered **report-only**.
**The policy is report-only on purpose.** It never blocks anything; the browser only lists violations in the Console. I enforced it in a local rehearsal and the guest flow had zero violations, but real Firebase and Google sign-in and Turnstile could not be tried, so I did not risk breaking them. When sign-in works on the live site with no Console lines: in `vercel.json` rename `Content-Security-Policy-Report-Only` to `Content-Security-Policy`, redeploy, and try sign-in again (email and the Google pop-up).
**If a long generation fails through the rewrite** (timeout at the proxy), the fallback in `specs/06-deploy.md` §3 is to call Render directly with `CROSS_SITE_COOKIES=true`.

## Order (so nothing is half-done)
1. Finish and verify everything locally (done up to T-19; T-08, Firebase and Turnstile live checks still need your keys).
2. One push to GitHub as the owner.
3. Atlas → Render (this file) → smoke test.
4. T-21: Vercel (`client/vercel.json` rewrite to the Render address), then the same smoke test against the Vercel address.
5. T-22: final QA, README, tag `v1.0-submission`.

## What to send me when you have them
Not the secrets themselves. Tell me only: the Render service address (`https://….onrender.com`), the Vercel address, and whether the smoke test printed 23/23 or which line failed.
