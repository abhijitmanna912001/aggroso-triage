// What this protects: every semantic color utility used in app/ and lib/ui has a matching --color-<name> theme
// definition, so Tailwind generates it, and borders without an explicit color default to the subtle line token.
// Only the contents of string literals are scanned and each token must match a whole utility name, so prose in
// comments or JSX text and Tailwind's own colors (red-500, white) cannot cause a false failure.
import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const ROOT = path.join(import.meta.dirname, "..", "..");
const DIRS = ["app", path.join("lib", "ui")];
const PREFIXES = "text|bg|border|ring|outline|fill|stroke|divide";

// The project's semantic names. Longest first so "accent-fg" is not read as "accent".
const TOKEN_NAMES = [
  "surface-raised",
  "danger-soft",
  "warning-soft",
  "success-soft",
  "info-soft",
  "background",
  "foreground",
  "accent-fg",
  "surface",
  "line",
  "muted",
  "accent",
  "danger",
  "warning",
  "success",
  "info",
];

const USAGE = new RegExp(`^(${PREFIXES})-(${TOKEN_NAMES.join("|")})$`);

function walk(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) return walk(full);
    return /\.tsx?$/.test(entry.name) ? [full] : [];
  });
}

function stripComments(source: string): string {
  return source.replace(/\/\*[\s\S]*?\*\//g, " ").replace(/\/\/.*$/gm, " ");
}

function stringContents(source: string): string[] {
  const out: string[] = [];
  for (const match of stripComments(source).matchAll(/"([^"\n]*)"|'([^'\n]*)'|`([^`]*)`/g)) {
    out.push(match[1] ?? match[2] ?? match[3] ?? "");
  }
  return out;
}

// Drops variant prefixes (up to the last ":"), a leading "!" and a trailing "/opacity".
function utilityOf(token: string): string {
  const base = token.slice(token.lastIndexOf(":") + 1).replace(/^!/, "");
  return base.replace(/\/[\w.[\]%]+$/, "");
}

function tokenNamesUsed(source: string): string[] {
  const names: string[] = [];
  for (const text of stringContents(source)) {
    for (const token of text.split(/\s+/).filter(Boolean)) {
      const match = USAGE.exec(utilityOf(token));
      if (match) names.push(match[2]);
    }
  }
  return names;
}

const css = readFileSync(path.join(ROOT, "app", "globals.css"), "utf8");

function themeColorNames(source: string): Set<string> {
  const names = new Set<string>();
  for (const block of source.matchAll(/@theme[^{]*\{([^}]*)\}/g)) {
    for (const def of block[1].matchAll(/--color-([\w-]+)\s*:/g)) names.add(def[1]);
  }
  return names;
}

describe("semantic color tokens", () => {
  const files = DIRS.flatMap((dir) => walk(path.join(ROOT, dir)));
  const defined = themeColorNames(css);

  it("finds the files and the theme it is meant to scan", () => {
    expect(files.length).toBeGreaterThan(5);
    expect(defined.size).toBeGreaterThan(5);
  });

  it("defines every token the project names in an @theme block", () => {
    expect(TOKEN_NAMES.filter((name) => !defined.has(name))).toEqual([]);
  });

  it("only uses semantic color names that are defined in an @theme block", () => {
    const missing: string[] = [];
    for (const file of files) {
      for (const name of tokenNamesUsed(readFileSync(file, "utf8"))) {
        if (!defined.has(name)) missing.push(`${path.relative(ROOT, file)}: ${name}`);
      }
    }
    expect(missing).toEqual([]);
  });

  it("sets a default border color to the line token in the base layer", () => {
    const base = /@layer base\s*\{[\s\S]*?\*,\s*::after,\s*::before,\s*::backdrop,\s*::file-selector-button\s*\{([^}]*)\}/.exec(css);
    expect(base).not.toBeNull();
    expect(base?.[1]).toMatch(/border-color:\s*var\(--line\)/);
  });

  it("extracts names from class strings only (self-check)", () => {
    const sample = [
      "// text-muted in a comment",
      'const a = "border border-line bg-accent/90 hover:text-accent-fg !bg-danger-soft text-nope";',
      "const b = `ring-1 ring-danger text-red-500 text-sm border-t`;",
      "const c = 'Use the muted color and text-mutedness';",
    ].join("\n");
    expect(tokenNamesUsed(sample).sort()).toEqual(["accent", "accent-fg", "danger", "danger-soft", "line"]);
  });
});
