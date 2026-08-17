"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { useToast } from "@/components/toast";
import { Spinner } from "@/components/icons";
import { useCoachMark } from "@/components/coach-mark";

export function SignOutButton() {
  const router = useRouter();
  const { toast } = useToast();
  const [busy, setBusy] = useState(false);
  const { restartTour } = useCoachMark();

  async function handleSignOut() {
    if (busy) return;
    setBusy(true);

    try {
      const supabase = createClient();
      const { error } = await supabase.auth.signOut();

      if (error) {
        toast("Could not sign out. Please try again.", "error");
        setBusy(false);
        return;
      }

      router.push("/login");
      router.refresh();
      // Stay busy on success: the button unmounts once the redirect lands, and
      // re-enabling it would allow a second click mid-navigation.
    } catch {
      toast("Network error. Please check your connection.", "error");
      setBusy(false);
    }
  }

  return (
    <div className="flex items-center gap-2">
      <button
        onClick={restartTour}
        className="inline-flex items-center gap-1.5 rounded-full px-3 py-2 text-[11px] font-semibold uppercase tracking-[0.15em] text-taupe-500 transition hover:bg-wine-100 hover:text-wine-950"
        aria-label="Restart product tour"
      >
        <svg viewBox="0 0 16 16" className="h-3.5 w-3.5" fill="none">
          <path
            d="M2 8a6 6 0 0 1 10.2-4.3M14 8a6 6 0 0 1-10.2 4.3"
            stroke="currentColor"
            strokeWidth="1.6"
            strokeLinecap="round"
          />
          <path
            d="M12.5 1v3.2h-3.2M3.5 15v-3.2h3.2"
            stroke="currentColor"
            strokeWidth="1.6"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
        Tour
      </button>
      <button
        onClick={handleSignOut}
        disabled={busy}
        aria-busy={busy}
        // Fixed width so swapping in the longer busy label doesn't shift the header.
        className="btn-secondary min-w-[9.5rem] px-4 py-2 text-xs uppercase tracking-[0.2em]"
      >
        {busy ? (
          <>
            <Spinner className="h-3 w-3" />
            Signing out…
          </>
        ) : (
          "Sign out"
        )}
      </button>
    </div>
  );
}
