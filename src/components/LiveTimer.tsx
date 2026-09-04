import { useEffect, useRef, useState, type CSSProperties } from "react";

import {
  formatTimerValue,
  getCurrentSegment,
  getRemainingMs,
  getRemainingProportion,
  getTimerTone,
} from "../domain/timer";
import { getTimerUrgencyMetrics, buildTimerSwarmLayout } from "../domain/timerUrgency";
import type { LiveWorkshopState } from "../domain/types";
import ConfirmDialog from "./ConfirmDialog";
import SegmentMusicPlayer from "./SegmentMusicPlayer";
import TimerSwarm from "./TimerSwarm";

interface LiveTimerProps {
  readonly state: LiveWorkshopState;
  readonly nowMs: number;
  readonly onPause: () => void;
  readonly onResume: () => void;
  readonly onNext: () => void;
  readonly onFinish: () => void;
  readonly onNewPlan: () => void;
  readonly disabled?: boolean;
}

type Confirmation = "finish" | "new-plan";

export default function LiveTimer({
  state,
  nowMs,
  onPause,
  onResume,
  onNext,
  onFinish,
  onNewPlan,
  disabled = false,
}: LiveTimerProps) {
  const [confirmation, setConfirmation] = useState<Confirmation>();
  const [wasDisabled, setWasDisabled] = useState(disabled);
  const finishRef = useRef<HTMLButtonElement>(null);
  const newPlanRef = useRef<HTMLButtonElement>(null);
  const headingRef = useRef<HTMLHeadingElement>(null);
  const segment = getCurrentSegment(state);
  const next = state.segments[state.currentSegmentIndex + 1];
  const remainingMs = getRemainingMs(state, nowMs);
  const tone = state.status === "paused" ? "paused" : getTimerTone(state, nowMs);
  const proportion = getRemainingProportion(state, nowMs);
  const urgency = getTimerUrgencyMetrics(state, nowMs);
  const timerValue = formatTimerValue(remainingMs);
  const timerSwarm = buildTimerSwarmLayout(urgency.swarmSpreadMultiplier);
  const isFinal = next === undefined;
  const statusLabel = getStatusLabel(tone);
  const style = {
    "--remaining": `${proportion * 100}%`,
    "--timer-base-scale": urgency.baseScale,
    "--timer-pulse-amplitude": urgency.pulseAmplitude,
    "--timer-pulse-duration": `${urgency.pulseDurationMs}ms`,
    "--timer-pulse-delay": `${urgency.pulseDelayMs}ms`,
  } as CSSProperties;

  useEffect(() => {
    headingRef.current?.focus();
  }, [state.currentSegmentIndex]);

  if (disabled !== wasDisabled) {
    setWasDisabled(disabled);
    if (disabled && confirmation) setConfirmation(undefined);
  }

  function confirm() {
    if (disabled) {
      setConfirmation(undefined);
      return;
    }
    if (confirmation === "finish") onFinish();
    if (confirmation === "new-plan") onNewPlan();
    setConfirmation(undefined);
  }

  return (
    <section
      className="live-timer"
      data-testid="live-timer"
      data-tone={tone}
      style={style}
      aria-labelledby="current-segment-title"
    >
      <div className="live-content">
        <div className="live-heading">
          <p className="live-position">Segment {state.currentSegmentIndex + 1} of {state.segments.length}</p>
          <span className="tone-label">{statusLabel}</span>
        </div>

        <div className="current-segment">
          <h1 id="current-segment-title" ref={headingRef} tabIndex={-1}>{segment.name}</h1>
          {segment.facilitator ? (
            <p className="segment-facilitator">Facilitator: {segment.facilitator}</p>
          ) : null}
          <div
            className="timer-value-shell"
            data-urgency-phase={urgency.phase}
            data-urgency-animate={urgency.animate ? "true" : "false"}
          >
            <TimerSwarm value={timerValue} cells={timerSwarm} />
          </div>
          <p className="timer-caption">{remainingMs < 0 ? "over allocated time" : "remaining"}</p>
        </div>

        {next ? (
          <div className="next-segment">
            <span>Up next</span>
            <strong>{next.name} · {formatMinutes(next.durationMinutes)}</strong>
          </div>
        ) : (
          <div className="next-segment"><span>Final segment</span><strong>Finish when you are ready</strong></div>
        )}

        <SegmentMusicPlayer
          key={segment.id}
          music={segment.music}
          workshopPaused={state.status === "paused"}
        />

        <div className="live-actions">
          <button
            className="pause-button"
            type="button"
            disabled={disabled}
            onClick={state.status === "paused" ? onResume : onPause}
          >
            {state.status === "paused" ? "Resume" : "Pause"}
          </button>
          {isFinal ? (
            <button ref={finishRef} className="advance-button" type="button" disabled={disabled} onClick={() => setConfirmation("finish")}>Finish workshop</button>
          ) : (
            <button className="advance-button" type="button" disabled={disabled} onClick={onNext}>Next segment</button>
          )}
        </div>

        <button ref={newPlanRef} className="new-plan-button" type="button" disabled={disabled} onClick={() => setConfirmation("new-plan")}>New plan</button>
      </div>

      {confirmation ? (
        <ConfirmDialog
          title={confirmation === "finish" ? "Finish workshop?" : "Discard this workshop?"}
          description={confirmation === "finish" ? "This records the final segment and completes the workshop." : "Your current timing progress will be replaced with a new plan."}
          cancelLabel="Keep timing"
          confirmLabel={confirmation === "finish" ? "Finish workshop" : "Discard workshop"}
          returnFocusRef={confirmation === "finish" ? finishRef : newPlanRef}
          onCancel={() => setConfirmation(undefined)}
          onConfirm={confirm}
        />
      ) : null}
    </section>
  );
}

function getStatusLabel(tone: "neutral" | "orange" | "red" | "overtime" | "paused"): string {
  if (tone === "paused") return "Paused";
  if (tone === "orange") return "25% remaining";
  if (tone === "red") return "10% remaining";
  if (tone === "overtime") return "Overtime";
  return "On time";
}

function formatMinutes(minutes: number): string {
  return `${minutes} min`;
}