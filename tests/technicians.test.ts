import { describe, expect, it } from "vitest";
import { isTechnician, TECHNICIAN_COOKIE, TECHNICIANS } from "../lib/technicians";

describe("technicians", () => {
  it("lists four names and the cookie name", () => {
    expect(TECHNICIANS).toEqual(["Asha Rao", "Ben Carter", "Chen Wei", "Dana Okoye"]);
    expect(TECHNICIAN_COOKIE).toBe("technician");
  });

  it.each([...TECHNICIANS])("accepts %s", (name) => {
    expect(isTechnician(name)).toBe(true);
  });

  it.each([
    ["empty", ""],
    ["undefined", undefined],
    ["null", null],
    ["lower case", "asha rao"],
    ["upper case", "ASHA RAO"],
    ["padded", " Asha Rao "],
    ["unknown", "Eve Smith"],
  ])("rejects %s", (_label, value) => {
    expect(isTechnician(value)).toBe(false);
  });
});
