import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const LIB = path.join(import.meta.dirname, "..", "..", "lib");

function tsFiles(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) return tsFiles(full);
    return entry.name.endsWith(".ts") ? [full] : [];
  });
}

// Regex-based comment stripper. Known limit: a "//" inside a string literal hides the rest of that line. That is
// acceptable for these files and keeps the check simple.
function stripComments(source: string): string {
  return source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");
}

const rel = (file: string) => path.relative(path.join(LIB, ".."), file).split(path.sep).join("/");

// \b keeps WORK_ORDER_APPROVED (a history type) and similar names from matching: "_" is a word character.
const DECISION_WORDS = /\b(APPROVED|REJECTED)\b/;
// The leading dot and "(" mean a call, not a type declaration such as `updateMany(args: ...)`.
const WRITE_CALLS = /\.(update|updateMany|upsert|delete|deleteMany)\s*\(/;
const RAW_SQL = /\$executeRaw/;
const UPDATE_MANY_CALL = /\.updateMany\s*\(/;

const read = (file: string) => stripComments(readFileSync(file, "utf8"));

describe("AI code cannot decide", () => {
  const analysisFiles = tsFiles(path.join(LIB, "analysis"));

  it("finds the analysis files (guards against a vacuous pass)", () => {
    expect(analysisFiles.length).toBeGreaterThan(0);
    expect(analysisFiles.map(rel)).toContain("lib/analysis/persist.ts");
  });

  it.each(analysisFiles.map((f) => [rel(f), f]))("%s has no decision words, writes or raw SQL", (_name, file) => {
    const code = read(file);
    expect(code).not.toMatch(DECISION_WORDS);
    expect(code).not.toMatch(WRITE_CALLS);
    expect(code).not.toMatch(RAW_SQL);
  });

  it("only lib/reports/workorder.ts sets APPROVED or REJECTED", () => {
    const files = tsFiles(LIB);
    const withApproved = files.filter((f) => /\bAPPROVED\b/.test(read(f))).map(rel);
    const withRejected = files.filter((f) => /\bREJECTED\b/.test(read(f))).map(rel);
    expect(withApproved).toEqual(["lib/reports/workorder.ts"]);
    expect(withRejected).toEqual(["lib/reports/workorder.ts"]);
  });

  it("only workorder.ts and notes.ts call updateMany", () => {
    const callers = tsFiles(LIB)
      .filter((f) => UPDATE_MANY_CALL.test(read(f)))
      .map(rel)
      .sort();
    expect(callers).toEqual(["lib/reports/notes.ts", "lib/reports/workorder.ts"]);
  });
});
