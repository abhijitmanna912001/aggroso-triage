import type { EquipmentType } from "@/generated/prisma/enums";

export type SensorRule = {
  sensor: string;
  unit: string;
  // "high": alarm at or above the value. "low": alarm at or below the value.
  direction: "high" | "low";
  warning: number;
  critical: number;
  // A missing reading is reported only for expected sensors.
  expected: boolean;
  // Two readings of one sensor inside the window may differ by at most this.
  conflictTolerance: number;
};

export const CONFLICT_WINDOW_MINUTES = 10;

export const RULES: Record<EquipmentType, readonly SensorRule[]> = {
  PUMP: [
    { sensor: "vibration", unit: "mm/s", direction: "high", warning: 4.5, critical: 7.1, expected: true, conflictTolerance: 1.0 },
    { sensor: "bearing_temperature", unit: "°C", direction: "high", warning: 70, critical: 85, expected: true, conflictTolerance: 5 },
    { sensor: "discharge_pressure", unit: "bar", direction: "low", warning: 4.0, critical: 3.0, expected: false, conflictTolerance: 0.3 },
    { sensor: "suction_pressure", unit: "bar", direction: "low", warning: 0.5, critical: 0.2, expected: false, conflictTolerance: 0.2 },
  ],
  COMPRESSOR: [
    { sensor: "discharge_temperature", unit: "°C", direction: "high", warning: 105, critical: 120, expected: true, conflictTolerance: 5 },
    { sensor: "oil_pressure", unit: "bar", direction: "low", warning: 2.5, critical: 1.8, expected: true, conflictTolerance: 0.3 },
    { sensor: "discharge_pressure", unit: "bar", direction: "high", warning: 8.5, critical: 9.5, expected: false, conflictTolerance: 0.3 },
    { sensor: "vibration", unit: "mm/s", direction: "high", warning: 4.5, critical: 7.1, expected: false, conflictTolerance: 1.0 },
  ],
  MOTOR: [
    { sensor: "winding_temperature", unit: "°C", direction: "high", warning: 120, critical: 140, expected: true, conflictTolerance: 5 },
    { sensor: "vibration", unit: "mm/s", direction: "high", warning: 4.5, critical: 7.1, expected: true, conflictTolerance: 1.0 },
    { sensor: "bearing_temperature", unit: "°C", direction: "high", warning: 80, critical: 95, expected: false, conflictTolerance: 5 },
    { sensor: "current_imbalance", unit: "%", direction: "high", warning: 5, critical: 10, expected: false, conflictTolerance: 2 },
  ],
};

export function getRules(type: EquipmentType): readonly SensorRule[] {
  return RULES[type];
}

export function getRule(type: EquipmentType, sensor: string): SensorRule | undefined {
  return RULES[type].find((r) => r.sensor === sensor);
}
