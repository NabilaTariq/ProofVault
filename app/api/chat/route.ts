import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { AI_MODEL, getOpenRouter, isAiEnabled } from "@/lib/ai/client";
import { checkRateLimit } from "@/lib/ai/rate-limit";
import { formatDate, formatMoney } from "@/lib/format";
import { toNum, type Client, type Deliverable, type Project } from "@/lib/types";

export const dynamic = "force-dynamic";

const RATE_LIMIT = 20;
const RATE_WINDOW_MS = 5 * 60 * 1000;
const MAX_HISTORY = 20;
const MAX_PROJECT_DETAILS = 24;
const MAX_DELIVERABLE_DETAILS = 20;
const MAX_ACTIVITY_ITEMS = 12;

const SYSTEM_PROMPT = `You are Taskora AI, a helpful assistant for the signed-in user's own ProofVault records.

Rules you must follow:
- Answer only using the context provided below.
- Never invent, estimate, or hallucinate project names, client names, amounts, dates, deliverables, payment status, proof records, or notes.
- The context only contains the authenticated user's own records. Never claim access to another user's data.
- If the user asks about another user's projects or records, refuse briefly because that data is not accessible.
- If the database context does not contain enough information to answer, say: "I couldn't find enough information in your ProofVault data to answer that."
- If the user asks a general knowledge question unrelated to their vault, redirect them back to their ProofVault data.
- The app schema currently includes clients, projects, and deliverables. There is no separate tasks table in this project, so answer task-like questions using the available project and deliverable records, or say the task is not recorded if the data is missing.
- When referencing money, preserve the currency from the source record.
- Keep the answer concise, factual, and easy to scan. Use markdown bullets when helpful.`;

interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

interface ChatRequest {
  message: string;
  history?: ChatMessage[];
}

const OTHER_USER_PATTERNS = [
  /another\s+user's?/i,
  /someone\s+else's?/i,
  /other\s+user's?/i,
  /someone\s+elses?/i,
];

const CLIENT_HINT_PATTERN = /client\s+["']?([^"'?.!,]+)["']?/i;

const DELIVERABLE_KEYWORDS = [
  "deliverable",
  "deliver",
  "delivered",
  "delivery",
  "payment",
  "paid",
  "unpaid",
  "pending",
  "owed",
  "outstanding",
  "money",
  "amount",
  "proof",
  "evidence",
  "file",
  "upload",
  "attachment",
  "acknowledg",
  "notes",
  "history",
  "activity",
  "latest",
  "recent",
  "last",
  "workload",
  "summary",
];

function normalize(value: string): string {
  return value.toLowerCase().trim();
}

function hasAnyKeyword(message: string, keywords: string[]): boolean {
  const lower = normalize(message);
  return keywords.some((keyword) => lower.includes(keyword));
}

function isOtherUsersRequest(message: string): boolean {
  return OTHER_USER_PATTERNS.some((pattern) => pattern.test(message));
}

function extractClientHint(message: string, clients: Client[], projects: Project[]): string | null {
  const lower = normalize(message);

  for (const client of clients) {
    if (lower.includes(normalize(client.name))) {
      return client.name;
    }
  }

  for (const project of projects) {
    if (lower.includes(normalize(project.client_name))) {
      return project.client_name;
    }
  }

  const match = message.match(CLIENT_HINT_PATTERN);
  if (match?.[1]) {
    const hint = match[1].trim();
    return hint || null;
  }

  return null;
}

function wantsDeliverableDetail(message: string): boolean {
  return hasAnyKeyword(message, DELIVERABLE_KEYWORDS);
}

function wantsActivity(message: string): boolean {
  const lower = normalize(message);
  return (
    lower.includes("activity") ||
    lower.includes("history") ||
    lower.includes("latest") ||
    lower.includes("recent") ||
    lower.includes("last")
  );
}

function wantsOverview(message: string): boolean {
  const lower = normalize(message);
  return (
    lower.includes("summary") ||
    lower.includes("overview") ||
    lower.includes("workload") ||
    lower.includes("how many") ||
    lower.includes("count") ||
    lower.includes("total")
  );
}

function projectMatchesClient(project: Project, clientHint: string): boolean {
  const hint = normalize(clientHint);
  return normalize(project.client_name).includes(hint);
}

function projectLatestActivity(project: Project, deliverables: Deliverable[]): string {
  const projectDeliverables = deliverables.filter((deliverable) => deliverable.project_id === project.id);
  const timestamps = [project.created_at, ...projectDeliverables.map((deliverable) => deliverable.created_at)];
  const latest = timestamps
    .map((timestamp) => new Date(timestamp).getTime())
    .filter((timestamp) => Number.isFinite(timestamp));

  if (latest.length === 0) return project.created_at;
  return new Date(Math.max(...latest)).toISOString();
}

