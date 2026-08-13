// ─── Domain types based on the existing Supabase schema ──────────────────────

export interface Client {
  id: string;
  user_id: string;
  name: string;
  created_at: string;
}

export interface Project {
  id: string;
  user_id: string;
  client_id?: string | null; // set by the DB trigger that links projects to clients
  client_name: string;
  platform: string | null;
  description: string | null;
  agreed_amount: number | string; // DB may return string
  currency: string;
  status: "active" | "completed" | "archived";
  created_at: string;
}

export interface Deliverable {
  id: string;
  project_id: string;
  user_id: string;
  title: string;
  notes: string | null;
  amount: number | string; // DB may return string
  paid: boolean;
  paid_at?: string | null;
  acknowledged?: boolean;
  acknowledged_at?: string | null;
  acknowledgement_note?: string | null;
  file_key: string | null;
  file_url: string | null;
  file_name: string | null;
  created_at: string;
}

// ─── Derived / computed types ─────────────────────────────────────────────────

export interface FinancialSummary {
  currency: string;
  agreedTotal: number;
  deliveredTotal: number;
  paidTotal: number;
  unpaidDeliveredTotal: number;
  remainingScope: number; // agreed - delivered (may be negative = overage)
  isOverBudget: boolean;
}

export interface CurrencyGroup {
  currency: string;
  projects: Project[];
  agreedTotal: number;
  paidTotal: number;
  pendingTotal: number;
}

// ─── Helper to safely parse monetary values ───────────────────────────────────

export function toNum(value: number | string | null | undefined): number {
  if (value === null || value === undefined) return 0;
  const n = typeof value === "string" ? parseFloat(value) : value;
  return isNaN(n) ? 0 : n;
}
