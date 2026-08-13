import Image from "next/image";
import Link from "next/link";
import { Logo } from "@/components/logo";
import { ArrowRightIcon, FolderIcon, ReceiptIcon, ShieldIcon, SparkIcon } from "@/components/icons";
import { CurvedArrow, RecordIllustration, ScribbleUnderline } from "@/components/illustrations";
import heroPhoto from "@/public/images/freelancer-workspace.jpg";
import howItWorksPhoto from "@/public/images/how-it-works-illustration.png";

const navigation = [
  { label: "Features", href: "#features" },
  { label: "How It Works", href: "#how-it-works" },
  { label: "Benefits", href: "#benefits" },
];

const features = [
  { title: "Delivery Tracking", copy: "Every handoff in one place.", icon: FolderIcon },
  { title: "Proof of Work", copy: "Evidence attached to the deliverable.", icon: ReceiptIcon },
  { title: "Project Records", copy: "Clean history, no spreadsheets.", icon: ShieldIcon },
  { title: "Secure Evidence", copy: "Files stored in an organized vault.", icon: SparkIcon },
];

const steps = [
  { number: "01", title: "Create Project", copy: "Client, platform, agreement." },
  { number: "02", title: "Deliver Work", copy: "Log the handoff, attach the proof." },
  { number: "03", title: "Keep Proof", copy: "One audit trail, always ready." },
];

const benefits = [
  "Organized across every client",
  "Proof stays with the work",
  "Fewer delivery disputes",
  "A reliable project history",
];

const footerLinks = [
  {
    heading: "product",
    links: navigation,
  },
  {
    heading: "account",
    links: [
      { label: "Login", href: "/login" },
      { label: "Create account", href: "/signup" },
    ],
  },
];

