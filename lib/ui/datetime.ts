// Pure module. Turns a datetime-local value (browser local time, no offset) into a UTC ISO string for the server.
export function toIsoWithOffset(value: string): string {
  const trimmed = value.trim();
  if (trimmed === "") return "";
  const date = new Date(trimmed);
  // Unparseable text goes through unchanged so the server reports the error against the right field.
  if (Number.isNaN(date.getTime())) return value;
  return date.toISOString();
}
