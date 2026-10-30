// "Mary Ann Lee" -> "ML". One word -> one letter. Works on any script (Array.from keeps whole characters).
export function initialsOf(name) {
  const words = String(name).trim().split(/\s+/).filter(Boolean).map((w) => Array.from(w));
  if (words.length === 0) return '?';
  const last = words.length > 1 ? words[words.length - 1][0] : '';
  return (words[0][0] + last).toUpperCase();
}

const SLOTS = 5; // a case has at most five suspects
const BAND = 360 / SLOTS; // 72 degrees of the colour wheel per suspect
const MARGIN = 24; // keep clear of the band edges, so neighbours are always visibly different

function hashOf(name) {
  let h = 0;
  for (const ch of String(name)) h = (h * 31 + ch.codePointAt(0)) % 360;
  return h;
}

// A stable hue (0-359) for a name. The same name always gets the same colour, so a suspect looks the same everywhere.
// With `slot` (the suspect's position in the case) the hue is chosen inside that suspect's own band of the colour wheel:
// still seeded by the name, but two suspects in one case can never end up with near-identical avatars.
export function hueOf(name, slot) {
  const h = hashOf(name);
  if (slot === undefined) return h;
  return (slot % SLOTS) * BAND + MARGIN + (h % (BAND - 2 * MARGIN));
}
