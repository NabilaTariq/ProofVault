"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { useToast } from "@/components/toast";
import { Spinner } from "@/components/icons";

/**
 * The acknowledgement columns arrived after the first schema release, so a
 * database that predates them fails this update with a raw PostgREST message.
 * Turn that into something the operator can act on.
 */
function describeUpdateError(raw: unknown, fallback: string) {
  const message = typeof raw === "string" ? raw : "";
  if (/acknowledg/i.test(message) && /(column|schema cache|does not exist)/i.test(message)) {
    return "This database is missing the acknowledgement columns. Re-run supabase/schema.sql in the Supabase SQL editor.";
  }
  return message || fallback;
}

interface DeliverableActionsProps {
  id: string;
  paid: boolean;
  title: string;
  acknowledged?: boolean;
}

export function DeliverableActions({ id, paid, title, acknowledged = false }: DeliverableActionsProps) {
  const router = useRouter();
  const { toast } = useToast();
  const [toggleBusy, setToggleBusy] = useState(false);
  const [ackBusy, setAckBusy] = useState(false);
  const [deleteBusy, setDeleteBusy] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  async function togglePaid() {
    setToggleBusy(true);
    try {
      const res = await fetch(`/api/deliverables/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ paid: !paid }),
      });

      if (!res.ok) {
        const json = await res.json().catch(() => ({}));
        toast(json.error ?? "Could not update payment status. Please try again.", "error");
        return;
      }

      toast(paid ? "Marked as unpaid." : "Marked as paid.", "success");
      router.refresh();
    } catch {
      toast("Network error. Please check your connection.", "error");
    } finally {
      setToggleBusy(false);
    }
  }

  async function toggleAcknowledged() {
    setAckBusy(true);
    try {
      const res = await fetch(`/api/deliverables/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ acknowledged: !acknowledged }),
      });

      if (!res.ok) {
        const json = await res.json().catch(() => ({}));
        toast(
          describeUpdateError(json.error, "Could not update acknowledgement. Please try again."),
          "error"
        );
        return;
      }

      toast(
        acknowledged ? "Client acknowledgement cleared." : "Client acknowledgement recorded.",
        "success"
      );
      router.refresh();
    } catch {
      toast("Network error. Please check your connection.", "error");
    } finally {
      setAckBusy(false);
    }
  }

  async function handleDelete() {
    setDeleteBusy(true);
    try {
      const res = await fetch(`/api/deliverables/${id}`, { method: "DELETE" });

      if (!res.ok) {
        const json = await res.json().catch(() => ({}));
        toast(json.error ?? "Could not delete deliverable. Please try again.", "error");
        setShowDeleteConfirm(false);
        return;
      }

      toast("Deliverable deleted.", "info");
      router.refresh();
    } catch {
      toast("Network error. Please check your connection.", "error");
    } finally {
      setDeleteBusy(false);
      setShowDeleteConfirm(false);
    }
  }

  const anyBusy = toggleBusy || ackBusy || deleteBusy;

  return (
    <>
      <div className="flex flex-wrap items-center gap-2">
        {/* Paid toggle */}
        <button
          onClick={togglePaid}
          disabled={anyBusy}
          aria-label={paid ? "Mark as unpaid" : "Mark as paid"}
          title={paid ? "Click to mark as unpaid" : "Click to mark as paid"}
          className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.18em] transition disabled:pointer-events-none disabled:opacity-50 ${
            paid
              ? "border-wine-950 bg-wine-950 text-cream-50 hover:bg-wine-900"
              : "border-taupe-200 bg-cream-50 text-ember-700 hover:border-wine-700"
          }`}
        >
          {toggleBusy ? (
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
          {ackBusy ? (
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
        loading={deleteBusy}
        destructive={true}
        onConfirm={handleDelete}
        onCancel={() => !deleteBusy && setShowDeleteConfirm(false)}
      />
    </>
  );
}
