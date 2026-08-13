"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { ArrowRightIcon } from "@/components/icons";

export function NewProjectForm() {
  const router = useRouter();
  const [clientName, setClientName] = useState("");
  const [platform, setPlatform] = useState("");
  const [description, setDescription] = useState("");
  const [amount, setAmount] = useState("");
  const [currency, setCurrency] = useState("USD");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      setError("Your session expired - please sign in again.");
      setLoading(false);
      return;
    }

    const { data, error } = await supabase
      .from("projects")
      .insert({
        user_id: user.id,
        client_name: clientName,
        platform: platform || null,
        description: description || null,
        agreed_amount: Number(amount) || 0,
        currency,
      })
      .select("id")
      .single();

    if (error) {
      setError(error.message);
      setLoading(false);
      return;
    }

    router.push(`/projects/${data.id}`);
    router.refresh();
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <div>
        <label className="field-label" htmlFor="clientName">
          Client name
        </label>
        <input
          id="clientName"
          required
          className="field-input"
          value={clientName}
          onChange={(e) => setClientName(e.target.value)}
          placeholder="e.g. Northwind Studio"
        />
      </div>

      <div>
        <label className="field-label" htmlFor="platform">
          Platform
        </label>
        <input
          id="platform"
          className="field-input"
          value={platform}
          onChange={(e) => setPlatform(e.target.value)}
          placeholder="Upwork, Fiverr, direct - optional"
        />
      </div>

      <div>
        <label className="field-label" htmlFor="description">
          Scope / agreement notes
        </label>
        <textarea
          id="description"
          rows={4}
          className="field-input resize-none"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="What was agreed - deliverables, deadlines, revisions included"
        />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className="field-label" htmlFor="amount">
            Agreed amount
          </label>
          <input
            id="amount"
            type="number"
            min="0"
            step="0.01"
            className="field-input"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            placeholder="0.00"
          />
        </div>
        <div>
          <label className="field-label" htmlFor="currency">
            Currency
          </label>
          <select
            id="currency"
            className="field-input"
            value={currency}
            onChange={(e) => setCurrency(e.target.value)}
          >
            <option>USD</option>
            <option>EUR</option>
            <option>GBP</option>
            <option>PKR</option>
            <option>INR</option>
            <option>AED</option>
          </select>
        </div>
      </div>

      {error && (
        <p className="rounded-2xl border border-wine-900/15 bg-wine-100 px-4 py-3 text-sm text-wine-950">
          {error}
        </p>
      )}

      <button type="submit" disabled={loading} className="btn-primary w-full">
        {loading ? "Creating..." : "Create project"}
        {!loading && <ArrowRightIcon className="h-4 w-4" />}
      </button>
    </form>
  );
}
