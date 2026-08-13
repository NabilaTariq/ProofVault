import { GoogleAuthProvider, signInWithPopup, signOut } from "firebase/auth";
import { getFirebaseAuth, googleProvider } from "@/lib/firebase/client";
import { createClient } from "@/lib/supabase/client";

/** Thrown for cases we want to show as a friendly message rather than a raw code. */
export class GoogleSignInError extends Error {}

/**
 * Signs in with Google through Firebase, then trades the Google ID token for a
 * real Supabase session.
 *
 * The rest of the app (RLS, middleware, every server component) only ever looks
 * at the Supabase session, so Firebase is used purely as the OAuth broker and we
 * sign out of it immediately afterwards to keep a single source of truth.
 *
 * Supabase must have the Google provider enabled with the Firebase web app's
 * OAuth client ID listed under "Authorized Client IDs", otherwise it rejects the
 * token's audience.
 */
export async function signInWithGoogle(): Promise<void> {
  const auth = getFirebaseAuth();

  let idToken: string | undefined;
  try {
    const result = await signInWithPopup(auth, googleProvider());
    idToken = GoogleAuthProvider.credentialFromResult(result)?.idToken;
  } catch (err) {
    throw new GoogleSignInError(popupError(err));
  } finally {
    // The Firebase session has served its purpose either way.
    await signOut(auth).catch(() => {});
  }

  if (!idToken) {
    throw new GoogleSignInError("Google did not return an identity token. Please try again.");
  }

  const supabase = createClient();
  const { error } = await supabase.auth.signInWithIdToken({
    provider: "google",
    token: idToken,
  });

  if (error) throw new GoogleSignInError(exchangeError(error.message));
}

function popupError(err: unknown): string {
  const code = typeof err === "object" && err && "code" in err ? String(err.code) : "";

  switch (code) {
    case "auth/popup-closed-by-user":
    case "auth/cancelled-popup-request":
      return "Sign-in was cancelled.";
    case "auth/popup-blocked":
      return "Your browser blocked the sign-in popup. Allow popups for this site and try again.";
    case "auth/unauthorized-domain":
      return "This domain is not authorised in Firebase. Add it under Authentication → Settings → Authorized domains.";
    case "auth/network-request-failed":
      return "Network error. Please check your connection and try again.";
    default:
      return "Could not sign in with Google. Please try again.";
  }
}

function exchangeError(msg: string): string {
  const m = msg.toLowerCase();
  if (m.includes("audience") || m.includes("client id") || m.includes("provider is not enabled"))
    return "Google sign-in is not configured on the server yet. Enable Google in Supabase and add the Firebase OAuth client ID.";
  if (m.includes("network") || m.includes("fetch"))
    return "Network error. Please check your connection and try again.";
  return msg;
}
