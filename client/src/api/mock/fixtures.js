// Three complete, fair-play cases for mock mode (VITE_USE_MOCK=true). Same shape the server's AI pipeline produces,
// and fixtures obey the same rules the server validator enforces (api/mock/mock.test.js runs them through it):
// exact counts, ids s1..sN / c1..cN, the culprit is always s2, the hints and story never name the culprit.
import { toPublic, toResult } from './serializers.js';

const EASY = {
  title: 'The Silent Sitar',
  setting: 'Ravindra Music College, Pune — festival night',
  crime: 'The 1890s sitar was stolen from the locked green room between 9:10 and 9:40 PM.',
  story:
    'The annual Ravindra Raag Festival had drawn a full house to the old college auditorium. Backstage, the green room held the '
    + "evening's jewel: a 130-year-old sitar lent by the maestro's family, kept in a crimson velvet case behind a door that only three "
    + 'people could open. At 9:10 the lights dipped for a power flicker; by 9:40 the case lay open on the table, the velvet crushed, the '
    + 'sitar gone. Nobody saw anyone leave. The doors were watched, the windows painted shut, and every person in the building seemed to '
    + 'have somewhere else to be. Inspector Devika Kulkarni asked the festival\'s three keyholders to stay behind, and the first thing she '
    + 'noticed was how calm all of them looked.',
  suspects: [
    { id: 's1', name: 'Meera Iyer', role: 'Festival coordinator', description: 'Has run the festival for nine years and holds the master key to the green room.', motive: "The festival is losing money, and the sitar's insurance payout would cover the deficit.", alibi: 'On stage introducing the next act from 9:05 to 9:45, in front of fifty people.' },
    { id: 's2', name: 'Arjun Rao', role: 'Visiting tabla player', description: 'A charming guest artist who arrived two days early and rehearses alone in the green room.', motive: 'Owes a large sum to a collector who has asked about the sitar for years.', alibi: 'Says he stepped out for chai at the canteen at 9:10 and came back after the power flicker.' },
    { id: 's3', name: 'Kavya Nair', role: 'Student volunteer', description: 'A second-year student in charge of the green room sign-in sheet.', motive: 'Was publicly scolded by the maestro yesterday for losing a cable.', alibi: 'At the ticket desk with two other volunteers for the whole interval.' },
  ],
  clues: [
    { id: 'c1', title: 'Rosin smudge', location: 'Green room door', description: 'A fresh amber smear of rosin on the inside door handle. The college stocks none; only the visiting artists brought their own.' },
    { id: 'c2', title: 'Torn ticket', location: 'Back stairwell', description: 'Half of a backstage pass, the kind issued to student volunteers, torn along the perforation. The stub is stamped 7:12, long before the festival began.' },
    { id: 'c3', title: 'Chai ledger', location: 'Canteen', description: "The stall's handwritten ledger shows no sale to anyone between 9:00 and 9:50. The owner shut up shop for the power flicker and was out fetching gas." },
    { id: 'c4', title: 'Velvet thread', location: "Guest artists' lockers", description: "A strand of crimson velvet is caught in the zip of a visiting artist's instrument bag, the same shade as the sitar case's lining." },
    { id: 'c5', title: 'Insurance email', location: 'Festival office', description: 'A printed email in the bin: the insurer covers the sitar only if it is stolen from a locked room. It explains a motive, but the coordinator never left the stage.' },
  ],
  hints: [
    'Think about who would actually own a stick of rosin, and who in the building does not.',
    'Ask what a chai stall that was closed can and cannot prove about someone\'s alibi.',
  ],
  solution: {
    culpritId: 's2',
    explanation:
      'Arjun Rao took the sitar. His rosin on the inside door handle shows he was in the green room, the velvet thread caught in his instrument '
      + "bag matches the sitar's case lining, and the canteen ledger proves nobody could have served his chai break. Meera's insurance email is "
      + "a motive without an opportunity, and Kavya's torn pass was stamped at 7:12, hours before the theft.",
    keyClueIds: ['c1', 'c3', 'c4'],
  },
};