function buildActivityFeed(projects: Project[], deliverables: Deliverable[]): string[] {
  const entries: Array<{ when: string; label: string }> = [];

  for (const project of projects) {
    entries.push({
      when: project.created_at,
      label: `Project created: ${project.client_name} (${project.status})`,
    });
  }

  for (const deliverable of deliverables) {
    const relatedProject = projects.find((project) => project.id === deliverable.project_id);
    const name = relatedProject?.client_name ?? "Unknown project";

    entries.push({
      when: deliverable.created_at,
      label: `Deliverable logged: ${deliverable.title} for ${name}${deliverable.paid ? " (paid)" : ""}`,
    });
  }

  return entries
    .sort((a, b) => new Date(b.when).getTime() - new Date(a.when).getTime())
    .slice(0, MAX_ACTIVITY_ITEMS)
    .map((entry) => `- ${formatDate(entry.when)}: ${entry.label}`);
}

function buildContext(options: {
  clients: Client[];
  projects: Project[];
  deliverables: Deliverable[];
  clientHint: string | null;
  includeDeliverables: boolean;
  includeActivity: boolean;
  overviewRequested: boolean;
}): string {
  const { clients, projects, deliverables, clientHint, includeDeliverables, includeActivity, overviewRequested } = options;

  const relevantProjects = clientHint
    ? projects.filter((project) => projectMatchesClient(project, clientHint))
    : projects;

  const relevantDeliverables = clientHint
    ? deliverables.filter((deliverable) => relevantProjects.some((project) => project.id === deliverable.project_id))
    : deliverables;

  const activeProjects = relevantProjects.filter((project) => project.status === "active");
  const completedProjects = relevantProjects.filter((project) => project.status === "completed");
  const archivedProjects = relevantProjects.filter((project) => project.status === "archived");

  const clientSummaries = clients
    .map((client) => {
      const clientProjects = projects.filter((project) => projectMatchesClient(project, client.name));
      const clientDeliverables = deliverables.filter((deliverable) =>
        clientProjects.some((project) => project.id === deliverable.project_id)
      );
      const paidTotal = clientDeliverables
        .filter((deliverable) => deliverable.paid)
        .reduce((sum, deliverable) => sum + toNum(deliverable.amount), 0);
      const outstandingTotal = clientDeliverables
        .filter((deliverable) => !deliverable.paid)
        .reduce((sum, deliverable) => sum + toNum(deliverable.amount), 0);

      return {
        name: client.name,
        projectCount: clientProjects.length,
        activeCount: clientProjects.filter((project) => project.status === "active").length,
        completedCount: clientProjects.filter((project) => project.status === "completed").length,
        archivedCount: clientProjects.filter((project) => project.status === "archived").length,
        paidTotal,
        outstandingTotal,
        currency: clientProjects[0]?.currency ?? "USD",
      };
    })
    .filter((summary) => summary.projectCount > 0)
    .sort((a, b) => b.projectCount - a.projectCount || a.name.localeCompare(b.name));

  const currencyTotals = new Map<string, { agreed: number; paid: number; outstanding: number }>();
  for (const project of relevantProjects) {
    const currency = project.currency || "USD";
    const entry = currencyTotals.get(currency) ?? { agreed: 0, paid: 0, outstanding: 0 };
    const projectDeliverables = relevantDeliverables.filter((deliverable) => deliverable.project_id === project.id);

    entry.agreed += toNum(project.agreed_amount);
    entry.paid += projectDeliverables
      .filter((deliverable) => deliverable.paid)
      .reduce((sum, deliverable) => sum + toNum(deliverable.amount), 0);
    entry.outstanding += projectDeliverables
      .filter((deliverable) => !deliverable.paid)
      .reduce((sum, deliverable) => sum + toNum(deliverable.amount), 0);
    currencyTotals.set(currency, entry);
  }

  const lines: string[] = [];
  lines.push("=== AUTHENTICATED USER CONTEXT ===");
  lines.push(`Scope: ${clientHint ? `filtered to client "${clientHint}"` : "all accessible user records"}`);
  lines.push(`Clients: ${clients.length}`);
  lines.push(`Projects: ${relevantProjects.length}`);
  lines.push(`Deliverables: ${relevantDeliverables.length}`);
  lines.push(`Active projects: ${activeProjects.length}`);
  lines.push(`Completed projects: ${completedProjects.length}`);
  lines.push(`Archived projects: ${archivedProjects.length}`);

  if (overviewRequested) {
    lines.push("");
    lines.push("--- FINANCIAL OVERVIEW ---");
    if (currencyTotals.size === 0) {
      lines.push("No project totals are available.");
    } else {
      for (const [currency, totals] of currencyTotals) {
        lines.push(`${currency}:`);
        lines.push(`  Agreed: ${formatMoney(totals.agreed, currency)}`);
        lines.push(`  Paid: ${formatMoney(totals.paid, currency)}`);
        lines.push(`  Outstanding: ${formatMoney(totals.outstanding, currency)}`);
      }
    }
  }

  lines.push("");
  lines.push("--- CLIENTS ---");
  if (clientSummaries.length === 0) {
    lines.push("No client records were found for this user.");
  } else {
    for (const summary of clientSummaries.slice(0, MAX_PROJECT_DETAILS)) {
      lines.push(`Client: ${summary.name}`);
      lines.push(`  Projects: ${summary.projectCount} (active ${summary.activeCount}, completed ${summary.completedCount}, archived ${summary.archivedCount})`);
      lines.push(`  Paid deliverables: ${formatMoney(summary.paidTotal, summary.currency)}`);
      lines.push(`  Outstanding deliverables: ${formatMoney(summary.outstandingTotal, summary.currency)}`);
    }
  }

  lines.push("");
  lines.push("--- PROJECTS ---");
  if (relevantProjects.length === 0) {
    lines.push("No projects match the requested scope.");
  } else {
    for (const project of relevantProjects.slice(0, MAX_PROJECT_DETAILS)) {
      const projectDeliverables = relevantDeliverables.filter((deliverable) => deliverable.project_id === project.id);
      const paidTotal = projectDeliverables
        .filter((deliverable) => deliverable.paid)
        .reduce((sum, deliverable) => sum + toNum(deliverable.amount), 0);
      const outstandingTotal = projectDeliverables
        .filter((deliverable) => !deliverable.paid)
        .reduce((sum, deliverable) => sum + toNum(deliverable.amount), 0);
      const latestActivity = projectLatestActivity(project, relevantDeliverables);

      lines.push(`Project: ${project.client_name}`);
      lines.push(`  Status: ${project.status}`);
      lines.push(`  Platform: ${project.platform || "Direct"}`);
      lines.push(`  Agreed amount: ${formatMoney(toNum(project.agreed_amount), project.currency)}`);
      lines.push(`  Description: ${project.description || "Not recorded"}`);
      lines.push(`  Created: ${formatDate(project.created_at)}`);
      lines.push(`  Deliverables: ${projectDeliverables.length}`);
      lines.push(`  Paid deliverables: ${formatMoney(paidTotal, project.currency)}`);
      lines.push(`  Outstanding deliverables: ${formatMoney(outstandingTotal, project.currency)}`);
      lines.push(`  Latest activity: ${formatDate(latestActivity)}`);
    }
  }

  if (includeDeliverables) {
    lines.push("");
    lines.push("--- DELIVERABLES ---");
    if (relevantDeliverables.length === 0) {
      lines.push("No deliverables match the requested scope.");
    } else {
      for (const deliverable of relevantDeliverables.slice(0, MAX_DELIVERABLE_DETAILS)) {
        const parentProject = relevantProjects.find((project) => project.id === deliverable.project_id);
        const currency = parentProject?.currency ?? "USD";

        lines.push(`Deliverable: ${deliverable.title}`);
        lines.push(`  Project: ${parentProject?.client_name || "Unknown project"}`);
        lines.push(`  Amount: ${formatMoney(toNum(deliverable.amount), currency)}`);
        lines.push(`  Paid: ${deliverable.paid ? "Yes" : "No"}${deliverable.paid_at ? ` (${formatDate(deliverable.paid_at)})` : ""}`);
        lines.push(`  Proof file: ${deliverable.file_url ? deliverable.file_name || deliverable.file_url : "Not recorded"}`);
        lines.push(`  Notes: ${deliverable.notes || "Not recorded"}`);
        lines.push(`  Acknowledged: ${deliverable.acknowledged ? "Yes" : "No"}${deliverable.acknowledged_at ? ` (${formatDate(deliverable.acknowledged_at)})` : ""}`);
        lines.push(`  Acknowledgement note: ${deliverable.acknowledgement_note || "Not recorded"}`);
        lines.push(`  Created: ${formatDate(deliverable.created_at)}`);
      }
    }
  }

  if (includeActivity) {
    lines.push("");
    lines.push("--- RECENT ACTIVITY ---");
    const activity = buildActivityFeed(relevantProjects, relevantDeliverables);
    if (activity.length === 0) {
      lines.push("No recent activity was recorded.");
    } else {
      lines.push(...activity);
    }
  }

  return lines.join("\n");
}

