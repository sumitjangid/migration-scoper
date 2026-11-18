"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ReportSchema, type Report } from "../../../lib/analyse/schemas";
import { renderMarkdown } from "../../../lib/report/markdown";
import { getBrowserReport } from "../../../lib/report/browser-store";

export default function ReportPage({ params }: { params: Promise<{ id: string }> }) {
  const [report, setReport] = useState<Report | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    params.then(async ({ id }) => {
      const savedReport = getBrowserReport(window.localStorage, id);
      if (savedReport) {
        setReport(savedReport);
        return;
      }

      const response = await fetch(`/api/reports/${id}`);
      const data: unknown = await response.json();
      if (!response.ok) {
        const error = data && typeof data === "object" && "error" in data ? data.error : undefined;
        throw new Error(typeof error === "string" ? error : "Report not found.");
      }
      setReport(ReportSchema.parse(data));
    }).catch((cause) => setError(cause instanceof Error ? cause.message : "Report not found."));
  }, [params]);

  function downloadMarkdown() {
    if (!report) return;
    const blob = new Blob([renderMarkdown(report)], { type: "text/markdown;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = "migration-scope-report.md";
    anchor.click();
    URL.revokeObjectURL(url);
  }

  if (error) {
    return <main className="report-shell"><p className="report-error">{error}</p></main>;
  }
  if (!report) {
    return <main className="report-shell"><p className="loading-state">Preparing your report...</p></main>;
  }

  return (
    <main className="report-shell">
      <header className="topbar">
        <Link className="brand" href="/" aria-label="Migration Copilot home">
          <span className="brand-mark">M</span>
          <span>Migration Copilot</span>
        </Link>
        <Link className="back-link" href="/">← New analysis</Link>
      </header>
      <div className="report-content">
        <div className="report-heading">
          <div>
            <p className="eyebrow"><span className="status-dot" /> Migration scope / Report</p>
            <h1>{report.requestedUrl}</h1>
          </div>
          <button onClick={downloadMarkdown} className="secondary-button">
            Download report <span aria-hidden="true">↓</span>
          </button>
        </div>

        <section className="metrics-grid">
          <Metric label="Platform" value={`${report.platform.name} (${Math.round(report.platform.confidence * 100)}%)`} />
          <Metric label="Project size" value={report.estimate.tshirtSize} />
          <Metric label="Effort" value={`${report.estimate.effortRangeWeeks.min}-${report.estimate.effortRangeWeeks.max} weeks`} />
          <Metric label="Monthly Vercel usage" value={`$${report.estimate.vercelUsageRangeUsdMonthly.min}–$${report.estimate.vercelUsageRangeUsdMonthly.max}`} />
        </section>

        <Section title="Rendering recommendations">
          <div className="report-card-list">
            {report.templates.map((item) => (
              <article key={item.template} className="report-card">
                <div className="card-title-row">
                  <h3>{item.template}</h3>
                  <span className="strategy-tag">{item.strategy}</span>
                </div>
                <p>{item.rationale}</p>
                {item.evidence.length > 0 && <p className="evidence-line"><strong>Evidence:</strong> {item.evidence.join(" · ")}</p>}
                {item.assumption && <span className="assumption-tag">Assumption</span>}
              </article>
            ))}
          </div>
        </Section>

        <Section title="Risk register">
          <div className="report-card-list">
            {report.risks.map((risk) => (
              <article key={risk.id} className="report-card">
                <div className="card-title-row">
                  <h3>{risk.title}</h3>
                  <span className={`severity-tag severity-${risk.severity}`}>{risk.severity}</span>
                </div>
                <p className="card-meta">{risk.category}</p>
                {risk.evidence.map((evidence) => <p key={evidence} className="evidence-line">{evidence}</p>)}
                {risk.assumption && <span className="assumption-tag">Assumption</span>}
              </article>
            ))}
          </div>
        </Section>

        <Section title="Discovery questions">
          <ul className="report-card-list question-list">
            {report.discoveryQuestions.map((item) => (
              <li key={item.topic} className="report-card">
                <span className="card-meta">{item.topic}</span>
                <h3>{item.question}</h3>
                <p>{item.reason}</p>
              </li>
            ))}
          </ul>
        </Section>

        <Section title="Assumptions and unknowns">
          <ul className="unknowns-list">
            {report.assumptionsAndUnknowns.map((item) => <li key={item}><span aria-hidden="true">↳</span>{item}</li>)}
            {report.estimate.assumptions.map((item) => <li key={item}><span aria-hidden="true">↳</span>{item}</li>)}
          </ul>
        </Section>

        <Section title="Phased outline">
          <div className="phase-grid">
            {report.phasedOutline.map((phase) => (
              <article key={phase.phase} className="phase-card">
                <span className="card-meta">{String(report.phasedOutline.indexOf(phase) + 1).padStart(2, "0")}</span>
                <h3>{phase.phase}</h3>
                <p>{phase.summary}</p>
              </article>
            ))}
          </div>
        </Section>
      </div>
      <footer className="landing-footer report-footer">
        <span>BUILT FOR THE COMPLEX PARTS.</span>
        <span>Evidence over guesswork.</span>
      </footer>
    </main>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="metric-card">
      <p>{label}</p>
      <strong>{value}</strong>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="report-section">
      <div className="section-heading">
        <span aria-hidden="true">/</span>
        <h2>{title}</h2>
      </div>
      {children}
    </section>
  );
}
