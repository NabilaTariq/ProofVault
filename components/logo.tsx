import Link from "next/link";

type LogoProps = {
  /** Use "light" on dark wine surfaces so the wordmark stays legible. */
  tone?: "dark" | "light";
};

export function Logo({ tone = "dark" }: LogoProps) {
  const isLight = tone === "light";

  return (
    <Link href="/" className="group inline-flex items-center gap-2.5 sm:gap-3">
      <span
        className={`relative flex h-10 w-10 shrink-0 items-center justify-center rounded-[16px] border shadow-soft sm:h-11 sm:w-11 ${
          isLight
            ? "border-cream-50/25 bg-cream-50"
            : "border-wine-950/20 bg-gradient-to-br from-wine-950 via-wine-900 to-wine-800"
        }`}
      >
        <svg viewBox="0 0 44 44" aria-hidden="true" className="h-8 w-8 sm:h-9 sm:w-9">
          <rect x="6" y="6" width="32" height="32" rx="11" fill="#6D2932" />
          <path
            d="M13 15.5C13 13.567 14.567 12 16.5 12h11c1.933 0 3.5 1.567 3.5 3.5v13c0 1.933-1.567 3.5-3.5 3.5h-11c-1.933 0-3.5-1.567-3.5-3.5v-13Z"
            fill="#F4ECDF"
            opacity="0.98"
          />
          <path
            d="M18 16.5h8.5M18 20.5h8.5M18 24.5h5.5"
            stroke="#6D2932"
            strokeWidth="1.7"
            strokeLinecap="round"
          />
          <path
            d="M27.1 27.3c0-.72.58-1.3 1.3-1.3s1.3.58 1.3 1.3-.58 1.3-1.3 1.3-1.3-.58-1.3-1.3Z"
            fill="#82313D"
          />
          <path
            d="M29.7 23.8c1.08-1.02 1.73-2.46 1.73-4.02V15.8c0-.45.36-.8.8-.8h.42c.44 0 .8.36.8.8v3.98c0 2.16-.92 4.1-2.4 5.42"
            fill="none"
            stroke="#82313D"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
        <span
          className={`absolute -right-1 -top-1 h-3 w-3 rounded-full border ${
            isLight ? "border-wine-900 bg-sand-300" : "border-cream-50 bg-sand-100"
          }`}
        />
      </span>
      <span className="flex flex-col leading-none">
        <span
          className={`font-display text-lg font-semibold tracking-tight sm:text-2xl ${
            isLight ? "text-cream-50" : "text-wine-950"
          }`}
        >
          Taskora
        </span>
        <span
          className={`text-[10px] font-semibold uppercase tracking-[0.2em] sm:text-[11px] sm:tracking-[0.24em] ${
            isLight ? "text-cream-50/60" : "text-taupe-600"
          }`}
        >
          delivery ledger
        </span>
      </span>
    </Link>
  );
}
