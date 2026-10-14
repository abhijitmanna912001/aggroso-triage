import type { EquipmentType } from "../../generated/prisma/enums";

export type ParsedChunk = {
  id: string;
  equipmentType: EquipmentType;
  document: string;
  sectionRef: string;
  heading: string;
  content: string;
};

export type ParseOptions = {
  equipmentType: EquipmentType;
  idPrefix: string;
  documentTitle: string;
};

export class ManualParseError extends Error {
  readonly problems: readonly string[];

  constructor(documentTitle: string, problems: readonly string[]) {
    super(`Manual "${documentTitle}" has ${problems.length} problem(s):\n- ${problems.join("\n- ")}`);
    this.name = "ManualParseError";
    this.problems = problems;
  }
}

const HEADING = /^## (\d+)\.(\d+) (\S.*)$/;

export function parseManual(markdown: string, options: ParseOptions): ParsedChunk[] {
  const { equipmentType, idPrefix, documentTitle } = options;
  const problems: string[] = [];
  const chunks: ParsedChunk[] = [];
  const seen = new Set<string>();

  type Section = { id: string; chapter: string; number: string; heading: string; body: string[] } | null;
  let current: Section = null;
  let sawSection = false;

  const finish = () => {
    if (!current) return;
    const body = current.body.join("\n").trim();
    if (body === "") {
      problems.push(`Section ${current.chapter}.${current.number} "${current.heading}" has an empty body`);
      return;
    }
    chunks.push({
      id: current.id,
      equipmentType,
      document: documentTitle,
      sectionRef: `${documentTitle} §${current.chapter}.${current.number}`,
      heading: current.heading,
      content: `${current.heading}\n\n${body}`,
    });
  };

  markdown.split(/\r?\n/).forEach((line, index) => {
    if (line.startsWith("## ")) {
      finish();
      current = null;
      sawSection = true;
      const match = HEADING.exec(line);
      if (!match) {
        problems.push(`Line ${index + 1}: malformed heading "${line}" (expected "## <chapter>.<number> <Title>")`);
        return;
      }
      const [, chapter, number, heading] = match;
      const id = `${idPrefix}-${chapter}-${number}`;
      if (seen.has(id)) {
        problems.push(`Line ${index + 1}: duplicate id "${id}"`);
      }
      seen.add(id);
      current = { id, chapter, number, heading: heading.trim(), body: [] };
      return;
    }
    if (current) current.body.push(line);
  });
  finish();

  if (!sawSection) problems.push("No sections found");
  if (problems.length > 0) throw new ManualParseError(documentTitle, problems);
  return chunks;
}
