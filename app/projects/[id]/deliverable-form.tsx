"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { PROOF_BUCKET } from "@/lib/storage";
import { ArrowRightIcon, ReceiptIcon } from "@/components/icons";
import { formatFileSize } from "@/lib/format";
import { useToast } from "@/components/toast";

const MAX_FILE_BYTES = 25 * 1024 * 1024; // 25 MB

export function DeliverableForm({ projectId }: { projectId: string }) {
  const router = useRouter();
  const { toast } = useToast();
  const fileRef = useRef<HTMLInputElement>(null);

  const [title, setTitle] = useState("");
  const [notes, setNotes] = useState("");
  const [amount, setAmount] = useState("");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<"idle" | "uploading" | "saving">("idle");

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0] ?? null;
    setError(null);

    if (file) {
      if (file.size === 0) {
        setError("The selected file appears to be empty. Please choose a different file.");
        e.target.value = "";
        setSelectedFile(null);
        return;
      }
      if (file.size > MAX_FILE_BYTES) {
        setError(`File is too large (${formatFileSize(file.size)}). Maximum allowed size is 25 MB.`);
        e.target.value = "";
        setSelectedFile(null);
        return;
      }
    }
    setSelectedFile(file);
  }

  function validateForm(): string | null {
    if (!title.trim()) return "Deliverable title is required.";
    if (amount !== "") {
      const n = parseFloat(amount);
      if (isNaN(n)) return "Amount must be a valid number.";
      if (n < 0) return "Amount cannot be negative.";
    }
    return null;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    const validationError = validateForm();
    if (validationError) {
      setError(validationError);
      return;
    }

    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      setError("Your session expired. Please sign in again.");
      return;
    }

    let fileKey: string | null = null;
    let fileUrl: string | null = null;
    let fileName: string | null = null;

    // ── Upload file if present ────────────────────────────────────────────────
    if (selectedFile) {
      setStatus("uploading");
      const key = `${user.id}/${projectId}/${Date.now()}-${selectedFile.name.replace(/[^a-zA-Z0-9._-]/g, "_")}`;

      const { error: uploadError } = await supabase.storage.from(PROOF_BUCKET).upload(key, selectedFile, {
        contentType: selectedFile.type || "application/octet-stream",
      });

      if (uploadError) {
        setError(uploadError.message ?? "File upload failed. Please try again.");
        setStatus("idle");
        return;
      }

      const { data: publicUrlData } = supabase.storage.from(PROOF_BUCKET).getPublicUrl(key);
      fileKey = key;
      fileUrl = publicUrlData.publicUrl;
      fileName = selectedFile.name;
    }

    // ── Save deliverable record ───────────────────────────────────────────────
    setStatus("saving");
    const { error: insertError } = await supabase.from("deliverables").insert({
      project_id: projectId,
      user_id: user.id,
      title: title.trim(),
      notes: notes.trim() || null,
      amount: amount !== "" ? parseFloat(amount) : 0,
      file_key: fileKey,
      file_url: fileUrl,
      file_name: fileName,
    });

    if (insertError) {
      // ── Orphan cleanup — if insert failed but file was uploaded ─────────────
      if (fileKey) {
        try {
          await supabase.storage.from(PROOF_BUCKET).remove([fileKey]);
        } catch {
          // Don't let cleanup failure mask the original error
        }
      }
      setError(insertError.message ?? "Could not save the deliverable. Please try again.");
      setStatus("idle");
      return;
    }

    setStatus("idle");
    setTitle("");
    setNotes("");
    setAmount("");
    setSelectedFile(null);
    if (fileRef.current) fileRef.current.value = "";

    toast("Deliverable added successfully.", "success");
    router.refresh();
  }

  const busy = status !== "idle";

  return (
    <form onSubmit={handleSubmit} className="space-y-5" noValidate>
      <div className="flex items-center justify-between gap-4">
        <div>
          <p className="section-kicker">add deliverable</p>
          <h3 className="mt-1 text-[1.15rem] font-semibold tracking-tight text-wine-950">
            Log a delivery record.
          </h3>
        </div>
        <ReceiptIcon className="h-5 w-5 shrink-0 text-wine-900" />
      </div>

      {/* Title */}
      <div>
        <label className="field-label" htmlFor="dv-title">
          What was delivered <span aria-hidden="true" className="text-wine-700">*</span>
        </label>
        <input
          id="dv-title"
          type="text"
          required
          className="field-input"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="e.g. Homepage redesign — final files"
          disabled={busy}
        />
      </div>

      {/* Notes */}
      <div>
        <label className="field-label" htmlFor="dv-notes">
          Notes <span className="font-normal normal-case tracking-normal text-taupe-400">(optional)</span>
        </label>
        <textarea
          id="dv-notes"
          rows={3}
          className="field-input resize-none"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="Client message, milestone note, or delivery context"
          disabled={busy}
        />
      </div>

      {/* Amount + File */}
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className="field-label" htmlFor="dv-amount">Amount</label>
          <input
            id="dv-amount"
            type="number"
            min="0"
            step="0.01"
            className="field-input"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            placeholder="0.00"
            disabled={busy}
          />
        </div>
        <div>
          <label className="field-label" htmlFor="dv-file">
            Proof file <span className="font-normal normal-case tracking-normal text-taupe-400">(max 25 MB)</span>
          </label>
          <input
            id="dv-file"
            ref={fileRef}
            type="file"
            onChange={handleFileChange}
            className="field-input cursor-pointer file:mr-3 file:cursor-pointer file:rounded-full file:border-0 file:bg-wine-950 file:px-3 file:py-1.5 file:text-[11px] file:font-semibold file:uppercase file:tracking-[0.18em] file:text-cream-50 hover:file:bg-wine-900"
            disabled={busy}
          />
          {/* Selected file info */}
          {selectedFile && (
            <p className="mt-1 text-xs text-taupe-600">
              {selectedFile.name} — {formatFileSize(selectedFile.size)}
            </p>
          )}
        </div>
      </div>

      {error && (
        <div role="alert" className="rounded-2xl border border-wine-900/15 bg-wine-100 px-4 py-3 text-sm text-wine-950">
          {error}
        </div>
      )}

      <button type="submit" disabled={busy} className="btn-primary w-full">
        {status === "uploading"
          ? "Uploading proof..."
          : status === "saving"
          ? "Saving..."
          : "Add to ledger"}
        {!busy && <ArrowRightIcon className="h-4 w-4" />}
      </button>
    </form>
  );
}
