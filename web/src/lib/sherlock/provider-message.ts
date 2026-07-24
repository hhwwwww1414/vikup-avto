export type SherlockMessageLike = {
  message?: string;
  text?: string;
  media?: unknown;
  buttons?: Array<Array<{ text?: string }>>;
};

export const REPORT_URL_RE = /https?:\/\/\S+/i;
export const REPORT_READY_RE =
  /(\u043e\u0442\u0447(?:\u0435|\u0451)\u0442|report|\u0433\u043e\u0442\u043e\u0432|\u043d\u0430\u0439\u0434\u0435\u043d|\u043e\u0431\u043d\u0430\u0440\u0443\u0436\u0435\u043d|\u0440\u0435\u0437\u0443\u043b\u044c\u0442\u0430\u0442|\u0442\u0435\u043b\u0435\u0444\u043e\u043d|\d+(?:[.,]\d+)?\s*%)/iu;
export const FULL_REPORT_BUTTON_RE =
  /(full|\(\d+\s*\u0448\u0442\)|\u043f\u043e\u043b\u043d\u044b\u0439\s+\u043e\u0442\u0447(?:\u0435|\u0451)\u0442)/iu;

export function messageText(message: SherlockMessageLike): string {
  return String(message.message ?? message.text ?? "");
}

export function normalizeSherlockPlateText(value: string): string {
  const lookAlikes: Record<string, string> = {
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
  return value
    .replace(/\s+/g, "")
    .toUpperCase()
    .replace(/[ABEKMHOPCTYX]/g, (char) => lookAlikes[char] ?? char);
}

export function firstReportUrl(text: string): string | null {
  const raw = text.match(REPORT_URL_RE)?.[0];
  return raw ? raw.replace(/[)\].,;]+$/, "") : null;
}

export function hasFullReportButton(message: SherlockMessageLike): boolean {
  return Boolean(
    message.buttons?.some((row) =>
      row.some((button) => FULL_REPORT_BUTTON_RE.test(button.text ?? "")),
    ),
  );
}

export function isSherlockReportMessageForPlate(
  message: SherlockMessageLike,
  plate: string,
): boolean {
  const text = messageText(message);
  if (!normalizeSherlockPlateText(text).includes(normalizeSherlockPlateText(plate))) {
    return false;
  }
  return REPORT_READY_RE.test(text) || Boolean(message.media) || hasFullReportButton(message);
}
