# 04 — Frontend spec (React + Vite + Tailwind v4 + GSAP)

Source of truth: SPEC §3, §4, §5. The frontend lane can start on day 1 **without the backend** by running on mock fixtures (`VITE_USE_MOCK=true`).

## 1. Design system (T-13)

### Look: "noir case file"
- Background near-black with subtle film grain; amber "desk lamp" accent; evidence cards look like aged paper on dark felt.
- Display font: Playfair Display (titles). Body: Inter. Mono: JetBrains Mono for case numbers.
- Motion is purposeful: reveal, flip, stamp. Never block input; every animation ≤ 600 ms except the generation overlay.

### Tokens — `src/index.css`
```css
@import "tailwindcss";
@theme {
  --color-ink: #0b0b0f;        /* page background */
  --color-felt: #14141b;       /* panels */
  --color-paper: #efe6d2;      /* evidence cards */
  --color-paper-ink: #2a2219;  /* text on paper */
  --color-amber: #f5a524;      /* primary accent */
  --color-blood: #d94848;      /* danger / wrong verdict */
  --color-moss: #4caf7a;       /* success / correct verdict */
  --color-mist: #a1a1b5;       /* muted text */
  --font-display: "Playfair Display", serif;
  --font-sans: "Inter", system-ui, sans-serif;
  --font-mono: "JetBrains Mono", ui-monospace, monospace;
}
body { @apply bg-ink text-zinc-100 font-sans antialiased; }
```
Contrast: body text on `ink` ≥ 4.5:1; `paper-ink` on `paper` ≥ 7:1.

### UI kit — `src/components/ui/`
`Button` (variants primary/ghost/danger, `loading` prop with spinner, disabled styles), `Card`, `Badge` (difficulty colors: easy moss, medium amber, hard blood), `Modal` (focus trap, Esc closes, `role="dialog"`, `aria-modal`), `Toast` provider, `ProgressBar`, `Skeleton`, `ErrorState` (message + Retry), `Spinner`.
21st.dev: pull components through the 21st.dev MCP for hero, buttons, cards, dialogs where they fit; **copy them into `components/ui/` and restyle with the tokens above**, don't add their whole dependency trees. Note the source in a comment at the top of the file.

## 2. App shell & routing (T-13)
`src/App.jsx`
```
<BrowserRouter>
  <AuthProvider>  <ToastProvider>
    <Layout>  (NavBar + <main> + Footer)
      /                    Home
      /create              CreateMystery
      /case/:id            Investigation
      /case/:id/accuse     Accusation
      /case/:id/result     Results
      /login /register     Login / Register       (Tier 2)
      /history             History                (Tier 2)
      *                    NotFound
```
Pages are `React.lazy` loaded; `<Suspense fallback={<PageSkeleton/>}>`. Vercel SPA fallback is in `vercel.json`.

## 3. API layer (T-13)
`src/api/http.js`
```js
import axios from 'axios';
export const http = axios.create({ baseURL: import.meta.env.VITE_API_BASE_URL || '/api', withCredentials: true, timeout: 90000 });
export function toApiError(err) {
  if (err.response?.data?.error) return { status: err.response.status, ...err.response.data.error };
  if (err.code === 'ECONNABORTED') return { status: 0, code: 'TIMEOUT', message: 'The server took too long. It may be waking up, please try again.' };
  return { status: 0, code: 'NETWORK', message: 'Cannot reach the server. Check your connection and try again.' };
}
```
`src/api/cases.js` exports `createCase`, `getCase`, `discoverClue`, `requestHint`, `accuse`, `getResult`, `listCases`, `health` — each returns `data.case` / `data.result` etc. and throws `toApiError(e)`.
If `import.meta.env.VITE_USE_MOCK === 'true'` export the same functions from `src/api/mock/index.js` instead (in-memory state, 800 ms fake latency, 2.5 s for create, same shapes as SPEC §5, mock culprit `s2`).

