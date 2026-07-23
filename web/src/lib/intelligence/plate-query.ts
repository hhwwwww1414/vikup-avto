import { formatPlateDisplay, normalizePlateInput } from "../plate.ts";

export const PLATE_QUERY_GENERATOR_VERSION = "plate_query_generator_v1";

const CYRILLIC_TO_LATIN: Record<string, string> = {
  "А": "A",
  "В": "B",
  "Е": "E",
  "К": "K",
  "М": "M",
  "Н": "H",
  "О": "O",
  "Р": "P",
  "С": "C",
  "Т": "T",
  "У": "Y",
  "Х": "X",
};

export interface GeneratedPlateQuery {
  query: string;
  queryType: string;
  generatedBy: string;
}

function toLatinLookalike(value: string): string {
  return value
    .split("")
    .map((ch) => CYRILLIC_TO_LATIN[ch] ?? ch)
    .join("");
}

function spacedPlate(normalized: string): string {
  const display = formatPlateDisplay(normalized);
  const [prefix, region] = display.split(" ");
  if (!prefix || !region) return display;
  return `${prefix.slice(0, 1)} ${prefix.slice(1, 4)} ${prefix.slice(4)} ${region}`;
}

function addUnique(
  out: GeneratedPlateQuery[],
  seen: Set<string>,
  query: string,
  queryType: string,
) {
  const trimmed = query.trim();
  if (!trimmed || seen.has(trimmed)) return;
  seen.add(trimmed);
  out.push({
    query: trimmed,
    queryType,
    generatedBy: PLATE_QUERY_GENERATOR_VERSION,
  });
}

export function generatePlateQueries(rawPlate: string): GeneratedPlateQuery[] {
  const normalized = normalizePlateInput(rawPlate);
  if (!normalized) return [];

  const display = formatPlateDisplay(normalized);
  const latin = toLatinLookalike(normalized);
  const latinDisplay = toLatinLookalike(display);
  const spaced = spacedPlate(normalized);
  const seen = new Set<string>();
  const out: GeneratedPlateQuery[] = [];

  addUnique(out, seen, normalized, "plate_exact");
  addUnique(out, seen, display, "plate_display");
  addUnique(out, seen, spaced, "plate_spaced");
  addUnique(out, seen, latin, "plate_latin_exact");
  addUnique(out, seen, latinDisplay, "plate_latin_display");
  addUnique(out, seen, `"${normalized}"`, "plate_quoted");
  addUnique(out, seen, `"${latin}"`, "plate_latin_quoted");

  for (const word of ["автомобиль", "продажа", "купить", "авто", "VIN"]) {
    addUnique(out, seen, `"${normalized}" ${word}`, "plate_keyword");
    addUnique(out, seen, `"${latin}" ${word}`, "plate_latin_keyword");
  }

  return out;
}
