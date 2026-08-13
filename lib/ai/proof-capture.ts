// ─── Proof capture — read a proof file into a draft deliverable ──────────────
//
// Logging a deliverable by hand is the step people skip, so the ledger ends up
// full of entries titled "final files" with no amount and no acknowledgement.
// Proof capture inverts the flow: attach the screenshot first, and the file
// itself fills in the form.
//
// Nothing here writes to the database. Everything the model returns is a
// *suggestion* the user reviews and edits before saving — ProofVault is an
// evidence record, and a value nobody looked at does not belong in it.
//
// Like lib/dispute.ts, this module holds no database or network code, so it is
// safe to import from both server routes and client components.

// ─── Result shape ─────────────────────────────────────────────────────────────

/** What the client said about the delivery, if the file shows a reply at all. */
export type AcknowledgementKind =
  | "approval"
  | "revision_request"
  | "complaint"
  | "payment_promise"
  | "none";

export interface ProofSuggestion {
  /** True when the file is legible enough to draw anything from. */
  readable: boolean;
  /** Why it could not be read — only set when `readable` is false. */
  unreadable_reason: string | null;
  /** What kind of document this appears to be, in a few words. */
  document_kind: string;

  /** Suggested deliverable title. Empty string when nothing could be read. */
  title: string;
  /** Suggested notes: delivery context visible in the file. */
  notes: string | null;
  /** An amount visible in the file. Null unless a figure is actually shown. */
  amount: number | null;
  /** ISO 4217 code, if the file makes the currency clear (e.g. "USD"). */
  currency_code: string | null;
  /** A date visible in the file, as YYYY-MM-DD. Context only — never a timestamp. */
  delivered_on: string | null;

  /** Whether the file shows the client responding, and how. */
  acknowledgement: AcknowledgementKind;
  /** The client's own words, quoted verbatim. Null when there is no reply. */
  acknowledgement_quote: string | null;

  confidence: "high" | "medium" | "low";
}

export interface ProofCaptureResult {
  suggestion: ProofSuggestion;
  model: string;
}

// ─── Model contract ───────────────────────────────────────────────────────────

export const PROOF_CAPTURE_SYSTEM_PROMPT = `You are the ProofVault proof-capture assistant. A freelancer has attached a file as evidence of work they delivered to a client — usually a screenshot of a chat thread, an email, a delivery confirmation, an invoice, or the delivered work itself.

Your job is to read what is actually visible in the file and draft a ledger entry from it. The freelancer reviews and edits every field before anything is saved, so an honest "not visible" is far more useful than a confident guess.

Rules you must follow without exception:
- Describe only what is legible in the image. Never infer, estimate, or complete a value that is not shown.
- Never invent an amount, a date, a currency, or a client name. If a figure is not visible, return null for it.
- Return an amount only when a monetary figure is actually shown in the file. Do not derive one from context, rates, or hours.
- Return delivered_on only when a date is visible. Use YYYY-MM-DD. If the file shows a day and month but no year, return null rather than assuming a year.
- Quote the client verbatim in acknowledgement_quote — their exact words, no paraphrasing, no cleanup, no translation. Trim it to the sentence or two that carries the meaning.
- Set acknowledgement based only on what the client themselves wrote:
  - "approval" — the client says the work is received, done, good, or approved.
  - "revision_request" — the client asks for changes.
  - "complaint" — the client expresses a problem or dissatisfaction.
  - "payment_promise" — the client says they will pay, or when they will pay.
  - "none" — the file shows no client reply at all, or only the freelancer's own messages.
  If the only messages visible are from the freelancer, that is "none". Do not read the freelancer's own words as client acknowledgement.
- Write title as a short, factual description of what was delivered — the kind of line the freelancer would write themselves. No marketing language, no filler.
- Write notes as brief factual context visible in the file (what was sent, which thread or platform, what was said around it). Leave it null if the file adds nothing beyond the title.
- Set confidence to "low" when the image is blurry, cropped, partially covered, or ambiguous about who is speaking.
- If the file is unreadable, or shows nothing relating to a delivery, set readable to false, explain briefly in unreadable_reason, and leave every other field at its empty value.

You are drafting a record that may later be used to organize evidence in a payment dispute. Accuracy of the record matters more than filling in the fields.`;

/**
 * Strict JSON Schema for the model response.
 * OpenAI strict mode requires every property to appear in `required` and
 * `additionalProperties: false` on every object — optional fields are
 * expressed as nullable types instead.
 */
