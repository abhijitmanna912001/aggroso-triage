// Pure module: no "server-only", no "@/" alias, no I/O. The seeded technician list; identity is a name in a cookie.
export const TECHNICIANS = ["Asha Rao", "Ben Carter", "Chen Wei", "Dana Okoye"] as const;

export const TECHNICIAN_COOKIE = "technician";

export function isTechnician(value: string | undefined | null): value is (typeof TECHNICIANS)[number] {
  if (typeof value !== "string") return false;
  return (TECHNICIANS as readonly string[]).includes(value);
}
