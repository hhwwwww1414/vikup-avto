/**
 * Russian license plate normalization and validation.
 *
 * Standard passenger plate format:  L DDD LL RR(R)
 *   position 1     = letter
 *   positions 2-4  = digits
 *   positions 5-6  = letters
 *   positions 7-9  = region digits (2 or 3)
 *
 * Only the 12 letters that are visually shared between Cyrillic and Latin are
 * valid on Russian plates. We store the CYRILLIC canonical form in the DB.
 */

// Canonical Cyrillic letters allowed on RU plates.
export const RU_PLATE_LETTERS = ["А", "В", "Е", "К", "М", "Н", "О", "Р", "С", "Т", "У", "Х"] as const;

// Map look-alike Latin letters -> canonical Cyrillic.
const LATIN_TO_CYRILLIC: Record<string, string> = {
  A: "А",
  B: "В",
  E: "Е",
  K: "К",
  M: "М",
  H: "Н",
  O: "О",
  P: "Р",
  C: "С",
  T: "Т",
  Y: "У",
  X: "Х",
};

const CYRILLIC_LETTER_SET = new Set<string>(RU_PLATE_LETTERS);

// Digits that are commonly confused with letters (and vice-versa).
const DIGIT_TO_LETTER: Record<string, string> = {
  "0": "О",
  "8": "В",
  "1": "Т",
};
// Keys are canonical Cyrillic (input is canonicalized before this map is used).
const LETTER_TO_DIGIT: Record<string, string> = {
  О: "0",
  В: "8",
  Т: "1",
};

/**
 * Convert any look-alike Latin letter to its canonical Cyrillic letter and
 * uppercase everything. Leaves digits untouched. Removes spaces & separators.
 */
export function toCanonicalChars(input: string): string {
  const upper = input.toUpperCase();
  let out = "";
  for (const ch of upper) {
    if (LATIN_TO_CYRILLIC[ch]) {
      out += LATIN_TO_CYRILLIC[ch];
    } else if (CYRILLIC_LETTER_SET.has(ch) || /[0-9]/.test(ch)) {
      out += ch;
    } else if (ch === " " || ch === "-" || ch === "\t") {
      // skip separators
    } else {
      // Unknown character (other Cyrillic letters, punctuation) -> keep so that
      // validation can reject it. Uppercased already.
      out += ch;
    }
  }
  return out;
}

/**
 * Normalize free-form user search input: strip spaces, uppercase, map latin
 * look-alikes to Cyrillic. Used both for storing plates and for search queries.
 */
export function normalizePlateInput(input: string): string {
  return toCanonicalChars(input).replace(/[^0-9А-Я]/g, "");
}

const PLATE_REGEX = /^([АВЕКМНОРСТУХ])(\d{3})([АВЕКМНОРСТУХ]{2})(\d{2,3})$/;

/**
 * Apply position-aware OCR correction to a canonicalized 8-9 char string.
 * Positions that must be letters get digit->letter fixes; positions that must
 * be digits get letter->digit fixes. Only applied where it fits the format.
 */
export function contextCorrect(canonical: string): string | null {
  const s = canonical;
  // Expect length 8 (2-digit region) or 9 (3-digit region).
  if (s.length !== 8 && s.length !== 9) return null;

  const chars = s.split("");

  const fixToLetter = (c: string): string => {
    if (CYRILLIC_LETTER_SET.has(c)) return c;
    return DIGIT_TO_LETTER[c] ?? c;
  };
  const fixToDigit = (c: string): string => {
    if (/[0-9]/.test(c)) return c;
    return LETTER_TO_DIGIT[c] ?? c;
  };

  // pos 0: letter
  chars[0] = fixToLetter(chars[0]);
  // pos 1-3: digits
  chars[1] = fixToDigit(chars[1]);
  chars[2] = fixToDigit(chars[2]);
  chars[3] = fixToDigit(chars[3]);
  // pos 4-5: letters
  chars[4] = fixToLetter(chars[4]);
  chars[5] = fixToLetter(chars[5]);
  // pos 6+: region digits
  for (let i = 6; i < chars.length; i++) {
    chars[i] = fixToDigit(chars[i]);
  }

  return chars.join("");
}

export interface PlateResult {
  normalized: string; // e.g. О101НТ790
  display: string; // e.g. О101НТ 790
}

/**
 * Take a raw OCR string, canonicalize, context-correct, and validate against
 * the standard Russian passenger-plate format. Returns null if invalid.
 */
export function parseRussianPlate(raw: string): PlateResult | null {
  const canonical = normalizePlateInput(raw);
  const candidates = new Set<string>();
  candidates.add(canonical);
  const corrected = contextCorrect(canonical);
  if (corrected) candidates.add(corrected);

  for (const cand of candidates) {
    if (PLATE_REGEX.test(cand)) {
      return { normalized: cand, display: formatPlateDisplay(cand) };
    }
  }
  return null;
}

/** Insert a space before the region part for display: О101НТ790 -> О101НТ 790 */
export function formatPlateDisplay(normalized: string): string {
  const m = normalized.match(PLATE_REGEX);
  if (!m) return normalized;
  return `${m[1]}${m[2]}${m[3]} ${m[4]}`;
}

export function isValidRussianPlate(normalized: string): boolean {
  return PLATE_REGEX.test(normalized);
}
