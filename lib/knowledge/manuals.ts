import { readFileSync } from "node:fs";
import path from "node:path";
import type { EquipmentType } from "../../generated/prisma/enums";
import { parseManual, type ParsedChunk } from "./parse";

export type ManualFile = {
  file: string;
  equipmentType: EquipmentType;
  idPrefix: string;
  documentTitle: string;
};

export const MANUAL_FILES: readonly ManualFile[] = [
  { file: "knowledge/pump-manual.md", equipmentType: "PUMP", idPrefix: "pump", documentTitle: "Centrifugal Pump Manual" },
  { file: "knowledge/compressor-manual.md", equipmentType: "COMPRESSOR", idPrefix: "compressor", documentTitle: "Air Compressor Manual" },
  { file: "knowledge/motor-manual.md", equipmentType: "MOTOR", idPrefix: "motor", documentTitle: "Electric Motor Manual" },
];

export function loadManualChunks(): ParsedChunk[] {
  return MANUAL_FILES.flatMap(({ file, ...options }) => {
    const markdown = readFileSync(path.join(process.cwd(), file), "utf8");
    return parseManual(markdown, options);
  });
}
