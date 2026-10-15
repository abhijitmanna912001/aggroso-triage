// What this protects: app/actions.ts is the only door through which a person's identity enters the system.
// - Identity comes only from the signed-in cookie (requireTechnician), never from a field in the submitted form.
// - Logs carry only fixed, safe fields: no error text, no form content, no console output.
// - The budget guard runs before the paid analysis call.
// The check is static (the file is read as text, comments stripped), so it needs no database or network.
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const ACTIONS_FILE = path.join(import.meta.dirname, "..", "..", "app", "actions.ts");

// Regex-based comment stripper, same as ai-cannot-decide.test.ts. Known limit: a "//" inside a string literal hides
// the rest of that line. That is acceptable for this file.
function stripComments(source: string): string {
  return source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");
}

const code = stripComments(readFileSync(ACTIONS_FILE, "utf8"));

const OPENERS = "([{";
const CLOSERS = ")]}";

// Index of the bracket that closes the one at openIdx. Skips string literals. Returns -1 if unbalanced.
function matchingClose(text: string, openIdx: number): number {
  let depth = 0;
  for (let i = openIdx; i < text.length; i++) {
    const ch = text.charAt(i);
    if (ch === '"' || ch === "'" || ch === "`") {
      i = skipString(text, i);
      continue;
    }
    if (OPENERS.includes(ch)) depth++;
    else if (CLOSERS.includes(ch)) {
      depth--;
      if (depth === 0) return i;
    }
  }
  return -1;
}

function skipString(text: string, startIdx: number): number {
  const quote = text.charAt(startIdx);
  for (let i = startIdx + 1; i < text.length; i++) {
    if (text.charAt(i) === "\\") i++;
    else if (text.charAt(i) === quote) return i;
  }
  return text.length;
}

// Splits on commas that are not nested inside brackets or strings. Blank pieces (trailing comma) are dropped.
function splitTopLevel(text: string): string[] {
  const parts: string[] = [];
  let depth = 0;
  let current = "";
  for (let i = 0; i < text.length; i++) {
    const ch = text.charAt(i);
    if (ch === '"' || ch === "'" || ch === "`") {
      const end = skipString(text, i);
      current += text.slice(i, end + 1);
      i = end;
      continue;
    }
    if (OPENERS.includes(ch)) depth++;
    else if (CLOSERS.includes(ch)) depth--;
    if (ch === "," && depth === 0) {
      parts.push(current.trim());
      current = "";
    } else {
      current += ch;
    }
  }
  parts.push(current.trim());
  return parts.filter((part) => part.length > 0);
}

// The top-level arguments of every call that starts with `prefix` (a regex source ending just before the "(").
function callArguments(source: string, prefix: string): string[][] {
  const calls: string[][] = [];
  const pattern = new RegExp(`${prefix}\\s*\\(`, "g");
  for (const match of source.matchAll(pattern)) {
    const openIdx = match.index + match[0].length - 1;
    const closeIdx = matchingClose(source, openIdx);
    expect(closeIdx, `unbalanced call near: ${match[0]}`).toBeGreaterThan(openIdx);
    calls.push(splitTopLevel(source.slice(openIdx + 1, closeIdx)));
  }
  return calls;
}

// Each exported action with its body: from the signature to the next line that starts with "}" in column 0.
function exportedActions(source: string): Map<string, string> {
  const actions = new Map<string, string>();
  for (const match of source.matchAll(/^export\s+async\s+function\s+(\w+)/gm)) {
    const rest = source.slice(match.index);
    const end = rest.search(/^}/m);
    expect(end, `no closing brace found for ${match[1]}`).toBeGreaterThan(0);
    actions.set(match[1] ?? "", rest.slice(0, end + 1));
  }
  return actions;
}

const actions = exportedActions(code);
const EXEMPT = ["selectTechnicianAction", "signOutAction"];
const EXPECTED_ACTIONS = [
  "selectTechnicianAction",
  "signOutAction",
  "createReportAction",
  "analyzeReportAction",
  "editWorkOrderAction",
  "approveWorkOrderAction",
  "rejectWorkOrderAction",
  "addObservationAction",
  "confirmFindingAction",
  "answerQuestionAction",
];

function body(name: string): string {
  const found = actions.get(name);
  expect(found, `${name} not found in app/actions.ts`).toBeDefined();
  return found ?? "";
}

