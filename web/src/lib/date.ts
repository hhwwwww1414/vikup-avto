const MONTHS = [
  "янв",
  "фев",
  "мар",
  "апр",
  "мая",
  "июн",
  "июл",
  "авг",
  "сен",
  "окт",
  "ноя",
  "дек",
];

/** Format like "Сегодня, 13:30" / "Вчера, 09:05" / "5 июл, 14:20". */
export function formatCardDate(d: Date, now = new Date()): string {
  const time = `${String(d.getHours()).padStart(2, "0")}:${String(
    d.getMinutes(),
  ).padStart(2, "0")}`;

  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const startOfDay = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const diffDays = Math.round(
    (startOfToday.getTime() - startOfDay.getTime()) / 86_400_000,
  );

  if (diffDays === 0) return `Сегодня, ${time}`;
  if (diffDays === 1) return `Вчера, ${time}`;

  const datePart = `${d.getDate()} ${MONTHS[d.getMonth()]}`;
  if (d.getFullYear() !== now.getFullYear()) {
    return `${datePart} ${d.getFullYear()}, ${time}`;
  }
  return `${datePart}, ${time}`;
}
