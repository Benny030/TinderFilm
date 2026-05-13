// ─── Genera codici tipo "MAPLE-73" o "CLOUD-51" ───────────────────────────────

const words = [
  'MAPLE', 'CLOUD', 'TIGER', 'PIXEL', 'SOLAR',
  'FROST', 'EMBER', 'CORAL', 'STONE', 'LUNAR',
  'CEDAR', 'PRISM', 'FLINT', 'GROVE', 'BLAZE',
  'OCEAN', 'CRISP', 'DRIFT', 'FLARE', 'GLADE',
  'HAVEN', 'INKLE', 'JOLLY', 'KNACK', 'LUMEN',
  'MOCHI', 'NOBLE', 'OAKEN', 'PLUME', 'QUIRK',
  'RAVEN', 'SWIFT', 'TIDAL', 'UMBRA', 'VIVID',
  'WALTZ', 'XYLEM', 'YACHT', 'ZIPPY', 'AMBER',
];

export function generateRoomCode(): string {
  const word = words[Math.floor(Math.random() * words.length)];
  const num = Math.floor(Math.random() * 90) + 10;
  return `${word}-${num}`;
}

// ─── Normalizza il codice inserito dall'utente ────────────────────────────────
export function normalizeRoomCode(input: string): string {
  return input.trim().toUpperCase().replace(/\s+/g, '');
}