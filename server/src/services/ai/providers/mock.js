import { ProviderError } from '../../../utils/provider-error.js';

// Deterministic, offline provider for tests and `AI_PROVIDERS=mock` dev. Culprit is always s2 (Arjun Rao).
export const MOCK_SECRET = 'MOCK_SECRET_EXPLANATION';

const SUSPECTS = [
  ['Meera Iyer', 'Festival coordinator'],
  ['Arjun Rao', 'Visiting tabla player'],
  ['Kavya Nair', 'Student volunteer'],
  ['Rohan Mehta', 'Sound engineer'],
  ['Isha Kapoor', 'College librarian'],
];
const CLUES = [
  ['Rosin smudge', 'Green room door'], ['Torn ticket', 'Back stairwell'], ['Wet footprints', 'Side corridor'],
  ['Tuning fork', 'Stage wing'], ['Pawn receipt', 'Green room bin'], ['Cracked latch', 'Storage closet'],
  ['Missing key', 'Reception desk'], ['Crumpled note', 'Practice hall'], ['Muddy glove', 'Parking lot'],
];

export function buildMockCase({ suspects, clues, hints }) {
  return {
    title: 'The Mock Mystery',
    setting: 'A mock music college, festival night',
    crime: 'A priceless instrument was stolen from the locked green room between 9:10 and 9:40 PM.',
    story: 'The festival was in full swing when the lights dipped for a moment. By the time they returned, the green room door '
      + 'stood ajar and the instrument case lay empty on the floor. Staff, students and guest artists crowded the corridor, '
      + 'each with a story about where they had been. The only certainty was the time window and a locked door that someone '
      + 'with access had opened quietly, leaving the investigators with questions about everyone in the building tonight.',
    suspects: Array.from({ length: suspects }, (_, i) => ({
      id: `s${i + 1}`,
      name: SUSPECTS[i][0],
      role: SUSPECTS[i][1],
      description: `${SUSPECTS[i][1]} who knows the building well.`,
      motive: 'Money troubles and an old grudge.',
      alibi: 'Says they were elsewhere during the window.',
    })),
    clues: Array.from({ length: clues }, (_, i) => ({
      id: `c${i + 1}`,
      title: CLUES[i][0],
      location: CLUES[i][1],
      description: `MOCK_CLUE_${i + 1}_TEXT found at the ${CLUES[i][1].toLowerCase()}, worth a closer look.`,
    })),
    hints: Array.from({ length: hints }, (_, i) => `MOCK_HINT_${i + 1}_TEXT compare the clues from the green room with the alibis.`),
    solution: {
      culpritId: 's2',
      explanation: `${MOCK_SECRET} Arjun Rao took the instrument. The rosin smudge and the pawn receipt place the visiting tabla `
        + 'player at the door and at a pawn shop, which breaks the alibi he gave and clears everyone else.',
      keyClueIds: ['c1', 'c3', 'c4'],
    },
  };
}

// modes: valid | invalid-once | invalid-always | unavailable. `calls` records every request for assertions.
export function mockProvider({ mode = 'valid', name = 'mock' } = {}) {
  const calls = [];
  return {
    name,
    model: 'mock-1',
    calls,
    async generate(args) {
      calls.push(args);
      if (mode === 'unavailable') throw new ProviderError('mock provider unavailable', 429, true);
      if (mode === 'invalid-always' || (mode === 'invalid-once' && calls.length === 1)) return '{"oops":true}';
      const p = args.jsonSchema.properties; // counts come from the schema, so every difficulty is right
      return JSON.stringify(buildMockCase({ suspects: p.suspects.minItems, clues: p.clues.minItems, hints: p.hints.minItems }));
    },
  };
}
