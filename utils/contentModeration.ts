export type ModerationField =
  | 'username'
  | 'bio'
  | 'review'
  | 'comment'
  | 'generic';

export type ModerationResult = {
  allowed: boolean;
  reason:
    | 'ok'
    | 'blocked_term'
    | 'invalid_username'
    | 'empty'
    | 'too_long';
  /** Solo per logging/telemetria interna: mai mostrare all'utente. */
  matchedCategory?: string;
};

// ---------------------------------------------------------------------------
// Normalizzazione
// ---------------------------------------------------------------------------

const LEET_MAP: Record<string, string> = {
  '0': 'o',
  '1': 'i',
  '2': 'z',
  '3': 'e',
  '4': 'a',
  '5': 's',
  '6': 'g',
  '7': 't',
  '8': 'b',
  '9': 'g',
  '@': 'a',
  '$': 's',
  '!': 'i',
  '+': 't',
  '|': 'i',
};

// Lettere Unicode "omografe" che assomigliano a lettere latine
// (cirillico, greco, ecc.) usate spesso per aggirare i filtri.
const HOMOGLYPH_MAP: Record<string, string> = {
  'а': 'a', 'е': 'e', 'о': 'o', 'р': 'p', 'с': 'c', 'у': 'y',
  'х': 'x', 'ѕ': 's', 'і': 'i', 'ј': 'j', 'ԁ': 'd', 'ᴀ': 'a',
  'α': 'a', 'ο': 'o', 'ρ': 'p', 'υ': 'u', 'ε': 'e', 'κ': 'k',
};

// Caratteri invisibili / di controllo spesso inseriti tra le lettere
// per spezzare le parole agli occhi del filtro ma non a quelli umani.
const INVISIBLE_CHARS_RE =
  /[\u200B-\u200F\u202A-\u202E\u2060\uFEFF\u00AD]/g;

function stripInvisible(value: string) {
  return value.replace(INVISIBLE_CHARS_RE, '');
}

function normalizeHomoglyphs(value: string) {
  return value.replace(/./g, (ch) => HOMOGLYPH_MAP[ch] ?? ch);
}

function stripDiacritics(value: string) {
  return value.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}

function collapseRepeats(value: string) {
  return value.replace(/(.)\1{2,}/g, '$1$1');
}

function applyLeet(value: string) {
  return value
    .split('')
    .map((char) => LEET_MAP[char] ?? char)
    .join('');
}

function compact(value: string) {
  return value.replace(/[^a-z0-9]/g, '');
}

export function normalizeForModeration(value: string) {
  const cleaned = normalizeHomoglyphs(stripInvisible(value));
  const lower = stripDiacritics(cleaned.toLowerCase());
  const leet = applyLeet(lower);
  const repeated = collapseRepeats(leet);

  return {
    spaced: repeated
      .replace(/[_\-./\\|*~^]+/g, ' ')
      .replace(/\s+/g, ' ')
      .trim(),
    compact: compact(repeated),
  };
}

// ---------------------------------------------------------------------------
// Liste dei termini (organizzate per categoria per facilitare la manutenzione)
// ---------------------------------------------------------------------------

const BLASPHEMY_TERMS = [
  'porcodio', 'porcoddio', 'porcamadonna', 'dio cane', 'diocane',
  'dio porco', 'dioporco', 'madonna puttana', 'gesu porco', 'gesuporco',
  'dio boia', 'dioboia', 'madonna troia',
];

const INSULT_TERMS = [
  'figlio di puttana', 'figliodiputtana', 'pezzo di merda', 'pezzodimerda',
  'vai a fanculo', 'vaffanculo', 'coglione', 'coglioni', 'stronzo', 'stronza',
  'merda', 'puttana', 'troia', 'bastardo', 'bastarda', 'idiota di merda',
  'testa di cazzo', 'testadicazzo', 'leccaculo', 'faccia di culo',
  'facciadiculo', 'succhiacazzi', 'bocchinaro', 'bocchinara',
];

const SLUR_TERMS = [
  // slur omofobi/transfobici
  'frocio', 'frocia', 'ricchione', 'culattone', 'finocchio',
  // slur razzisti/etnici
  'negro', 'negra', 'terrone', 'zingaro', 'zingara',
  // slur abilisti
  'mongoloide', 'ritardato', 'ritardata', 'spastico', 'spastica',
];

const SEXUAL_TERMS = [
  'cazzo', 'cazzi', 'minchia', 'minchione', 'culo', 'pene', 'fica', 'figa',
  'tette', 'vagina', 'sborra', 'sborrata', 'pompino', 'scopare', 'trombare',
];

