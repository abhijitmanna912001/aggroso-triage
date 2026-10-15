import { describe, expect, it } from "vitest";
import { isNavActive } from "@/lib/ui/nav";

describe("isNavActive: Reports (/)", () => {
  it("is active for the dashboard and for report detail pages", () => {
    expect(isNavActive("/", "/")).toBe(true);
    expect(isNavActive("/reports/5", "/")).toBe(true);
    expect(isNavActive("/reports/12345", "/")).toBe(true);
  });

  it("is not active for /reports/new", () => {
    expect(isNavActive("/reports/new", "/")).toBe(false);
    expect(isNavActive("/reports/new/", "/")).toBe(false);
  });

  it("is not active for non-numeric or nested report paths", () => {
    expect(isNavActive("/reports", "/")).toBe(false);
    expect(isNavActive("/reports/abc", "/")).toBe(false);
    expect(isNavActive("/reports/5/extra", "/")).toBe(false);
  });
});

describe("isNavActive: Equipment (/equipment)", () => {
  it("is active for the list and for an equipment page", () => {
    expect(isNavActive("/equipment", "/equipment")).toBe(true);
    expect(isNavActive("/equipment/3", "/equipment")).toBe(true);
  });

  it("is not active for look-alike or non-numeric paths", () => {
    expect(isNavActive("/equipmentx", "/equipment")).toBe(false);
    expect(isNavActive("/equipment/abc", "/equipment")).toBe(false);
    expect(isNavActive("/equipment/3/extra", "/equipment")).toBe(false);
  });
});

describe("isNavActive: New report (/reports/new)", () => {
  it("is active only for /reports/new", () => {
    expect(isNavActive("/reports/new", "/reports/new")).toBe(true);
    expect(isNavActive("/reports/new/", "/reports/new")).toBe(true);
    expect(isNavActive("/reports/5", "/reports/new")).toBe(false);
    expect(isNavActive("/", "/reports/new")).toBe(false);
    expect(isNavActive("/reports/new/more", "/reports/new")).toBe(false);
  });
});

describe("isNavActive: general", () => {
  it("ignores a trailing slash", () => {
    expect(isNavActive("/equipment/", "/equipment")).toBe(true);
    expect(isNavActive("/equipment/3/", "/equipment")).toBe(true);
    expect(isNavActive("/reports/5/", "/")).toBe(true);
  });

  it("is never active for unrelated paths or the empty string", () => {
    for (const href of ["/", "/equipment", "/reports/new"] as const) {
      expect(isNavActive("", href)).toBe(false);
      expect(isNavActive("/other", href)).toBe(false);
      expect(isNavActive("/settings/equipment", href)).toBe(false);
    }
  });

  it("marks at most one link active", () => {
    const hrefs = ["/", "/equipment", "/reports/new"] as const;
    for (const path of ["/", "/reports/5", "/reports/new", "/equipment", "/equipment/2", "/x", ""]) {
      expect(hrefs.filter((h) => isNavActive(path, h)).length).toBeLessThanOrEqual(1);
    }
  });
});
