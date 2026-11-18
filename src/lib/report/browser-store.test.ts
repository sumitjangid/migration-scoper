import { describe, expect, it } from "vitest";
import type { Report } from "../analyse/schemas";
import { getBrowserReport, saveBrowserReport } from "./browser-store";

function createStorage() {
  const values = new Map<string, string>();
  return {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => values.set(key, value),
    removeItem: (key: string) => values.delete(key),
  };
}

const report: Report = {
  requestedUrl: "https://example.com",
  platform: { name: "Unknown", confidence: 0, evidence: [] },
  templates: [],
  risks: [],
  estimate: {
    tshirtSize: "S",
    effortRangeWeeks: { min: 1, max: 2 },
    vercelUsageRangeUsdMonthly: { min: 0, max: 0 },
    assumptions: [],
  },
  discoveryQuestions: [],
  phasedOutline: [],
  assumptionsAndUnknowns: [],
  analyzedAt: "2026-01-01T00:00:00.000Z",
};

describe("browser report storage", () => {
  it("saves and retrieves a validated report by ID", () => {
    const storage = createStorage();
    saveBrowserReport(storage, "report-1", report);

    expect(getBrowserReport(storage, "report-1")).toEqual(report);
    expect(getBrowserReport(storage, "report-2")).toBeUndefined();
  });

  it("removes invalid stored data and returns no report", () => {
    const storage = createStorage();
    storage.setItem("migration-report:report-1", "{invalid");

    expect(getBrowserReport(storage, "report-1")).toBeUndefined();
    expect(storage.getItem("migration-report:report-1")).toBeNull();
  });
});