describe("server actions: identity, logging and budget", () => {
  it("finds exactly the known actions (guards against a vacuous pass)", () => {
    expect([...actions.keys()].sort()).toEqual([...EXPECTED_ACTIONS].sort());
  });

  describe("1. directive and exports", () => {
    it('begins with the "use server" directive', () => {
      expect(code.trimStart()).toMatch(/^["']use server["']/);
    });

    it("exports only async functions", () => {
      const badExports = code.match(/^export\s+(?!async\s+function\b).*$/gm);
      expect(badExports).toBeNull();
    });
  });

  describe("2. requireTechnician", () => {
    const guarded = EXPECTED_ACTIONS.filter((name) => !EXEMPT.includes(name));

    it.each(guarded)("%s calls requireTechnician", (name) => {
      expect(body(name)).toMatch(/\brequireTechnician\s*\(/);
    });

    it.each(EXEMPT)("%s (exempt) does not call requireTechnician", (name) => {
      expect(body(name)).not.toMatch(/\brequireTechnician\s*\(/);
    });
  });

  describe("3. no identity read from the form", () => {
    it("never reads an identity field from submitted data", () => {
      expect(code).not.toMatch(
        /\.get\(\s*["'`](actor|reportedBy|recordedBy|confirmedBy|answeredBy|decidedBy|editedBy)["'`]/,
      );
    });

    it("createReportAction drops the submitted reportedBy and sets it from the session before parsing", () => {
      const fn = body("createReportAction");
      const required = fn.indexOf("requireTechnician(");
      const filter = fn.search(/key\s*!==\s*["']reportedBy["']/);
      const overwrite = fn.search(/\.set\(\s*["']reportedBy["']\s*,\s*technician\s*\)/);
      const parse = fn.indexOf("parseReportForm(");
      expect(required).toBeGreaterThanOrEqual(0);
      expect(filter).toBeGreaterThanOrEqual(0);
      expect(overwrite).toBeGreaterThanOrEqual(0);
      expect(parse).toBeGreaterThanOrEqual(0);
      expect(required).toBeLessThan(overwrite);
      expect(filter).toBeLessThan(parse);
      expect(overwrite).toBeLessThan(parse);
      expect(fn).toMatch(/parseReportForm\(\s*trusted\s*\)/);
      expect(fn).not.toMatch(/parseReportForm\(\s*formData/);
    });
  });

  describe("4. logging", () => {
    const SAFE_FIELD_CALL = /^(analysisLogFields|errorLogFields)\(/;
    const SAFE_OBJECT_KEY = /^(event|reason|reportId)\s*(:|$)/;

    it("has no console call", () => {
      expect(code).not.toMatch(/\bconsole\./);
    });

    it("passes only safe fields as the first argument of every logger call", () => {
      const calls = callArguments(code, "\\blogger\\.(?:trace|debug|info|warn|error|fatal)");
      expect(calls.length).toBeGreaterThan(0);
      for (const args of calls) {
        const first = args[0] ?? "";
        if (SAFE_FIELD_CALL.test(first)) {
          // The whole argument must be that one call, not "errorLogFields(e), extra".
          const open = first.indexOf("(");
          expect(matchingClose(first, open), `not a single call: ${first}`).toBe(first.length - 1);
        } else {
          expect(first, `unsafe logger argument: ${first}`).toMatch(/^\{[\s\S]*\}$/);
          const keys = splitTopLevel(first.slice(1, -1));
          expect(keys.length).toBeGreaterThan(0);
          for (const entry of keys) {
            expect(entry, `unsafe logger field: ${entry}`).toMatch(SAFE_OBJECT_KEY);
          }
        }
      }
    });

    it("never reads .message on a caught error", () => {
      const names = [...code.matchAll(/\bcatch\s*\(\s*(\w+)/g)].map((m) => m[1] ?? "");
      expect(names.length).toBeGreaterThan(0);
      for (const name of names) {
        expect(code).not.toMatch(new RegExp(`\\b${name}\\.message\\b`));
      }
    });

    it("never stringifies a form or an error", () => {
      for (const args of callArguments(code, "\\bJSON\\.stringify")) {
        expect(args.join(","), "JSON.stringify of form or error data").not.toMatch(
          /\b(formData|trusted|parsed|error|err|entries)\b/i,
        );
      }
    });
  });

  describe("5. budget guard", () => {
    it("analyzeReportAction calls evaluateBudget before analyzeReport", () => {
      const fn = body("analyzeReportAction");
      const budget = fn.indexOf("evaluateBudget(");
      const analyze = fn.indexOf("analyzeReport(");
      expect(budget).toBeGreaterThanOrEqual(0);
      expect(analyze).toBeGreaterThanOrEqual(0);
      expect(budget).toBeLessThan(analyze);
    });
  });
});
