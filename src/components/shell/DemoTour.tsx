"use client";

import { usePathname, useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import Button from "@/components/ui/Button";
import Icon from "@/components/ui/Icon";
import styles from "./DemoTour.module.css";

interface TourStep {
  path: string;
  target: string;
  title: string;
  body: string;
}

const STEPS: TourStep[] = [
  { path: "/", target: "ask", title: "Ask Qiko anything", body: "Deals, people, assignments, what to do next. Every answer cites the records it used, and can create the task for you." },
  { path: "/", target: "move", title: "One decision, not a dashboard", body: "Qiko picks the single highest-value move from Pulse and puts it here with its evidence. Accept it and it becomes a task." },
  { path: "/", target: "focus", title: "What matters now, ranked", body: "Sales, staffing and Pulse in one list, ordered by priority and how soon it bites. The thumbs on each row teach Qiko what was right." },
  { path: "/", target: "inbox", title: "Automations wait for your OK", body: "Closed Won drafts the requirement, an ending assignment opens the renewal, a thin brief gets swept. Nothing runs until you approve it." },
  { path: "/", target: "record", title: "Qiko keeps score on itself", body: "Raised, acted on, outcomes recorded, value attributed, and how often you said the call was right. The product has to earn trust." },
  { path: "/sales", target: "signals", title: "Growth signals from the records", body: "Coverage gaps, re-engagement windows, second-degree reach and rate benchmarks, ranked by impact. Showcase signals are labelled." },
  { path: "/sales/accounts/acc_civic", target: "map", title: "How the door opened", body: "Who Tessiant knows at the account, who delivers there, and which SIA made the introduction. Click any node for the connection." },
  { path: "/staffing", target: "bench", title: "Bench against demand, 90 days out", body: "Who frees up and what starts, by skill or sector. A red cell is a gap Qiko sees before it happens." },
  { path: "/staffing/requirements/req_sap", target: "sweep", title: "One sweep across every source", body: "CVs, the first-degree network, second-degree reach and LinkedIn in one pass, with a before-and-after so the time saved is visible." },
  { path: "/staffing/offerings", target: "offerings", title: "The catalogue, read honestly", body: "Each offering against who can deliver it, who wants it, what it has won and what it earns. Demand above pool is flagged." },
];

const SESSION_KEY = "qiko-tour";
const SEEN_KEY = "qiko-tour-seen";

function readStep(): number | null {
  try {
    const raw = window.sessionStorage.getItem(SESSION_KEY);
    return raw === null ? null : Number(raw);
  } catch {
    return null;
  }
}

/**
 * Guided demo tour: ten stops across Home, Sales and Staffing, each spotlighting one element with a
 * short line on why it matters. Cross-page: the step index lives in sessionStorage so navigation
 * keeps the tour running. Start it from the top bar or the first-visit offer.
 */
export default function DemoTour() {
  const router = useRouter();
  const pathname = usePathname();
  const [step, setStep] = useState<number | null>(null);
  const [rect, setRect] = useState<DOMRect | null>(null);
  const [offer, setOffer] = useState(false);

  // Resume a tour in progress, or offer one on the first visit.
  useEffect(() => {
    // Deferred so the first client render matches the server and the restore happens after hydration.
    const timer = window.setTimeout(() => {
      const saved = readStep();
      if (saved !== null && saved >= 0 && saved < STEPS.length) {
        setStep(saved);
        return;
      }
      try {
        if (!window.localStorage.getItem(SEEN_KEY)) setOffer(true);
      } catch {
        /* storage unavailable */
      }
    }, 400);
    return () => window.clearTimeout(timer);
  }, []);

  const persist = useCallback((next: number | null) => {
    try {
      if (next === null) window.sessionStorage.removeItem(SESSION_KEY);
      else window.sessionStorage.setItem(SESSION_KEY, String(next));
      window.localStorage.setItem(SEEN_KEY, "1");
    } catch {
      /* storage unavailable */
    }
  }, []);

  const start = useCallback(() => {
    setOffer(false);
    setStep(0);
    persist(0);
  }, [persist]);

  useEffect(() => {
    const onStart = () => start();
    window.addEventListener("qiko:tour", onStart);
    return () => window.removeEventListener("qiko:tour", onStart);
  }, [start]);

  const stop = () => {
    setStep(null);
    setRect(null);
    persist(null);
  };

  const go = (next: number) => {
    if (next < 0 || next >= STEPS.length) {
      stop();
      return;
    }
    setStep(next);
    setRect(null);
    persist(next);
  };

  // Navigate to the step's page when needed, then find and measure its target.
  const current = step === null ? null : STEPS[step];
  useEffect(() => {
    if (!current) return;
    if (pathname !== current.path) {
      router.push(current.path);
      return;
    }
    let tries = 0;
    let frame = 0;
    const measure = () => {
      const element = document.querySelector<HTMLElement>(`[data-tour="${current.target}"]`);
      if (element) {
        element.scrollIntoView({ block: "center", behavior: "auto" });
        const apply = () => {
          const next = element.getBoundingClientRect();
          setRect((previous) => (previous && Math.abs(previous.top - next.top) < 1 && Math.abs(previous.left - next.left) < 1 && previous.width === next.width ? previous : next));
        };
        apply();
        // Layout can still settle after the scroll (fonts, count-ups); measure again shortly after.
        window.setTimeout(apply, 120);
        window.setTimeout(apply, 420);
      }
      if (!element && tries < 60) {
        tries += 1;
        frame = window.setTimeout(measure, 100);
      }
    };
    measure();
    const onChange = () => {
      const element = document.querySelector<HTMLElement>(`[data-tour="${current.target}"]`);
      if (element) setRect(element.getBoundingClientRect());
    };
    window.addEventListener("resize", onChange);
    window.addEventListener("scroll", onChange, true);
    return () => {
      window.clearTimeout(frame);
      window.removeEventListener("resize", onChange);
      window.removeEventListener("scroll", onChange, true);
    };
  }, [current, pathname, router]);

  if (offer && step === null) {
    return (
      <div className={styles.offer} role="dialog" aria-label="Take the tour">
        <span className={styles.offerOrb}>
          <Icon name="sparkles" size={14} />
        </span>
        <div>
          <b>New here? Two-minute tour.</b>
          <small>Ten stops: what Qiko decides, proposes and keeps score on.</small>
        </div>
        <Button size="small" variant="qiko" onClick={start}>
          Start
        </Button>
        <button
          type="button"
          className={styles.offerDismiss}
          aria-label="Dismiss"
          onClick={() => {
            setOffer(false);
            persist(null);
          }}
        >
          <Icon name="x" size={14} />
        </button>
      </div>
    );
  }

  if (!current) return null;
  const pad = 8;
  const cardBelow = rect ? rect.bottom + 16 + 220 < window.innerHeight : true;
  const cardTop = rect ? (cardBelow ? rect.bottom + 14 : Math.max(12, rect.top - 14 - 200)) : 80;
  const cardLeft = rect ? Math.min(Math.max(12, rect.left), window.innerWidth - 372) : 80;

  return (
    <div className={styles.layer} aria-live="polite">
      {rect ? (
        <>
          {/* Four dim panels around the target: robust where a giant box-shadow is not. */}
          <div className={styles.dim} style={{ top: 0, left: 0, right: 0, height: Math.max(0, rect.top - pad) }} />
          <div className={styles.dim} style={{ top: rect.bottom + pad, left: 0, right: 0, bottom: 0 }} />
          <div className={styles.dim} style={{ top: rect.top - pad, left: 0, width: Math.max(0, rect.left - pad), height: rect.height + pad * 2 }} />
          <div className={styles.dim} style={{ top: rect.top - pad, left: rect.right + pad, right: 0, height: rect.height + pad * 2 }} />
          <div className={styles.spot} style={{ top: rect.top - pad, left: rect.left - pad, width: rect.width + pad * 2, height: rect.height + pad * 2 }} />
        </>
      ) : (
        <div className={styles.dim} style={{ inset: 0 }} />
      )}
      <div className={styles.card} role="dialog" aria-label={`Tour step ${step! + 1} of ${STEPS.length}`} style={{ top: cardTop, left: cardLeft }}>
        <span className={styles.counter}>
          <i style={{ width: `${((step! + 1) / STEPS.length) * 100}%` }} />
        </span>
        <small>
          {step! + 1} of {STEPS.length} · {rect ? "" : "loading…"}
        </small>
        <b>{current.title}</b>
        <p>{current.body}</p>
        <div className={styles.actions}>
          <button type="button" className="link-button" onClick={stop}>
            Skip tour
          </button>
          <span className={styles.nav}>
            <Button size="small" variant="secondary" icon="chevronLeft" disabled={step === 0} onClick={() => go(step! - 1)} aria-label="Back" />
            <Button size="small" variant="qiko" iconRight={step! + 1 < STEPS.length ? "chevronRight" : "check"} onClick={() => go(step! + 1)}>
              {step! + 1 < STEPS.length ? "Next" : "Done"}
            </Button>
          </span>
        </div>
      </div>
    </div>
  );
}