const MEDIUM = {
  title: 'The Poisoned Chai',
  setting: 'Deodar Homestay, Mukteshwar — a rainy evening',
  crime: 'Owner Harish Negi was taken seriously ill after his evening chai; the pot held crushed oleander leaves added between 6:20 and 6:45 PM.',
  story:
    'Rain had been hammering Mukteshwar for three days when the guests of the Deodar Homestay gathered in the lounge for the '
    + "owner's famous evening chai. Harish Negi poured the first cup for himself, as he always did, and within minutes he was gripping the "
    + 'arm of his chair, grey in the face. The village doctor arrived before a landslide cut the road, and by nine he was stable but clear '
    + 'on one point: the tea had been tampered with. Four people had been in or near the kitchen that evening, and the road would stay '
    + 'closed until morning, so whoever it was had nowhere to go. Sub-Inspector Rawat set a lantern on the lounge table and began to ask questions.',
  suspects: [
    { id: 's1', name: 'Nandini Bisht', role: "Cook and the owner's niece", description: 'Has run the kitchen for six years and knows every jar on the shelf.', motive: 'She would inherit the homestay if her uncle died.', alibi: 'Was kneading dough in plain view of the kitchen window from 6:15 to 6:50.' },
    { id: 's2', name: 'Vikram Sood', role: 'Retired tea trader and long-stay guest', description: 'Soft-spoken, and always offering opinions on how the chai should be brewed.', motive: "Harish refused to sell him the homestay's orchard, which he wanted for a resort.", alibi: 'Says he was reading in the lounge all evening and never went near the kitchen.' },
    { id: 's3', name: 'Pooja Menon', role: 'Trekking guide', description: 'Leads treks from the homestay and carries a bag of herbal remedies.', motive: 'Harish was about to cancel her contract after a guest complaint.', alibi: 'Was fixing a tent flap in the courtyard until 6:40, then joined the lounge.' },
    { id: 's4', name: 'Tenzin Dorji', role: 'Handyman', description: 'Repairs everything from drains to the generator.', motive: 'Has not been paid for two months.', alibi: 'Was in the generator shed checking the diesel, which his logbook supports.' },
  ],
  clues: [
    { id: 'c1', title: 'Cut oleander', location: 'Veranda flower bed', description: 'Fresh cuts on the oleander bush by the veranda, leaves stripped from the side nearest the lounge window. The soil around it is red clay.' },
    { id: 'c2', title: 'Clay-caked slippers', location: 'Lounge radiator', description: 'A pair of guest slippers left to dry, soaked through and smeared with red clay. The paths and courtyard here are gravel; only the veranda bed has red clay.' },
    { id: 'c3', title: 'Reading glasses', location: 'Kitchen counter', description: 'Tortoiseshell reading glasses folded beside the chai pot. Only two people in the house wear reading glasses: the owner, and the guest who loves to read in the lounge.' },
    { id: 'c4', title: 'Recipe card', location: 'Kitchen shelf', description: "The cook's handwritten card lists only ginger, cardamom and tulsi, with a note that the pot must never be left unattended. She kneaded dough by the window all evening." },
    { id: 'c5', title: 'Herb bag', location: "Trekking guide's room", description: "A pharmacist's tag identifies the dried herbs as mint and chamomile. Nothing in the bag is harmful." },
    { id: 'c6', title: 'Generator log', location: 'Generator shed', description: "The handyman's logbook is signed every ten minutes from 6:15 to 6:50 and countersigned by the diesel delivery driver." },
    { id: 'c7', title: 'Resort letter', location: 'Lounge writing desk', description: 'A crumpled letter from a resort developer to a long-stay guest, dated last week: the homestay orchard is the last obstacle to the deal.' },
  ],
  hints: [
    'Ask where red clay actually exists on this property.',
    'Two clues put the same person in the kitchen even though they claim never to have left the lounge.',
    'Compare the garden side of the veranda with the footwear left drying by the radiator.',
  ],
  solution: {
    culpritId: 's2',
    explanation:
      'Vikram Sood poisoned the chai. He claimed he never left the lounge, yet his slippers are caked in red clay found only in the veranda flower bed '
      + 'where the oleander was cut, and his reading glasses were left beside the pot in the kitchen. Nandini, Pooja and Tenzin are cleared by the recipe '
      + 'card, the herb bag and the generator log, and the resort letter gives Vikram the motive.',
    keyClueIds: ['c1', 'c2', 'c3'],
  },
};

