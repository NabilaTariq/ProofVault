"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import { formatMoney, formatDate } from "@/lib/format";
import { toNum } from "@/lib/types";
import type { Project } from "@/lib/types";
import { ArrowRightIcon } from "@/components/icons";
import { DeleteProjectButton } from "./delete-project-button";

type StatusFilter = "all" | "active" | "completed" | "archived";

interface ProjectWithTotals extends Project {
  paid: number;
  pending: number;
  count: number;
}

interface DashboardClientProps {
  projects: ProjectWithTotals[];
}

export function DashboardClient({ projects }: DashboardClientProps) {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");

  const filtered = useMemo(() => {
    const q = search.toLowerCase().trim();
    return projects.filter((p) => {
      const matchesSearch =
        !q ||
        p.client_name.toLowerCase().includes(q) ||
        (p.platform ?? "").toLowerCase().includes(q);
      const matchesStatus = statusFilter === "all" || p.status === statusFilter;
      return matchesSearch && matchesStatus;
    });
  }, [projects, search, statusFilter]);

  const statusCounts = useMemo(
    () => ({
      all: projects.length,
      active: projects.filter((p) => p.status === "active").length,
      completed: projects.filter((p) => p.status === "completed").length,
      archived: projects.filter((p) => p.status === "archived").length,
    }),
    [projects]
  );

  const STATUS_LABELS: Record<StatusFilter, string> = {
    all: "All",
    active: "Active",
    completed: "Completed",
    archived: "Archived",
  };

  return (
    <div className="surface overflow-hidden">
      {/* Header */}
      <div className="border-b border-taupe-200 px-5 py-4 sm:px-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="section-kicker">projects</p>
            <h2 className="mt-1 text-[1.1rem] font-semibold tracking-tight text-wine-950">
              Client Ledger
            </h2>
          </div>
          <Link href="/projects/new" data-tour="new-project" className="btn-primary shrink-0 self-start sm:self-auto">
            New project
            <ArrowRightIcon className="h-4 w-4" />
          </Link>
        </div>

        {/* Search + Filter */}
        <div data-tour="search-filter" className="mt-4 flex flex-col gap-3 sm:flex-row">
          <div className="relative flex-1">
            <svg
              viewBox="0 0 20 20"
              className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-taupe-400"
              fill="none"
            >
              <path
                d="M12.9 12.9A6 6 0 1 0 7 13a6 6 0 0 0 5.9-.1Zm0 0L17 17"
                stroke="currentColor"
                strokeWidth="1.6"
                strokeLinecap="round"
              />
            </svg>
            <input
              type="search"
              placeholder="Search by client or platform..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              aria-label="Search projects"
              className="field-input pl-9"
            />
          </div>

          {/* Status filter pills */}
          <div className="flex shrink-0 flex-wrap gap-1.5" role="group" aria-label="Filter by status">
            {(["all", "active", "completed", "archived"] as StatusFilter[]).map((s) => (
              <button
                key={s}
                onClick={() => setStatusFilter(s)}
                aria-pressed={statusFilter === s}
                className={`rounded-full border px-3 py-1.5 text-[12px] font-semibold transition ${
                  statusFilter === s
                    ? "border-wine-950 bg-wine-950 text-cream-50"
                    : "border-taupe-200 bg-cream-50 text-ember-700 hover:border-wine-700"
                }`}
              >
                {STATUS_LABELS[s]}
                <span className="ml-1.5 opacity-60">{statusCounts[s]}</span>
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Results */}
      {filtered.length === 0 ? (
        <div className="px-6 py-16 text-center">
          {projects.length === 0 ? (
            <>
              <p className="text-lg font-semibold text-wine-950">No projects yet.</p>
              <p className="mx-auto mt-2 max-w-sm text-sm leading-6 text-ember-700/75">
                Create your first project to start tracking client deliveries.
              </p>
              <Link href="/projects/new" className="btn-primary mt-5">
                Create Project
                <ArrowRightIcon className="h-4 w-4" />
              </Link>
            </>
          ) : (
            <>
              <p className="text-lg font-semibold text-wine-950">No projects match your search.</p>
              <p className="mt-2 text-sm text-ember-700/75">Try a different name or clear the filter.</p>
              <button
                onClick={() => { setSearch(""); setStatusFilter("all"); }}
                className="btn-ghost mt-4"
              >
                Clear filters
              </button>
            </>
          )}
        </div>
      ) : (
        <>
          {/* Desktop table */}
          <div className="hidden lg:block">
            <table className="w-full border-separate border-spacing-0 text-sm">
              <thead className="bg-cream-50/60">
                <tr className="text-left text-[11px] uppercase tracking-[0.22em] text-taupe-600">
                  <th className="px-6 py-3.5 font-semibold">Client</th>
                  <th className="px-4 py-3.5 font-semibold">Platform</th>
                  <th className="px-4 py-3.5 font-semibold">Status</th>
                  <th className="px-4 py-3.5 text-right font-semibold">Agreed</th>
                  <th className="px-4 py-3.5 text-right font-semibold">Paid</th>
                  <th className="px-4 py-3.5 text-right font-semibold">Outstanding</th>
                  <th className="px-4 py-3.5 font-semibold"></th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((project) => (
                  <tr key={project.id} className="border-t border-taupe-200/60 transition hover:bg-sand-100/40">
                    <td className="px-6 py-4">
                      <Link
                        href={`/projects/${project.id}`}
                        className="font-semibold text-wine-950 transition hover:text-wine-700 hover:underline"
                      >
                        {project.client_name}
                      </Link>
                      <p className="mt-0.5 text-xs text-taupe-600">{formatDate(project.created_at)}</p>
                    </td>
                    <td className="px-4 py-4 text-sm text-ember-700/75">{project.platform || "Direct"}</td>
                    <td className="px-4 py-4">
                      <StatusBadge status={project.status} />
                    </td>
                    <td className="px-4 py-4 text-right font-mono text-sm text-wine-950">
                      {formatMoney(toNum(project.agreed_amount), project.currency)}
                    </td>
                    <td className="px-4 py-4 text-right font-mono text-sm text-wine-900">
                      {formatMoney(project.paid, project.currency)}
                    </td>
                    <td className="px-4 py-4 text-right font-mono text-sm text-ember-700">
                      {formatMoney(project.pending, project.currency)}
                    </td>
                    <td className="px-4 py-4">
                      <div className="flex items-center justify-end gap-1">
                        <Link
                          href={`/projects/${project.id}`}
                          className="btn-ghost py-1.5 text-[12px]"
                          aria-label={`Open project for ${project.client_name}`}
                        >
                          Open →
                        </Link>
                        <DeleteProjectButton
                          projectId={project.id}
                          clientName={project.client_name}
                          deliverableCount={project.count}
                          className="py-1.5 text-[12px]"
                        />
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Mobile cards */}
          <div className="grid gap-3 p-4 lg:hidden">
            {filtered.map((project) => (
              // The card is a container rather than one big <Link>: a <button>
              // cannot be nested inside an <a>, so the tap target stops at the
              // footer and Delete sits outside it.
              <div
                key={project.id}
                className="rounded-[22px] border border-taupe-200 bg-cream-50 transition hover:shadow-lift"
              >
                <Link href={`/projects/${project.id}`} className="block p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate font-semibold text-wine-950">{project.client_name}</p>
                      <p className="mt-0.5 text-sm text-ember-700/75">{project.platform || "Direct"}</p>
                    </div>
                    <StatusBadge status={project.status} />
                  </div>

                  <div className="mt-3 grid grid-cols-3 gap-2 text-xs">
                    <div className="rounded-xl bg-sand-100 px-2.5 py-2">
                      <p className="uppercase tracking-[0.18em] text-taupe-600">Agreed</p>
                      <p className="mt-1 font-semibold text-wine-950">
                        {formatMoney(toNum(project.agreed_amount), project.currency)}
                      </p>
                    </div>
                    <div className="rounded-xl bg-sand-100 px-2.5 py-2">
                      <p className="uppercase tracking-[0.18em] text-taupe-600">Paid</p>
                      <p className="mt-1 font-semibold text-wine-950">
                        {formatMoney(project.paid, project.currency)}
                      </p>
                    </div>
                    <div className="rounded-xl bg-sand-100 px-2.5 py-2">
                      <p className="uppercase tracking-[0.18em] text-taupe-600">Owed</p>
                      <p className="mt-1 font-semibold text-wine-700">
                        {formatMoney(project.pending, project.currency)}
                      </p>
                    </div>
                  </div>
                </Link>

                <div className="flex justify-end border-t border-taupe-200/60 px-4 py-2">
                  <DeleteProjectButton
                    projectId={project.id}
                    clientName={project.client_name}
                    deliverableCount={project.count}
                    className="px-2.5 py-1.5 text-[11px] uppercase tracking-[0.18em]"
                  />
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      {/* Footer result count */}
      {filtered.length > 0 && (
        <div className="border-t border-taupe-200/60 px-6 py-3">
          <p className="text-xs text-taupe-600">
            Showing {filtered.length} of {projects.length} project{projects.length !== 1 ? "s" : ""}
            {(search || statusFilter !== "all") && (
              <button
                onClick={() => { setSearch(""); setStatusFilter("all"); }}
                className="ml-2 text-wine-950 underline-offset-2 hover:underline"
              >
                Clear filters
              </button>
            )}
          </p>
        </div>
      )}
    </div>
  );
}

// ─── Status badge helper ──────────────────────────────────────────────────────

function StatusBadge({ status }: { status: string }) {
  const styles: Record<string, string> = {
    active: "border-wine-950/15 bg-wine-100 text-wine-950",
    completed: "border-taupe-200 bg-sand-100 text-ember-700",
    archived: "border-taupe-100 bg-cream-50 text-taupe-600",
  };

  return (
    <span
      className={`status-pill shrink-0 ${styles[status] ?? "border-taupe-200 bg-sand-100 text-ember-700"}`}
    >
      {status}
    </span>
  );
}
