/**
 * Shown the instant "Open" is clicked, while the project page's Supabase
 * queries run on the server. Without it the browser sits on the previous page
 * with no feedback until the whole payload arrives, which reads as a hang.
 *
 * Mirrors the real page's layout so the swap isn't jarring.
 */
export default function Loading() {
  return (
    <main className="page-frame animate-pulse" aria-busy="true" aria-label="Loading project">
      {/* Header */}
      <div className="mb-6 flex flex-col gap-4 rounded-[24px] border border-taupe-200 bg-cream-50 px-5 py-4 shadow-soft lg:flex-row lg:items-center lg:justify-between">
        <div className="flex items-center gap-4">
          <div className="h-10 w-10 rounded-[16px] bg-taupe-100" />
          <div className="space-y-1.5">
            <div className="h-4 w-28 rounded bg-taupe-100" />
            <div className="h-2.5 w-20 rounded bg-taupe-100" />
          </div>
        </div>
        <div className="flex items-center gap-3">
          <div className="h-7 w-24 rounded-full bg-taupe-100" />
          <div className="h-7 w-20 rounded-full bg-taupe-100" />
        </div>
      </div>

      {/* Hero card + sidebar */}
      <div className="mb-6 grid gap-4 lg:grid-cols-[1.2fr_0.8fr]">
        <div className="rounded-[28px] bg-gradient-to-br from-wine-950 via-wine-900 to-wine-800 p-7 shadow-soft sm:p-8">
          <div className="h-2.5 w-24 rounded bg-cream-50/20" />
          <div className="mt-4 h-10 w-2/3 rounded bg-cream-50/20" />

          <div className="mt-8 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="rounded-[24px] border border-cream-50/15 bg-cream-50/10 p-4">
                <div className="h-2 w-12 rounded bg-cream-50/25" />
                <div className="mt-3 h-5 w-20 rounded bg-cream-50/25" />
              </div>
            ))}
          </div>

          <div className="mt-6 h-2.5 w-full rounded-full bg-cream-50/15" />
        </div>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-1">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="stat-card">
              <div className="h-2.5 w-20 rounded bg-taupe-100" />
              <div className="h-7 w-16 rounded bg-taupe-100" />
              <div className="h-3 w-28 rounded bg-taupe-100" />
            </div>
          ))}
        </div>
      </div>

      {/* Form + deliverable list */}
      <div className="grid gap-6 lg:grid-cols-[0.9fr_1.1fr]">
        <div className="surface space-y-4 p-6 sm:p-7">
          <div className="h-4 w-32 rounded bg-taupe-100" />
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-11 w-full rounded-2xl bg-taupe-100/70" />
          ))}
        </div>

        <div className="surface overflow-hidden">
          <div className="border-b border-taupe-200 px-5 py-4 sm:px-6">
            <div className="h-2.5 w-20 rounded bg-taupe-100" />
            <div className="mt-2 h-5 w-40 rounded bg-taupe-100" />
          </div>
          <div className="space-y-4 p-4 sm:p-5">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="rounded-[24px] border border-taupe-200 bg-cream-50 p-5">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 space-y-2">
                    <div className="h-4 w-2/3 rounded bg-taupe-100" />
                    <div className="h-2.5 w-1/3 rounded bg-taupe-100" />
                  </div>
                  <div className="h-5 w-16 rounded bg-taupe-100" />
                </div>
                <div className="mt-4 flex gap-2">
                  <div className="h-6 w-24 rounded-full bg-taupe-100" />
                  <div className="h-6 w-32 rounded-full bg-taupe-100" />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </main>
  );
}
