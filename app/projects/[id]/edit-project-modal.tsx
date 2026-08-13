"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useToast } from "@/components/toast";
import type { Project } from "@/lib/types";

const CURRENCIES = ["USD", "GBP", "EUR", "PKR", "INR", "AED", "CAD", "AUD"] as const;
const STATUSES = [
  { value: "active", label: "Active" },
  { value: "completed", label: "Completed" },
  { value: "archived", label: "Archived" },
] as const;

interface EditProjectModalProps {
  project: Project;
  onClose: () => void;
}

export function EditProjectModal({ project, onClose }: EditProjectModalProps) {
  const router = useRouter();
  const { toast } = useToast();

  const [clientName, setClientName] = useState(project.client_name);
  const [platform, setPlatform] = useState(project.platform ?? "");
  const [description, setDescription] = useState(project.description ?? "");
  const [agreedAmount, setAgreedAmount] = useState(String(project.agreed_amount));
  const [currency, setCurrency] = useState(project.currency ?? "USD");
  const [status, setStatus] = useState(project.status ?? "active");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  function validate(): string | null {
    if (!clientName.trim()) return "Client name is required.";
    const amount = parseFloat(agreedAmount);
    if (isNaN(amount) || amount < 0) return "Agreed amount must be a valid non-negative number.";
    return null;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const validationError = validate();
    if (validationError) {
      setError(validationError);
      return;
    }

    setError(null);
    setLoading(true);

    try {
      const res = await fetch(`/api/projects/${project.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          client_name: clientName.trim(),
          platform: platform.trim() || null,
          description: description.trim() || null,
          agreed_amount: parseFloat(agreedAmount),
          currency,
          status,
        }),
      });

      const json = await res.json();

      if (!res.ok || !json.success) {
        setError(json.error ?? "Could not update project. Please try again.");
        return;
      }

      toast("Project updated successfully.", "success");
      router.refresh();
      onClose();
    } catch {
      setError("A network error occurred. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="edit-project-title"
      onClick={(e) => { if (e.target === e.currentTarget && !loading) onClose(); }}
      className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-wine-950/40 p-4 backdrop-blur-sm sm:items-center"
    >
      <div
        className="surface my-8 w-full max-w-lg p-6 sm:p-7"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-6 flex items-start justify-between gap-4">
          <div>
            <p className="section-kicker">edit project</p>
            <h2 id="edit-project-title" className="mt-1 text-xl font-semibold tracking-tight text-wine-950">
              Update project details
            </h2>
          </div>
          <button
            onClick={onClose}
            disabled={loading}
            aria-label="Close edit dialog"
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-taupe-200 text-taupe-600 transition hover:border-wine-700 hover:text-wine-950"
          >
            <svg viewBox="0 0 16 16" className="h-4 w-4" fill="none">
              <path d="M4 4l8 8M12 4l-8 8" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
            </svg>
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4" noValidate>
          {/* Client name */}
          <div>
            <label className="field-label" htmlFor="ep-client-name">
              Client name <span aria-hidden="true" className="text-wine-700">*</span>
            </label>
            <input
              id="ep-client-name"
              type="text"
              required
              className="field-input"
              value={clientName}
              onChange={(e) => setClientName(e.target.value)}
              placeholder="e.g. Northline Studio"
              disabled={loading}
            />
          </div>

          {/* Platform */}
          <div>
            <label className="field-label" htmlFor="ep-platform">Platform</label>
            <input
              id="ep-platform"
              type="text"
              className="field-input"
              value={platform}
              onChange={(e) => setPlatform(e.target.value)}
              placeholder="e.g. Upwork, Fiverr, Direct"
              disabled={loading}
            />
          </div>

          {/* Description */}
          <div>
            <label className="field-label" htmlFor="ep-description">Description</label>
            <textarea
              id="ep-description"
              rows={3}
              className="field-input resize-none"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Brief project description (optional)"
              disabled={loading}
            />
          </div>

          {/* Amount + Currency */}
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="field-label" htmlFor="ep-amount">
                Agreed amount <span aria-hidden="true" className="text-wine-700">*</span>
              </label>
              <input
                id="ep-amount"
                type="number"
                min="0"
                step="0.01"
                required
                className="field-input"
                value={agreedAmount}
                onChange={(e) => setAgreedAmount(e.target.value)}
                placeholder="0.00"
                disabled={loading}
              />
            </div>
            <div>
              <label className="field-label" htmlFor="ep-currency">Currency</label>
              <select
                id="ep-currency"
                className="field-input"
                value={currency}
                onChange={(e) => setCurrency(e.target.value)}
                disabled={loading}
              >
                {CURRENCIES.map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Status */}
          <div>
            <label className="field-label" htmlFor="ep-status">Project status</label>
            <select
              id="ep-status"
              className="field-input"
              value={status}
              onChange={(e) => setStatus(e.target.value as "active" | "completed" | "archived")}
              disabled={loading}
            >
              {STATUSES.map((s) => (
                <option key={s.value} value={s.value}>{s.label}</option>
              ))}
            </select>
          </div>

          {error && (
            <div role="alert" className="rounded-2xl border border-wine-900/15 bg-wine-100 px-4 py-3 text-sm text-wine-950">
              {error}
            </div>
          )}

          <div className="flex flex-col-reverse gap-2 pt-2 sm:flex-row sm:justify-end">
            <button type="button" onClick={onClose} disabled={loading} className="btn-secondary">
              Cancel
            </button>
            <button type="submit" disabled={loading} className="btn-primary">
              {loading ? "Saving..." : "Save changes"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
