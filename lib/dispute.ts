// ─── AI Dispute Assistant — evidence model ───────────────────────────────────
//
// The Dispute Assistant never decides who is right. It reads what ProofVault
// already stores for a project (or a single deliverable), assembles it into a
// neutral evidence bundle, and produces a factual summary of that bundle.
//
// This module is shared by the API route (which builds the bundle and, when an
// Anthropic API key is configured, asks Claude to phrase the summary) and by
// the UI (which renders the result). It contains no database or network code,
// so it is safe to import from both server and client components.

import { formatMoney, formatDate, formatDateTime, shortRef } from "./format";
import { toNum, type Deliverable, type Project } from "./types";

export const DISPUTE_DISCLAIMER =
  "This summary organizes the records stored in ProofVault. It is not legal advice, " +
  "and it does not determine who is right or who is at fault in a dispute.";

export const NOT_RECORDED = "Not recorded in ProofVault.";

// ─── Evidence bundle ──────────────────────────────────────────────────────────

export interface DisputeEvidenceDeliverable {
  ref: string;
  title: string;
  notes: string | null;
  amount: number;
  amount_formatted: string;
  delivered_at: string | null;
  delivered_at_display: string;
  proof_file_attached: boolean;
  proof_file_name: string | null;
  proof_file_url: string | null;
  client_acknowledged: boolean;
  client_acknowledged_at: string | null;
  client_acknowledgement_note: string | null;
  paid: boolean;
  paid_at: string | null;
}

export interface DisputePaymentEntry {
  ref: string;
  deliverable_title: string;
  amount_formatted: string;
  recorded_paid_at: string | null;
  recorded_paid_at_display: string;
}

export interface DisputeActivityEntry {
  at: string;
  at_display: string;
  event: string;
}

export interface DisputeEvidence {
  generated_at: string;
  scope: "project" | "deliverable";
  client: {
    name: string;
    total_projects_for_client: number | null;
  };
  project: {
    id: string;
    client_name: string;
    platform: string | null;
    description: string | null;
    status: string;
    currency: string;
    created_at: string;
    created_at_display: string;
    agreed_amount: number;
    agreed_amount_formatted: string;
  };
  deliverables: DisputeEvidenceDeliverable[];
  totals: {
    deliverable_count: number;
    delivered_value: number;
    delivered_value_formatted: string;
    paid_value: number;
    paid_value_formatted: string;
    unpaid_value: number;
    unpaid_value_formatted: string;
    paid_count: number;
    unpaid_count: number;
    acknowledged_count: number;
    proof_file_count: number;
  };
  payment_history: DisputePaymentEntry[];
  activity: DisputeActivityEntry[];
  data_gaps: string[];
}

// ─── Report shape ─────────────────────────────────────────────────────────────

export interface DisputeReport {
  headline: string;
  what_was_delivered: string;
  when_delivered: string;
  proof_available: string;
  client_acknowledgement: string;
  payment_amount: string;
  payment_history: string;
  payment_status: string;
  missing_or_inconsistent: string[];
  neutral_observations: string;
}

export interface DisputeResult {
  source: "ai" | "records";
  notice: string | null;
  disclaimer: string;
  report: DisputeReport;
  evidence: DisputeEvidence;
}

export const DISPUTE_SECTIONS: { key: keyof DisputeReport; label: string }[] = [
  { key: "what_was_delivered", label: "Delivered" },
  { key: "when_delivered", label: "Delivered on" },
  { key: "proof_available", label: "Proof" },
  { key: "client_acknowledgement", label: "Acknowledgement" },
  { key: "payment_amount", label: "Amount" },
  { key: "payment_history", label: "Payment history" },
  { key: "payment_status", label: "Payment status" },
];

// ─── Evidence builder ─────────────────────────────────────────────────────────