function refusalResponse(message: string) {
  return new Response(message, {
    status: 200,
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "no-cache",
    },
  });
}

export async function POST(request: Request) {
  if (!isAiEnabled()) {
    return NextResponse.json(
      {
        success: false,
        error: "AI features are not configured. Please set your OPENROUTER_API_KEY.",
      },
      { status: 503 }
    );
  }

  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ success: false, error: "Not authenticated" }, { status: 401 });
  }

  const limit = checkRateLimit(user.id, "chat", RATE_LIMIT, RATE_WINDOW_MS);
  if (!limit.allowed) {
    return NextResponse.json(
      {
        success: false,
        error: `You are sending messages too quickly. Please wait ${limit.retryAfter} seconds.`,
      },
      { status: 429, headers: { "Retry-After": String(limit.retryAfter) } }
    );
  }

  let body: ChatRequest;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ success: false, error: "Invalid request body" }, { status: 400 });
  }

  const message = typeof body.message === "string" ? body.message.trim() : "";
  const history = Array.isArray(body.history) ? body.history.slice(-MAX_HISTORY) : [];

  if (!message) {
    return NextResponse.json({ success: false, error: "Message is required" }, { status: 400 });
  }

  if (message.length > 2000) {
    return NextResponse.json(
      { success: false, error: "Message is too long (max 2000 characters)" },
      { status: 400 }
    );
  }

  if (isOtherUsersRequest(message)) {
    return refusalResponse("I can only access your own ProofVault data. I do not have access to other users' records.");
  }

  try {
    const [clientsResult, projectsResult] = await Promise.all([
      supabase
        .from("clients")
        .select("id, user_id, name, created_at")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false }),
      supabase
        .from("projects")
        .select("id, user_id, client_id, client_name, platform, description, agreed_amount, currency, status, created_at")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false }),
    ]);

    if (clientsResult.error) {
      console.error("Chat: clients query failed:", clientsResult.error);
      return NextResponse.json(
        { success: false, error: "Failed to retrieve your client data." },
        { status: 500 }
      );
    }

    if (projectsResult.error) {
      console.error("Chat: projects query failed:", projectsResult.error);
      return NextResponse.json(
        { success: false, error: "Failed to retrieve your project data." },
        { status: 500 }
      );
    }

    const clients = (clientsResult.data ?? []) as Client[];
    const projects = (projectsResult.data ?? []) as Project[];

    const clientHint = extractClientHint(message, clients, projects);
    const includeDeliverables = wantsDeliverableDetail(message) || !!clientHint;
    const includeActivity = wantsActivity(message);
    const overviewRequested = wantsOverview(message);

    let deliverables: Deliverable[] = [];
    if (includeDeliverables || includeActivity) {
      let query = supabase
        .from("deliverables")
        .select(
          "id, project_id, user_id, title, notes, file_key, file_url, file_name, amount, paid, paid_at, acknowledged, acknowledged_at, acknowledgement_note, created_at"
        )
        .eq("user_id", user.id)
        .order("created_at", { ascending: false });

      if (clientHint) {
        const matchingProjectIds = projects.filter((project) => projectMatchesClient(project, clientHint)).map((project) => project.id);
        if (matchingProjectIds.length > 0) {
          query = query.in("project_id", matchingProjectIds);
        }
      }

      const deliverablesResult = await query;
      if (deliverablesResult.error) {
        console.error("Chat: deliverables query failed:", deliverablesResult.error);
      } else {
        deliverables = (deliverablesResult.data ?? []) as Deliverable[];
      }
    }

    const context = buildContext({
      clients,
      projects,
      deliverables,
      clientHint,
      includeDeliverables,
      includeActivity,
      overviewRequested,
    });

    const messages = [
      {
        role: "system" as const,
        content: `${SYSTEM_PROMPT}\n\n${context}`,
      },
      ...history.map((entry) => ({
        role: entry.role as "user" | "assistant",
        content: entry.content,
      })),
      {
        role: "user" as const,
        content: message,
      },
    ];

    const stream = await getOpenRouter().chat.completions.create({
      model: AI_MODEL,
      messages,
      max_tokens: 1400,
      temperature: 0.2,
      stream: true,
    });

    const encoder = new TextEncoder();
    const readable = new ReadableStream({
      async start(controller) {
        try {
          for await (const chunk of stream) {
            const content = chunk.choices?.[0]?.delta?.content;
            if (content) {
              controller.enqueue(encoder.encode(content));
            }
          }
          controller.close();
        } catch (error) {
          console.error("Chat: streaming error:", error);
          controller.enqueue(
            encoder.encode(
              "\n\nI couldn't finish that response, but you can try again in a moment."
            )
          );
          controller.close();
        }
      },
    });

    return new Response(readable, {
      headers: {
        "Content-Type": "text/plain; charset=utf-8",
        "Cache-Control": "no-cache",
        "Transfer-Encoding": "chunked",
      },
    });
  } catch (error) {
    console.error("Chat: unexpected error:", error);
    return NextResponse.json(
      {
        success: false,
        error: "Something went wrong. Please try again in a moment.",
      },
      { status: 500 }
    );
  }
}
