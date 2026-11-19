import type { Report } from "../analyse/schemas";
import { enrichReportWithDiscoveryQuestions } from "./discovery";
import { enrichReportWithRationales } from "./rationale";
import { enrichReportWithSummary } from "./summary";

export async function enrichReportWithAI(report: Report): Promise<Report> {
  const results = await Promise.allSettled([
    enrichReportWithDiscoveryQuestions(report),
    enrichReportWithRationales(report),
    enrichReportWithSummary(report),
  ]);
  const names = ["discovery questions", "rendering rationales", "executive summary"];
  results.forEach((result, index) => {
    if (result.status === "rejected") {
      const reason = result.reason instanceof Error ? result.reason.message : "Unknown error.";
      console.error(`AI ${names[index]} unavailable: ${reason}`);
    }
  });

  const aiReports = results.flatMap((result) =>
    result.status === "fulfilled" && result.value.ai ? [result.value.ai] : [],
  );
  const questions = aiReports.find((item) => item.questions)?.questions;
  const rationales = aiReports.find((item) => item.rationales)?.rationales;
  const summary = aiReports.find((item) => item.summary)?.summary;
  if (!questions && !rationales && !summary) return report;

  const model = aiReports.find((item) => item.model)?.model;
  if (!model) return report;

  return {
    ...report,
    ai: {
      ...(questions ? { questions } : {}),
      ...(rationales ? { rationales } : {}),
      ...(summary ? { summary } : {}),
      model,
      generatedAt: new Date().toISOString(),
    },
  };
}
