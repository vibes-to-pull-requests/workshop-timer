import { useEffect, useEffectEvent, useRef, useState } from "react";

import LiveTimer from "./components/LiveTimer";
import PlanEditor from "./components/PlanEditor";
import SummaryView from "./components/SummaryView";
import ConfirmDialog from "./components/ConfirmDialog";
import { createPreparingState, transition } from "./domain/reducer";
import { getTimerTone } from "./domain/timer";
import type { Segment, WorkshopState } from "./domain/types";
import { createBrowserClock } from "./infrastructure/clock";
import {
  commitWorkshopState,
  checkpointWorkshop,
  loadWorkshopState,
  probeStorage,
  resetStoredWorkshop,
  type PersistenceError,
  type StorageLike,
} from "./infrastructure/storage";

interface AppProps {
  readonly storage?: StorageLike;
  readonly now?: () => number;
  readonly createId?: () => string;
}

interface InitialAppState {
  readonly workshop: WorkshopState;
  readonly canPersist: boolean;
  readonly persistenceMessage?: string;
  readonly recoveryError?: PersistenceError;
}

const defaultNow = createBrowserClock().now;
const defaultCreateId = () => crypto.randomUUID();

export default function App({
  storage: injectedStorage,
  now = defaultNow,
  createId = defaultCreateId,
}: AppProps) {
  const [storage] = useState<StorageLike>(() => resolveStorage(injectedStorage));
  const [initial] = useState(() => initialize(storage, now()));
  const [workshop, setWorkshop] = useState(initial.workshop);
  const [canPersist, setCanPersist] = useState(initial.canPersist);
  const [persistenceMessage, setPersistenceMessage] = useState(initial.persistenceMessage);
  const [recoveryError, setRecoveryError] = useState(initial.recoveryError);
  const [confirmingReset, setConfirmingReset] = useState(false);
  const [displayNow, setDisplayNow] = useState(() => now());
  const [announcement, setAnnouncement] = useState(() => initial.workshop.status === "paused" ? "Workshop restored and paused." : "");
  const errorRef = useRef<HTMLDivElement>(null);
  const resetRef = useRef<HTMLButtonElement>(null);

  const checkpoint = useEffectEvent(() => {
    if (workshop.status !== "running") return;
    const cutoff = now();
    const result = checkpointWorkshop(storage, workshop, cutoff);
    if (result.ok) {
      setWorkshop(result.state);
      setDisplayNow(cutoff);
      return;
    }
    const paused = transition(workshop, { type: "pause", nowMs: cutoff });
    if (paused.ok) setWorkshop(paused.state);
    setDisplayNow(cutoff);
    setCanPersist(false);
    setPersistenceMessage(result.error.message);
    setAnnouncement("Workshop paused because progress could not be saved.");
  });

  useEffect(() => {
    if (workshop.status !== "running") return;
    const timer = window.setInterval(() => setDisplayNow(now()), 250);
    return () => window.clearInterval(timer);
  }, [now, workshop.status]);

  useEffect(() => {
    if (workshop.status !== "running" || !canPersist) return;
    const timer = window.setInterval(checkpoint, 1_000);
    return () => window.clearInterval(timer);
  }, [canPersist, workshop.status]);

  useEffect(() => {
    if (!persistenceMessage) return;
    errorRef.current?.focus();
  }, [persistenceMessage]);

  useEffect(() => {
    function saveOnExit() {
      if (workshop.status === "running" && canPersist) checkpoint();
    }
    document.addEventListener("visibilitychange", saveOnExit);
    window.addEventListener("pagehide", saveOnExit);
    return () => {
      document.removeEventListener("visibilitychange", saveOnExit);
      window.removeEventListener("pagehide", saveOnExit);
    };
  }, [canPersist, workshop.status]);

  function saveDraft(segments: readonly Segment[]) {
    if (workshop.status !== "preparing") return;
    const candidate = transition(workshop, { type: "set-plan", segments });
    if (!candidate.ok) return;
    const committed = commitWorkshopState(storage, workshop, candidate.state, now());
    if (committed.ok) {
      setWorkshop(committed.state);
      setCanPersist(true);
      setPersistenceMessage(undefined);
    } else {
      setCanPersist(false);
      setPersistenceMessage(committed.error.message);
    }
  }

  function applyLiveEvent(type: "pause" | "resume" | "next" | "finish") {
    if (!canPersist) return;
    if (workshop.status !== "running" && workshop.status !== "paused") return;
    const eventNow = now();
    const candidate = transition(workshop, { type, nowMs: eventNow });
    if (!candidate.ok) return;
    const committed = commitWorkshopState(storage, workshop, candidate.state, eventNow);
    if (!committed.ok) {
      if (workshop.status === "running") {
        const paused = transition(workshop, { type: "pause", nowMs: eventNow });
        if (paused.ok) setWorkshop(paused.state);
      }
      setCanPersist(false);
      setPersistenceMessage(committed.error.message);
      setAnnouncement("Workshop paused because progress could not be saved.");
      return;
    }
    setWorkshop(committed.state);
    setDisplayNow(eventNow);
    setAnnouncement(getAnnouncement(type, committed.state));
  }

  function retryPersistence() {
    const committed = commitWorkshopState(storage, workshop, workshop, now());
    if (!committed.ok) {
      setPersistenceMessage(committed.error.message);
      return;
    }
    setWorkshop(committed.state);
    setCanPersist(true);
    setPersistenceMessage(undefined);
    setAnnouncement("Progress saved. Workshop remains paused until you resume.");
  }

  function startNewPlan() {
    if (!canPersist) return;
    const eventNow = now();
    const candidate = createPreparingState();
    const committed = commitWorkshopState(storage, workshop, candidate, eventNow);
    if (!committed.ok) {
      if (workshop.status === "running") {
        const paused = transition(workshop, { type: "pause", nowMs: eventNow });
        if (paused.ok) setWorkshop(paused.state);
        setDisplayNow(eventNow);
        setAnnouncement("Workshop paused because progress could not be saved.");
      }
      setCanPersist(false);
      setPersistenceMessage(committed.error.message);
      return;
    }
    setWorkshop(committed.state);
    setCanPersist(true);
    setPersistenceMessage(undefined);
    setAnnouncement("New plan ready.");
  }

  function resetRecovery() {
    const reset = resetStoredWorkshop(storage, true);
    if (!reset.ok) {
      setPersistenceMessage(reset.error.message);
      setConfirmingReset(false);
      return;
    }
    const blank = createPreparingState();
    const committed = commitWorkshopState(storage, workshop, blank, now());
    if (!committed.ok) {
      setPersistenceMessage(committed.error.message);
      setCanPersist(false);
      setConfirmingReset(false);
      return;
    }
    setWorkshop(committed.state);
    setRecoveryError(undefined);
    setPersistenceMessage(undefined);
    setCanPersist(true);
    setConfirmingReset(false);
    setAnnouncement("Saved workshop reset. New plan ready.");
  }

  function startWorkshop(segments: readonly Segment[]) {
    if (workshop.status !== "preparing" || !canPersist) return;
    const prepared = transition(workshop, { type: "set-plan", segments });
    if (!prepared.ok) return;
    const eventNow = now();
    const started = transition(prepared.state, { type: "start", nowMs: eventNow });
    if (!started.ok) return;
    const committed = commitWorkshopState(storage, workshop, started.state, eventNow);
    if (committed.ok) {
      setWorkshop(committed.state);
      setDisplayNow(eventNow);
      setAnnouncement(`Started ${committed.state.segments[0]?.name ?? "workshop"}.`);
      setPersistenceMessage(undefined);
    } else {
      setCanPersist(false);
      setPersistenceMessage(committed.error.message);
    }
  }

  return (
    <div className="app-shell">
      <header className="app-header">
        <span className="brand">Workshop Timer</span>
        <span className="tagline">Stay present. Stay on time.</span>
      </header>

      <main className="app-main">
        <span className="sr-only" aria-live="polite" aria-atomic="true">{announcement} {getThresholdAnnouncement(workshop, displayNow)}</span>
        {persistenceMessage && workshop.status !== "preparing" ? (
          <div className="blocking-error" role="alert" tabIndex={-1} ref={errorRef}>
            <strong>Timing paused to protect your progress.</strong>
            <span>{persistenceMessage}</span>
            <button type="button" onClick={retryPersistence}>Retry save</button>
          </div>
        ) : null}
        {recoveryError ? (
          <section className="recovery-view" aria-labelledby="recovery-title">
            <p className="eyebrow">Recovery</p>
            <h1 id="recovery-title">Saved workshop needs attention</h1>
            <p>{recoveryError.message}</p>
            <p>Your saved data will remain untouched until you choose to reset it.</p>
            <button ref={resetRef} type="button" onClick={() => setConfirmingReset(true)}>Reset saved workshop</button>
          </section>
        ) : workshop.status === "preparing" ? (
          <PlanEditor
            segments={workshop.segments}
            onChange={saveDraft}
            onStart={startWorkshop}
            onRetry={saveDraft}
            createId={createId}
            canPersist={canPersist}
            persistenceMessage={persistenceMessage}
          />
        ) : workshop.status === "completed" ? (
          <SummaryView state={workshop} onNewPlan={startNewPlan} />
        ) : (
          <LiveTimer
            state={workshop}
            nowMs={displayNow}
            disabled={!canPersist}
            onPause={() => applyLiveEvent("pause")}
            onResume={() => applyLiveEvent("resume")}
            onNext={() => applyLiveEvent("next")}
            onFinish={() => applyLiveEvent("finish")}
            onNewPlan={startNewPlan}
          />
        )}
      </main>
      {confirmingReset ? (
        <ConfirmDialog
          title="Reset saved workshop?"
          description="This permanently removes the incompatible saved workshop and opens a blank plan."
          cancelLabel="Cancel"
          confirmLabel="Reset and start over"
          returnFocusRef={resetRef}
          onCancel={() => setConfirmingReset(false)}
          onConfirm={resetRecovery}
        />
      ) : null}

      <footer className="app-footer" role="contentinfo">One Team One Dream</footer>
    </div>
  );
}

