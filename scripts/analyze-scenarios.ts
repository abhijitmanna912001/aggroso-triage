// Data only: sample scenarios for scripts/analyze.ts and tests/analysis/scenarios.test.ts.
import type { EquipmentType } from "../generated/prisma/enums";
import type { SensorReadingInput } from "../lib/thresholds/evaluate";

export type AnalyzeScenario = {
  name: string;
  equipment: { type: EquipmentType; tag: string; name: string };
  issue: string;
  events: string[];
  readings: SensorReadingInput[];
};

export const SCENARIOS: AnalyzeScenario[] = [
  {
    name: "pump-bearing",
    equipment: { type: "PUMP", tag: "PUMP-101", name: "Cooling water pump A" },
    issue: "The pump housing is very hot and there is a grinding noise from the bearing end since this morning.",
    events: [
      "Pump was restarted after a seal change yesterday afternoon",
      "Operator reported the grinding noise at the start of the morning shift",
    ],
    readings: [
      { sensor: "vibration", value: 6.2, unit: "mm/s", recordedAt: null, source: "handheld" },
      { sensor: "bearing_temperature", value: 88, unit: "°C", recordedAt: null, source: "panel gauge" },
    ],
  },
  {
    name: "compressor-conflict",
    equipment: { type: "COMPRESSOR", tag: "CMP-201", name: "Instrument air compressor 1" },
    issue: "Oil pressure reading looks unreliable and there is oil mist in the discharge air.",
    events: ["Oil was topped up two days ago"],
    readings: [
      { sensor: "oil_pressure", value: 2.0, unit: "bar", recordedAt: null, source: "panel gauge" },
      { sensor: "oil_pressure", value: 2.9, unit: "bar", recordedAt: null, source: "handheld gauge" },
    ],
  },
  {
    name: "motor-unrelated",
    equipment: { type: "MOTOR", tag: "MTR-301", name: "Conveyor drive motor" },
    issue: "Banana smoothie recipe request",
    events: [],
    readings: [],
  },
];
