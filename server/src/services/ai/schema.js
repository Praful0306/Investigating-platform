import { z } from 'zod';

// Sent to the model. Gemini ignores some keywords; zod + validate.js below are the real gate.
export function jsonSchemaFor(cfg) {
  const str = (maxLength) => ({ type: 'string', maxLength });
  return {
    type: 'object',
    required: ['title', 'setting', 'crime', 'story', 'suspects', 'clues', 'hints', 'solution'],
    properties: {
      title: str(100),
      setting: str(200),
      crime: str(400),
      story: str(2500),
      suspects: {
        type: 'array',
        minItems: cfg.suspects,
        maxItems: cfg.suspects,
        items: {
          type: 'object',
          required: ['id', 'name', 'role', 'description', 'motive', 'alibi'],
          properties: { id: { type: 'string' }, name: str(60), role: str(80), description: str(500), motive: str(300), alibi: str(300) },
        },
      },
      clues: {
        type: 'array',
        minItems: cfg.clues,
        maxItems: cfg.clues,
        items: {
          type: 'object',
          required: ['id', 'title', 'location', 'description'],
          properties: { id: { type: 'string' }, title: str(80), location: str(80), description: str(600) },
        },
      },
      hints: { type: 'array', minItems: cfg.hints, maxItems: cfg.hints, items: str(300) },
      solution: {
        type: 'object',
        required: ['culpritId', 'explanation', 'keyClueIds'],
        properties: {
          culpritId: { type: 'string' },
          explanation: str(2000),
          keyClueIds: { type: 'array', items: { type: 'string' } },
        },
      },
    },
  };
}

// Mirrors the Mongoose limits in models/Case.js so an over-long string is retried, not a 500 on save.
const str = (max) => z.string().trim().min(1).max(max);

export const GeneratedCaseSchema = z.object({
  title: str(100),
  setting: str(200),
  crime: str(400),
  story: z.string().trim().min(300).max(2500),
  suspects: z.array(z.object({
    id: str(10), name: str(60), role: str(80), description: str(500), motive: str(300), alibi: str(300),
  })),
  clues: z.array(z.object({ id: str(10), title: str(80), location: str(80), description: str(600) })),
  hints: z.array(str(300)),
  solution: z.object({
    culpritId: str(10),
    explanation: z.string().trim().min(120).max(2000),
    keyClueIds: z.array(str(10)),
  }),
});
