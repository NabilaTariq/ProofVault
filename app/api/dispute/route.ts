import { NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { createClient } from "@/lib/supabase/server";
import {
  buildDisputeEvidence,
  buildRecordsReport,
  DISPUTE_DISCLAIMER,
  type DisputeEvidence,
  type DisputeReport,
  type DisputeResult,
} from "@/lib/dispute";
import type { Deliverable, Project } from "@/lib/types";

export const dynamic = "force-dynamic";

// ─── Model configuration ──────────────────────────────────────────────────────

const MODEL = "claude-opus-5";

const SYSTEM_PROMPT = `You are the ProofVault Dispute Assistant. A freelancer has opened a dispute review for one project (or one deliverable) in their delivery ledger.

Your only job is to organize and summarize the evidence the freelancer already recorded in ProofVault. You are not deciding a dispute.

Rules you must follow without exception:
- Use only the JSON evidence bundle provided in the user message. It is the complete record.
- Never invent, estimate, or infer facts that are not in the bundle. Do not guess dates, amounts, approvals, or communications.
- When a piece of information is absent, say plainly that it is not recorded in ProofVault, and note that absence from these records does not mean the event did not happen elsewhere.
- Stay neutral and factual. Do not say or imply that the freelancer or the client is at fault, in breach, negligent, or legally in the wrong.
- Do not give legal advice, recommend legal action, or characterize anything as a legal claim, breach of contract, or violation.
- Do not recommend what the user should do next beyond noting which records are missing or inconsistent.
- Describe timestamps as the time an entry was recorded in ProofVault, not as independently verified proof of delivery.
- Write in plain, calm prose. Cite the concrete values from the bundle (titles, amounts, dates) so the summary is checkable against the record.

For "missing_or_inconsistent", list only gaps or contradictions that are visible in the bundle itself (for example: a deliverable with no attached proof file, a payment marked paid with no payment date, logged value above the agreed amount). If nothing is missing or inconsistent, return a single entry saying so. Never speculate about a cause.`;

const REPORT_SCHEMA = {
  type: "object",
  properties: {
    headline: {
      type: "string",
      description: "One neutral sentence summarizing what the records show.",
    },
    what_was_delivered: {
      type: "string",
      description: "The deliverables recorded, with their titles and amounts.",
    },
    when_delivered: {
      type: "string",
      description: "The recorded delivery dates and timestamps.",
    },
    proof_available: {
      type: "string",
      description: "Proof files, links and timestamps attached to the deliverables.",
    },
    client_acknowledgement: {
      type: "string",
      description: "Whether client acknowledgement or approval is recorded, and for which items.",
    },
    payment_amount: {
      type: "string",
      description: "Agreed amount and recorded deliverable values.",
    },
    payment_history: {
      type: "string",
      description: "Payments recorded against these deliverables, with dates where available.",
    },
    payment_status: {
      type: "string",
      description: "Current paid / unpaid position according to the records.",
    },
    missing_or_inconsistent: {
      type: "array",
      description: "Gaps or contradictions visible in the stored records.",
      items: { type: "string" },
    },
    neutral_observations: {
      type: "string",
      description: "Any remaining factual context from the records. No conclusions.",
    },
  },
  required: [
    "headline",
    "what_was_delivered",
    "when_delivered",
    "proof_available",
    "client_acknowledgement",
    "payment_amount",
    "payment_history",
    "payment_status",
    "missing_or_inconsistent",
    "neutral_observations",
  ],
  additionalProperties: false,
} as const;

// ─── Helpers ──────────────────────────────────────────────────────────────────

function isReport(value: unknown): value is DisputeReport {
  if (!value || typeof value !== "object") return false;
  const v = value as Record<string, unknown>;
  const stringKeys = [
    "headline",
    "what_was_delivered",
    "when_delivered",
    "proof_available",
    "client_acknowledgement",
    "payment_amount",
    "payment_history",
    "payment_status",
    "neutral_observations",
  ];
  if (!stringKeys.every((k) => typeof v[k] === "string" && (v[k] as string).trim() !== "")) {
    return false;
  }
  return (
    Array.isArray(v.missing_or_inconsistent) &&
    v.missing_or_inconsistent.every((i) => typeof i === "string")
  );
}

async function generateAiReport(evidence: DisputeEvidence): Promise<DisputeReport> {
  const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

  const response = await anthropic.messages.create({
    model: MODEL,
    max_tokens: 16000,
    system: SYSTEM_PROMPT,
    thinking: { type: "adaptive" },
    output_config: {
      effort: "medium",
      format: { type: "json_schema", schema: REPORT_SCHEMA },
    },
    messages: [
      {
        role: "user",
        content:
          `Summarize the evidence below for ${
            evidence.scope === "deliverable" ? "the single deliverable" : "the whole project"
          }. This JSON bundle is the complete ProofVault record — nothing outside it is available.\n\n` +
          JSON.stringify(evidence, null, 2),
      },
    ],
  });

  if (response.stop_reason === "refusal") {
    throw new Error("The model declined to summarize this record.");
  }

  const text = response.content
    .filter((block): block is Anthropic.TextBlock => block.type === "text")
    .map((block) => block.text)
    .join("")
    .trim();

  if (!text) throw new Error("The model returned an empty summary.");

  const parsed: unknown = JSON.parse(text);
  if (!isReport(parsed)) {
    throw new Error("The model returned a summary in an unexpected shape.");
  }

  return parsed;
}

// ─── Route ────────────────────────────────────────────────────────────────────

export async function POST(request: Request) {
  const supabase = createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ success: false, error: "Not authenticated" }, { status: 401 });
  }

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ success: false, error: "Invalid request body" }, { status: 400 });
  }

  const projectId = typeof body.projectId === "string" ? body.projectId : "";
  const deliverableId = typeof body.deliverableId === "string" ? body.deliverableId : null;

  if (!projectId) {
    return NextResponse.json({ success: false, error: "A project id is required" }, { status: 400 });
  }

  // Ownership is enforced twice: by the explicit user_id filter here and by RLS.
  const { data: projectRow, error: projectError } = await supabase
    .from("projects")
    .select("*")
    .eq("id", projectId)
    .eq("user_id", user.id)
    .single();

  if (projectError || !projectRow) {
    return NextResponse.json({ success: false, error: "Project not found" }, { status: 404 });
  }

  const project = projectRow as unknown as Project;

  const { data: deliverableRows } = await supabase
    .from("deliverables")
    .select("*")
    .eq("project_id", projectId)
    .eq("user_id", user.id)
    .order("created_at", { ascending: true });

  const deliverables = (deliverableRows ?? []) as unknown as Deliverable[];

  if (deliverableId && !deliverables.some((d) => d.id === deliverableId)) {
    return NextResponse.json(
      { success: false, error: "Deliverable not found on this project" },
      { status: 404 }
    );
  }

  // How many projects this client has in total — context, never a judgement.
  let clientProjectCount: number | null = null;
  const clientQuery = supabase
    .from("projects")
    .select("id", { count: "exact", head: true })
    .eq("user_id", user.id);
  const { count } = project.client_id
    ? await clientQuery.eq("client_id", project.client_id)
    : await clientQuery.eq("client_name", project.client_name);
  clientProjectCount = count ?? null;

  const evidence = buildDisputeEvidence({
    project,
    deliverables,
    focusDeliverableId: deliverableId,
    clientProjectCount,
  });

  const recordsReport = buildRecordsReport(evidence);

  let result: DisputeResult = {
    source: "records",
    notice:
      "",
    disclaimer: DISPUTE_DISCLAIMER,
    report: recordsReport,
    evidence,
  };

  if (process.env.ANTHROPIC_API_KEY) {
    try {
      const report = await generateAiReport(evidence);
      result = {
        source: "ai",
        notice: null,
        disclaimer: DISPUTE_DISCLAIMER,
        report,
        evidence,
      };
    } catch (error) {
      console.error("Dispute assistant AI summary failed:", error);
      result = {
        ...result,
        notice:
          "The AI summary was unavailable, so this summary was generated directly from your ProofVault records.",
      };
    }
  }

  return NextResponse.json({ success: true, data: result });
}
