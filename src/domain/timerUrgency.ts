import {
  getActiveElapsedMs,
  getCurrentSegment,
  getRemainingMs,
  segmentPlannedMs,
} from "./timer";
import type { LiveWorkshopState } from "./types";

export type TimerUrgencyPhase = "calm" | "building" | "critical" | "final-ten" | "pounding" | "overtime";

export interface TimerUrgencyMetrics {
  readonly baseScale: number;
  readonly pulseDurationMs: number;
  readonly pulseAmplitude: number;
  readonly pulseDelayMs: number;
  readonly phase: TimerUrgencyPhase;
  readonly animate: boolean;
  readonly swarmSpreadMultiplier: number;
}

export interface TimerSwarmCell {
  readonly x: string;
  readonly y: string;
}

export const TIMER_SWARM_COUNT = 36;

function lerp(from: number, to: number, progress: number): number {
  return from + (to - from) * progress;
}

export function getElapsedProportion(state: LiveWorkshopState, nowMs: number): number {
  const plannedMs = segmentPlannedMs(getCurrentSegment(state));
  if (plannedMs <= 0) return 1;
  return Math.min(1, Math.max(0, getActiveElapsedMs(state, nowMs) / plannedMs));
}

export function getTimerUrgencyMetrics(
  state: LiveWorkshopState,
  nowMs: number,
): TimerUrgencyMetrics {
  const plannedMs = segmentPlannedMs(getCurrentSegment(state));
  const remainingMs = getRemainingMs(state, nowMs);
  const elapsedProportion = getElapsedProportion(state, nowMs);
  const remainingProportion = plannedMs > 0
    ? Math.min(1, Math.max(0, remainingMs / plannedMs))
    : 0;
  const remainingSeconds = Math.max(0, remainingMs / 1_000);

  let growthProgress = elapsedProportion;
  if (remainingMs > 0 && remainingMs <= 10_000) {
    const urgencyBoost = (1 - remainingMs / 10_000) ** 1.35;
    growthProgress = Math.min(1, elapsedProportion + urgencyBoost * (1 - elapsedProportion) * 0.22);
  }

  const baseScale = 0.05 + 0.95 * growthProgress;

  let pulseDurationMs: number;
  let pulseAmplitude: number;
  let phase: TimerUrgencyPhase;

  if (remainingMs <= 0) {
    phase = "overtime";
    pulseDurationMs = 750;
    pulseAmplitude = 0.08;
  } else if (remainingSeconds <= 5) {
    phase = "pounding";
    pulseDurationMs = 1_000;
    pulseAmplitude = lerp(0.075, 0.1, (5 - remainingSeconds) / 5);
  } else if (remainingSeconds <= 10) {
    phase = "final-ten";
    pulseDurationMs = 1_000;
    pulseAmplitude = 0.06;
  } else if (remainingProportion <= 0.2) {
    phase = "critical";
    const progress = 1 - remainingProportion / 0.2;
    pulseDurationMs = lerp(1_200, 700, progress);
    pulseAmplitude = lerp(0.04, 0.055, progress);
  } else if (elapsedProportion < 0.5) {
    phase = "calm";
    const progress = elapsedProportion / 0.5;
    pulseDurationMs = lerp(4_000, 2_500, progress);
    pulseAmplitude = lerp(0.012, 0.02, progress);
  } else {
    phase = "building";
    const progress = Math.min(1, (elapsedProportion - 0.5) / 0.3);
    pulseDurationMs = lerp(2_500, 1_100, progress);
    pulseAmplitude = lerp(0.025, 0.038, progress);
  }

  const pulseDelayMs = remainingMs > 0 && remainingMs <= 10_000
    ? -(remainingMs % 1_000)
    : 0;

  const swarmSpreadMultiplier = getSwarmSpreadMultiplier(phase, elapsedProportion, remainingProportion);

  return {
    baseScale,
    pulseDurationMs,
    pulseAmplitude,
    pulseDelayMs,
    phase,
    animate: state.status !== "paused",
    swarmSpreadMultiplier,
  };
}

export function getSwarmSpreadMultiplier(
  phase: TimerUrgencyPhase,
  elapsedProportion: number,
  remainingProportion: number,
): number {
  let spread = lerp(1, 1.12, elapsedProportion);

  if (remainingProportion <= 0.2) {
    spread += lerp(0, 0.18, 1 - remainingProportion / 0.2);
  }

  if (phase === "final-ten") spread += 0.12;
  if (phase === "pounding") spread += 0.2;
  if (phase === "overtime") spread += 0.08;

  return spread;
}

export function buildTimerSwarmLayout(spreadMultiplier = 1): TimerSwarmCell[] {
  const columns = 6;
  const rows = Math.ceil(TIMER_SWARM_COUNT / columns);

  return Array.from({ length: TIMER_SWARM_COUNT }, (_, index) => {
    const column = index % columns;
    const row = Math.floor(index / columns);
    const x = (column - (columns - 1) / 2) * 5.5 * spreadMultiplier;
    const y = (row - (rows - 1) / 2) * 4.8 * spreadMultiplier;

    return {
      x: `${x}vmin`,
      y: `${y}vmin`,
    };
  });
}