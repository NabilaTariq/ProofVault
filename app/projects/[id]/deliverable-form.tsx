"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { PROOF_BUCKET } from "@/lib/storage";
import { ArrowRightIcon, ReceiptIcon, SparkIcon, Spinner } from "@/components/icons";
import { formatDate, formatFileSize } from "@/lib/format";
import { useToast } from "@/components/toast";
import { isAnalyzableFile, prepareImageForAnalysis } from "@/lib/image";
import {
  ACKNOWLEDGEMENT_LABEL,
  impliesAcknowledged,
  type ProofCaptureResult,
  type ProofSuggestion,
} from "@/lib/ai/proof-capture";

const MAX_FILE_BYTES = 25 * 1024 * 1024; // 25 MB

/** Which form fields currently hold an AI suggestion the user hasn't touched. */
type SuggestedField = "title" | "notes" | "amount";

interface DeliverableFormProps {
  projectId: string;
  /** Project currency, used to flag when the file shows a different one. */
  currency: string;
  /** False when the deployment has no OPENAI_API_KEY — hides proof capture. */
  aiEnabled: boolean;
}

export function DeliverableForm({ projectId, currency, aiEnabled }: DeliverableFormProps) {
  const router = useRouter();
  const { toast } = useToast();
  const fileRef = useRef<HTMLInputElement>(null);

  const [title, setTitle] = useState("");
  const [notes, setNotes] = useState("");
  const [amount, setAmount] = useState("");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<"idle" | "uploading" | "saving">("idle");

  // ── Proof capture state ────────────────────────────────────────────────────
  const [analyzing, setAnalyzing] = useState(false);
  const [analysisError, setAnalysisError] = useState<string | null>(null);
  const [suggestion, setSuggestion] = useState<ProofSuggestion | null>(null);
  const [suggested, setSuggested] = useState<Set<SuggestedField>>(new Set());
  const [recordAck, setRecordAck] = useState(false);
  const [ackNote, setAckNote] = useState("");

  /** Once the user edits a field themselves, it is theirs — drop the badge. */
  function clearSuggested(field: SuggestedField) {
    setSuggested((prev) => {
      if (!prev.has(field)) return prev;
      const next = new Set(prev);
      next.delete(field);
      return next;
    });
  }

  function resetCapture() {
    setSuggestion(null);
    setSuggested(new Set());
    setAnalysisError(null);
    setRecordAck(false);
    setAckNote("");
  }

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0] ?? null;
    setError(null);
    resetCapture();

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

  // ── Read the proof file into the form ──────────────────────────────────────
  async function analyzeProof() {
    if (!selectedFile) return;

    setAnalyzing(true);
    setAnalysisError(null);

    try {
      const prepared = await prepareImageForAnalysis(selectedFile);

      const res = await fetch("/api/deliverables/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ imageDataUrl: prepared.dataUrl }),
      });

      const json = await res.json().catch(() => ({}));

      if (!res.ok || !json.success) {
        setAnalysisError(json.error ?? "Could not read this file. Please fill the form in manually.");
        return;
      }

      const { suggestion: s } = json.data as ProofCaptureResult;
      setSuggestion(s);

      if (!s.readable) {
        setAnalysisError(
          s.unreadable_reason ?? "Nothing readable was found in this file. Please fill the form in manually."
        );
        return;
      }

      // Only fill fields the user hasn't already written into — their own
      // typing always wins over a suggestion.
      const filled = new Set<SuggestedField>();
      if (s.title && !title.trim()) {
        setTitle(s.title);
        filled.add("title");
      }
      if (s.notes && !notes.trim()) {
        setNotes(s.notes);
        filled.add("notes");
      }
      if (s.amount !== null && amount === "") {
        setAmount(String(s.amount));
        filled.add("amount");
      }
      setSuggested(filled);

      // Pre-tick the acknowledgement only for an explicit approval — a
      // revision request or a complaint is a reply, not an approval, and the
      // dispute summary would misreport it as one.
      if (impliesAcknowledged(s.acknowledgement) && s.acknowledgement_quote) {
        setRecordAck(true);
        setAckNote(s.acknowledgement_quote);
      }

      toast("Draft filled in from your proof file. Review before saving.", "success");
    } catch (err) {
      setAnalysisError(
        err instanceof Error ? err.message : "Could not read this file. Please fill the form in manually."
      );
    } finally {
      setAnalyzing(false);
    }
  }

  /** Fold a non-approval client reply into the notes rather than the ack flag. */
  function appendQuoteToNotes() {
    if (!suggestion?.acknowledgement_quote) return;
    const line = `Client reply: "${suggestion.acknowledgement_quote}"`;
    setNotes((prev) => (prev.trim() ? `${prev.trim()}\n\n${line}` : line));
    clearSuggested("notes");
    toast("Client reply added to notes.", "success");
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
    // The acknowledgement is recorded only when the user left the box ticked,
    // and its timestamp is when it was logged here — the same meaning the rest
    // of ProofVault gives a timestamp, not a date read off the screenshot.
    const acknowledged = recordAck && ackNote.trim() !== "";

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
      acknowledged,
      acknowledged_at: acknowledged ? new Date().toISOString() : null,
      acknowledgement_note: acknowledged ? ackNote.trim() : null,
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
    resetCapture();
    if (fileRef.current) fileRef.current.value = "";

    toast("Deliverable added successfully.", "success");
    router.refresh();
  }

  const busy = status !== "idle" || analyzing;
  const canAnalyze = aiEnabled && selectedFile !== null && isAnalyzableFile(selectedFile);
  const showAckBlock =
    suggestion?.readable &&
    suggestion.acknowledgement !== "none" &&
    suggestion.acknowledgement_quote !== null;
  const currencyMismatch =
    suggestion?.currency_code !== null &&
    suggestion?.currency_code !== undefined &&
    suggestion.currency_code !== currency;

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

      {/* ── Proof file (first: it can fill in the rest) ── */}
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
        {selectedFile && (
          <p className="mt-1 text-xs text-taupe-600">
            {selectedFile.name} — {formatFileSize(selectedFile.size)}
          </p>
        )}

        {/* Read the file into the form. Stays available after an unreadable
            result so the user can retry with a clearer screenshot. */}
        {canAnalyze && !suggestion?.readable && (
          <button
            type="button"
            onClick={analyzeProof}
            disabled={busy}
            className="btn-secondary mt-3 w-full"
          >
            {analyzing ? <Spinner /> : <SparkIcon className="h-4 w-4" />}
            {analyzing ? "Reading your file..." : "Fill the form in from this file"}
          </button>
        )}

        {aiEnabled && selectedFile && !isAnalyzableFile(selectedFile) && (
          <p className="mt-2 text-xs text-taupe-600">
            Automatic reading works on PNG, JPEG, WebP and GIF screenshots. This file will still be
            attached as proof.
          </p>
        )}

        {analysisError && (
          <div
            role="alert"
            className="mt-3 rounded-2xl border border-wine-900/15 bg-wine-100 px-4 py-3 text-sm text-wine-950"
          >
            {analysisError}
          </div>
        )}
      </div>

      {/* ── What was read from the file ── */}
      {suggestion?.readable && (
        <div className="rounded-2xl border border-taupe-200 bg-sand-100/60 px-4 py-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="inline-flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-wine-950">
              <SparkIcon className="h-3.5 w-3.5" />
              Read from {suggestion.document_kind}
            </p>
            <button
              type="button"
              onClick={resetCapture}
              className="text-xs font-semibold text-taupe-600 underline-offset-2 hover:text-wine-950 hover:underline"
            >
              Dismiss
            </button>
          </div>

          <p className="mt-2 text-xs leading-5 text-taupe-600">
            These are suggestions drawn from the file — check every field before saving. Nothing is
            recorded until you add it to the ledger.
          </p>

          <dl className="mt-3 space-y-1.5 text-xs text-wine-950">
            {suggestion.delivered_on && (
              <div className="flex flex-wrap gap-x-2">
                <dt className="font-semibold">Date seen in file:</dt>
                <dd className="text-taupe-600">
                  {formatDate(suggestion.delivered_on)} — this entry is still timestamped when you
                  save it.
                </dd>
              </div>
            )}
            {currencyMismatch && (
              <div className="flex flex-wrap gap-x-2">
                <dt className="font-semibold">Currency in file:</dt>
                <dd className="text-taupe-600">
                  {suggestion.currency_code} — this project is recorded in {currency}. Check the
                  amount.
                </dd>
              </div>
            )}
            <div className="flex flex-wrap gap-x-2">
              <dt className="font-semibold">Confidence:</dt>
              <dd className="text-taupe-600">
                {suggestion.confidence}
                {suggestion.confidence === "low" && " — read the file yourself before saving."}
              </dd>
            </div>
          </dl>

          {/* Client reply detected in the file */}
          {showAckBlock && (
            <div className="mt-3 rounded-xl border border-taupe-200 bg-cream-50 px-3.5 py-3">
              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-wine-950">
                {ACKNOWLEDGEMENT_LABEL[suggestion.acknowledgement]}
              </p>
              <blockquote className="mt-1.5 border-l-2 border-taupe-200 pl-3 text-xs italic leading-5 text-taupe-600">
                {suggestion.acknowledgement_quote}
              </blockquote>

              {impliesAcknowledged(suggestion.acknowledgement) ? (
                <div className="mt-3">
                  <label className="flex items-start gap-2.5 text-xs font-medium text-wine-950">
                    <input
                      type="checkbox"
                      checked={recordAck}
                      onChange={(e) => setRecordAck(e.target.checked)}
                      disabled={busy}
                      className="mt-0.5 h-3.5 w-3.5 shrink-0 accent-wine-950"
                    />
                    Record this as a client acknowledgement
                  </label>
                  {recordAck && (
                    <textarea
                      rows={2}
                      className="field-input mt-2 resize-none text-xs"
                      value={ackNote}
                      onChange={(e) => setAckNote(e.target.value)}
                      disabled={busy}
                      aria-label="Acknowledgement note"
                    />
                  )}
                </div>
              ) : (
                <button
                  type="button"
                  onClick={appendQuoteToNotes}
                  disabled={busy}
                  className="btn-ghost mt-2.5 text-xs"
                >
                  Add this reply to notes
                </button>
              )}
            </div>
          )}
        </div>
      )}

      {/* Title */}
      <div>
        <label className="field-label" htmlFor="dv-title">
          What was delivered <span aria-hidden="true" className="text-wine-700">*</span>
          {suggested.has("title") && <SuggestedBadge />}
        </label>
        <input
          id="dv-title"
          type="text"
          required
          className="field-input"
          value={title}
          onChange={(e) => {
            setTitle(e.target.value);
            clearSuggested("title");
          }}
          placeholder="e.g. Homepage redesign — final files"
          disabled={busy}
        />
      </div>

      {/* Notes */}
      <div>
        <label className="field-label" htmlFor="dv-notes">
          Notes <span className="font-normal normal-case tracking-normal text-taupe-400">(optional)</span>
          {suggested.has("notes") && <SuggestedBadge />}
        </label>
        <textarea
          id="dv-notes"
          rows={3}
          className="field-input resize-none"
          value={notes}
          onChange={(e) => {
            setNotes(e.target.value);
            clearSuggested("notes");
          }}
          placeholder="Client message, milestone note, or delivery context"
          disabled={busy}
        />
      </div>

      {/* Amount */}
      <div>
        <label className="field-label" htmlFor="dv-amount">
          Amount
          {suggested.has("amount") && <SuggestedBadge />}
        </label>
        <input
          id="dv-amount"
          type="number"
          min="0"
          step="0.01"
          className="field-input"
          value={amount}
          onChange={(e) => {
            setAmount(e.target.value);
            clearSuggested("amount");
          }}
          placeholder="0.00"
          disabled={busy}
        />
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
        {status === "idle" && !analyzing && <ArrowRightIcon className="h-4 w-4" />}
      </button>
    </form>
  );
}

/** Marks a field that currently holds an unreviewed suggestion. */
function SuggestedBadge() {
  return (
    <span className="ml-2 inline-flex items-center gap-1 rounded-full bg-wine-100 px-2 py-0.5 text-[9px] font-semibold uppercase tracking-[0.14em] text-wine-950">
      <SparkIcon className="h-2.5 w-2.5" />
      suggested
    </span>
  );
}
