import { describe, expect, it } from "vitest";

import {
  buildTimerSwarmLayout,
  getElapsedProportion,
  getTimerUrgencyMetrics,
  TIMER_SWARM_COUNT,
} from "./timerUrgency";
import type { PausedState, RunningState } from "./types";

const runningState = (durationMinutes: number): RunningState => ({
  status: "running",
  segments: [{ id: "one", name: "Lesson", facilitator: "", durationMinutes }],
  currentSegmentIndex: 0,
  completedActualMs: [],
  currentAccumulatedMs: 0,
  runStartedAtMs: 0,
});

describe("timer urgency metrics", () => {
  it("starts near 5% scale and reaches full scale at zero", () => {
    const state = runningState(10);

    expect(getTimerUrgencyMetrics(state, 0).baseScale).toBeCloseTo(0.05, 2);
    expect(getTimerUrgencyMetrics(state, 300_000).baseScale).toBeCloseTo(0.53, 1);
    expect(getTimerUrgencyMetrics(state, 600_000).baseScale).toBeCloseTo(1, 2);
  });

  it("accelerates growth during the final ten seconds", () => {
    const state = runningState(10);
    const atElevenSeconds = getTimerUrgencyMetrics(state, 549_000).baseScale;
    const atFiveSeconds = getTimerUrgencyMetrics(state, 555_000).baseScale;

    expect(atFiveSeconds).toBeGreaterThan(atElevenSeconds);
  });

  it("enters pounding mode in the final five seconds", () => {
    const state = runningState(1);

    expect(getTimerUrgencyMetrics(state, 56_000).phase).toBe("pounding");
    expect(getTimerUrgencyMetrics(state, 56_000).pulseAmplitude).toBeGreaterThanOrEqual(0.075);
  });

  it("syncs pulse timing to second boundaries in the final ten seconds", () => {
    const state = runningState(1);

    expect(getTimerUrgencyMetrics(state, 52_500).pulseDurationMs).toBe(1_000);
    expect(getTimerUrgencyMetrics(state, 52_500).pulseDelayMs).toBe(-500);
  });

  it("freezes animation while paused", () => {
    const paused: PausedState = {
      ...runningState(10),
      status: "paused",
      currentAccumulatedMs: 300_000,
      pausedAtMs: 300_000,
    };

    expect(getTimerUrgencyMetrics(paused, 999_999).animate).toBe(false);
    expect(getElapsedProportion(paused, 999_999)).toBeCloseTo(0.5, 2);
  });

  it("keeps a full swarm visible from the start and expands spread with urgency", () => {
    const state = runningState(1);
    const calm = getTimerUrgencyMetrics(state, 0);
    const pounding = getTimerUrgencyMetrics(state, 56_000);

    expect(buildTimerSwarmLayout(calm.swarmSpreadMultiplier)).toHaveLength(TIMER_SWARM_COUNT);
    expect(buildTimerSwarmLayout(pounding.swarmSpreadMultiplier)).toHaveLength(TIMER_SWARM_COUNT);
    expect(pounding.swarmSpreadMultiplier).toBeGreaterThan(calm.swarmSpreadMultiplier);
  });
});