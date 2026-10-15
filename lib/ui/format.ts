// Pure module. Dates are always shown in UTC so server and browser render the same text.
const formatter = new Intl.DateTimeFormat("en-GB", {
  timeZone: "UTC",
  day: "numeric",
  month: "short",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
});

export function formatUtc(value: Date | string | null): string {
  if (value === null) return "unknown time";
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return "unknown time";
  // Built from parts so the separator does not depend on the ICU version.
  const p: Record<string, string> = {};
  for (const part of formatter.formatToParts(date)) p[part.type] = part.value;
  return `${p.day} ${p.month} ${p.year}, ${p.hour}:${p.minute} UTC`;
}
