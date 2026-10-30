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
    select: false, // SECRET. Must use .select('+solution') to read.
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
  userId: { type: String, default: null, index: true }, // the Firebase uid of the signed-in owner
  ai: { type: { provider: String, model: String, attempts: Number, latencyMs: Number }, select: false },
  completedAt: { type: Date, default: null },
}, { timestamps: true, strict: true });

CaseSchema.index({ playerId: 1, createdAt: -1 });
CaseSchema.index({ userId: 1, createdAt: -1 });
CaseSchema.index({ status: 1, difficulty: 1, 'score.total': -1 });

// Defence in depth: even if someone calls toJSON on a doc, solution & ai never serialize.
CaseSchema.set('toJSON', {
  transform: (_doc, ret) => {
    delete ret.solution;
    delete ret.ai;
    return ret;
  },
});

export const Case = mongoose.model('Case', CaseSchema);
