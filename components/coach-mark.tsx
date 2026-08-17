"use client";

import {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  useRef,
  type ReactNode,
} from "react";

/* ═══════════════════════════════════════════════════════════════════════════
   Tour step definitions
   ═══════════════════════════════════════════════════════════════════════════ */

export interface TourStep {
  /** Must match the `data-tour` attribute on the target element */
  target: string;
  title: string;
  description: string;
}

const TOUR_STEPS: TourStep[] = [
  {
    target: "welcome",
    title: "Welcome to Taskora",
    description:
      "Your delivery ledger — track projects, deliverables, and payments all in one place.",
  },
  {
    target: "stats",
    title: "Your Overview at a Glance",
    description:
      "These cards show your total projects, active work, completed projects, and deliverable count.",
  },
  {
    target: "finance",
    title: "Financial Summary",
    description:
      "See agreed amounts, payments received, and outstanding balances — grouped by currency.",
  },
  {
    target: "new-project",
    title: "Create Your First Project",
    description:
      "Tap here to start a new project. Add your client, platform, and agreed amount.",
  },
  {
    target: "search-filter",
    title: "Search & Filter",
    description:
      "Quickly find projects by client name or platform, and filter by status.",
  },
];

const STORAGE_KEY = "taskora_tour_completed";

/* ═══════════════════════════════════════════════════════════════════════════
   Context
   ═══════════════════════════════════════════════════════════════════════════ */

interface CoachMarkContextValue {
  /** Restart the product tour */
  restartTour: () => void;
}

const CoachMarkContext = createContext<CoachMarkContextValue>({
  restartTour: () => {},
});

export function useCoachMark() {
  return useContext(CoachMarkContext);
}

/* ═══════════════════════════════════════════════════════════════════════════
   Rect helpers
   ═══════════════════════════════════════════════════════════════════════════ */

interface Rect {
  top: number;
  left: number;
  width: number;
  height: number;
}

function getTargetRect(target: string): Rect | null {
  const el = document.querySelector(`[data-tour="${target}"]`);
  if (!el) return null;
  const r = el.getBoundingClientRect();
  return { top: r.top, left: r.left, width: r.width, height: r.height };
}

type Placement = "bottom" | "top" | "left" | "right";

const TOOLTIP_GAP = 16;

function computePlacement(
  targetRect: Rect,
  tooltipW: number,
  tooltipH: number
): { placement: Placement; x: number; y: number } {
  const vw = window.innerWidth;
  const vh = window.innerHeight;

  // Prefer below
  const belowY = targetRect.top + targetRect.height + TOOLTIP_GAP;
  if (belowY + tooltipH < vh - 20) {
    return {
      placement: "bottom",
      x: clampX(targetRect.left + targetRect.width / 2 - tooltipW / 2, tooltipW, vw),
      y: belowY,
    };
  }

  // Try above
  const aboveY = targetRect.top - TOOLTIP_GAP - tooltipH;
  if (aboveY > 20) {
    return {
      placement: "top",
      x: clampX(targetRect.left + targetRect.width / 2 - tooltipW / 2, tooltipW, vw),
      y: aboveY,
    };
  }

  // Try right
  const rightX = targetRect.left + targetRect.width + TOOLTIP_GAP;
  if (rightX + tooltipW < vw - 20) {
    return {
      placement: "right",
      x: rightX,
      y: clampY(targetRect.top + targetRect.height / 2 - tooltipH / 2, tooltipH, vh),
    };
  }

  // Fallback: left
  const leftX = targetRect.left - TOOLTIP_GAP - tooltipW;
  return {
    placement: "left",
    x: Math.max(20, leftX),
    y: clampY(targetRect.top + targetRect.height / 2 - tooltipH / 2, tooltipH, vh),
  };
}

function clampX(x: number, w: number, vw: number) {
  return Math.max(16, Math.min(x, vw - w - 16));
}
function clampY(y: number, h: number, vh: number) {
  return Math.max(16, Math.min(y, vh - h - 16));
}

/* ═══════════════════════════════════════════════════════════════════════════
   Provider
   ═══════════════════════════════════════════════════════════════════════════ */

