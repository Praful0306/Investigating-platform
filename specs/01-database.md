# 01 — Database spec (MongoDB Atlas + Mongoose)

Source of truth: SPEC §6. This file gives build steps.

## 1. Atlas setup (human, 10 min, T-02)
1. Create one free Atlas account → project `ai-mystery-room` → **M0** cluster (region closest to your backend host, e.g. AWS Mumbai `ap-south-1` or Singapore).
2. Database Access → user `mystery_app` with a generated password, role *Read and write to any database* (or scoped to db `mysteryroom`).
3. Network Access → add `0.0.0.0/0` (free hosts don't have static IPs). Strong password compensates.
4. Connect → Drivers → copy URI, add db name: `mongodb+srv://mystery_app:<pw>@cluster0.xxxx.mongodb.net/mysteryroom?retryWrites=true&w=majority`.
5. Put it in `server/.env` as `MONGODB_URI`. Never commit it.

## 2. Connection — `server/src/db/connect.js`
```js
import mongoose from 'mongoose';
mongoose.set('strictQuery', true);
// NOTE: do NOT enable mongoose.set('sanitizeFilter', true) globally: it also wraps our own guard
// operators ($lt, $size) in $eq and silently breaks the atomic updates in §5. Operator injection is
// prevented instead by zod: every client value reaching a filter is a regex-checked string.
export async function connectDB(uri) {
  await mongoose.connect(uri, { serverSelectionTimeoutMS: 10000, maxPoolSize: 10 });
  return mongoose.connection;
}
export function dbState() { return mongoose.connection.readyState === 1 ? 'up' : 'down'; }
```
`index.js` exits with code 1 and a clear message if the connection fails at boot.

## 3. Case model — `server/src/models/Case.js`
```js
import mongoose from 'mongoose';
const { Schema } = mongoose;

const SuspectSchema = new Schema({
  id: { type: String, required: true, match: /^s\d$/ },
  name: { type: String, required: true, maxlength: 60 },
  role: { type: String, required: true, maxlength: 80 },
  description: { type: String, required: true, maxlength: 500 },
  motive: { type: String, required: true, maxlength: 300 },
  alibi: { type: String, required: true, maxlength: 300 },
}, { _id: false });

const ClueSchema = new Schema({
  id: { type: String, required: true, match: /^c\d{1,2}$/ },
  title: { type: String, required: true, maxlength: 80 },
  location: { type: String, required: true, maxlength: 80 },
  description: { type: String, required: true, maxlength: 600 },
}, { _id: false });

const CaseSchema = new Schema({
  title: { type: String, required: true, maxlength: 100 },
  premise: { type: String, required: true, minlength: 10, maxlength: 300 },
  difficulty: { type: String, enum: ['easy', 'medium', 'hard'], required: true },
  setting: { type: String, required: true, maxlength: 200 },
  crime: { type: String, required: true, maxlength: 400 },
  story: { type: String, required: true, maxlength: 4000 },
  suspects: { type: [SuspectSchema], required: true },
  clues: { type: [ClueSchema], required: true },
  hints: { type: [String], required: true },
  solution: {
    type: new Schema({
      culpritId: { type: String, required: true },
      explanation: { type: String, required: true, maxlength: 2000 },
      keyClueIds: { type: [String], required: true },
    }, { _id: false }),
    required: true,
    select: false,                       // <-- SECRET. Must use .select('+solution') to read.
  },
  progress: {
    discoveredClueIds: { type: [String], default: [] },
    hintsUsed: { type: Number, default: 0, min: 0 },
  },
  status: { type: String, enum: ['active', 'solved', 'failed'], default: 'active', index: true },
  accusation: {
    type: new Schema({ suspectId: String, correct: Boolean, submittedAt: Date }, { _id: false }),
    default: null,
  },
  score: {
    type: new Schema({ base: Number, clueBonus: Number, hintPenalty: Number, total: Number }, { _id: false }),
    default: null,
  },
  playerId: { type: String, required: true, index: true },
  userId: { type: Schema.Types.ObjectId, ref: 'User', default: null, index: true },
  ai: { type: { provider: String, model: String, attempts: Number, latencyMs: Number }, select: false },
  completedAt: { type: Date, default: null },
}, { timestamps: true, strict: true });

CaseSchema.index({ playerId: 1, createdAt: -1 });
CaseSchema.index({ userId: 1, createdAt: -1 });
CaseSchema.index({ status: 1, difficulty: 1, 'score.total': -1 });

// Defence in depth: even if someone calls toJSON on a doc, solution & ai never serialize.
CaseSchema.set('toJSON', { transform: (_doc, ret) => { delete ret.solution; delete ret.ai; return ret; } });

export const Case = mongoose.model('Case', CaseSchema);
```

## 4. User model (Tier 2) — `server/src/models/User.js`
```js
const UserSchema = new Schema({
  email: { type: String, required: true, unique: true, lowercase: true, trim: true, maxlength: 254 },
  passwordHash: { type: String, required: true, select: false },
  displayName: { type: String, required: true, minlength: 2, maxlength: 30, trim: true },
}, { timestamps: true });
UserSchema.set('toJSON', { transform: (_d, r) => { delete r.passwordHash; return r; } });
```

## 5. Atomic state transitions (repository functions in `case.service.js`)
All game mutations are single `findOneAndUpdate` calls with guard conditions. Never read-modify-save.

| Action | Filter | Update |
|---|---|---|
| discover | `{ _id, status: 'active', 'clues.id': clueId }` | `{ $addToSet: { 'progress.discoveredClueIds': clueId } }` |
| hint | `{ _id, status: 'active', 'progress.hintsUsed': { $lt: hintsTotal } }` | `{ $inc: { 'progress.hintsUsed': 1 } }` (return `new: true`, revealed index = hintsUsed − 1) |
| accuse | `{ _id, status: 'active' }` | `{ $set: { status, accusation, score, completedAt } }` |
| claim (login) | `{ playerId, userId: null }` | `{ $set: { userId } }` via `updateMany` |

If the guarded update returns `null`, re-read the case to pick the right error (`CASE_NOT_FOUND`, `CASE_ALREADY_COMPLETED`, `NO_HINTS_LEFT`, `CLUE_NOT_FOUND`).
Accuse flow: (1) load case with `+solution` and owner check, (2) compute correct + score from the loaded progress, (3) guarded update with filter `{ _id, status: 'active', 'progress.hintsUsed': loaded.hintsUsed, 'progress.discoveredClueIds': { $size: loaded.discoveredCount } }`, so a concurrent hint/discover can't slip in between; if null → re-read and return 409 (or retry once if still active).

## 6. Data size & retention (small scale)
- One case ≈ 6–12 kB. 512 MB M0 ≈ 40k cases — far beyond need.
- Optional: TTL cleanup of abandoned guest cases: add `expiresAt` (createdAt + 30 days) with `{ expireAfterSeconds: 0 }` index, only when `userId` is null. Not required for MVP.

## 7. Test DB
`server/tests/helpers/db.js` starts `MongoMemoryServer`, connects, clears collections `afterEach`, stops `afterAll`. Tests never touch Atlas.

## 8. Done when (T-04)
- [ ] `Case` and `User` models exist exactly as above.
- [ ] `Case.findById(id)` result has no `solution` field; `Case.findById(id).select('+solution')` does.
- [ ] `JSON.stringify(caseDoc)` never includes `solution` or `ai`.
- [ ] Unit test `tests/unit/model.test.js` proves the two points above and that `difficulty: 'extreme'` fails validation.

## Verify
```bash
cd server && npx vitest run tests/unit/model.test.js
```
