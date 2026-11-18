import type { CrawlResult } from "../crawl/types";
import { ReportSchema, type Report } from "./schemas";
import { analyseRendering } from "./rendering";
import { analyseRisks } from "./risks";
import { estimateProject, type EstimateInputs } from "./estimate";
import { generateDiscoveryQuestions } from "./questions";

export function createReport(crawl: CrawlResult, inputs: EstimateInputs = {}): Report {
  const assumptionsAndUnknowns = [
    "Only public pages were observed; authenticated and backend behavior remains unknown.",
  ];
  if (!crawl.robotsAllowed) assumptionsAndUnknowns.push(crawl.robotsNote);

  return ReportSchema.parse({
    requestedUrl: crawl.requestedUrl,
    platform: crawl.platform,
    templates: analyseRendering(crawl.pages),
    risks: analyseRisks(crawl.pages),
    estimate: estimateProject(crawl.pages, inputs),
    discoveryQuestions: generateDiscoveryQuestions(crawl.pages),
    phasedOutline: [
      { phase: "Discovery", summary: "Validate templates, integrations, checkout boundaries, and unknown requirements." },
      { phase: "Implementation", summary: "Build the rendering architecture, migrations, integrations, SEO, and QA." },
      { phase: "Launch", summary: "Complete redirects, cutover, monitoring, performance tuning, and rollout." },
    ],
    assumptionsAndUnknowns,
    analyzedAt: new Date().toISOString(),
  });
}
