// What this protects: every dropdown goes through the shared Select (with its chevron and padding), so a raw
// <select> cannot bring back the native arrow touching the border.
import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const ROOT = path.join(import.meta.dirname, "..", "..");
const DIRS = ["app", path.join("lib", "ui")];
const ALLOWED = path.join("app", "_components", "ui", "field.tsx");

function walk(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) return walk(full);
    return /\.tsx?$/.test(entry.name) ? [full] : [];
  });
}

describe("select elements", () => {
  const files = DIRS.flatMap((dir) => walk(path.join(ROOT, dir)));

  it("finds the files it is meant to scan", () => {
    expect(files.length).toBeGreaterThan(5);
  });

  it('contains "<select" only in the shared field component', () => {
    const found = files
      .filter((file) => readFileSync(file, "utf8").includes("<select"))
      .map((file) => path.relative(ROOT, file));
    expect(found).toEqual([ALLOWED]);
  });
});
