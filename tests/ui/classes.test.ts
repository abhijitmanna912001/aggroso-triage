import { describe, expect, it } from "vitest";
import {
  buttonClasses,
  cardClasses,
  controlClasses,
  toneClasses,
  type ButtonSize,
  type ButtonVariant,
  type Tone,
} from "@/lib/ui/classes";

const VARIANTS: ButtonVariant[] = ["primary", "secondary", "danger", "ghost"];
const SIZES: ButtonSize[] = ["sm", "md"];
const TONES: Tone[] = ["neutral", "info", "success", "warning", "danger"];

describe("buttonClasses", () => {
  it("returns a non-empty string for every variant and size", () => {
    for (const variant of VARIANTS) {
      for (const size of SIZES) {
        expect(buttonClasses({ variant, size }).length).toBeGreaterThan(0);
      }
    }
  });

  it("gives each variant its own classes", () => {
    const results = VARIANTS.map((variant) => buttonClasses({ variant, size: "md" }));
    expect(new Set(results).size).toBe(VARIANTS.length);
  });

  it("gives each size its own classes", () => {
    expect(buttonClasses({ variant: "primary", size: "sm" })).not.toBe(buttonClasses({ variant: "primary", size: "md" }));
  });

  it("includes disabled styling for every variant", () => {
    for (const variant of VARIANTS) {
      const classes = buttonClasses({ variant, size: "md" });
      expect(classes).toContain("disabled:cursor-not-allowed");
      expect(classes).toContain("disabled:opacity-60");
    }
  });

  it("adds w-full only when fullWidth is set", () => {
    expect(buttonClasses({ variant: "primary", size: "md", fullWidth: true }).split(" ")).toContain("w-full");
    expect(buttonClasses({ variant: "primary", size: "md" }).split(" ")).not.toContain("w-full");
  });

  it("is deterministic", () => {
    expect(buttonClasses({ variant: "danger", size: "sm" })).toBe(buttonClasses({ variant: "danger", size: "sm" }));
  });
});

describe("controlClasses and cardClasses", () => {
  it("are non-empty and style the invalid and disabled states", () => {
    expect(controlClasses.length).toBeGreaterThan(0);
    expect(controlClasses).toContain("aria-invalid:");
    expect(controlClasses).toContain("disabled:");
    expect(cardClasses.length).toBeGreaterThan(0);
  });
});

describe("toneClasses", () => {
  it("returns a non-empty string for every tone", () => {
    for (const tone of TONES) expect(toneClasses(tone).length).toBeGreaterThan(0);
  });

  it("gives each tone its own classes", () => {
    expect(new Set(TONES.map(toneClasses)).size).toBe(TONES.length);
  });

  it("is deterministic", () => {
    expect(toneClasses("warning")).toBe(toneClasses("warning"));
  });
});