export function CoachMarkProvider({ children }: { children: ReactNode }) {
  const [active, setActive] = useState(false);
  const [step, setStep] = useState(0);
  const [targetRect, setTargetRect] = useState<Rect | null>(null);
  const tooltipRef = useRef<HTMLDivElement>(null);
  const [tooltipPos, setTooltipPos] = useState<{
    x: number;
    y: number;
    placement: Placement;
  } | null>(null);
  // Track the animation direction for tooltip transitions
  const [animDir, setAnimDir] = useState<"forward" | "backward">("forward");

  /* ── Launch tour on first visit ── */
  useEffect(() => {
    try {
      if (localStorage.getItem(STORAGE_KEY)) return;
    } catch {
      // SSR or storage blocked — skip gracefully
      return;
    }
    // Small delay so DOM is painted and elements can be measured
    const timer = setTimeout(() => setActive(true), 600);
    return () => clearTimeout(timer);
  }, []);

  /* ── Measure target + position tooltip whenever step changes ── */
  useEffect(() => {
    if (!active) return;
    const current = TOUR_STEPS[step];
    if (!current) return;

    function measure() {
      const rect = getTargetRect(current.target);
      setTargetRect(rect);

      if (rect && tooltipRef.current) {
        const tw = tooltipRef.current.offsetWidth;
        const th = tooltipRef.current.offsetHeight;
        const pos = computePlacement(rect, tw, th);
        setTooltipPos(pos);
      }
    }

    // Measure after a frame so the tooltip has been rendered
    requestAnimationFrame(() => {
      measure();
      // Second measure after tooltip is visible with content
      requestAnimationFrame(measure);
    });

    // Re-measure on scroll / resize
    window.addEventListener("scroll", measure, true);
    window.addEventListener("resize", measure);
    return () => {
      window.removeEventListener("scroll", measure, true);
      window.removeEventListener("resize", measure);
    };
  }, [active, step]);

  /* ── Scroll target into view ── */
  useEffect(() => {
    if (!active) return;
    const current = TOUR_STEPS[step];
    if (!current) return;
    const el = document.querySelector(`[data-tour="${current.target}"]`);
    if (el) {
      el.scrollIntoView({ behavior: "smooth", block: "center" });
    }
  }, [active, step]);

  /* ── Keyboard: Escape to skip ── */
  useEffect(() => {
    if (!active) return;
    function handleKey(e: KeyboardEvent) {
      if (e.key === "Escape") finish();
    }
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active]);

  /* ── Actions ── */
  const finish = useCallback(() => {
    setActive(false);
    setStep(0);
    setTargetRect(null);
    setTooltipPos(null);
    try {
      localStorage.setItem(STORAGE_KEY, "1");
    } catch {
      /* ignore */
    }
  }, []);

  const next = useCallback(() => {
    setAnimDir("forward");
    if (step < TOUR_STEPS.length - 1) setStep((s) => s + 1);
    else finish();
  }, [step, finish]);

  const prev = useCallback(() => {
    setAnimDir("backward");
    if (step > 0) setStep((s) => s - 1);
  }, [step]);

  const restartTour = useCallback(() => {
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch {
      /* ignore */
    }
    setStep(0);
    setAnimDir("forward");
    setActive(true);
  }, []);

  const currentStep = TOUR_STEPS[step];

  // ── Spotlight clip path ──
  // Creates a rectangular cutout over the target element
  const PAD = 10;
  const RADIUS = 18;
  let clipPath = "none";
  if (targetRect) {
    const x = targetRect.left - PAD;
    const y = targetRect.top - PAD;
    const w = targetRect.width + PAD * 2;
    const h = targetRect.height + PAD * 2;
    // Use an SVG-style inset with rounded corners via polygon that approximates the cutout
    // We'll use a CSS approach: two layers — backdrop + cutout via box-shadow
    clipPath = `inset(0)`;
    // Actually, let's skip clip-path and use box-shadow for the spotlight effect
    void clipPath;
  }

  return (
    <CoachMarkContext.Provider value={{ restartTour }}>
      {children}

      {active && currentStep && (
        <>
          {/* ── Overlay with spotlight cutout ── */}
          <div
            className="coachmark-overlay"
            onClick={finish}
            aria-hidden="true"
            style={
              targetRect
                ? ({
                    "--spotlight-x": `${targetRect.left - PAD}px`,
                    "--spotlight-y": `${targetRect.top - PAD}px`,
                    "--spotlight-w": `${targetRect.width + PAD * 2}px`,
                    "--spotlight-h": `${targetRect.height + PAD * 2}px`,
                    "--spotlight-r": `${RADIUS}px`,
                  } as React.CSSProperties)
                : undefined
            }
          />

          {/* ── Pulse ring around target ── */}
          {targetRect && (
            <div
              className="coachmark-pulse-ring"
              aria-hidden="true"
              style={{
                top: targetRect.top - PAD - 4,
                left: targetRect.left - PAD - 4,
                width: targetRect.width + PAD * 2 + 8,
                height: targetRect.height + PAD * 2 + 8,
                borderRadius: RADIUS + 4,
              }}
            />
          )}

          {/* ── Tooltip ── */}
          <div
            ref={tooltipRef}
            className={`coachmark-tooltip coachmark-enter-${animDir}`}
            key={step} // re-mount to retrigger entrance animation
            role="dialog"
            aria-modal="true"
            aria-label={currentStep.title}
            style={
              tooltipPos
                ? { top: tooltipPos.y, left: tooltipPos.x }
                : { top: "50%", left: "50%", transform: "translate(-50%, -50%)" }
            }
            onClick={(e) => e.stopPropagation()}
          >
            {/* Step counter chip */}
            <div className="flex items-center justify-between mb-3">
              <span className="inline-flex items-center gap-1.5 rounded-full bg-wine-100 border border-wine-950/10 px-3 py-1 text-[10px] font-bold uppercase tracking-[0.2em] text-wine-950">
                Step {step + 1} of {TOUR_STEPS.length}
              </span>
              <button
                onClick={finish}
                className="text-taupe-400 hover:text-wine-950 transition p-1 -mr-1"
                aria-label="Close tour"
              >
                <svg viewBox="0 0 16 16" className="h-4 w-4" fill="none">
                  <path
                    d="M4 4l8 8M12 4l-8 8"
                    stroke="currentColor"
                    strokeWidth="1.8"
                    strokeLinecap="round"
                  />
                </svg>
              </button>
            </div>

            {/* Content */}
            <h3 className="text-[1.05rem] font-semibold text-wine-950 tracking-tight leading-snug">
              {currentStep.title}
            </h3>
            <p className="mt-1.5 text-[13.5px] text-ember-700/80 leading-relaxed">
              {currentStep.description}
            </p>

            {/* Step dots */}
            <div className="flex items-center gap-1.5 mt-4" aria-hidden="true">
              {TOUR_STEPS.map((_, i) => (
                <span
                  key={i}
                  className={`h-1.5 rounded-full transition-all duration-300 ${
                    i === step
                      ? "w-5 bg-wine-950"
                      : i < step
                      ? "w-1.5 bg-wine-700/50"
                      : "w-1.5 bg-taupe-300"
                  }`}
                />
              ))}
            </div>

            {/* Actions */}
            <div className="flex items-center justify-between mt-4 pt-3 border-t border-taupe-200/60">
              <button
                onClick={finish}
                className="text-[12px] text-taupe-500 hover:text-wine-950 transition font-medium"
              >
                Skip tour
              </button>
              <div className="flex items-center gap-2">
                {step > 0 && (
                  <button
                    onClick={prev}
                    className="inline-flex items-center gap-1.5 rounded-full border border-taupe-200 bg-cream-50 px-4 py-2 text-[12px] font-semibold text-ember-700 transition hover:border-wine-700 hover:bg-cream-100"
                  >
                    <svg viewBox="0 0 16 16" className="h-3 w-3" fill="none">
                      <path
                        d="M10 3L5 8l5 5"
                        stroke="currentColor"
                        strokeWidth="1.8"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </svg>
                    Back
                  </button>
                )}
                <button
                  onClick={next}
                  className="inline-flex items-center gap-1.5 rounded-full bg-wine-950 px-4 py-2 text-[12px] font-semibold text-cream-50 transition hover:bg-wine-900 hover:-translate-y-0.5 hover:shadow-lift"
                >
                  {step < TOUR_STEPS.length - 1 ? (
                    <>
                      Next
                      <svg viewBox="0 0 16 16" className="h-3 w-3" fill="none">
                        <path
                          d="M6 3l5 5-5 5"
                          stroke="currentColor"
                          strokeWidth="1.8"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        />
                      </svg>
                    </>
                  ) : (
                    <>
                      Finish
                      <svg viewBox="0 0 16 16" className="h-3 w-3" fill="none">
                        <path
                          d="M3 8.5l3.5 3.5L13 5"
                          stroke="currentColor"
                          strokeWidth="1.8"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        />
                      </svg>
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </>
      )}
    </CoachMarkContext.Provider>
  );
}
