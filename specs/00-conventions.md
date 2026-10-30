# 00 — Conventions, scaffold and shared contract rules

## 1. Final folder structure
```
ai-mystery-room/
├── SPEC.md  AGENTS.md  CLAUDE.md  TASKS.md  README.md  .gitignore
├── specs/
├── prompts/
├── client/
│   ├── index.html  vite.config.js  vercel.json  package.json  .env.example
│   ├── playwright.config.js
│   ├── e2e/                       # Playwright specs
│   └── src/
│       ├── main.jsx  App.jsx  index.css
│       ├── api/        http.js cases.js auth.js mock/ (fixtures + mock adapter)
│       ├── config/     difficulty.js (display copy of SPEC §7.1)
│       ├── context/    AuthContext.jsx
│       ├── hooks/      useCase.js useHealthWake.js useReducedMotion.js
│       ├── components/ layout/ ui/ case/ effects/
│       ├── pages/      Home.jsx CreateMystery.jsx Investigation.jsx Accusation.jsx Results.jsx
│       │               Login.jsx Register.jsx History.jsx NotFound.jsx
│       └── test/       setup.js + *.test.jsx
└── server/
    ├── package.json  .env.example  vitest.config.js
    ├── scripts/        smoke.mjs  seed-demo.mjs (optional)
    ├── src/
    │   ├── index.js            # loads env, connects DB, app.listen
    │   ├── app.js              # createApp(): middleware + routes, no listen (testable)
    │   ├── config/  env.js difficulty.js
    │   ├── db/      connect.js
    │   ├── models/  Case.js User.js
    │   ├── routes/  health.js cases.js auth.js
    │   ├── controllers/ cases.controller.js auth.controller.js
    │   ├── services/    case.service.js scoring.js auth.service.js
    │   │   └── ai/      index.js prompt.js schema.js validate.js
    │   │       └── providers/ gemini.js openai-compat.js mock.js
    │   ├── serializers/ case.serializer.js
    │   ├── middleware/  player.js auth.js rate-limit.js validate.js error.js turnstile.js
    │   └── utils/       app-error.js sanitize.js
    └── tests/
        ├── helpers/ db.js app.js
        ├── unit/    scoring.test.js validate.test.js serializer.test.js prompt.test.js
        └── api/     cases.test.js security.test.js auth.test.js
```

## 2. Scaffold commands (T-01)
```bash
mkdir ai-mystery-room && cd ai-mystery-room && git init
# client
npm create vite@latest client -- --template react
cd client
npm install
npm install react-router-dom axios gsap @gsap/react firebase
npm install -D tailwindcss @tailwindcss/vite vitest @testing-library/react @testing-library/jest-dom @testing-library/user-event jsdom @playwright/test
cd ..
# server
mkdir server && cd server && npm init -y
npm install express cors dotenv mongoose @google/genai zod helmet cookie-parser express-rate-limit jose
npm install -D nodemon vitest supertest mongodb-memory-server
cd ..
```
Optional (Tier 3, Home 3D only): `npm i three @react-three/fiber @react-three/drei` in client.

`server/package.json` essentials:
```json
{
  "type": "module",
  "engines": { "node": ">=20" },
  "scripts": {
    "dev": "nodemon src/index.js",
    "start": "node src/index.js",
    "test": "vitest run",
    "test:watch": "vitest",
    "check": "node --check src/index.js && node --check src/app.js"
  }
}
```
`client/vite.config.js`:
```js
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: { proxy: { '/api': 'http://localhost:5000' } },
  test: { environment: 'jsdom', setupFiles: './src/test/setup.js', exclude: ['e2e/**', 'node_modules/**'] },
});
```
`client/src/index.css` starts with `@import "tailwindcss";` then `@theme { … }` tokens (see 04-frontend).

Root `.gitignore`:
```
node_modules/
.env
.env.*
!.env.example
dist/
coverage/
playwright-report/
test-results/
.vercel
```

## 3. Git flow for multiple AI tools
- `main` is always deployable. Each task = branch `t-XX-short-name`, merged by PR (or fast-forward if solo).
- Parallel lanes don't touch each other's folders: **Backend lane** owns `server/`, **Frontend lane** owns `client/`. Only the integrator edits `SPEC.md`, `TASKS.md` statuses can be ticked by anyone.
- Pull `main` before starting each task. Rebase, don't merge `main` into task branches.
- Commit message: `T-XX: summary`. One task per PR.

## 4. Shared contract rule
The JSON shapes in SPEC §5 are the contract. The frontend mock fixtures in `client/src/api/mock/fixtures.js` must be literally the same shapes. Any change → SPEC first → both lanes update.

## 5. Error class (server)
```js
// server/src/utils/app-error.js
export class AppError extends Error {
  constructor(code, status, message, details) {
    super(message); this.code = code; this.status = status; this.details = details;
  }
}
```
