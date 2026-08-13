"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { useToast } from "@/components/toast";

interface ProjectActionsProps {
  projectId: string;
  currentStatus: string;
  clientName: string;
}

type ActionType = "complete" | "archive" | "reopen" | null;

const CONFIRM_COPY: Record<NonNullable<ActionType>, { title: string; message: (name: string) => string; label: string }> = {
  complete: {
    title: "Mark project as completed?",
    message: (name) => `"${name}" will be marked as completed. You can reopen it later if needed.`,
    label: "Mark Completed",
  },
  archive: {
    title: "Archive this project?",
    message: (name) => `"${name}" will be archived and excluded from financial summaries. You can restore it anytime.`,
    label: "Archive",
  },
  reopen: {
    title: "Reopen this project?",
    message: (name) => `"${name}" will be set back to active.`,
    label: "Reopen",
  },
};

export function ProjectActions({ projectId, currentStatus, clientName }: ProjectActionsProps) {
  const router = useRouter();
  const { toast } = useToast();
  const [pendingAction, setPendingAction] = useState<ActionType>(null);
  const [loading, setLoading] = useState(false);

  async function applyStatus(status: string) {
    setLoading(true);
    try {
      const res = await fetch(`/api/projects/${projectId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });

      const json = await res.json().catch(() => ({}));

      if (!res.ok || !json.success) {
        toast(json.error ?? "Could not update project status. Please try again.", "error");
        return;
      }

      const labels: Record<string, string> = {
        active: "Project reopened.",
        completed: "Project marked as completed.",
        archived: "Project archived.",
      };
      toast(labels[status] ?? "Project updated.", "success");
      router.refresh();
    } catch {
      toast("Network error. Please try again.", "error");
    } finally {
      setLoading(false);
      setPendingAction(null);
    }
  }

  return (
    <>
      <div className="flex flex-wrap items-center gap-2">
        {currentStatus !== "completed" && currentStatus !== "archived" && (
          <button
            onClick={() => setPendingAction("complete")}
            className="btn-secondary text-[12px]"
            title="Mark this project as completed"
          >
            Mark Completed
          </button>
        )}

        {currentStatus !== "archived" && (
          <button
            onClick={() => setPendingAction("archive")}
            className="btn-ghost px-3 py-2 text-[12px] text-taupe-600 hover:text-wine-950"
            title="Archive this project"
          >
            Archive
          </button>
        )}

        {(currentStatus === "completed" || currentStatus === "archived") && (
          <button
            onClick={() => setPendingAction("reopen")}
            className="btn-secondary text-[12px]"
            title="Reopen as active"
          >
            Reopen
          </button>
        )}
      </div>

      {pendingAction && (
        <ConfirmDialog
          open={true}
          title={CONFIRM_COPY[pendingAction].title}
          message={CONFIRM_COPY[pendingAction].message(clientName)}
          confirmLabel={CONFIRM_COPY[pendingAction].label}
          cancelLabel="Cancel"
          loading={loading}
          destructive={pendingAction === "archive"}
          onConfirm={() =>
            applyStatus(
              pendingAction === "complete" ? "completed" : pendingAction === "archive" ? "archived" : "active"
            )
          }
          onCancel={() => !loading && setPendingAction(null)}
        />
      )}
    </>
  );
}
