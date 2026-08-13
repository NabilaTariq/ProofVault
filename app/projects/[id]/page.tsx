import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { Logo } from "@/components/logo";
import { ArrowRightIcon, FolderIcon, ReceiptIcon, ShieldIcon } from "@/components/icons";
import { formatMoney, formatDate } from "@/lib/format";
import { toNum, type Project, type Deliverable } from "@/lib/types";
import { ProgressBar } from "@/components/progress-bar";
import { DeliverableForm } from "./deliverable-form";
import { DeliverableList } from "./deliverable-list";
import { ProjectActions } from "./project-actions";
import { EditProjectButton } from "./edit-project-button";
import { DisputeAssistantSection } from "./dispute-assistant";

const STATUS_LABEL: Record<string, string> = {
  active: "Active",
  completed: "Completed",
  archived: "Archived",
};

const STATUS_CLASS: Record<string, string> = {
  active: "status-pill status-neutral",
  completed: "status-pill status-paid",
  archived: "status-pill",
};

export default async function ProjectPage({ params }: { params: { id: string } }) {
  const supabase = createClient();

  const { data: project } = await supabase
    .from("projects")
    .select("*")
    .eq("id", params.id)
    .single();

  if (!project) notFound();

  const { data: deliverablesRaw } = await supabase
    .from("deliverables")
    .select("*")
    .eq("project_id", params.id)
    .order("created_at", { ascending: false });

  const deliverables: Deliverable[] = (deliverablesRaw ?? []) as Deliverable[];

  // ── Sibling projects for the same client ───────────────────────────────────
  // Every project for a client hangs off a single client record, so this is a
  // straight lookup by client_id (falling back to the name for rows created
  // before the clients table existed).
  const siblingQuery = supabase
    .from("projects")
    .select("id, client_name, platform, status, agreed_amount, currency, created_at")
    .neq("id", params.id)
    .order("created_at", { ascending: false });

  const { data: siblingRaw } = project.client_id
    ? await siblingQuery.eq("client_id", project.client_id)
    : await siblingQuery.eq("client_name", project.client_name);

  const clientProjects: Project[] = (siblingRaw ?? []) as unknown as Project[];

  // ── Financial calculations ─────────────────────────────────────────────────
  const agreed = toNum(project.agreed_amount);
  const deliveredTotal = deliverables.reduce((sum, d) => sum + toNum(d.amount), 0);
  const paidTotal = deliverables.filter((d) => d.paid).reduce((sum, d) => sum + toNum(d.amount), 0);
  const unpaidDelivered = deliverables.filter((d) => !d.paid).reduce((sum, d) => sum + toNum(d.amount), 0);
  const remaining = agreed - deliveredTotal;
  const percent = agreed > 0 ? Math.round((deliveredTotal / agreed) * 100) : 0;
  const isOverBudget = deliveredTotal > agreed;

  // ── Activity timeline (chronological, oldest first) ────────────────────────
  interface ActivityItem {
    label: string;
    date: string;
    sub?: string;
  }

  const timeline: ActivityItem[] = [
    { label: "Project created", date: project.created_at },
    ...deliverables
      .slice()
      .sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime())
      .map((d) => ({
        label: d.paid ? `Paid: ${d.title}` : `Delivered: ${d.title}`,
        date: d.created_at,
        sub: formatMoney(toNum(d.amount), project.currency),
      })),
  ];

  const typedProject = project as unknown as Project;

  return (
    <main className="page-frame">
      {/* ── Header ── */}
      <header className="mb-6 flex flex-col gap-4 rounded-[24px] border border-taupe-200 bg-cream-50 px-5 py-4 shadow-soft lg:flex-row lg:items-center lg:justify-between">
        <div className="flex items-center gap-4">
          <Logo />
          <div className="hidden h-10 w-px bg-taupe-200 lg:block" />
          <Link href="/dashboard" className="btn-ghost">
            <ArrowRightIcon className="h-4 w-4 rotate-180" />
            All projects
          </Link>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <span className={STATUS_CLASS[project.status ?? "active"] ?? "status-pill"}>
            <ShieldIcon className="h-4 w-4" />
            {STATUS_LABEL[project.status ?? "active"] ?? project.status}
          </span>
          <EditProjectButton project={typedProject} />
        </div>
      </header>

      {/* ── Hero card ── */}
      <section className="mb-6 grid gap-4 lg:grid-cols-[1.2fr_0.8fr]">
        <div className="surface-strong p-7 sm:p-8">
          <p className="section-kicker text-cream-50/70">project detail</p>
          <div className="mt-3">
            <h1 className="text-4xl font-semibold tracking-tight text-cream-50 sm:text-5xl">
              {project.client_name}
            </h1>
            {project.description && (
              <p className="mt-3 max-w-2xl text-sm leading-6 text-cream-50/80">{project.description}</p>
            )}
          </div>

          {/* Financial metrics */}
          <div className="mt-8 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <div className="frost-card">
              <p className="text-[10px] uppercase tracking-[0.22em] text-cream-50/70">Agreed</p>
              <p className="mt-2 text-xl font-semibold text-cream-50">
                {formatMoney(agreed, project.currency)}
              </p>
            </div>
            <div className="frost-card">
              <p className="text-[10px] uppercase tracking-[0.22em] text-cream-50/70">Delivered</p>
              <p className="mt-2 text-xl font-semibold text-cream-50">
                {formatMoney(deliveredTotal, project.currency)}
              </p>
            </div>
            <div className="frost-card">
              <p className="text-[10px] uppercase tracking-[0.22em] text-cream-50/70">Paid</p>
              <p className="mt-2 text-xl font-semibold text-cream-50">
                {formatMoney(paidTotal, project.currency)}
              </p>
            </div>
            <div className="frost-card">
              <p className="text-[10px] uppercase tracking-[0.22em] text-cream-50/70">
                {unpaidDelivered > 0 ? "Owed" : remaining >= 0 ? "Remaining" : "Overage"}
              </p>
              <p className="mt-2 text-xl font-semibold text-cream-50">
                {unpaidDelivered > 0
                  ? formatMoney(unpaidDelivered, project.currency)
                  : formatMoney(Math.abs(remaining), project.currency)}
              </p>
            </div>
          </div>

          {/* Progress bar */}
          <div className="mt-5">
            <div className="mb-1.5 flex items-center justify-between gap-2">
              <p className="text-[10px] uppercase tracking-[0.2em] text-cream-50/60">
                Value delivered
              </p>
              <p className="text-[11px] font-semibold text-cream-50/80">
                {percent}%{isOverBudget && " (over)"}
              </p>
            </div>
            <ProgressBar percent={percent} isOverBudget={isOverBudget} />
          </div>
        </div>

        {/* Sidebar stats */}
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-1">
          <div className="stat-card">
            <div className="flex items-center justify-between">
              <span className="section-kicker">proof entries</span>
              <ReceiptIcon className="h-5 w-5 text-wine-900" />
            </div>
            <p className="text-3xl font-semibold text-wine-950">{deliverables.length}</p>
            <p className="text-sm text-ember-700/75">
              {deliverables.filter((d) => d.paid).length} paid ·{" "}
              {deliverables.filter((d) => !d.paid).length} unpaid
            </p>
          </div>
          <div className="stat-card">
            <div className="flex items-center justify-between">
              <span className="section-kicker">platform</span>
              <FolderIcon className="h-5 w-5 text-wine-900" />
            </div>
            <p className="text-2xl font-semibold text-wine-950">{project.platform || "Direct"}</p>
            <p className="text-sm text-ember-700/75">Created {formatDate(project.created_at)}</p>
          </div>

          {/* Status controls */}
          <div className="stat-card sm:col-span-2 lg:col-span-1">
            <p className="section-kicker mb-3">project controls</p>
            <ProjectActions
              projectId={project.id}
              currentStatus={project.status ?? "active"}
              clientName={project.client_name}
            />
          </div>
        </div>
      </section>

      {/* ── AI Dispute Assistant ── */}
      <DisputeAssistantSection
        projectId={project.id}
        clientName={project.client_name}
        deliverables={deliverables.map((d) => ({ id: d.id, title: d.title }))}
      />

      {/* ── Main content: form + deliverables ── */}
      <section className="grid gap-6 lg:grid-cols-[0.9fr_1.1fr]">
        {/* Add deliverable form */}
        <div className="surface p-6 sm:p-7">
          <DeliverableForm projectId={project.id} />
        </div>

        {/* Deliverable list */}
        <div className="surface overflow-hidden">
          <div className="flex items-center justify-between border-b border-taupe-200 px-5 py-4 sm:px-6">
            <div>
              <p className="section-kicker">proof trail</p>
              <h2 className="mt-1 text-xl font-semibold tracking-tight text-wine-950">
                Deliverables ({deliverables.length})
              </h2>
            </div>
            <span className="status-pill status-neutral">Ledger view</span>
          </div>
          <DeliverableList deliverables={deliverables} currency={project.currency} />
        </div>
      </section>

      {/* ── Other projects under this client ── */}
      {clientProjects.length > 0 && (
        <section className="mt-6 surface overflow-hidden">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-taupe-200 px-5 py-4 sm:px-6">
            <div>
              <p className="section-kicker">client</p>
              <h2 className="mt-1 text-lg font-semibold tracking-tight text-wine-950">
                Other projects for {project.client_name}
              </h2>
            </div>
            <span className="status-pill status-neutral">
              {clientProjects.length + 1} total
            </span>
          </div>
          <ul className="divide-y divide-taupe-100 px-5 sm:px-6">
            {clientProjects.map((p) => (
              <li key={p.id} className="flex flex-wrap items-center justify-between gap-3 py-3.5">
                <div className="min-w-0">
                  <Link
                    href={`/projects/${p.id}`}
                    className="text-sm font-semibold text-wine-950 underline-offset-2 transition hover:text-wine-700 hover:underline"
                  >
                    {p.platform || "Direct"} · {formatMoney(toNum(p.agreed_amount), p.currency)}
                  </Link>
                  <p className="mt-0.5 text-xs text-taupe-600">
                    Created {formatDate(p.created_at)}
                  </p>
                </div>
                <span className={STATUS_CLASS[p.status ?? "active"] ?? "status-pill"}>
                  {STATUS_LABEL[p.status ?? "active"] ?? p.status}
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* ── Activity timeline ── */}
      {timeline.length > 1 && (
        <section className="mt-6 surface overflow-hidden">
          <div className="border-b border-taupe-200 px-5 py-4 sm:px-6">
            <p className="section-kicker">project activity</p>
            <h2 className="mt-1 text-lg font-semibold tracking-tight text-wine-950">Timeline</h2>
          </div>
          <ol className="divide-y divide-taupe-100 px-5 sm:px-6" aria-label="Project activity timeline">
            {timeline.map((item, i) => (
              <li key={i} className="flex items-start gap-4 py-3.5">
                <div
                  className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-wine-950 text-cream-50"
                  aria-hidden="true"
                >
                  <span className="text-[10px] font-bold">{i + 1}</span>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-wine-950 truncate">{item.label}</p>
                  {item.sub && (
                    <p className="text-xs text-ember-700/70">{item.sub}</p>
                  )}
                </div>
                <time className="shrink-0 text-[11px] text-taupe-500 tabular-nums">
                  {formatDate(item.date)}
                </time>
              </li>
            ))}
          </ol>
        </section>
      )}
    </main>
  );
}
