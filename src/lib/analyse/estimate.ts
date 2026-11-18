import type { CapturedPage } from "../crawl/types";
import type { Estimate } from "./schemas";

export interface EstimateInputs {
  monthlyTraffic?: number;
  catalogSize?: number;
}

export function estimateProject(pages: CapturedPage[], inputs: EstimateInputs = {}): Estimate {
  const templateCount = new Set(pages.map((page) => page.template)).size;
  let tshirtSize: Estimate["tshirtSize"] = templateCount >= 5 ? "M" : "S";
  if (pages.length === 0) tshirtSize = "XS";

  if ((inputs.monthlyTraffic ?? 0) > 5_000_000 || (inputs.catalogSize ?? 0) > 100_000) {
    tshirtSize = "L";
  } else if ((inputs.monthlyTraffic ?? 0) > 1_000_000 || (inputs.catalogSize ?? 0) > 25_000) {
    tshirtSize = tshirtSize === "XS" ? "S" : "M";
  }

  const ranges: Record<Estimate["tshirtSize"], [number, number]> = {
    XS: [1, 2],
    S: [2, 4],
    M: [4, 8],
    L: [8, 12],
    XL: [12, 16],
  };
  const usage: Record<Estimate["tshirtSize"], [number, number]> = {
    XS: [50, 150],
    S: [150, 400],
    M: [400, 1000],
    L: [1000, 2500],
    XL: [2500, 5000],
  };
  const [effortMin, effortMax] = ranges[tshirtSize];
  const [usageMin, usageMax] = usage[tshirtSize];
  const assumptions = [
    "Effort ranges are indicative scoping estimates, not delivery commitments.",
    "Vercel usage ranges exclude third-party services and negotiated enterprise pricing.",
  ];
  if (inputs.monthlyTraffic === undefined) assumptions.push("Monthly traffic is unknown.");
  if (inputs.catalogSize === undefined) assumptions.push("Catalog size is unknown.");

  return {
    tshirtSize,
    effortRangeWeeks: { min: effortMin, max: effortMax },
    vercelUsageRangeUsdMonthly: { min: usageMin, max: usageMax },
    assumptions,
  };
}
