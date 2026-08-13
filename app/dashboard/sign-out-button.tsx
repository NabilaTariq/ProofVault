"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { useToast } from "@/components/toast";
import { Spinner } from "@/components/icons";

export function SignOutButton() {
  const router = useRouter();
  const { toast } = useToast();
  const [busy, setBusy] = useState(false);

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
  );
}
