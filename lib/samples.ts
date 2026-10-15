// Pure module: sample reports for the "Load a sample" control. Copied from scripts/analyze-scenarios.ts on purpose,
// so the UI never imports from scripts/.
export type SampleReport = {
  id: "pump-bearing" | "compressor-conflict" | "motor-unrelated";
  label: string;
  equipmentTag: "PUMP-101" | "CMP-201" | "MTR-301";
  issue: string;
  events: string[];
  readings: { sensor: string; value: number; source: string | null }[];
};

export const SAMPLE_REPORTS: SampleReport[] = [
  {
    id: "pump-bearing",
    label: "Pump with hot, noisy bearing",
    equipmentTag: "PUMP-101",
    issue: "The pump housing is very hot and there is a grinding noise from the bearing end since this morning.",
    events: [
      "Pump was restarted after a seal change yesterday afternoon",
      "Operator reported the grinding noise at the start of the morning shift",
    ],
    readings: [
      { sensor: "vibration", value: 6.2, source: "handheld" },
      { sensor: "bearing_temperature", value: 88, source: "panel gauge" },
    ],
  },
  {
    id: "compressor-conflict",
    label: "Compressor with conflicting oil pressure",
    equipmentTag: "CMP-201",
    issue: "Oil pressure reading looks unreliable and there is oil mist in the discharge air.",
    events: ["Oil was topped up two days ago"],
    readings: [
      { sensor: "oil_pressure", value: 2.0, source: "panel gauge" },
      { sensor: "oil_pressure", value: 2.9, source: "handheld gauge" },
    ],
  },
  {
    id: "motor-unrelated",
    label: "Motor with an unrelated request",
    equipmentTag: "MTR-301",
    issue: "Banana smoothie recipe request",
    events: [],
    readings: [],
  },
];
