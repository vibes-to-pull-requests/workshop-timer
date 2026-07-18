import type { LiveWorkshopState, Segment } from "./types";

export type TimerTone = "neutral" | "orange" | "red" | "overtime";

export function segmentPlannedMs(segment: Segment): number {
  return segment.durationMinutes * 60_000;
}

export function getCurrentSegment(state: LiveWorkshopState): Segment {
  const segment = state.segments[state.currentSegmentIndex];
  if (!segment) {
    throw new RangeError("The current segment index is outside the plan.");
  }
  return segment;
}

export function getActiveElapsedMs(
  state: LiveWorkshopState,
  nowMs: number,
): number {
  if (state.status === "paused") return state.currentAccumulatedMs;
  assertMonotonicNow(nowMs, state.runStartedAtMs);
  return state.currentAccumulatedMs + (nowMs - state.runStartedAtMs);
}

export function getRemainingMs(state: LiveWorkshopState, nowMs: number): number {
  return segmentPlannedMs(getCurrentSegment(state)) - getActiveElapsedMs(state, nowMs);
}

export function getOvertimeMs(state: LiveWorkshopState, nowMs: number): number {
  return Math.max(0, -getRemainingMs(state, nowMs));
}

export function getRemainingProportion(
  state: LiveWorkshopState,
  nowMs: number,
): number {
  const plannedMs = segmentPlannedMs(getCurrentSegment(state));
  return Math.min(1, Math.max(0, getRemainingMs(state, nowMs) / plannedMs));
}

export function getTimerTone(state: LiveWorkshopState, nowMs: number): TimerTone {
  const remainingMs = getRemainingMs(state, nowMs);
  if (remainingMs < 0) return "overtime";

  const plannedMs = segmentPlannedMs(getCurrentSegment(state));
  if (remainingMs <= plannedMs * 0.1) return "red";
  if (remainingMs <= plannedMs * 0.25) return "orange";
  return "neutral";
}

export function formatTimerValue(remainingMs: number): string {
  assertFiniteDuration(remainingMs);
  if (remainingMs < 0) {
    return `+${formatSeconds(Math.floor(Math.abs(remainingMs) / 1_000))}`;
  }
  return formatSeconds(Math.ceil(remainingMs / 1_000));
}

export function formatSignedDuration(durationMs: number): string {
  assertFiniteDuration(durationMs);
  if (durationMs === 0) return "00:00";
  const sign = durationMs > 0 ? "+" : "-";
  return `${sign}${formatSeconds(Math.floor(Math.abs(durationMs) / 1_000))}`;
}

function formatSeconds(totalSeconds: number): string {
  const hours = Math.floor(totalSeconds / 3_600);
  const minutes = Math.floor((totalSeconds % 3_600) / 60);
  const seconds = totalSeconds % 60;
  if (hours > 0) {
    return `${hours}:${pad(minutes)}:${pad(seconds)}`;
  }
  return `${pad(minutes)}:${pad(seconds)}`;
}

function pad(value: number): string {
  return value.toString().padStart(2, "0");
}

function assertFiniteDuration(durationMs: number): void {
  if (!Number.isFinite(durationMs)) {
    throw new RangeError("Duration must be finite.");
  }
}

function assertMonotonicNow(nowMs: number, anchorMs: number): void {
  if (!Number.isFinite(nowMs) || nowMs < anchorMs) {
    throw new RangeError("The clock value must be finite and monotonic.");
  }
}