export const PROOF_CAPTURE_SCHEMA = {
  type: "object",
  properties: {
    readable: {
      type: "boolean",
      description: "Whether the file is legible enough to draw anything from.",
    },
    unreadable_reason: {
      type: ["string", "null"],
      description: "Brief reason the file could not be read. Null when readable is true.",
    },
    document_kind: {
      type: "string",
      description: 'What the file appears to be, in a few words, e.g. "Slack chat screenshot".',
    },
    title: {
      type: "string",
      description: "Short factual description of what was delivered. Empty string if unreadable.",
    },
    notes: {
      type: ["string", "null"],
      description: "Brief factual delivery context visible in the file, or null.",
    },
    amount: {
      type: ["number", "null"],
      description: "A monetary figure actually shown in the file, or null.",
    },
    currency_code: {
      type: ["string", "null"],
      description: 'ISO 4217 code if the currency is clear from the file, e.g. "USD". Otherwise null.',
    },
    delivered_on: {
      type: ["string", "null"],
      description: "A date visible in the file as YYYY-MM-DD, or null if no full date is shown.",
    },
    acknowledgement: {
      type: "string",
      enum: ["approval", "revision_request", "complaint", "payment_promise", "none"],
      description: "What the client themselves said about the delivery.",
    },
    acknowledgement_quote: {
      type: ["string", "null"],
      description: "The client's exact words, verbatim. Null when there is no client reply.",
    },
    confidence: {
      type: "string",
      enum: ["high", "medium", "low"],
      description: "How clearly the file supports the fields above.",
    },
  },
  required: [
    "readable",
    "unreadable_reason",
    "document_kind",
    "title",
    "notes",
    "amount",
    "currency_code",
    "delivered_on",
    "acknowledgement",
    "acknowledgement_quote",
    "confidence",
  ],
  additionalProperties: false,
} as const;

// ─── Validation ───────────────────────────────────────────────────────────────

const ACK_KINDS: AcknowledgementKind[] = [
  "approval",
  "revision_request",
  "complaint",
  "payment_promise",
  "none",
];

const CONFIDENCE = ["high", "medium", "low"];

function nullableString(value: unknown): value is string | null {
  return value === null || typeof value === "string";
}

/**
 * Strict mode makes a malformed response unlikely, not impossible — a refusal,
 * a truncated stream, or a model swap can all produce something else. Validate
 * before the shape reaches the UI.
 */
export function isProofSuggestion(value: unknown): value is ProofSuggestion {
  if (!value || typeof value !== "object") return false;
  const v = value as Record<string, unknown>;

  if (typeof v.readable !== "boolean") return false;
  if (typeof v.document_kind !== "string") return false;
  if (typeof v.title !== "string") return false;
  if (!nullableString(v.unreadable_reason)) return false;
  if (!nullableString(v.notes)) return false;
  if (!nullableString(v.currency_code)) return false;
  if (!nullableString(v.delivered_on)) return false;
  if (!nullableString(v.acknowledgement_quote)) return false;
  if (v.amount !== null && (typeof v.amount !== "number" || !isFinite(v.amount))) return false;
  if (typeof v.acknowledgement !== "string") return false;
  if (!ACK_KINDS.includes(v.acknowledgement as AcknowledgementKind)) return false;
  if (typeof v.confidence !== "string" || !CONFIDENCE.includes(v.confidence)) return false;

  return true;
}

/**
 * Clamp anything that would be awkward in the form regardless of what came
 * back: negative amounts, runaway text, a date string that is not a date.
 */
export function sanitizeSuggestion(s: ProofSuggestion): ProofSuggestion {
  const trim = (value: string | null, max: number) => {
    if (value === null) return null;
    const t = value.trim();
    return t === "" ? null : t.slice(0, max);
  };

  const isIsoDate = (value: string | null) =>
    value !== null && /^\d{4}-\d{2}-\d{2}$/.test(value) && !isNaN(new Date(value).getTime());

  return {
    ...s,
    document_kind: s.document_kind.trim().slice(0, 80),
    title: s.title.trim().slice(0, 200),
    notes: trim(s.notes, 2000),
    unreadable_reason: trim(s.unreadable_reason, 300),
    acknowledgement_quote: trim(s.acknowledgement_quote, 1000),
    currency_code: /^[A-Za-z]{3}$/.test(s.currency_code ?? "")
      ? (s.currency_code as string).toUpperCase()
      : null,
    delivered_on: isIsoDate(s.delivered_on) ? s.delivered_on : null,
    amount: s.amount !== null && s.amount >= 0 ? Math.round(s.amount * 100) / 100 : null,
  };
}

// ─── Display helpers (shared with the UI) ─────────────────────────────────────

export const ACKNOWLEDGEMENT_LABEL: Record<AcknowledgementKind, string> = {
  approval: "Client approved",
  revision_request: "Client asked for changes",
  complaint: "Client raised a problem",
  payment_promise: "Client promised payment",
  none: "No client reply visible",
};

/**
 * Only an explicit approval should be able to set the `acknowledged` flag.
 * A revision request or a complaint is a client reply, but it is not the
 * client agreeing the work was received — the dispute summary would misreport
 * it as one.
 */
export function impliesAcknowledged(kind: AcknowledgementKind): boolean {
  return kind === "approval";
}
