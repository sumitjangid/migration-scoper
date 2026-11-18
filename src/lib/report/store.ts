import type { Report } from "../analyse/schemas";

const reports = new Map<string, Report>();

export function saveReport(report: Report): string {
  const id = crypto.randomUUID();
  reports.set(id, report);
  return id;
}

export function getReport(id: string): Report | undefined {
  return reports.get(id);
}
