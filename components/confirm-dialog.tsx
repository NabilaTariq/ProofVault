"use client";

import { useEffect, useRef } from "react";

interface ConfirmDialogProps {
  open: boolean;
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  loading?: boolean;
  destructive?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

export function ConfirmDialog({
  open,
  title,
  message,
  confirmLabel = "Confirm",
  cancelLabel = "Cancel",
  loading = false,
  destructive = true,
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  const cancelRef = useRef<HTMLButtonElement>(null);
  const dialogRef = useRef<HTMLDivElement>(null);

  // Focus the cancel button when dialog opens
  useEffect(() => {
    if (open) {
      cancelRef.current?.focus();
    }
  }, [open]);

  // Trap Escape key
  useEffect(() => {
    if (!open) return;
    function handleKey(e: KeyboardEvent) {
      if (e.key === "Escape" && !loading) onCancel();
    }
    document.addEventListener("keydown", handleKey);
    return () => document.removeEventListener("keydown", handleKey);
  }, [open, loading, onCancel]);

  // Click-outside to cancel
  function handleBackdropClick(e: React.MouseEvent) {
    if (e.target === e.currentTarget && !loading) onCancel();
  }

  if (!open) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="confirm-title"
      aria-describedby="confirm-message"
      onClick={handleBackdropClick}
      className="fixed inset-0 z-50 flex items-center justify-center bg-wine-950/40 p-4 backdrop-blur-sm"
    >
      <div
        ref={dialogRef}
        className="surface w-full max-w-md p-6 sm:p-7"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Icon */}
        {destructive && (
          <div className="mb-4 flex h-11 w-11 items-center justify-center rounded-2xl bg-wine-100">
            <svg viewBox="0 0 20 20" className="h-5 w-5 text-wine-950" fill="none">
              <path
                d="M10 2.5a7.5 7.5 0 1 1 0 15 7.5 7.5 0 0 1 0-15ZM10 7v4M10 13h.01"
                stroke="currentColor"
                strokeWidth="1.6"
                strokeLinecap="round"
              />
            </svg>
          </div>
        )}

        <h2 id="confirm-title" className="text-lg font-semibold tracking-tight text-wine-950">
          {title}
        </h2>
        <p id="confirm-message" className="mt-2 text-sm leading-6 text-ember-700/80">
          {message}
        </p>

        <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <button
            ref={cancelRef}
            onClick={onCancel}
            disabled={loading}
            className="btn-secondary"
          >
            {cancelLabel}
          </button>
          <button
            onClick={onConfirm}
            disabled={loading}
            className={`btn-primary ${destructive ? "bg-wine-950 hover:bg-wine-900" : ""}`}
          >
            {loading ? "Working..." : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
