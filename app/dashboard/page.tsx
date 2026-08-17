import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { Logo } from "@/components/logo";
import { ReceiptIcon, ShieldIcon, SparkIcon } from "@/components/icons";
import { SignOutButton } from "./sign-out-button";
import { formatMoney } from "@/lib/format";
import { groupProjectsByCurrency } from "@/lib/format";
import { toNum, type Project, type Deliverable } from "@/lib/types";
import { DashboardClient } from "./dashboard-client";
import { CoachMarkProvider } from "@/components/coach-mark";

export default async function DashboardPage() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: projectsRaw } = await supabase
    .from("projects")
    .select("id, client_name, platform, agreed_amount, currency, status, created_at, description")
    .order("created_at", { ascending: false });

  const { data: deliverablesRaw } = await supabase
    .from("deliverables")
    .select("project_id, amount, paid");

  const projects: Project[] = (projectsRaw ?? []) as Project[];
  const deliverables: Pick<Deliverable, "project_id" | "amount" | "paid">[] = deliverablesRaw ?? [];

  // Build per-project totals map
  const totalsMap = new Map<string, { paid: number; pending: number; count: number }>();
  for (const d of deliverables) {
    const current = totalsMap.get(d.project_id) ?? { paid: 0, pending: 0, count: 0 };
    current.count += 1;
    if (d.paid) current.paid += toNum(d.amount);
    else current.pending += toNum(d.amount);
    totalsMap.set(d.project_id, current);
  }

  // Counts
  const allProjects = projects;
  const activeProjects = projects.filter((p) => p.status === "active");
  const completedProjects = projects.filter((p) => p.status === "completed");
  const archivedProjects = projects.filter((p) => p.status === "archived");

  // Currency-grouped stats (only active + completed — not archived)
  const visibleProjects = projects.filter((p) => p.status !== "archived");
  const currencyGroups = groupProjectsByCurrency(visibleProjects, totalsMap);

  // Projects with unpaid delivered work (needs attention)
  const needsAttention = activeProjects.filter(
    (p) => (totalsMap.get(p.id)?.pending ?? 0) > 0
  );

  // Enrich projects for the client table
  const enriched = allProjects.map((p) => ({
    ...p,
    paid: totalsMap.get(p.id)?.paid ?? 0,
    pending: totalsMap.get(p.id)?.pending ?? 0,
    count: totalsMap.get(p.id)?.count ?? 0,
  }));

  return (
    <CoachMarkProvider>
    <main className="page-frame">
      {/* ── Header ── */}
      <header data-tour="welcome" className="surface mb-6 flex flex-col gap-4 px-5 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-6">
        <div className="flex items-center gap-4">
          <Logo />
          <span className="hidden h-8 w-px bg-taupe-200 sm:block" />
          <div className="hidden flex-col sm:flex">
            <p className="section-kicker">dashboard</p>
            <p className="text-sm text-taupe-600">
              Welcome back{user?.email ? `, ${user.email.split("@")[0]}` : ""}.
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* <span className="nav-chip">
            <ShieldIcon className="h-4 w-4" />
            <span className="hidden sm:inline">Protected session</span>
          </span> */}
          {/* <span className="hidden text-sm text-taupe-600 sm:inline">{user?.email}</span> */}
          <SignOutButton />
        </div>
      </header>

      {/* ── Overview stats ── */}
      <section data-tour="stats" className="mb-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="stat-card">
          <p className="section-kicker">total projects</p>
          <p className="mt-2 text-3xl font-semibold text-wine-950">{allProjects.length}</p>
          <p className="mt-1 text-sm text-ember-700/70">All time</p>
        </div>
        <div className="stat-card">
          <p className="section-kicker">active</p>
          <p className="mt-2 text-3xl font-semibold text-wine-950">{activeProjects.length}</p>
          <p className="mt-1 text-sm text-ember-700/70">In progress</p>
        </div>
        <div className="stat-card">
          <p className="section-kicker">completed</p>
          <p className="mt-2 text-3xl font-semibold text-wine-950">{completedProjects.length}</p>
          <p className="mt-1 text-sm text-ember-700/70">Finished</p>
        </div>
        <div className="stat-card">
          <div className="flex items-center justify-between">
            <p className="section-kicker">deliverables</p>
            <ReceiptIcon className="h-4 w-4 text-wine-800" />
          </div>
          <p className="mt-2 text-3xl font-semibold text-wine-950">{deliverables.length}</p>
          <p className="mt-1 text-sm text-ember-700/70">Total entries</p>
        </div>
      </section>

      {/* ── Financial summary by currency ── */}
      {currencyGroups.length > 0 && (
        <section data-tour="finance" className="mb-6">
          <div className="mb-3 flex items-center justify-between">
            <p className="section-kicker">financial summary</p>
            <p className="text-xs text-taupe-600">Active &amp; completed projects</p>
          </div>

          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {currencyGroups.map((group) => (
              <div key={group.currency} className="surface-strong overflow-hidden p-5">
                <div className="mb-4 flex items-center justify-between">
                  <span className="inline-flex items-center gap-2 rounded-full border border-cream-50/20 bg-cream-50/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.2em] text-cream-50">
                    <SparkIcon className="h-3.5 w-3.5" />
                    {group.currency}
                  </span>
                  <span className="text-xs text-cream-50/60">
                    {group.projects.length} project{group.projects.length !== 1 ? "s" : ""}
                  </span>
                </div>

                <div className="grid grid-cols-3 gap-3">
                  <div className="frost-card">
                    <p className="text-[10px] uppercase tracking-[0.2em] text-cream-50/60">Agreed</p>
                    <p className="mt-1.5 text-base font-semibold text-cream-50">
                      {formatMoney(group.agreedTotal, group.currency)}
                    </p>
                  </div>
                  <div className="frost-card">
                    <p className="text-[10px] uppercase tracking-[0.2em] text-cream-50/60">Paid</p>
                    <p className="mt-1.5 text-base font-semibold text-cream-50">
                      {formatMoney(group.paidTotal, group.currency)}
                    </p>
                  </div>
                  <div className="frost-card">
                    <p className="text-[10px] uppercase tracking-[0.2em] text-cream-50/60">Owed</p>
                    <p className="mt-1.5 text-base font-semibold text-cream-50">
                      {formatMoney(group.pendingTotal, group.currency)}
                    </p>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {archivedProjects.length > 0 && (
            <p className="mt-2 text-xs text-taupe-600">
              {archivedProjects.length} archived project{archivedProjects.length !== 1 ? "s" : ""} excluded from financial summary.
            </p>
          )}
        </section>
      )}

      {/* ── Needs Attention ── */}
      {needsAttention.length > 0 && (
        <section className="mb-6">
          <div className="rounded-[22px] border border-wine-800/20 bg-wine-100 px-5 py-4">
            <div className="flex items-start gap-3">
              <div className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-wine-950 text-cream-50">
                <svg viewBox="0 0 16 16" className="h-3.5 w-3.5" fill="none">
                  <path d="M8 4v4M8 11h.01" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
                </svg>
              </div>
              <div>
                <p className="text-sm font-semibold text-wine-950">
                  {needsAttention.length} active project{needsAttention.length !== 1 ? "s" : ""} with unpaid delivered work
                </p>
                <div className="mt-2 flex flex-wrap gap-2">
                  {needsAttention.map((p) => (
                    <Link
                      key={p.id}
                      href={`/projects/${p.id}`}
                      className="inline-flex items-center gap-1.5 rounded-full border border-wine-950/20 bg-cream-50 px-3 py-1 text-xs font-semibold text-wine-950 transition hover:border-wine-950/50"
                    >
                      {p.client_name}
                      <span className="text-wine-700">
                        {formatMoney(totalsMap.get(p.id)?.pending ?? 0, p.currency)} owed
                      </span>
                    </Link>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </section>
      )}

      {/* ── Project list with search + filter ── */}
      <DashboardClient projects={enriched} />
    </main>
    </CoachMarkProvider>
  );
}