const HARD_BLOCK_TERMS: Array<{ term: string; category: string }> = [
  ...BLASPHEMY_TERMS.map((term) => ({ term, category: 'blasphemy' })),
  ...INSULT_TERMS.map((term) => ({ term, category: 'insult' })),
  ...SLUR_TERMS.map((term) => ({ term, category: 'slur' })),
];

const USERNAME_EXTRA_BLOCK_TERMS: Array<{ term: string; category: string }> =
  SEXUAL_TERMS.map((term) => ({ term, category: 'sexual' }));

// Parole legittime che potrebbero generare falsi positivi: aggiungi qui
// eventuali eccezioni scoperte in produzione (case-insensitive, forma "compact").
const ALLOWLIST_COMPACT = new Set<string>([
  // esempio: 'scultore', // conterrebbe "culo"? no, ma tienilo come modello
]);

// ---------------------------------------------------------------------------
// Matching
// ---------------------------------------------------------------------------

type NormalizedTerm = {
  term: string;
  category: string;
  spaced: string;
  compact: string;
};

function precompute(
  list: Array<{ term: string; category: string }>,
): NormalizedTerm[] {
  return list.map(({ term, category }) => {
    const normalized = normalizeForModeration(term);
    return { term, category, ...normalized };
  });
}

// Calcolati una sola volta al caricamento del modulo, non ad ogni chiamata.
const HARD_BLOCK_NORMALIZED = precompute(HARD_BLOCK_TERMS);
const USERNAME_EXTRA_NORMALIZED = precompute(USERNAME_EXTRA_BLOCK_TERMS);

function isAllowlisted(text: ReturnType<typeof normalizeForModeration>) {
  return ALLOWLIST_COMPACT.has(text.compact);
}

function findMatch(
  text: ReturnType<typeof normalizeForModeration>,
  terms: NormalizedTerm[],
): NormalizedTerm | undefined {
  if (isAllowlisted(text)) return undefined;

  return terms.find(({ spaced, compact: compactTerm }) => {
    // Confine di parola sulla versione "spaziata" per ridurre i falsi
    // positivi (es. la sottostringa non deve trovarsi dentro un'altra parola).
    if (spaced && ` ${text.spaced} `.includes(` ${spaced} `)) {
      return true;
    }

    // Sottostringa sulla versione "compatta" per intercettare i tentativi
    // di elusione tramite rimozione di spazi/punteggiatura.
    if (compactTerm && text.compact.includes(compactTerm)) {
      return true;
    }

    return false;
  });
}

// ---------------------------------------------------------------------------
// API pubblica
// ---------------------------------------------------------------------------

export function moderateText(
  value: string,
  field: ModerationField = 'generic',
): ModerationResult {
  const trimmed = value.trim();

  if (!trimmed) {
    return {
      allowed: field === 'bio' || field === 'generic',
      reason: 'empty',
    };
  }

  if (field === 'username') {
    const username = trimmed.toLowerCase();

    if (!/^[a-z0-9_]{3,20}$/.test(username)) {
      return {
        allowed: false,
        reason: 'invalid_username',
      };
    }
  }

  if (field === 'bio' && trimmed.length > 240) {
    return {
      allowed: false,
      reason: 'too_long',
    };
  }

  if (
    (field === 'review' || field === 'comment') &&
    trimmed.length > 5000
  ) {
    return {
      allowed: false,
      reason: 'too_long',
    };
  }

  const normalized = normalizeForModeration(trimmed);
  const terms =
    field === 'username'
      ? [...HARD_BLOCK_NORMALIZED, ...USERNAME_EXTRA_NORMALIZED]
      : HARD_BLOCK_NORMALIZED;

  const match = findMatch(normalized, terms);

  if (match) {
    return {
      allowed: false,
      reason: 'blocked_term',
      matchedCategory: match.category,
    };
  }

  return {
    allowed: true,
    reason: 'ok',
  };
}

export function moderationMessage(
  result: ModerationResult,
  field: ModerationField,
) {
  if (result.allowed) return '';

  if (result.reason === 'invalid_username') {
    return 'Usa solo lettere minuscole, numeri e _ (3–20 caratteri).';
  }

  if (result.reason === 'too_long') {
    return field === 'bio'
      ? 'La biografia può contenere al massimo 240 caratteri.'
      : 'Il testo è troppo lungo.';
  }

  if (result.reason === 'empty') {
    return 'Questo campo non può essere vuoto.';
  }

  return 'Questo contenuto contiene termini non consentiti. Modificalo per continuare.';
}