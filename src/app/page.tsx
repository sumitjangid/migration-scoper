"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ReportSchema } from "../lib/analyse/schemas";
import { saveBrowserReport } from "../lib/report/browser-store";

export default function Home() {
  const router = useRouter();
  const [url, setUrl] = useState("");
  const [traffic, setTraffic] = useState("");
  const [catalog, setCatalog] = useState("");
  const [status, setStatus] = useState<"idle" | "running" | "error">("idle");
  const [error, setError] = useState("");

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setStatus("running");
    setError("");

    try {
      const response = await fetch("/api/scope", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          url,
          monthlyTraffic: traffic ? Number(traffic) : undefined,
          catalogSize: catalog ? Number(catalog) : undefined,
        }),
      });
      const data: { id?: unknown; report?: unknown; error?: unknown } = await response.json();
      if (!response.ok) {
        throw new Error(typeof data.error === "string" ? data.error : "Scope analysis failed.");
      }
      if (typeof data.id !== "string") throw new Error("The scope response did not include a report ID.");
      const report = ReportSchema.parse(data.report);
      saveBrowserReport(window.localStorage, data.id, report);
      router.push(`/report/${data.id}`);
    } catch (cause) {
      setStatus("error");
      setError(cause instanceof Error ? cause.message : "Scope analysis failed.");
    }
  }

  return (
    <main className="site-shell">
      <header className="topbar">
        <Link className="brand" href="/" aria-label="Migration Copilot home">
          <span className="brand-mark">M</span>
          <span>Migration Copilot</span>
        </Link>
        <span className="topbar-note">Storefront migration, made legible.</span>
      </header>

      <section className="hero-wrap">
        <div className="hero-copy">
          <p className="eyebrow"><span className="status-dot" /> Public storefront analysis</p>
          <h1>Big migration.<br /><span>Clear next move.</span></h1>
          <p className="hero-description">
            Turn a storefront URL into an implementation brief. We map page
            templates, surface technical risks, and make the unknowns explicit.
          </p>
          <div className="hero-footnote">
            <span className="footnote-number">01—03</span>
            <span>Crawl · Analyse · Make a plan</span>
          </div>
        </div>

        <div className="form-panel">
          <div className="panel-heading">
            <div>
              <p className="panel-kicker">Start with a URL</p>
              <h2>Scope your storefront</h2>
            </div>
            <span className="panel-index">M / 02</span>
          </div>
          {status === "running" ? (
            <div className="crawl-progress" role="status" aria-live="polite">
              <div className="crawl-map" aria-hidden="true">
                <div className="data-stream data-stream-one">0101 / 1100 / 010</div>
                <div className="data-stream data-stream-two">1010 / 0011 / 101</div>
                <svg viewBox="0 0 360 206" focusable="false">
                  <path className="map-path map-path-main" d="M180 103 104 54M180 103 94 145M180 103 263 49M180 103 276 145M104 54 48 30M104 54 72 91M94 145 45 177M94 145 131 181M263 49 313 27M263 49 292 88M276 145 323 177M276 145 226 183" />
                  <path className="map-path map-path-secondary" d="M104 54 94 145M263 49 276 145M72 91 45 177M292 88 323 177" />
                  <circle className="map-node map-node-root" cx="180" cy="103" r="13" />
                  <circle className="map-node map-node-level-one" cx="104" cy="54" r="8" />
                  <circle className="map-node map-node-level-one" cx="94" cy="145" r="8" />
                  <circle className="map-node map-node-level-one" cx="263" cy="49" r="8" />
                  <circle className="map-node map-node-level-one" cx="276" cy="145" r="8" />
                  <circle className="map-node map-node-level-two" cx="48" cy="30" r="5" />
                  <circle className="map-node map-node-level-two" cx="72" cy="91" r="5" />
                  <circle className="map-node map-node-level-two" cx="45" cy="177" r="5" />
                  <circle className="map-node map-node-level-two" cx="131" cy="181" r="5" />
                  <circle className="map-node map-node-level-two" cx="313" cy="27" r="5" />
                  <circle className="map-node map-node-level-two" cx="292" cy="88" r="5" />
                  <circle className="map-node map-node-level-two" cx="323" cy="177" r="5" />
                  <circle className="map-node map-node-level-two" cx="226" cy="183" r="5" />
                </svg>
                <span className="map-label map-label-root">STOREFRONT</span>
                <span className="map-label map-label-left">PAGES</span>
                <span className="map-label map-label-right">LINKS</span>
              </div>
              <h3>Mapping your storefront</h3>
              <p>Following public pages and preparing your migration brief.</p>
              <span className="crawl-wait-note">Larger sites can take a little longer.</span>
            </div>
          ) : (
            <form onSubmit={submit}>
              <div className="field">
                <label htmlFor="url">Storefront URL</label>
                <input
                  id="url"
                  type="url"
                  required
                  value={url}
                  onChange={(event) => setUrl(event.target.value)}
                  placeholder="https://store.example.com"
                />
              </div>

              <div className="field-row">
                <div className="field">
                  <label htmlFor="traffic">Monthly visits <span>Optional</span></label>
                  <input
                    id="traffic"
                    type="number"
                    min="0"
                    value={traffic}
                    onChange={(event) => setTraffic(event.target.value)}
                    placeholder="500,000"
                  />
                </div>
                <div className="field">
                  <label htmlFor="catalog">Catalog size <span>Optional</span></label>
                  <input
                    id="catalog"
                    type="number"
                    min="0"
                    value={catalog}
                    onChange={(event) => setCatalog(event.target.value)}
                    placeholder="10,000"
                  />
                </div>
              </div>

              {status === "error" && <p role="alert" className="form-error">{error}</p>}

              <button type="submit" className="primary-button">
                <span>Generate scope report</span>
                <span aria-hidden="true">↗</span>
              </button>
              <p className="form-note">Only public pages are scanned. Robots.txt rules are respected.</p>
            </form>
          )}
        </div>
      </section>

      <aside className="disclaimer" aria-label="Responsible use notice">
        <strong>Use only with permission.</strong>
        <span>
          Public access and robots.txt do not grant authorization. Crawling can
          still create load or side effects, and reports are estimates—not
          professional advice or a guaranteed migration plan.
        </span>
      </aside>

      <footer className="landing-footer">
        <span>BUILT FOR THE COMPLEX PARTS.</span>
        <span>Evidence over guesswork.</span>
      </footer>
    </main>
  );
}
