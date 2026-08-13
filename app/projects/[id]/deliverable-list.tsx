"use client";

import { useMemo, useState } from "react";
import { formatMoney, formatDate, shortRef } from "@/lib/format";
import { toNum, type Deliverable } from "@/lib/types";
import { ReceiptIcon } from "@/components/icons";
import { DeliverableActions } from "./deliverable-actions";

type PayFilter = "all" | "paid" | "unpaid";
type SortKey = "newest" | "oldest" | "highest" | "lowest";

interface DeliverableListProps {
  deliverables: Deliverable[];
  currency: string;
}

export function DeliverableList({ deliverables, currency }: DeliverableListProps) {
  const [payFilter, setPayFilter] = useState<PayFilter>("all");
  const [sort, setSort] = useState<SortKey>("newest");

  const filtered = useMemo(() => {
    let list = [...deliverables];

    if (payFilter === "paid") list = list.filter((d) => d.paid);
    else if (payFilter === "unpaid") list = list.filter((d) => !d.paid);

    switch (sort) {
      case "newest":
        list.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
        break;
      case "oldest":
        list.sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
        break;
      case "highest":
        list.sort((a, b) => toNum(b.amount) - toNum(a.amount));
        break;
      case "lowest":
        list.sort((a, b) => toNum(a.amount) - toNum(b.amount));
        break;
    }

    return list;
  }, [deliverables, payFilter, sort]);

  const paidCount = deliverables.filter((d) => d.paid).length;
  const unpaidCount = deliverables.filter((d) => !d.paid).length;

  if (deliverables.length === 0) {
    return (
      <div className="px-6 py-16 text-center">
        <ReceiptIcon className="mx-auto h-8 w-8 text-taupe-300" />
        <p className="mt-4 text-base font-semibold text-wine-950">No deliverables recorded yet.</p>
        <p className="mx-auto mt-2 max-w-sm text-sm leading-6 text-ember-700/75">
          Use the form on the left to add your first delivery record.
        </p>
      </div>
    );
  }

  return (
    <div>
      {/* Filter + sort controls */}
      <div className="flex flex-col gap-3 border-b border-taupe-200 px-5 py-3 sm:flex-row sm:items-center sm:justify-between sm:px-6">
        {/* Pay filter */}
        <div className="flex gap-1.5" role="group" aria-label="Filter by payment status">
          {([
            { key: "all" as PayFilter, label: "All", count: deliverables.length },
            { key: "paid" as PayFilter, label: "Paid", count: paidCount },
            { key: "unpaid" as PayFilter, label: "Unpaid", count: unpaidCount },
          ]).map(({ key, label, count }) => (
            <button
              key={key}
              onClick={() => setPayFilter(key)}
              aria-pressed={payFilter === key}
              className={`rounded-full border px-3 py-1 text-[11px] font-semibold transition ${
                payFilter === key
                  ? "border-wine-950 bg-wine-950 text-cream-50"
                  : "border-taupe-200 bg-cream-50 text-ember-700 hover:border-wine-700"
              }`}
            >
              {label} <span className="opacity-60">{count}</span>
            </button>
          ))}
        </div>

        {/* Sort */}
        <div className="flex items-center gap-2">
          <label htmlFor="dv-sort" className="text-[11px] uppercase tracking-[0.18em] text-taupe-600">
            Sort
          </label>
          <select
            id="dv-sort"
            value={sort}
            onChange={(e) => setSort(e.target.value as SortKey)}
            className="rounded-xl border border-taupe-200 bg-cream-50 px-2.5 py-1.5 text-[12px] text-ember-700 outline-none focus:border-wine-700 focus:ring-2 focus:ring-wine-700/20"
          >
            <option value="newest">Newest first</option>
            <option value="oldest">Oldest first</option>
            <option value="highest">Highest value</option>
            <option value="lowest">Lowest value</option>
          </select>
        </div>
      </div>

      {/* List */}
      {filtered.length === 0 ? (
        <div className="px-6 py-10 text-center">
          <p className="text-sm font-semibold text-wine-950">No deliverables match this filter.</p>
        </div>
      ) : (
        <div className="space-y-4 p-4 sm:p-5">
          {filtered.map((deliverable) => (
            <div key={deliverable.id} className="receipt p-5 pt-6">
              {/* Header row */}
              <div className="mb-3 flex items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <p className="font-semibold text-wine-950">{deliverable.title}</p>
                  <p className="mt-0.5 font-mono text-[10px] uppercase tracking-[0.18em] text-taupe-500">
                    #{shortRef(deliverable.id)} · {formatDate(deliverable.created_at)}
                  </p>
                </div>
                <div className="shrink-0 text-right">
                  <p className="font-mono text-base font-semibold text-wine-950">
                    {formatMoney(toNum(deliverable.amount), currency)}
                  </p>
                  <span
                    className={`mt-1 inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.18em] ${
                      deliverable.paid
                        ? "border-wine-950/20 bg-wine-100 text-wine-950"
                        : "border-taupe-200 bg-sand-100 text-ember-700"
                    }`}
                  >
                    {deliverable.paid ? "Paid" : "Unpaid"}
                  </span>
                </div>
              </div>

              {/* Notes */}
              {deliverable.notes && (
                <p className="mb-3 text-sm leading-6 text-ember-700/75">{deliverable.notes}</p>
              )}

              {/* Proof file */}
              {deliverable.file_url ? (
                <a
                  href={deliverable.file_url}
                  target="_blank"
                  rel="noreferrer"
                  className="mb-3 inline-flex max-w-full items-center gap-2 rounded-full border border-taupe-200 bg-cream-50 px-3 py-1.5 text-sm text-wine-950 underline-offset-2 transition hover:border-wine-700 hover:underline"
                  aria-label={`View proof: ${deliverable.file_name ?? "proof file"}`}
                >
                  <ReceiptIcon className="h-4 w-4 shrink-0" />
                  <span className="truncate">{deliverable.file_name ?? "View proof file"}</span>
                </a>
              ) : (
                <p className="mb-3 text-[11px] text-taupe-400">No proof file attached.</p>
              )}

              {/* Client acknowledgement — part of the dispute evidence trail */}
              <p className="mb-3 text-[11px] text-taupe-500">
                {deliverable.acknowledged
                  ? `Client acknowledged${
                      deliverable.acknowledged_at
                        ? ` on ${formatDate(deliverable.acknowledged_at)}`
                        : ""
                    }.`
                  : "No client acknowledgement recorded."}
                {deliverable.paid && deliverable.paid_at
                  ? ` Payment recorded ${formatDate(deliverable.paid_at)}.`
                  : ""}
              </p>

              <DeliverableActions
                id={deliverable.id}
                paid={deliverable.paid}
                title={deliverable.title}
                acknowledged={Boolean(deliverable.acknowledged)}
              />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