function mapDeliverable(d: Deliverable, currency: string): DisputeEvidenceDeliverable {
  const amount = toNum(d.amount);
  return {
    ref: shortRef(d.id),
    title: d.title,
    notes: d.notes ?? null,
    amount,
    amount_formatted: formatMoney(amount, currency),
    delivered_at: d.created_at ?? null,
    delivered_at_display: d.created_at ? formatDateTime(d.created_at) : NOT_RECORDED,
    proof_file_attached: Boolean(d.file_url),
    proof_file_name: d.file_name ?? null,
    proof_file_url: d.file_url ?? null,
    client_acknowledged: Boolean(d.acknowledged),
    client_acknowledged_at: d.acknowledged_at ?? null,
    client_acknowledgement_note: d.acknowledgement_note ?? null,
    paid: Boolean(d.paid),
    paid_at: d.paid_at ?? null,
  };
}

export function buildDisputeEvidence(params: {
  project: Project;
  deliverables: Deliverable[];
  focusDeliverableId?: string | null;
  clientProjectCount?: number | null;
}): DisputeEvidence {
  const { project, focusDeliverableId } = params;
  const currency = project.currency || "USD";

  const scope: DisputeEvidence["scope"] = focusDeliverableId ? "deliverable" : "project";
  const inScope = focusDeliverableId
    ? params.deliverables.filter((d) => d.id === focusDeliverableId)
    : params.deliverables;

  const deliverables = inScope
    .slice()
    .sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime())
    .map((d) => mapDeliverable(d, currency));

  const deliveredValue = deliverables.reduce((s, d) => s + d.amount, 0);
  const paidValue = deliverables.filter((d) => d.paid).reduce((s, d) => s + d.amount, 0);
  const unpaidValue = deliverables.filter((d) => !d.paid).reduce((s, d) => s + d.amount, 0);

  const paymentHistory: DisputePaymentEntry[] = deliverables
    .filter((d) => d.paid)
    .sort((a, b) => {
      const at = new Date(a.paid_at ?? a.delivered_at ?? 0).getTime();
      const bt = new Date(b.paid_at ?? b.delivered_at ?? 0).getTime();
      return at - bt;
    })
    .map((d) => ({
      ref: d.ref,
      deliverable_title: d.title,
      amount_formatted: d.amount_formatted,
      recorded_paid_at: d.paid_at,
      recorded_paid_at_display: d.paid_at
        ? formatDateTime(d.paid_at)
        : "Marked paid — exact date not recorded.",
    }));

  // Activity trail assembled from the timestamps ProofVault stores.
  const activity: DisputeActivityEntry[] = [];
  if (scope === "project") {
    activity.push({
      at: project.created_at,
      at_display: formatDateTime(project.created_at),
      event: `Project created for client "${project.client_name}".`,
    });
  }
  for (const d of deliverables) {
    if (d.delivered_at) {
      activity.push({
        at: d.delivered_at,
        at_display: d.delivered_at_display,
        event: `Deliverable logged: "${d.title}" (${d.amount_formatted})${
          d.proof_file_attached ? " with an attached proof file" : " with no proof file"
        }.`,
      });
    }
    if (d.client_acknowledged && d.client_acknowledged_at) {
      activity.push({
        at: d.client_acknowledged_at,
        at_display: formatDateTime(d.client_acknowledged_at),
        event: `Client acknowledgement recorded for "${d.title}".`,
      });
    }
    if (d.paid && d.paid_at) {
      activity.push({
        at: d.paid_at,
        at_display: formatDateTime(d.paid_at),
        event: `Payment recorded for "${d.title}" (${d.amount_formatted}).`,
      });
    }
  }
  activity.sort((a, b) => new Date(a.at).getTime() - new Date(b.at).getTime());

  // ── Gaps and inconsistencies, detected only from stored data ───────────────
  const gaps: string[] = [];

  if (deliverables.length === 0) {
    gaps.push("No deliverables are recorded for this project.");
  }

  const noProof = deliverables.filter((d) => !d.proof_file_attached);
  if (noProof.length > 0) {
    gaps.push(
      `${noProof.length} of ${deliverables.length} deliverable(s) have no proof file attached: ${noProof
        .map((d) => `"${d.title}"`)
        .join(", ")}.`
    );
  }

  const noAck = deliverables.filter((d) => !d.client_acknowledged);
  if (noAck.length > 0) {
    gaps.push(
      `No client acknowledgement is recorded for ${noAck.length} of ${deliverables.length} deliverable(s).`
    );
  }

  const paidWithoutDate = deliverables.filter((d) => d.paid && !d.paid_at);
  if (paidWithoutDate.length > 0) {
    gaps.push(
      `${paidWithoutDate.length} deliverable(s) are marked paid without a recorded payment date.`
    );
  }

  const unpaidButAcknowledged = deliverables.filter((d) => !d.paid && d.client_acknowledged);
  if (unpaidButAcknowledged.length > 0) {
    gaps.push(
      `${unpaidButAcknowledged.length} deliverable(s) are recorded as acknowledged by the client but not marked paid.`
    );
  }

  if (scope === "project") {
    const agreed = toNum(project.agreed_amount);
    if (agreed === 0) {
      gaps.push("No agreed project amount is recorded.");
    } else if (deliveredValue > agreed) {
      gaps.push(
        `Logged deliverable value (${formatMoney(deliveredValue, currency)}) exceeds the recorded agreed amount (${formatMoney(
          agreed,
          currency
        )}).`
      );
    }
    if (!project.description) {
      gaps.push("No scope or agreement notes are recorded for this project.");
    }
  }

  const agreedAmount = toNum(project.agreed_amount);

  return {
    generated_at: new Date().toISOString(),
    scope,
    client: {
      name: project.client_name,
      total_projects_for_client: params.clientProjectCount ?? null,
    },
    project: {
      id: project.id,
      client_name: project.client_name,
      platform: project.platform ?? null,
      description: project.description ?? null,
      status: project.status ?? "active",
      currency,
      created_at: project.created_at,
      created_at_display: formatDateTime(project.created_at),
      agreed_amount: agreedAmount,
      agreed_amount_formatted: formatMoney(agreedAmount, currency),
    },
    deliverables,
    totals: {
      deliverable_count: deliverables.length,
      delivered_value: deliveredValue,
      delivered_value_formatted: formatMoney(deliveredValue, currency),
      paid_value: paidValue,
      paid_value_formatted: formatMoney(paidValue, currency),
      unpaid_value: unpaidValue,
      unpaid_value_formatted: formatMoney(unpaidValue, currency),
      paid_count: deliverables.filter((d) => d.paid).length,
      unpaid_count: deliverables.filter((d) => !d.paid).length,
      acknowledged_count: deliverables.filter((d) => d.client_acknowledged).length,
      proof_file_count: deliverables.filter((d) => d.proof_file_attached).length,
    },
    payment_history: paymentHistory,
    activity,
    data_gaps: gaps,
  };
}

