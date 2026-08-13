"use client";

import { useCallback, useState } from "react";
import { useToast } from "@/components/toast";
import { ShieldIcon, SparkIcon } from "@/components/icons";
import { formatDateTime } from "@/lib/format";
import { DISPUTE_SECTIONS, type DisputeResult } from "@/lib/dispute";
import { downloadDisputePdf } from "@/lib/dispute-pdf";

interface DeliverableOption {
  id: string;
  title: string;
}

interface DisputeAssistantSectionProps {
  projectId: string;
  clientName: string;
  deliverables: DeliverableOption[];
}

const ALL = "all";

export function DisputeAssistantSection({
  projectId,
  clientName,
  deliverables,
}: DisputeAssistantSectionProps) {
  const { toast } = useToast();
  const [scope, setScope] = useState<string>(ALL);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<DisputeResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [analyzedScope, setAnalyzedScope] = useState<string>(ALL);
  const [downloading, setDownloading] = useState(false);

  const analyze = useCallback(
    async (target: string) => {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch("/api/dispute", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ projectId, deliverableId: target === ALL ? null : target }),
        });

        const json = await res.json().catch(() => ({}));

        if (!res.ok || !json.success) {
          setError(json.error ?? "Could not build the summary. Please try again.");
          setResult(null);
          return;
        }

        setResult(json.data as DisputeResult);
        setAnalyzedScope(target);
      } catch {
        setError("A network error occurred. Please try again.");
        setResult(null);
      } finally {
        setLoading(false);
      }
    },
    [projectId]
  );

  const scopeLabel =
    analyzedScope === ALL
      ? clientName
      : deliverables.find((d) => d.id === analyzedScope)?.title ?? "Selected deliverable";

  async function copySummary() {
    if (!result) return;

    const lines = [
      "ProofVault — Delivery Summary",
      scopeLabel,
      `Generated ${formatDateTime(result.evidence.generated_at)}`,
      "",
      result.report.headline,
      "",
      ...DISPUTE_SECTIONS.map(
        ({ key, label }) => `${label.toUpperCase()}\n${result.report[key] as string}\n`
      ),
      "MISSING EVIDENCE",
      ...result.report.missing_or_inconsistent.map((item) => `- ${item}`),
      "",
      result.report.neutral_observations,
      "",
      result.disclaimer,
    ];

    try {
      await navigator.clipboard.writeText(lines.join("\n"));
      toast("Summary copied to clipboard.", "success");
    } catch {
      toast("Could not copy to clipboard.", "error");
    }
  }

  async function downloadPdf() {
    if (!result) return;
    setDownloading(true);
    try {
      await downloadDisputePdf(result, scopeLabel, clientName);
      toast("Summary downloaded as PDF.", "success");
    } catch {
      toast("Could not generate the PDF. Please try again.", "error");
    } finally {
      setDownloading(false);
    }
  }

  const totals = result?.evidence.totals;

  return (
    <section id="dispute-assistant" className="surface mb-6 overflow-hidden scroll-mt-6">
      {/* ── Header ── */}
      <div className="flex flex-col gap-4 border-b border-taupe-200 bg-gradient-to-r from-sand-100/70 to-transparent px-5 py-5 sm:px-6 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex items-center gap-3.5">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-wine-950 text-cream-50">
            <SparkIcon className="h-5 w-5" />
          </span>
          <div>
            {/* <p className="section-kicker">dispute assistant</p> */}
            <h2 className="mt-0.5 text-xl font-semibold tracking-tight text-wine-950">
              Delivery Summary
            </h2>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <select
            aria-label="Scope to analyze"
            value={scope}
            onChange={(e) => setScope(e.target.value)}
            disabled={loading}
            className="rounded-full border border-taupe-200 bg-cream-50 px-4 py-2.5 text-[13px] font-medium text-ember-700 outline-none transition focus:border-wine-700 focus:ring-2 focus:ring-wine-700/20 disabled:opacity-50"
          >
            <option value={ALL}>Whole project</option>
            {deliverables.map((d) => (
              <option key={d.id} value={d.id}>
                {d.title}
              </option>
            ))}
          </select>
          <button
            type="button"
            onClick={() => void analyze(scope)}
            disabled={loading}
            className="btn-primary whitespace-nowrap"
          >
            {loading ? "Analyzing…" : result ? "Re-analyze" : "Analyze"}
          </button>
        </div>
      </div>

      {/* ── Body ── */}
      <div className="px-5 py-6 sm:px-6">
        {/* Idle */}
        {!loading && !error && !result && (
          <p className="py-8 text-center text-sm text-taupe-600">
            A neutral summary of what your records show — delivery, proof, acknowledgement and
            payment.
          </p>
        )}

        {/* Loading */}
        {loading && (
          <div className="py-12 text-center">
            <svg className="mx-auto h-5 w-5 animate-spin text-wine-900" viewBox="0 0 24 24" fill="none">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" />
              <path
                className="opacity-75"
                d="M4 12a8 8 0 0 1 8-8"
                stroke="currentColor"
                strokeWidth="3"
                strokeLinecap="round"
              />
            </svg>
            <p className="mt-3 text-sm text-taupe-600">Reading your records…</p>
          </div>
        )}

        {/* Error */}
        {!loading && error && (
          <div className="rounded-2xl border border-wine-900/15 bg-wine-100 px-5 py-4" role="alert">
            <p className="text-sm font-semibold text-wine-950">{error}</p>
            <button onClick={() => void analyze(scope)} className="btn-secondary mt-3 text-[12px]">
              Try again
            </button>
          </div>
        )}

        {/* Result */}
        {!loading && !error && result && totals && (
          <div className="space-y-6">
            {/* Headline + meta */}
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <p className="max-w-3xl text-[15px] leading-7 text-wine-950">
                {result.report.headline}
              </p>
              <div className="flex shrink-0 items-center gap-2 self-start">
                <button onClick={copySummary} className="btn-ghost text-[12px]">
                  Copy
                </button>
                <button
                  onClick={downloadPdf}
                  disabled={downloading}
                  className="btn-secondary text-[12px]"
                >
                  <svg viewBox="0 0 16 16" aria-hidden="true" className="h-3.5 w-3.5" fill="none">
                    <path
                      d="M8 2v8m0 0L5 7m3 3 3-3M3 12v1.5h10V12"
                      stroke="currentColor"
                      strokeWidth="1.5"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                  {downloading ? "Preparing…" : "PDF"}
                </button>
              </div>
            </div>

            <p className="text-[11px] uppercase tracking-[0.18em] text-taupe-500">
              {scopeLabel} · {result.source === "ai" ? "AI-written" : "From records"} ·{" "}
              {formatDateTime(result.evidence.generated_at)}
            </p>

            {/* Metrics */}
            <div className="grid grid-cols-2 gap-px overflow-hidden rounded-[22px] border border-taupe-200 bg-taupe-200 sm:grid-cols-4">
              {[
                { label: "Delivered", value: totals.delivered_value_formatted },
                { label: "Proof files", value: `${totals.proof_file_count}/${totals.deliverable_count}` },
                { label: "Acknowledged", value: `${totals.acknowledged_count}/${totals.deliverable_count}` },
                { label: "Outstanding", value: totals.unpaid_value_formatted },
              ].map((tile) => (
                <div key={tile.label} className="bg-cream-50 px-4 py-3.5">
                  <p className="text-[10px] uppercase tracking-[0.2em] text-taupe-600">
                    {tile.label}
                  </p>
                  <p className="mt-1 text-[15px] font-semibold text-wine-950">{tile.value}</p>
                </div>
              ))}
            </div>

            {/* Summary rows */}
            <dl className="divide-y divide-taupe-100">
              {DISPUTE_SECTIONS.map(({ key, label }) => (
                <div key={key} className="grid gap-1 py-3.5 lg:grid-cols-[10rem_1fr] lg:gap-6">
                  <dt className="text-[10px] uppercase tracking-[0.2em] text-taupe-600 lg:pt-1">
                    {label}
                  </dt>
                  <dd className="text-[13.5px] leading-6 text-ember-700/90">
                    {result.report[key] as string}
                  </dd>
                </div>
              ))}
              <div className="grid gap-1 py-3.5 lg:grid-cols-[10rem_1fr] lg:gap-6">
                <dt className="text-[10px] uppercase tracking-[0.2em] text-taupe-600 lg:pt-1">
                  Context
                </dt>
                <dd className="text-[13.5px] leading-6 text-ember-700/90">
                  {result.report.neutral_observations}
                </dd>
              </div>
            </dl>

            {/* Gaps */}
            <div className="rounded-[22px] border border-wine-900/15 bg-wine-100 px-5 py-4">
              <p className="text-[10px] uppercase tracking-[0.2em] text-wine-950/70">
                Missing evidence
              </p>
              <ul className="mt-2.5 space-y-1.5">
                {result.report.missing_or_inconsistent.map((item, i) => (
                  <li
                    key={i}
                    className="flex items-start gap-2.5 text-[13px] leading-6 text-wine-950"
                  >
                    <span
                      aria-hidden="true"
                      className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-wine-900"
                    />
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </div>

            {/* Underlying records — collapsed by default */}
            <details className="group rounded-[22px] border border-taupe-200 bg-cream-50">
              <summary className="flex cursor-pointer list-none items-center justify-between px-5 py-3.5 text-[10px] uppercase tracking-[0.2em] text-taupe-600 transition hover:text-wine-950 [&::-webkit-details-marker]:hidden">
                Records used
                <svg
                  viewBox="0 0 16 16"
                  aria-hidden="true"
                  className="h-3.5 w-3.5 text-taupe-400 transition-transform duration-200 group-open:rotate-180"
                  fill="none"
                >
                  <path d="M4 6l4 4 4-4" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </summary>

              <div className="border-t border-taupe-200 px-5 py-4">
                {result.evidence.deliverables.length === 0 ? (
                  <p className="text-[13px] text-taupe-600">No deliverables recorded.</p>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full border-separate border-spacing-0 text-left text-[13px]">
                      <thead>
                        <tr className="text-[10px] uppercase tracking-[0.18em] text-taupe-500">
                          <th className="pb-2 pr-4 font-semibold">Deliverable</th>
                          <th className="pb-2 pr-4 text-right font-semibold">Amount</th>
                          <th className="pb-2 pr-4 font-semibold">Logged</th>
                          <th className="pb-2 pr-4 font-semibold">Proof</th>
                          <th className="pb-2 pr-4 font-semibold">Ack.</th>
                          <th className="pb-2 font-semibold">Payment</th>
                        </tr>
                      </thead>
                      <tbody>
                        {result.evidence.deliverables.map((d) => (
                          <tr key={d.ref} className="border-t border-taupe-100">
                            <td className="py-2.5 pr-4 font-medium text-wine-950">{d.title}</td>
                            <td className="whitespace-nowrap py-2.5 pr-4 text-right font-mono text-wine-950">
                              {d.amount_formatted}
                            </td>
                            <td className="whitespace-nowrap py-2.5 pr-4 text-ember-700/80">
                              {d.delivered_at_display}
                            </td>
                            <td className="py-2.5 pr-4 text-ember-700/80">
                              {d.proof_file_attached ? "Yes" : "—"}
                            </td>
                            <td className="py-2.5 pr-4 text-ember-700/80">
                              {d.client_acknowledged ? "Yes" : "—"}
                            </td>
                            <td className="py-2.5 text-ember-700/80">{d.paid ? "Paid" : "Unpaid"}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}

                {result.evidence.activity.length > 0 && (
                  <ol className="mt-5 space-y-1.5 border-t border-taupe-100 pt-4">
                    {result.evidence.activity.map((a, i) => (
                      <li
                        key={i}
                        className="flex flex-wrap gap-x-3 text-[12.5px] leading-6 text-ember-700/85"
                      >
                        <span className="shrink-0 tabular-nums text-taupe-500">{a.at_display}</span>
                        <span>{a.event}</span>
                      </li>
                    ))}
                  </ol>
                )}

                {result.notice && (
                  <p className="mt-4 text-[11px] text-taupe-500">{result.notice}</p>
                )}
              </div>
            </details>
          </div>
        )}
      </div>

      {/* ── Footer ── */}
      <div className="flex items-center gap-2.5 border-t border-taupe-200 px-5 py-3 sm:px-6">
        <ShieldIcon className="h-3.5 w-3.5 shrink-0 text-taupe-500" />
        <p className="text-[11px] text-taupe-600">
          Organizes your ProofVault records. Not a ruling, not legal advice.
        </p>
      </div>
    </section>
  );
}
