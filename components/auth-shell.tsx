"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Logo } from "@/components/logo";
import { ArrowRightIcon } from "@/components/icons";

type Mode = "login" | "signup";

function loginError(msg: string): string {
  const m = msg.toLowerCase();
  if (m.includes("invalid login credentials") || m.includes("invalid email or password"))
    return "Incorrect email or password. Please try again.";
  if (m.includes("email not confirmed"))
    return "Please confirm your email before signing in. Check your inbox.";
  if (m.includes("too many requests"))
    return "Too many attempts. Please wait a moment and try again.";
  if (m.includes("network") || m.includes("fetch"))
    return "Network error. Please check your connection and try again.";
  return msg;
}

function signupError(msg: string): string {
  const m = msg.toLowerCase();
  if (m.includes("user already registered") || m.includes("already registered"))
    return "An account with this email already exists. Try signing in instead.";
  if (m.includes("password should be at least") || m.includes("weak password"))
    return "Your password is too short. Please use at least 6 characters.";
  if (m.includes("invalid email")) return "Please enter a valid email address.";
  if (m.includes("too many requests"))
    return "Too many attempts. Please wait a moment and try again.";
  if (m.includes("network") || m.includes("fetch"))
    return "Network error. Please check your connection and try again.";
  return msg;
}