// ─── Deterministic summary (used when no AI key is configured, or on failure) ─

function listTitles(items: DisputeEvidenceDeliverable[], limit = 6): string {
  const shown = items.slice(0, limit).map((d) => `"${d.title}" (${d.amount_formatted})`);
  const rest = items.length - shown.length;
  return shown.join("; ") + (rest > 0 ? `; and ${rest} more` : "");
}

export function buildRecordsReport(e: DisputeEvidence): DisputeReport {
  const d = e.deliverables;
  const single = e.scope === "deliverable" ? d[0] : null;

  const headline =
    e.scope === "deliverable" && single
      ? `Evidence summary for deliverable "${single.title}" on the project for ${e.client.name}.`
      : `Evidence summary for the ${e.client.name} project: ${e.totals.deliverable_count} deliverable(s) logged, ` +
        `${e.totals.delivered_value_formatted} in delivered value, ${e.totals.paid_value_formatted} recorded as paid.`;

  const whatDelivered =
    d.length === 0
      ? "No deliverables are recorded for this project in ProofVault."
      : `${d.length} deliverable(s) recorded: ${listTitles(d)}. ` +
        `Total recorded value: ${e.totals.delivered_value_formatted}.` +
        (e.project.description
          ? ` Recorded scope notes: ${e.project.description}`
          : ` ${NOT_RECORDED} (no scope notes on the project).`);

  const whenDelivered =
    d.length === 0
      ? NOT_RECORDED
      : d.length === 1
      ? `Logged ${d[0].delivered_at_display}.`
      : `Entries were logged between ${d[0].delivered_at_display} and ${
          d[d.length - 1].delivered_at_display
        }. Project record created ${e.project.created_at_display}.`;

  const withProof = d.filter((x) => x.proof_file_attached);
  const proof =
    d.length === 0
      ? NOT_RECORDED
      : withProof.length === 0
      ? `No proof files are attached to any of the ${d.length} recorded deliverable(s). Each entry still carries a ProofVault timestamp.`
      : `${withProof.length} of ${d.length} deliverable(s) have an attached proof file: ${withProof
          .map((x) => `"${x.title}" — ${x.proof_file_name ?? "file attached"}`)
          .join("; ")}.`;

  const acked = d.filter((x) => x.client_acknowledged);
  const acknowledgement =
    d.length === 0
      ? NOT_RECORDED
      : acked.length === 0
      ? `No client acknowledgement or approval is recorded in ProofVault for any of the ${d.length} deliverable(s). This means it was not logged here — it does not indicate whether the client approved the work elsewhere.`
      : `${acked.length} of ${d.length} deliverable(s) have a recorded client acknowledgement: ${acked
          .map(
            (x) =>
              `"${x.title}"${
                x.client_acknowledged_at ? ` on ${formatDate(x.client_acknowledged_at)}` : ""
              }${x.client_acknowledgement_note ? ` — note: ${x.client_acknowledgement_note}` : ""}`
          )
          .join("; ")}.`;

  const paymentAmount =
    e.scope === "deliverable" && single
      ? `Recorded amount for this deliverable: ${single.amount_formatted}.`
      : `Agreed project amount: ${
          e.project.agreed_amount > 0 ? e.project.agreed_amount_formatted : NOT_RECORDED
        } Total logged deliverable value: ${e.totals.delivered_value_formatted}.`;

  const paymentHistory =
    e.payment_history.length === 0
      ? "No payments are recorded against these deliverables in ProofVault."
      : e.payment_history
          .map(
            (p) =>
              `${p.amount_formatted} for "${p.deliverable_title}" — ${p.recorded_paid_at_display}`
          )
          .join("; ") + `. Total recorded as paid: ${e.totals.paid_value_formatted}.`;

  const paymentStatus =
    d.length === 0
      ? NOT_RECORDED
      : e.totals.unpaid_count === 0
      ? `All ${e.totals.paid_count} recorded deliverable(s) are marked paid (${e.totals.paid_value_formatted}). Nothing is outstanding in these records.`
      : `${e.totals.unpaid_count} of ${d.length} deliverable(s) are marked unpaid, totalling ${e.totals.unpaid_value_formatted} outstanding. ${e.totals.paid_value_formatted} is recorded as paid.`;

  const observations = [
    `Project status in ProofVault: ${e.project.status}.`,
    `Platform: ${e.project.platform || "not recorded"}.`,
    e.client.total_projects_for_client && e.client.total_projects_for_client > 1
      ? `${e.client.name} has ${e.client.total_projects_for_client} projects recorded in this account.`
      : null,
    "All timestamps above are the times entries were recorded in ProofVault, not independently verified delivery times.",
  ]
    .filter(Boolean)
    .join(" ");

  return {
    headline,
    what_was_delivered: whatDelivered,
    when_delivered: whenDelivered,
    proof_available: proof,
    client_acknowledgement: acknowledgement,
    payment_amount: paymentAmount,
    payment_history: paymentHistory,
    payment_status: paymentStatus,
    missing_or_inconsistent:
      e.data_gaps.length > 0
        ? e.data_gaps
        : ["No missing fields or inconsistencies were detected in the stored records."],
    neutral_observations: observations,
  };
}
