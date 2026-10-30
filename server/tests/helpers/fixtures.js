// Plain-object easy case shared by model and serializer tests. Contains the secret marker on purpose.
export const SECRET = 'MOCK_SECRET_EXPLANATION';

export function sampleCase(overrides = {}) {
  return {
    title: 'The Silent Sitar',
    premise: 'A priceless sitar vanishes during a college music fest',
    difficulty: 'easy',
    setting: 'Ravindra Music College, Pune — festival night',
    crime: 'The sitar was stolen from the locked green room between 9:10 and 9:40 PM.',
    story: 'A long festival night. '.repeat(20),
    suspects: [
      { id: 's1', name: 'Meera Iyer', role: 'Festival coordinator', description: 'Organised everything.', motive: 'Insurance bonus.', alibi: 'On stage 9:00-9:45.' },
      { id: 's2', name: 'Arjun Rao', role: 'Visiting tabla player', description: 'Guest artist.', motive: 'Debt.', alibi: 'Claims he was tuning.' },
      { id: 's3', name: 'Kavya Nair', role: 'Student volunteer', description: 'Runs the green room.', motive: 'Grudge.', alibi: 'At the ticket desk.' },
    ],
    clues: [
      { id: 'c1', title: 'Rosin smudge', location: 'Green room door', description: 'CLUE1_TEXT rosin on the handle.' },
      { id: 'c2', title: 'Torn ticket', location: 'Back stairwell', description: 'CLUE2_TEXT a torn backstage pass.' },
      { id: 'c3', title: 'Wet footprints', location: 'Corridor', description: 'CLUE3_TEXT size 9 shoes.' },
      { id: 'c4', title: 'Tuning fork', location: 'Stage wing', description: 'CLUE4_TEXT left behind.' },
      { id: 'c5', title: 'Receipt', location: 'Green room bin', description: 'CLUE5_TEXT pawn shop.' },
    ],
    hints: ['HINT1_TEXT look at the door.', 'HINT2_TEXT check the receipt.'],
    solution: { culpritId: 's2', explanation: `${SECRET} Arjun Rao took the sitar; the rosin and the receipt prove it.`, keyClueIds: ['c1', 'c5'] },
    playerId: '3b241101-e2bb-4255-8caf-4136c566a962',
    ...overrides,
  };
}
