import { toNum, type Project, type Deliverable, type FinancialSummary, type CurrencyGroup } from "./types";

// ─── Money formatting ─────────────────────────────────────────────────────────

const CURRENCY_CONFIG: Record<string, { locale: string; decimals: number }> = {
  USD: { locale: "en-US", decimals: 2 },
  GBP: { locale: "en-GB", decimals: 2 },
  EUR: { locale: "de-DE", decimals: 2 },
  PKR: { locale: "en-PK", decimals: 0 },
  INR: { locale: "en-IN", decimals: 0 },
  AED: { locale: "ar-AE", decimals: 2 },
  CAD: { locale: "en-CA", decimals: 2 },
  AUD: { locale: "en-AU", decimals: 2 },
};

export function formatMoney(amount: number | string | null | undefined, currency: string): string {
  const n = toNum(amount);
  const code = (currency || "USD").toUpperCase();
  const cfg = CURRENCY_CONFIG[code];

  try {
    return new Intl.NumberFormat(cfg?.locale ?? "en-US", {
      style: "currency",
      currency: code,
      minimumFractionDigits: cfg?.decimals ?? 2,
      maximumFractionDigits: cfg?.decimals ?? 2,
    }).format(n);
  } catch {
    // Fallback for unknown currency codes
    return `${code} ${n.toFixed(cfg?.decimals ?? 2)}`;
  }
}

// ─── Date formatting ──────────────────────────────────────────────────────────

export function formatDate(iso: string | null | undefined): string {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  } catch {
    return "—";
  }
}

export function formatDateTime(iso: string | null | undefined): string {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return "—";
  }
}

/** @deprecated use formatDate or formatDateTime */
export function formatTimestamp(iso: string) {
  return formatDateTime(iso);
}

// ─── File size ────────────────────────────────────────────────────────────────

export function formatFileSize(bytes: number): string {
  if (bytes === 0) return "0 B";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

// ─── Ledger ref ───────────────────────────────────────────────────────────────

export function shortRef(id: string): string {
  return id.replace(/-/g, "").slice(0, 8).toUpperCase();
}

// ─── Financial calculations ───────────────────────────────────────────────────

export function calcFinancials(
  project: Pick<Project, "agreed_amount" | "currency">,
  deliverables: Deliverable[]
): FinancialSummary {
  const currency = project.currency || "USD";
  const agreedTotal = toNum(project.agreed_amount);

  const deliveredTotal = deliverables.reduce((s, d) => s + toNum(d.amount), 0);
  const paidTotal = deliverables.filter((d) => d.paid).reduce((s, d) => s + toNum(d.amount), 0);
  const unpaidDeliveredTotal = deliverables.filter((d) => !d.paid).reduce((s, d) => s + toNum(d.amount), 0);
  const remainingScope = agreedTotal - deliveredTotal;
  const isOverBudget = remainingScope < 0;

  return {
    currency,
    agreedTotal,
    deliveredTotal,
    paidTotal,
    unpaidDeliveredTotal,
    remainingScope,
    isOverBudget,
  };
}

// ─── Dashboard currency grouping ──────────────────────────────────────────────

export function groupProjectsByCurrency(
  projects: Project[],
  deliverablesByProject: Map<string, { paid: number; pending: number; count: number }>
): CurrencyGroup[] {
  const map = new Map<string, CurrencyGroup>();

  for (const project of projects) {
    const currency = (project.currency || "USD").toUpperCase();
    const totals = deliverablesByProject.get(project.id) ?? { paid: 0, pending: 0, count: 0 };

    if (!map.has(currency)) {
      map.set(currency, {
        currency,
        projects: [],
        agreedTotal: 0,
        paidTotal: 0,
        pendingTotal: 0,
      });
    }

    const group = map.get(currency)!;
    group.projects.push(project);
    group.agreedTotal += toNum(project.agreed_amount);
    group.paidTotal += totals.paid;
    group.pendingTotal += totals.pending;
  }

  // Sort by currency code for consistent ordering
  return Array.from(map.values()).sort((a, b) => a.currency.localeCompare(b.currency));
}
