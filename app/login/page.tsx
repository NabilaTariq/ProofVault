import { Suspense } from "react";
import { AuthShell } from "@/components/auth-shell";

export default function LoginPage() {
  return (
    <main className="flex min-h-screen min-h-[100dvh] w-full items-center justify-center px-4 py-4 sm:px-6 sm:py-6">
      <Suspense fallback={null}>
        <AuthShell initialMode="login" />
      </Suspense>
    </main>
  );
}