export default function Home() {
  const year = new Date().getFullYear();

  return (
    <main id="top">
      <section className="relative flex min-h-svh flex-col overflow-hidden bg-gradient-to-br from-wine-950 via-wine-900 to-wine-800">
        <div aria-hidden className="pointer-events-none absolute -right-32 -top-40 h-[38rem] w-[38rem] rounded-full bg-cream-50/[0.07] blur-3xl" />
        <div aria-hidden className="pointer-events-none absolute -bottom-40 -left-32 h-[30rem] w-[30rem] rounded-full bg-brass-600/20 blur-3xl" />

        <div className="relative mx-auto flex w-full max-w-7xl flex-1 flex-col px-4 sm:px-6 lg:px-8">
          <header className="flex flex-wrap items-center justify-between gap-3 py-5 lg:grid lg:grid-cols-[auto_1fr_auto]">
            <Logo tone="light" />

            <nav className="hidden items-center justify-center gap-7 md:flex">
              {navigation.map((item) => (
                <Link
                  key={item.label}
                  href={item.href}
                  className="group relative text-[14px] font-medium text-cream-50/70 transition hover:text-cream-50"
                >
                  {item.label}
                  <span className="absolute -bottom-1.5 left-0 h-[2.5px] w-0 rounded-full bg-sand-300 transition-all duration-300 group-hover:w-full" />
                </Link>
              ))}
            </nav>

            <div className="flex items-center gap-1.5 lg:justify-end">
              <Link
                href="/login"
                className="rounded-full px-4 py-2.5 text-[13.5px] font-semibold text-cream-50/75 transition hover:bg-cream-50/10 hover:text-cream-50"
              >
                Login
              </Link>
              <Link
                href="/signup"
                className="inline-flex items-center justify-center gap-2 rounded-full bg-cream-50 px-6 py-3 text-[13.5px] font-semibold text-wine-950 transition duration-200 hover:-translate-y-0.5 hover:bg-cream-100 hover:shadow-lift"
              >
                Get Started
              </Link>
            </div>
          </header>

          <div className="grid flex-1 items-center gap-10 pb-8 lg:grid-cols-[1fr_1.02fr] lg:gap-6">
            <div className="max-w-xl">
              <h1 className="text-[2.2rem] font-semibold leading-[1.1] tracking-[-0.03em] text-cream-50 sm:text-[2.9rem] lg:text-[3.35rem]">
                Keep every deliverable.{" "}
                <span className="relative inline-block whitespace-nowrap text-sand-300">
                  Every proof.
                  <ScribbleUnderline className="absolute -bottom-1.5 left-0 h-3 w-full text-brass-400 sm:-bottom-2" />
                </span>
              </h1>

              <p className="mt-7 max-w-md text-[15px] leading-[1.75] text-cream-50/75">
                One organized vault for client work and the evidence behind it.
              </p>

              <div className="mt-8 flex flex-wrap items-center gap-x-6 gap-y-3">
                <Link
                  href="/signup"
                  className="inline-flex items-center justify-center gap-2 rounded-full bg-cream-50 px-7 py-3.5 text-[14px] font-semibold text-wine-950 transition duration-200 hover:-translate-y-0.5 hover:bg-cream-100 hover:shadow-lift"
                >
                  Get Started
                  <ArrowRightIcon className="h-4 w-4" />
                </Link>
                <Link
                  href="#how-it-works"
                  className="group inline-flex items-center gap-2 text-[14px] font-semibold text-cream-50 transition hover:text-sand-300"
                >
                  See How It Works
                  <ArrowRightIcon className="h-4 w-4 transition-transform group-hover:translate-x-1" />
                </Link>
              </div>

              <div className="mt-9 flex flex-wrap items-center gap-2">
                {["Projects", "Deliverables", "Proof files"].map((tag) => (
                  <span
                    key={tag}
                    className="rounded-full border border-cream-50/15 bg-cream-50/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-cream-50/75"
                  >
                    {tag}
                  </span>
                ))}
              </div>
            </div>

            <div className="relative mx-auto w-full max-w-md lg:max-w-none">
              <div aria-hidden className="absolute -inset-6 rounded-[44px] bg-cream-50/10 blur-2xl" />

              <div className="relative h-[38svh] min-h-[260px] w-full overflow-hidden rounded-[28px] border border-cream-50/15 shadow-soft sm:h-[46svh] lg:h-[min(74svh,660px)]">
                <Image
                  src={heroPhoto}
                  alt="Freelancer on a client call, logging delivered work from a laptop in a coffee shop"
                  priority
                  placeholder="blur"
                  sizes="(min-width: 1024px) 46vw, 100vw"
                  className="h-full w-full object-cover object-[52%_38%]"
                />
                <div
                  aria-hidden
                  className="pointer-events-none absolute inset-0 bg-gradient-to-tr from-wine-950/70 via-wine-950/15 to-wine-800/30"
                />
                <div aria-hidden className="pointer-events-none absolute inset-0 rounded-[28px] ring-1 ring-inset ring-cream-50/15" />
              </div>

              <CurvedArrow className="pointer-events-none absolute left-[26%] top-[6%] hidden h-12 w-16 text-brass-400/80 lg:block" />
              <CurvedArrow className="pointer-events-none absolute bottom-[16%] right-0 hidden h-14 w-16 -scale-x-100 rotate-[145deg] text-brass-400/80 lg:block" />
            </div>
          </div>
        </div>
      </section>

      <div className="page-frame">
        <section id="features">
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            {features.map((feature) => {
              const Icon = feature.icon;

              return (
                <article key={feature.title} className="surface p-5">
                  <span className="inline-flex h-11 w-11 items-center justify-center rounded-2xl bg-wine-100 text-wine-950">
                    <Icon className="h-5 w-5" />
                  </span>
                  <h3 className="mt-4 text-[1.05rem] font-semibold leading-snug tracking-[-0.015em] text-wine-950">{feature.title}</h3>
                  <p className="mt-2 text-[13.5px] leading-[1.65] text-ember-700/80">{feature.copy}</p>
                </article>
              );
            })}
          </div>
        </section>
      </div>

      {/* How It Works — full-width, only a small edge gutter */}
      <div className="w-full px-4 py-6 sm:px-6 lg:py-8">
        <section id="how-it-works" className="surface px-6 py-8 sm:px-8">
          <div className="grid items-center gap-8 lg:grid-cols-[0.9fr_1.1fr]">
            <div className="relative overflow-hidden rounded-[28px] border border-taupe-200/80 shadow-soft">
              <Image
                src={howItWorksPhoto}
                alt="A freelancer logging a client deliverable — documents, a verified seal, and a secure digital handoff"
                sizes="(min-width: 1024px) 42vw, 100vw"
                className="h-full w-full object-cover object-center"
                style={{ minHeight: "340px", maxHeight: "480px" }}
              />
            </div>

            <div className="space-y-5">
              <div className="space-y-2">
                <p className="section-kicker">how it works</p>
                <h2 className="section-title">Three steps, start to proof.</h2>
              </div>

              <div className="space-y-3">
                {steps.map((step) => (
                  <div key={step.number} className="flex items-start gap-4 rounded-[22px] border border-taupe-200 bg-cream-50 p-4">
                    <span className="font-mono text-[11px] font-semibold uppercase tracking-[0.22em] text-taupe-600">{step.number}</span>
                    <div>
                      <h3 className="text-[1rem] font-semibold leading-snug tracking-[-0.015em] text-wine-950">{step.title}</h3>
                      <p className="mt-1 text-[13.5px] leading-[1.6] text-ember-700/80">{step.copy}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>
      </div>

      <div className="page-frame">
        <section id="benefits" className="surface-muted p-6 sm:p-8">
          <div className="grid items-center gap-8 lg:grid-cols-[1fr_0.62fr] lg:gap-12">
            <div className="space-y-6">
              <div className="space-y-2">
                <p className="section-kicker">benefits</p>
                <h2 className="section-title">Proof you can point to.</h2>
              </div>

              <ul className="grid gap-3 sm:grid-cols-2">
                {benefits.map((benefit) => (
                  <li key={benefit} className="flex items-center gap-3 rounded-[18px] border border-taupe-200 bg-cream-50 px-4 py-3.5">
                    <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-wine-100 text-wine-950">
                      <ShieldIcon className="h-4 w-4" />
                    </span>
                    <p className="text-[13.5px] font-semibold text-wine-950">{benefit}</p>
                  </li>
                ))}
              </ul>
            </div>

            <RecordIllustration className="w-full max-w-sm justify-self-center" />
          </div>
        </section>

        <footer className="mt-6 surface overflow-hidden">
          <div className="h-1.5 w-full bg-gradient-to-r from-wine-950 via-wine-800 to-sand-300" />

          <div className="grid gap-8 px-6 py-8 sm:px-8 lg:grid-cols-[1.15fr_1fr] lg:gap-12">
            <div className="space-y-4">
              <Logo />
              <p className="max-w-xs text-[13.5px] leading-[1.6] text-taupe-600">
                Client work, delivery records, and the proof behind them — kept in one vault.
              </p>
            </div>

            <div className="grid grid-cols-2 gap-6 sm:gap-10 lg:justify-items-end">
              {footerLinks.map((group) => (
                <div key={group.heading} className="space-y-3">
                  <p className="section-kicker">{group.heading}</p>
                  <ul className="space-y-2">
                    {group.links.map((item) => (
                      <li key={item.label}>
                        <Link
                          href={item.href}
                          className="text-[13.5px] text-ember-700/80 transition hover:text-wine-950"
                        >
                          {item.label}
                        </Link>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          </div>

          <div className="flex flex-col gap-3 border-t border-taupe-200 bg-sand-100/70 px-6 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-8">
            <p className="text-[12.5px] text-taupe-600">
              © {year} ProofVault · Delivery ledger for freelancers
            </p>
            <Link
              href="#top"
              className="inline-flex items-center gap-2 rounded-full border border-taupe-200 bg-cream-50 px-4 py-2 text-[12.5px] font-semibold text-wine-950 transition duration-200 hover:-translate-y-0.5 hover:border-wine-700"
            >
              Back to top
              <ArrowRightIcon className="h-3.5 w-3.5 -rotate-90" />
            </Link>
          </div>
        </footer>
      </div>
    </main>
  );
}
