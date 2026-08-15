"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { useToast } from "@/components/toast";

interface DeleteProjectButtonProps {
  projectId: string;
  clientName: string;
  /** Deliverables on this project — named in the confirmation so the user
   *  knows how much goes with it. */
  deliverableCount: number;
  className?: string;
}

export function DeleteProjectButton({
  projectId,
  clientName,
  deliverableCount,
  className = "",
}: DeleteProjectButtonProps) {
  const router = useRouter();
  const { toast } = useToast();
  const [confirming, setConfirming] = useState(false);

  // `deleting` covers the request; `isPending` covers the server re-render that
  // follows it. Both must be held, or the row reappears as still-deletable for
  // the moment between the response landing and the refreshed list arriving.
  const [deleting, setDeleting] = useState(false);
  const [isPending, startTransition] = useTransition();
  const busy = deleting || isPending;

  async function handleDelete() {
    setDeleting(true);
    try {
      const res = await fetch(`/api/projects/${projectId}`, { method: "DELETE" });
      const json = await res.json().catch(() => ({}));

      if (!res.ok || !json.success) {
        toast(json.error ?? "Could not delete project. Please try again.", "error");
        return;
      }

      toast(`"${clientName}" deleted.`, "info");
      setConfirming(false);
      startTransition(() => router.refresh());
    } catch {
      toast("Network error. Please try again.", "error");
    } finally {
      setDeleting(false);
    }
  }

  const message =
    deliverableCount > 0
      ? `"${clientName}" and its ${deliverableCount} deliverable${
          deliverableCount !== 1 ? "s" : ""
        } — including any attached proof files — will be permanently removed. This cannot be undone.`
      : `"${clientName}" will be permanently removed. This cannot be undone.`;

  return (
    <>
      <button
        onClick={() => setConfirming(true)}
        disabled={busy}
        aria-label={`Delete project for ${clientName}`}
        className={`btn-ghost text-taupe-600 hover:text-wine-950 disabled:pointer-events-none disabled:opacity-50 ${className}`}
      >
        Delete
      </button>

      <ConfirmDialog
        open={confirming}
        title="Delete this project?"
        message={message}
        confirmLabel="Delete project"
        cancelLabel="Keep it"
        loading={busy}
        destructive={true}
        onConfirm={handleDelete}
        onCancel={() => !busy && setConfirming(false)}
      />
    </>
  );
}