const HARD = {
  title: 'The Last Scene',
  setting: 'Film City, Goregaon — night shoot on a replica Mumbai local train',
  crime: "The only copy of the day's final scene, a rugged drive in a sealed case, vanished from the production van between 1:05 and 1:40 AM.",
  story:
    'At one in the morning the replica local train in Studio 7 finally stopped rocking. The director had wrapped the most expensive scene of the '
    + "film, and the footage sat on a single rugged drive: sealed in a case, locked in the production van, waiting for the dawn courier. "
    + 'Between 1:05 and 1:40 the lot went dark for a generator swap, and when the lights returned the case in the van looked untouched. The seal was '
    + 'intact, the code lock secure, and yet the drive inside was a blank dummy. Five people had been close enough to matter, each with a tidy '
    + 'story about where they were, and the studio wanted answers before the sun came up.',
  suspects: [
    { id: 's1', name: 'Ishaan Pillai', role: 'Assistant director', description: 'Runs the set like a stopwatch and knew the code to the van case.', motive: "Was blamed by the studio for last week's schedule overrun.", alibi: 'On the roof lighting rig, texting the director at 1:15.' },
    { id: 's2', name: 'Rhea Malhotra', role: 'Line producer', description: 'Calm and meticulous. She controls the budget, the tamper seals and the insurance paperwork.', motive: 'Her company is behind on loans and the film is badly over budget.', alibi: 'On an audio call with the studio in Dubai from 1:00 to 1:45, from her office desk.' },
    { id: 's3', name: 'Dev Chandra', role: 'Lead actor', description: 'Has famously clashed with the director over the final scene.', motive: 'Wanted the scene reshot because he hated his own performance.', alibi: 'Napping in his locked trailer from 12:50 to 2:10.' },
    { id: 's4', name: 'Sana Qureshi', role: 'Digital imaging technician', description: 'Owns the backup workflow and the rugged drive.', motive: 'Faces the blame if footage is lost, and a bonus if the backup succeeds.', alibi: 'Was babysitting a data copy at her workstation.' },
    { id: 's5', name: 'Manoj Tiwari', role: 'Night security guard', description: 'Twenty years at Film City and knows every shortcut.', motive: 'A rival studio once offered him cash for early footage.', alibi: 'Logged at Gate 3, then walking his rounds with a partner.' },
  ],
  clues: [
    { id: 'c1', title: 'Intact seal', location: 'Production van', description: 'The tamper seal on the case is unbroken, but its serial number, 0417, is not one of the seals logged as used that day. Someone replaced it with a matching one.' },
    { id: 'c2', title: 'Hotspot log', location: 'Production office router', description: "The router shows a producer's phone joined the van's private hotspot at 1:07 AM and stayed until 1:38, while its owner claims to have been at her office desk." },
    { id: 'c3', title: 'Audio-only call', location: 'Studio call log', description: 'The Dubai call lasted 45 minutes, but it was audio-only. Nobody on the call ever saw anyone at a desk.' },
    { id: 'c4', title: 'Seal register', location: 'Production office', description: 'The register of numbered tamper seals is kept only by the line producer. Seal 0417 is marked as never issued.' },
    { id: 'c5', title: 'Trailer lock log', location: "Lead actor's trailer", description: 'The smart lock shows the door was shut from 12:50 and not opened until 2:10.' },
    { id: 'c6', title: 'Gate sheet', location: 'Gate 3', description: 'No vehicle and no one carrying a case left the lot between midnight and 2:30, so the drive never left Film City.' },
    { id: 'c7', title: 'Failed backup', location: "Imaging technician's workstation", description: 'A copy of the scene began at 12:58 and failed at 1:02 with a power-glitch error, leaving the original as the only copy.' },
    { id: 'c8', title: 'Rooftop location ping', location: "Assistant director's phone", description: 'Location data places the phone on the roof rig from 1:00 to 1:30, and the 1:15 text to the director matches.' },
    { id: 'c9', title: 'Insurance rider', location: 'Studio paperwork', description: "A cover note says lost footage triggers a payout to the line producer's company, not to the studio." },
  ],
  hints: [
    'A seal that looks untouched is only as trustworthy as the person who could have supplied it.',
    'Compare where one person says they were with what their phone was quietly connected to.',
    'Count how many people could have used a seal that, on paper, was never handed out.',
  ],
  solution: {
    culpritId: 's2',
    explanation:
      "Rhea Malhotra took the drive. The replacement seal on the case, number 0417, was never issued according to the register that only she keeps; "
      + "her phone was on the van's hotspot between 1:07 and 1:38 while she claimed to be on a video call from her office; and the Dubai call was "
      + 'audio-only, so nobody ever saw her at her desk. Dev, Manoj, Ishaan and Sana are each cleared by the trailer lock log, the gate sheet, '
      + 'the rooftop location data and the failed backup.',
    keyClueIds: ['c2', 'c3', 'c4'],
  },
};

const CASES = { easy: EASY, medium: MEDIUM, hard: HARD };

// The private, generated shape (what the server's AI pipeline returns). Deep copy: callers may mutate it.
export function buildMockCase(difficulty) {
  return structuredClone(CASES[difficulty] ?? EASY);
}

// ---- the SPEC examples, built from the same story so the docs, the mock and the tests tell one story ----

const exampleDoc = {
  _id: '6720c1f0a1b2c3d4e5f60718',
  ...buildMockCase('easy'),
  premise: 'A priceless sitar vanishes during a college music fest',
  difficulty: 'easy',
  progress: { discoveredClueIds: ['c1'], hintsUsed: 1 },
  status: 'active',
  createdAt: '2026-10-31T10:00:00.000Z',
};

// SPEC §5.3: one clue discovered, one hint used.
export const PUBLIC_CASE_EXAMPLE = toPublic(exampleDoc);

// SPEC §5.4: solved with 3 clues and 1 hint (c1, c2, c3 found).
export const RESULT_EXAMPLE = toResult({
  ...exampleDoc,
  progress: { discoveredClueIds: ['c1', 'c2', 'c3'], hintsUsed: 1 },
  status: 'solved',
  accusation: { suspectId: 's2', correct: true, submittedAt: '2026-10-31T10:12:00.000Z' },
  score: { base: 100, clueBonus: 15, hintPenalty: 10, total: 105 },
  completedAt: '2026-10-31T10:12:00.000Z',
});
