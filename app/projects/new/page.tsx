import Link from "next/link";
import { Logo } from "@/components/logo";
import { ArrowRightIcon, FolderIcon, ReceiptIcon } from "@/components/icons";
import { NewProjectForm } from "./new-project-form";

export default function NewProjectPage() {
  return (
    <main className="page-frame">
      <header className="mb-6 flex items-center justify-between rounded-[24px] border border-taupe-200 bg-cream-50 px-5 py-4 shadow-soft">
        <Logo />
        <Link href="/dashboard" className="btn-ghost">
          Cancel
        </Link>
      </header>

      <section className="grid gap-6 lg:grid-cols-[0.85fr_1.15fr]">
        <div className="surface-strong p-7 sm:p-8">
          <p className="section-kicker text-cream-50/70">new project</p>
          <h1 className="mt-3 text-4xl font-semibold tracking-tight text-cream-50">
            Open a fresh ledger entry for a client.
          </h1>
          <p className="mt-4 max-w-md text-sm leading-6 text-cream-50/80">
            Capture the agreement details once, then attach deliverables and proof as you work.
            Nothing about the backend changes, only the presentation.
          </p>

          <div className="mt-8 grid gap-3">
            <div className="frost-card">
              <FolderIcon className="mb-3 h-5 w-5 text-cream-50" />
              <p className="text-sm font-semibold text-cream-50">Client-first structure</p>
              <p className="mt-1 text-xs leading-5 text-cream-50/75">
                Each project becomes its own proof container.
              </p>
            </div>
            <div className="frost-card">
              <ReceiptIcon className="mb-3 h-5 w-5 text-cream-50" />
              <p className="text-sm font-semibold text-cream-50">Deliverable-friendly</p>
              <p className="mt-1 text-xs leading-5 text-cream-50/75">
                Add receipts, screenshots, and amounts later from the project page.
              </p>
            </div>
          </div>
        </div>

        <div className="surface p-6 sm:p-8">
          <div className="mb-6">
            <p className="section-kicker">project details</p>
            <h2 className="mt-2 text-2xl font-semibold tracking-tight text-wine-950">
              Set up the agreement.
            </h2>
            <p className="mt-2 text-sm leading-6 text-ember-700/75">
              A few core fields keep the record organized from day one.
            </p>
          </div>

          <NewProjectForm />

          <div className="mt-6 rounded-[22px] border border-taupe-200 bg-sand-100 p-4">
            <div className="flex items-start gap-3">
              <span className="mt-0.5 flex h-8 w-8 items-center justify-center rounded-full bg-wine-950 text-[11px] font-semibold text-cream-50">
                1
              </span>
              <div>
                <p className="text-sm font-semibold text-wine-950">Then log your first deliverable</p>
                <p className="mt-1 text-sm leading-6 text-ember-700/75">
                  The project page will give you a matching form and receipt list.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}