export function AuthShell({ initialMode }: { initialMode: Mode }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [mode, setMode] = useState<Mode>(initialMode);

  const [signInEmail, setSignInEmail] = useState("");
  const [signInPassword, setSignInPassword] = useState("");
  const [signInError, setSignInError] = useState<string | null>(null);
  const [signInLoading, setSignInLoading] = useState(false);

  const [signUpEmail, setSignUpEmail] = useState("");
  const [signUpPassword, setSignUpPassword] = useState("");
  const [signUpError, setSignUpError] = useState<string | null>(null);
  const [signUpLoading, setSignUpLoading] = useState(false);
  const [sent, setSent] = useState(false);

  /** Swap panes without a route change so the slide animation is not interrupted. */
  function switchMode(next: Mode) {
    setMode(next);
    setSignInError(null);
    setSignUpError(null);

    const query = searchParams.toString();
    const path = next === "login" ? "/login" : "/signup";
    window.history.replaceState(null, "", query ? `${path}?${query}` : path);
  }

  async function handleSignIn(e: React.FormEvent) {
    e.preventDefault();
    setSignInLoading(true);
    setSignInError(null);

    const supabase = createClient();
    const { error } = await supabase.auth.signInWithPassword({
      email: signInEmail.trim(),
      password: signInPassword.trim(),
    });

    if (error) {
      setSignInError(loginError(error.message));
      setSignInLoading(false);
      return;
    }

    router.push(searchParams.get("redirectTo") || "/dashboard");
    router.refresh();
  }

  async function handleSignUp(e: React.FormEvent) {
    e.preventDefault();
    setSignUpError(null);

    if (signUpPassword.trim().length < 6) {
      setSignUpError("Password must be at least 6 characters.");
      return;
    }

    setSignUpLoading(true);

    const supabase = createClient();
    const { error } = await supabase.auth.signUp({
      email: signUpEmail.trim(),
      password: signUpPassword.trim(),
      options: {
        emailRedirectTo: `${window.location.origin}/auth/callback`,
      },
    });

    setSignUpLoading(false);
    if (error) {
      setSignUpError(signupError(error.message));
      return;
    }
    setSent(true);
  }

  if (sent) {
    return (
      <div className="auth-shell max-w-xl">
        <div className="auth-pane" data-active="true">
          <Logo />
          <div className="space-y-2">
            <h1 className="section-title">Check your inbox.</h1>
            <p className="section-copy">
              We sent a confirmation link to{" "}
              <span className="font-semibold text-wine-950">{signUpEmail}</span>.
            </p>
          </div>
          <button
            type="button"
            onClick={() => {
              setSent(false);
              switchMode("login");
            }}
            className="btn-primary self-start"
          >
            Back to sign in
            <ArrowRightIcon className="h-4 w-4" />
          </button>
        </div>
      </div>
    );
  }

  const isSignup = mode === "signup";

  return (
    <div className="auth-shell max-w-5xl" data-mode={mode}>
      <div className="auth-pane auth-pane-signin" data-active={String(!isSignup)}>
        <Logo />
        <h1 className="section-title">Welcome back.</h1>

        <form onSubmit={handleSignIn} className="space-y-4">
          <div>
            <label className="field-label" htmlFor="signin-email">
              Email
            </label>
            <input
              id="signin-email"
              type="email"
              required
              className="field-input"
              value={signInEmail}
              onChange={(e) => setSignInEmail(e.target.value)}
              placeholder="you@studio.com"
            />
          </div>
          <div>
            <label className="field-label" htmlFor="signin-password">
              Password
            </label>
            <input
              id="signin-password"
              type="password"
              required
              className="field-input"
              value={signInPassword}
              onChange={(e) => setSignInPassword(e.target.value)}
              placeholder="Enter your password"
            />
          </div>

          {signInError && (
            <p className="rounded-2xl border border-wine-900/15 bg-wine-100 px-4 py-3 text-sm text-wine-950">
              {signInError}
            </p>
          )}

          <button type="submit" disabled={signInLoading} className="btn-primary min-w-40">
            {signInLoading ? "Signing in..." : "Sign in"}
            {!signInLoading && <ArrowRightIcon className="h-4 w-4" />}
          </button>
        </form>

        <p className="text-sm text-taupe-600 lg:hidden">
          New here?{" "}
          <button
            type="button"
            onClick={() => switchMode("signup")}
            className="font-semibold text-wine-950 underline underline-offset-4"
          >
            Create account
          </button>
        </p>
      </div>

      <div className="auth-pane auth-pane-signup" data-active={String(isSignup)}>
        <Logo />
        <h1 className="section-title">Create your vault.</h1>

        <form onSubmit={handleSignUp} className="space-y-4">
          <div>
            <label className="field-label" htmlFor="signup-email">
              Email
            </label>
            <input
              id="signup-email"
              type="email"
              required
              className="field-input"
              value={signUpEmail}
              onChange={(e) => setSignUpEmail(e.target.value)}
              placeholder="you@studio.com"
            />
          </div>
          <div>
            <label className="field-label" htmlFor="signup-password">
              Password
            </label>
            <input
              id="signup-password"
              type="password"
              required
              minLength={6}
              className="field-input"
              value={signUpPassword}
              onChange={(e) => setSignUpPassword(e.target.value)}
              placeholder="At least 6 characters"
            />
          </div>

          {signUpError && (
            <p className="rounded-2xl border border-wine-900/15 bg-wine-100 px-4 py-3 text-sm text-wine-950">
              {signUpError}
            </p>
          )}

          <button type="submit" disabled={signUpLoading} className="btn-primary min-w-40">
            {signUpLoading ? "Creating account..." : "Create account"}
            {!signUpLoading && <ArrowRightIcon className="h-4 w-4" />}
          </button>
        </form>

        <p className="text-sm text-taupe-600 lg:hidden">
          Have an account?{" "}
          <button
            type="button"
            onClick={() => switchMode("login")}
            className="font-semibold text-wine-950 underline underline-offset-4"
          >
            Sign in
          </button>
        </p>
      </div>

      <div className="auth-overlay-container">
        <div className="auth-overlay">
          <div className="auth-overlay-panel auth-overlay-left" data-active={String(isSignup)}>
            <p className="section-kicker text-cream-50/70">welcome back</p>
            <h2 className="text-[clamp(1.25rem,3vh,1.875rem)] font-semibold tracking-tight text-cream-50">
              Already have a vault?
            </h2>
            <p className="max-w-xs text-sm leading-6 text-cream-50/80">
              Sign in to pick up your delivery ledger.
            </p>
            <button type="button" onClick={() => switchMode("login")} className="auth-switch mt-2">
              Sign in
            </button>
          </div>

          <div className="auth-overlay-panel auth-overlay-right" data-active={String(!isSignup)}>
            <p className="section-kicker text-cream-50/70">new here</p>
            <h2 className="text-[clamp(1.25rem,3vh,1.875rem)] font-semibold tracking-tight text-cream-50">
              Start your proof vault.
            </h2>
            <p className="max-w-xs text-sm leading-6 text-cream-50/80">
              One account for every client handoff.
            </p>
            <button type="button" onClick={() => switchMode("signup")} className="auth-switch mt-2">
              Create account
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