function getAnnouncement(type: "pause" | "resume" | "next" | "finish", state: WorkshopState): string {
  if (type === "pause") return "Workshop paused.";
  if (type === "resume") return "Workshop resumed.";
  if (type === "finish") return "Workshop finished.";
  if (state.status === "running") return `Started ${state.segments[state.currentSegmentIndex]?.name ?? "next segment"}.`;
  return "";
}

function getThresholdAnnouncement(state: WorkshopState, nowMs: number): string {
  if (state.status !== "running") return "";
  const tone = getTimerTone(state, nowMs);
  if (tone === "orange") return "25 percent of this segment remains.";
  if (tone === "red") return "10 percent of this segment remains.";
  if (tone === "overtime") return "This segment is now overtime.";
  return "";
}

function initialize(storage: StorageLike, nowMs: number): InitialAppState {
  const capability = probeStorage(storage);
  if (!capability.ok) {
    return {
      workshop: createPreparingState(),
      canPersist: false,
      persistenceMessage: capability.error.message,
    };
  }
  const loaded = loadWorkshopState(storage, nowMs);
  if (!loaded.ok) {
    if (loaded.error.action === "confirm-reset") {
      return {
        workshop: createPreparingState(),
        canPersist: true,
        recoveryError: loaded.error,
      };
    }
    return {
      workshop: createPreparingState(),
      canPersist: false,
      persistenceMessage: loaded.error.message,
    };
  }
  return {
    workshop: loaded.kind === "loaded" ? loaded.state : createPreparingState(),
    canPersist: true,
  };
}

function resolveStorage(injectedStorage: StorageLike | undefined): StorageLike {
  if (injectedStorage) return injectedStorage;
  try {
    return window.localStorage;
  } catch {
    return unavailableStorage;
  }
}

const unavailableStorage: StorageLike = {
  getItem() {
    throw new Error("Storage unavailable");
  },
  setItem() {
    throw new Error("Storage unavailable");
  },
  removeItem() {
    throw new Error("Storage unavailable");
  },
};
