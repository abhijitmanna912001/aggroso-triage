// What this protects: no removed or misleading Tailwind v3 utility sneaks back into app/ or lib/ui.
// Comments are stripped first, then the text is split into tokens and each banned pattern must match a whole token,
// so prose that merely mentions a name inside a longer word cannot trip it.
import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const ROOT = path.join(import.meta.dirname, "..", "..");
const DIRS = ["app", path.join("lib", "ui")];
const EXTENSIONS = [".tsx", ".ts", ".css"];

function walk(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) return walk(full);
    return EXTENSIONS.some((ext) => entry.name.endsWith(ext)) ? [full] : [];
  });
}

// Regex-based, like the stripComments in the invariants tests. Known limit: a "//" inside a string literal hides the
// rest of that line (for example a URL), which can only cause a missed match, never a false failure.
function stripComments(source: string): string {
  return source.replace(/\/\*[\s\S]*?\*\//g, " ").replace(/\/\/.*$/gm, " ");
}

const BANNED: { pattern: RegExp; hint: string }[] = [
  { pattern: /^outline-none$/, hint: "use outline-hidden" },
  { pattern: /^flex-(shrink|grow)(-.+)?$/, hint: "use shrink / grow" },
  { pattern: /^overflow-ellipsis$/, hint: "use text-ellipsis" },
  { pattern: /^decoration-(slice|clone)$/, hint: "use box-decoration-slice / box-decoration-clone" },
  { pattern: /^(bg|text|border|ring|divide)-opacity-/, hint: "use a slash opacity modifier, e.g. bg-black/50" },
  { pattern: /^bg-gradient-to-/, hint: "use bg-linear-to-*" },
  { pattern: /-\[--[\w-]+\]/, hint: "use the parenthesis form, e.g. bg-(--var)" },
];

function tokens(source: string): string[] {
  return stripComments(source)
    .split(/[\s"'`{}()<>,;]+/)
    .filter(Boolean);
}

// Drops variant prefixes (everything up to the last ":") and a leading "!" important marker.
function utilityOf(token: string): string {
  const base = token.slice(token.lastIndexOf(":") + 1);
  return base.startsWith("!") ? base.slice(1) : base;
}

describe("Tailwind v4 utilities", () => {
  const files = DIRS.flatMap((dir) => walk(path.join(ROOT, dir)));

  it("finds the files it is meant to scan", () => {
    expect(files.length).toBeGreaterThan(5);
  });

  it("uses no removed v3 utility", () => {
    const found: string[] = [];
    for (const file of files) {
      for (const token of tokens(readFileSync(file, "utf8"))) {
        const utility = utilityOf(token);
        for (const { pattern, hint } of BANNED) {
          // The variable shorthand check uses the raw token, because the v3 form can sit behind a variant prefix.
          if (pattern.test(utility) || pattern.test(token)) {
            found.push(`${path.relative(ROOT, file)}: "${token}" (${hint})`);
          }
        }
      }
    }
    expect(found).toEqual([]);
  });

  it("catches the banned names (self-check)", () => {
    const hit = (token: string) => BANNED.some(({ pattern }) => pattern.test(utilityOf(token)) || pattern.test(token));
    for (const bad of ["outline-none", "focus:outline-none", "!flex-shrink-0", "flex-grow", "bg-opacity-50", "bg-[--x]"]) {
      expect(hit(bad), bad).toBe(true);
    }
    for (const good of ["outline-hidden", "shrink-0", "grow", "bg-black/50", "bg-(--x)", "outline-none-ish"]) {
      expect(hit(good), good).toBe(false);
    }
  });
});