`src/api/mock/fixtures.js` must contain an easy case that matches SPEC §5.3 exactly, plus generators for medium/hard counts.

Friendly messages by `code` (`src/lib/errors.js`): `RATE_LIMITED` → "You've opened a lot of cases. Take a breather and try again in a few minutes." · `AI_GENERATION_FAILED` → "Our mystery writer tangled the plot. Try again — it usually works on the next try." · `AI_UNAVAILABLE` → "The mystery writer is busy. Try again in a minute." · `FORBIDDEN` → "This case file belongs to another detective." · `CASE_NOT_FOUND` → "We couldn't find that case." · default → server message.

## 4. Pages

### 4.1 Home (T-14)
- Hero: title "AI Mystery Room", tagline "Every case is new. Every culprit is hiding.", primary **Start a mystery** → `/create`, secondary **How it works** (scrolls).
- How it works: 3 steps (Describe → Investigate → Accuse).
- Difficulty table from `config/difficulty.js`.
- `useHealthWake()` calls `health()` on mount; if not resolved within 3 s show pill "Waking up the detective…"; on success pill disappears.
- Optional 3D hero (Tier 3): `components/effects/HeroScene.jsx` with `@react-three/fiber` — a slowly rotating magnifying glass / floating case files with lamp light. Loaded with `React.lazy` **only** if `!prefersReducedMotion && window.innerWidth >= 768`; otherwise a CSS gradient + grain fallback. Must not delay the CTA render.

### 4.2 CreateMystery (T-14)
- Form state: `premise`, `difficulty` (default `easy`), `submitting`, `error`.
- Premise `<textarea maxLength={300}>` + counter `n/300`; error text under it when `trimmed.length < 10` after blur.
- Sample chips (fill textarea on click): "A stolen trophy at a college cricket final", "A poisoned chai at a hill-station homestay", "A missing hard drive at a startup hackathon", "A vanished sitar at a music festival", "Sabotage on a Mumbai local train film shoot".
- Difficulty: 3 radio cards (`role="radiogroup"`), each showing suspects/clues/hints/points.
- Submit → `createCase` → `navigate('/case/' + id)`. While waiting show `<GeneratingOverlay>`: rotating lines every 2.5 s, elapsed seconds, GSAP pulsing magnifier; after 25 s add "Hard cases take a bit longer…".
- Error → banner with friendly message + Try again (keeps form values). `429` disables Generate for 60 s with countdown.
- Turnstile (if `VITE_TURNSTILE_SITE_KEY`): render widget, send token, reset after each submit.

### 4.3 Investigation (T-15)
- `useCase(id)` hook: `{ data, loading, error, refresh, applyClue, applyHint }` — local state updated from mutation responses (no refetch needed).
- If `data.status !== 'active'` → `<Navigate to={/case/${id}/result} replace />`.
- Layout: desktop 2 columns (left: story + suspects, right: clues board + hints); mobile single column with a sticky bottom bar (progress + **Accuse**).
- `CaseHeader`: title, difficulty badge, `ProgressBar` (clues), hints `used/total`, **Score preview** = `base + 5·found − 10·hints` with tooltip "Preview if your accusation is correct. Final score is calculated by the server."
- `StoryPanel`: setting, crime (highlighted), story paragraphs; first-visit typewriter/fade (GSAP SplitText or simple stagger) with **Skip**; stores "seen" in `sessionStorage` per case.
- `SuspectCard`: initials avatar on gradient seeded by name, name, role, description, motive, alibi (collapsible on mobile).
- `ClueCard`: face down shows title + location + **Examine** button; on click → `discoverClue` → GSAP 3D flip (rotateY 180°, `transform-style: preserve-3d`) revealing description; toast "+5 clue found". Already discovered cards render face up without animation. Button shows spinner while pending; double-click guarded.
- `HintsPanel`: list revealed hints ("Hint 1 of 3"); **Get a hint** → confirm modal "Hints cost 10 points. Reveal hint {n}?" → `requestHint` → append with fade-in. Disabled when `used === total` ("No hints left").
- **Make an accusation** → `/case/:id/accuse`.
- Loading: skeleton for header, story, 3 suspect cards, clue grid. Errors: `ErrorState` with mapped message + Retry; 404/403 show a full-page state with "Start a new mystery".

