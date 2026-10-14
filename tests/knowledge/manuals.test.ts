import { describe, expect, it } from "vitest";
import { MANUAL_FILES } from "@/lib/knowledge/manuals";
import { ManualParseError, parseManual, type ParsedChunk } from "@/lib/knowledge/parse";
import { getRules } from "@/lib/thresholds/rules";
import { readFileSync } from "node:fs";
import path from "node:path";

const opts = { equipmentType: "PUMP", idPrefix: "pump", documentTitle: "Test Manual" } as const;

describe("parseManual", () => {
  it("parses valid sections", () => {
    const md = "# Title\n\n*note*\n\n## 1.1 First topic\n\nBody one.\n\n## 2.3 Second topic\n\nBody two.\n";
    const chunks = parseManual(md, opts);
    expect(chunks).toEqual([
      {
        id: "pump-1-1",
        equipmentType: "PUMP",
        document: "Test Manual",
        sectionRef: "Test Manual §1.1",
        heading: "First topic",
        content: "First topic\n\nBody one.",
      },
      {
        id: "pump-2-3",
        equipmentType: "PUMP",
        document: "Test Manual",
        sectionRef: "Test Manual §2.3",
        heading: "Second topic",
        content: "Second topic\n\nBody two.",
      },
    ]);
  });

  it("ignores text before the first heading", () => {
    const chunks = parseManual("Intro text\n\n## 1.1 Only\n\nBody.", opts);
    expect(chunks).toHaveLength(1);
    expect(chunks[0].content).not.toContain("Intro");
  });

  it("rejects a malformed heading", () => {
    expect(() => parseManual("## Bad heading\n\nBody.", opts)).toThrow(ManualParseError);
    expect(() => parseManual("## 1.1Title\n\nBody.", opts)).toThrow(/malformed heading/);
  });

  it("rejects duplicate ids", () => {
    expect(() => parseManual("## 1.1 A\n\nx\n\n## 1.1 B\n\ny", opts)).toThrow(/duplicate id "pump-1-1"/);
  });

  it("rejects an empty body", () => {
    expect(() => parseManual("## 1.1 A\n\n\n## 1.2 B\n\ny", opts)).toThrow(/empty body/);
  });

  it("lists every problem found", () => {
    try {
      parseManual("## bad\n\nx\n\n## 1.1 A\n\n## 1.1 B\n\ny", opts);
      expect.unreachable();
    } catch (e) {
      expect(e).toBeInstanceOf(ManualParseError);
      expect((e as ManualParseError).problems.length).toBeGreaterThanOrEqual(3);
    }
  });
});

const EXPECTED_IDS: Record<string, string[]> = {
  pump: [
    "1-1", "2-1", "2-2", "2-3", "2-4", "2-5", "2-6", "2-7", "3-1", "3-2", "3-3", "4-1", "4-2",
  ],
  compressor: [
    "1-1", "2-1", "2-2", "2-3", "2-4", "2-5", "2-6", "2-7", "2-8", "3-1", "3-2", "3-3", "4-1", "4-2",
  ],
  motor: [
    "1-1", "2-1", "2-2", "2-3", "2-4", "2-5", "2-6", "2-7", "2-8", "3-1", "3-2", "3-3", "4-1", "4-2",
  ],
};

function load(file: (typeof MANUAL_FILES)[number]): ParsedChunk[] {
  const { file: p, ...options } = file;
  return parseManual(readFileSync(path.join(process.cwd(), p), "utf8"), options);
}

const words = (s: string) => s.split(/\s+/).filter(Boolean).length;
const chapterOf = (c: ParsedChunk) => Number(c.id.split("-")[1]);

describe.each(MANUAL_FILES)("real manual: $idPrefix", (file) => {
  const chunks = load(file);

  it("has exactly the expected ids in order", () => {
    expect(chunks.map((c) => c.id)).toEqual(EXPECTED_IDS[file.idPrefix].map((s) => `${file.idPrefix}-${s}`));
  });

  it("has unique ids", () => {
    expect(new Set(chunks.map((c) => c.id)).size).toBe(chunks.length);
  });

  it("has a 1.1 table matching the threshold rules", () => {
    const section = chunks.find((c) => c.id === `${file.idPrefix}-1-1`)!;
    const rows = section.content
      .split("\n")
      .filter((l) => l.startsWith("|"))
      .map((l) => l.split("|").slice(1, -1).map((cell) => cell.trim()));
    expect(rows[0]).toEqual(["Sensor", "Unit", "Direction", "Warning", "Critical"]);
    const dataRows = rows.slice(2);
    const rules = getRules(file.equipmentType);
    expect(dataRows.map((r) => r[0]).sort()).toEqual(rules.map((r) => r.sensor).sort());
    for (const rule of rules) {
      const row = dataRows.find((r) => r[0] === rule.sensor)!;
      expect(row[1]).toBe(rule.unit);
      expect(row[2]).toBe(rule.direction);
      expect(Number(row[3])).toBe(rule.warning);
      expect(Number(row[4])).toBe(rule.critical);
    }
  });

  it("gives every chapter 2 section all five labelled parts", () => {
    for (const c of chunks.filter((c) => chapterOf(c) === 2)) {
      for (const label of ["Symptoms", "Possible causes", "Inspection steps", "Related sensors", "Escalate when"]) {
        expect(c.content, `${c.id} missing ${label}`).toMatch(new RegExp(`^\\*\\*${label}:\\*\\*`, "m"));
      }
    }
  });

  it("only lists related sensors that exist in the rules", () => {
    const known = new Set(getRules(file.equipmentType).map((r) => r.sensor));
    for (const c of chunks.filter((c) => chapterOf(c) === 2)) {
      const line = c.content.split("\n").find((l) => l.startsWith("**Related sensors:**"))!;
      const names = [...line.matchAll(/`([^`]+)`/g)].map((m) => m[1]);
      expect(names.length, `${c.id} has no related sensors`).toBeGreaterThan(0);
      for (const n of names) expect(known.has(n), `${c.id}: unknown sensor ${n}`).toBe(true);
    }
  });

  it("keeps sections within word limits", () => {
    for (const c of chunks) {
      const n = words(c.content);
      expect(n, `${c.id} has ${n} words`).toBeLessThanOrEqual(350);
      if (chapterOf(c) === 2) expect(n, `${c.id} has ${n} words`).toBeLessThanOrEqual(180);
      if (chapterOf(c) >= 3) expect(n, `${c.id} has ${n} words`).toBeLessThanOrEqual(220);
    }
  });
});
