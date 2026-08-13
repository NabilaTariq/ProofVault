"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { useToast } from "@/components/toast";
import { Spinner } from "@/components/icons";

interface DeliverableActionsProps {
  id: string;
  paid: boolean;
  title: string;
  acknowledged?: boolean;
}

type Action = "paid" | "ack" | "delete";

/**
 * `paid_at` and the acknowledgement columns arrived after the first schema
 * release, so a database that predates them rejects the write with a raw
 * PostgREST schema error. Turn that into something actionable.
 */
function describeError(raw: unknown, fallback: string) {
  const message = typeof raw === "string" ? raw : "";
  if (/(column|schema cache)/i.test(message) && /(does not exist|could not find)/i.test(message)) {
    return "This database is out of date — re-run supabase/schema.sql in the Supabase SQL editor.";
  }
  return message || fallback;
}

export function DeliverableActions({ id, paid, title, acknowledged = false }: DeliverableActionsProps) {
  const router = useRouter();
  const { toast } = useToast();
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  // `running` covers the PATCH/DELETE request. `isPending` covers the server
  // re-render that follows it — until that lands, this component still holds
  // the old `paid` prop. Releasing the button after only the first of those
  // made it snap back to "Mark As Paid" while the change was still in flight,
  // which read as the click doing nothing.
  const [running, setRunning] = useState<Action | null>(null);
  const [isPending, startTransition] = useTransition();
  const lastAction = useRef<Action | null>(null);

  const active: Action | null = running ?? (isPending ? lastAction.current : null);
  const anyBusy = active !== null;

  async function send(action: Action, request: () => Promise<Response>, onOk: () => void, failure: string) {
    lastAction.current = action;
    setRunning(action);

    try {
      const res = await request();

      if (!res.ok) {
        const json = await res.json().catch(() => ({}));
        toast(describeError(json.error, failure), "error");
        return;
      }

      onOk();
      // Hold the busy state through the refresh — `active` stays truthy while
      // the transition is pending.
      startTransition(() => router.refresh());
    } catch {
      toast("Network error. Please check your connection.", "error");
    } finally {
      setRunning(null);
    }
  }

  function togglePaid() {
    return send(
      "paid",
      () =>
        fetch(`/api/deliverables/${id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ paid: !paid }),
        }),
      () => toast(paid ? "Marked as unpaid." : "Marked as paid.", "success"),
      "Could not update payment status. Please try again."
    );
  }

  function toggleAcknowledged() {
    return send(
      "ack",
      () =>
        fetch(`/api/deliverables/${id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ acknowledged: !acknowledged }),
        }),
      () =>
        toast(
          acknowledged ? "Client acknowledgement cleared." : "Client acknowledgement recorded.",
          "success"
        ),
      "Could not update acknowledgement. Please try again."
    );
  }

  async function handleDelete() {
    await send(
      "delete",
      () => fetch(`/api/deliverables/${id}`, { method: "DELETE" }),
      () => toast("Deliverable deleted.", "info"),
      "Could not delete deliverable. Please try again."
    );
    setShowDeleteConfirm(false);
  }

  return (
    <>
      <div className="flex flex-wrap items-center gap-2">
        {/* Paid toggle */}
        <button
          onClick={togglePaid}
          disabled={anyBusy}
          aria-busy={active === "paid"}
          aria-label={paid ? "Mark as unpaid" : "Mark as paid"}
          title={paid ? "Click to mark as unpaid" : "Click to mark as paid"}
          className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.18em] transition disabled:pointer-events-none disabled:opacity-50 ${
            paid
              ? "border-wine-950 bg-wine-950 text-cream-50 hover:bg-wine-900"
              : "border-taupe-200 bg-cream-50 text-ember-700 hover:border-wine-700"
          }`}
        >
          {active === "paid" ? (
            <span className="flex items-center gap-1">
              <Spinner className="h-3 w-3" />
              Updating…
            </span>
          ) : (
            paid ? "✓ Paid" : "Mark As Paid"
          )}
        </button>

        {/* Client acknowledgement toggle — evidence for the dispute assistant */}
        <button
          onClick={toggleAcknowledged}
          disabled={anyBusy}
          aria-busy={active === "ack"}
          aria-label={
            acknowledged ? "Clear client acknowledgement" : "Record client acknowledgement"
          }
          title={
            acknowledged
              ? "Client acknowledgement is recorded — click to clear it"
              : "Record that the client acknowledged or approved this delivery"
          }
          className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.18em] transition disabled:pointer-events-none disabled:opacity-50 ${
            acknowledged
              ? "border-wine-800 bg-wine-100 text-wine-950 hover:border-wine-950"
              : "border-taupe-200 bg-cream-50 text-ember-700 hover:border-wine-700"
          }`}
        >
          {active === "ack" ? (
            <span className="flex items-center gap-1">
              <Spinner className="h-3 w-3" />
              Updating…
            </span>
          ) : (
            acknowledged ? "✓ Acknowledged" : "Mark Acknowledged"
          )}
        </button>

        {/* Delete button */}
        <button
          onClick={() => setShowDeleteConfirm(true)}
          disabled={anyBusy}
          aria-label="Delete this deliverable"
          className="btn-ghost px-2.5 py-1.5 text-[11px] uppercase tracking-[0.18em] text-taupe-600 hover:text-wine-950 disabled:pointer-events-none disabled:opacity-50"
        >
          Delete
        </button>
      </div>

      {/* Confirmation dialog */}
      <ConfirmDialog
        open={showDeleteConfirm}
        title="Delete deliverable?"
        message={`"${title}" and any attached proof file will be permanently removed. This cannot be undone.`}
        confirmLabel="Delete"
        cancelLabel="Keep it"
        loading={active === "delete"}
        destructive={true}
        onConfirm={handleDelete}
        onCancel={() => active !== "delete" && setShowDeleteConfirm(false)}
      />
    </>
  );
}