### 4.4 Accusation (T-16)
- Loads case via `useCase`; redirect to result if completed.
- Suspect cards selectable (`role="radio"`, arrow-key navigation), selected card gets amber ring + "Accused" stamp.
- Optional reasoning textarea (local only, shown back on results page from `sessionStorage`).
- **Accuse** disabled until a suspect is selected → confirm modal "You can accuse only once. Accuse {name}?" → `accuse(id, suspectId)` → store result in router state → `navigate('/case/' + id + '/result')`.
- 409 `CASE_ALREADY_COMPLETED` → go straight to results.

### 4.5 Results (T-16)
- Uses router state result if present, else `getResult(id)`; 409 `CASE_NOT_COMPLETED` → redirect to `/case/:id`.
- Verdict: big stamp animation ("SOLVED" moss / "UNSOLVED" blood) — GSAP scale+rotate from 1.4→1, 400 ms.
- Two cards: "You accused" vs "The culprit".
- Explanation in a paper card.
- Key clues list with ✓ Found / ✗ Missed.
- Score breakdown table with GSAP number count-up for total.
- Buttons: **New mystery** → `/create`; **My cases** (Tier 2); **Share** (Tier 3: Web Share API / copy text "I solved 'The Silent Sitar' on AI Mystery Room — 105 pts").

### 4.6 Tier 2 pages (T-17)
- `AuthContext`: `{ user, loading, login, register, logout, refresh }`, calls `GET /auth/me` on load.
- Login/Register forms with client validation mirroring server; errors inline; on success navigate back (`?next=`).
- History: table/cards of `listCases()`; status chips (Active / Solved / Unsolved); links to room or result; empty state "No cases yet — start one".
- NavBar shows display name + Logout when logged in. Guests can still play everything.

## 5. Motion rules (T-18)
- Use `@gsap/react` `useGSAP()` scoped to a ref; clean up automatically.
- `useReducedMotion()` → when true, skip timelines and render final states.
- Animations list: page enter fade/slide (200 ms), clue flip, hint fade-in, verdict stamp, score count-up, generating overlay loop, hero parallax (desktop only).
- No animation on layout-critical content before it is visible (avoid CLS).
- 3D: only Home, lazy, `dpr={[1, 1.5]}`, pause render loop when tab hidden, no post-processing.

## 6. Responsive & accessibility
- Breakpoints: base (360+), `md` 768, `lg` 1024. Test at 360×740, 768×1024, 1440×900.
- Tap targets ≥ 44 px. Sticky bottom action bar on mobile in the Investigation page.
- All interactive elements are buttons/links (no clickable divs). Visible focus ring (`focus-visible:ring-2 ring-amber`).
- `aria-live="polite"` region for toasts and hint reveals.
- Images/decorations `aria-hidden`.

## 7. Client tests (in T-19, see 05-tests)
Vitest + Testing Library on mock API: Create form validation, Investigation discover flips + progress, hint confirm flow and disabled state, Accusation confirm, Results render for correct/incorrect.

## 8. Done when (per page task)
- [ ] Works with `VITE_USE_MOCK=true` and with the real server (`AI_PROVIDERS=mock`).
- [ ] Loading, empty, error states exist and look intentional.
- [ ] No console errors/warnings in the browser.
- [ ] Usable at 360 px wide and keyboard-only.
- [ ] `npm run build` and `npm run lint` pass.

## Verify
```bash
cd client
VITE_USE_MOCK=true npm run dev          # click through the whole flow
npm run lint && npm run build
npm test
npx vite-bundle-visualizer || true      # optional: check initial JS < 300 kB gzip
```
