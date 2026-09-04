import { describe, expect, it } from "vitest";

import {
  getActiveElapsedMs,
  getRemainingMs,
  getRemainingProportion,
  getTimerTone,
  getOvertimeMs,
  formatTimerValue,
  formatSignedDuration,
} from "./timer";
import type { RunningState } from "./types";

const runningState = (durationMinutes: number): RunningState => ({
  status: "running",
  segments: [{ id: "one", name: "Lesson", facilitator: "", durationMinutes }],
  currentSegmentIndex: 0,
  completedActualMs: [],
  currentAccumulatedMs: 0,
  runStartedAtMs: 1_000,
});

describe("timer selectors", () => {
  it("derives elapsed time from timestamps instead of repaint counts", () => {
    const state = runningState(60);

    expect(getActiveElapsedMs(state, 2_001)).toBe(1_001);
    expect(getActiveElapsedMs(state, 11_001)).toBe(10_001);
  });

  it.each([
    [60, 15 * 60_000, "orange"],
    [60, 6 * 60_000, "red"],
    [10, 2.5 * 60_000, "orange"],
    [10, 60_000, "red"],
  ] as const)(
    "uses exact proportional boundaries for a %i-minute segment with %i ms left",
    (durationMinutes, remainingMs, expectedTone) => {
      const state = runningState(durationMinutes);
      const nowMs = state.runStartedAtMs + durationMinutes * 60_000 - remainingMs;

      expect(getTimerTone(state, nowMs)).toBe(expectedTone);
    },
  );

  it("uses unrounded seconds around warning thresholds", () => {
    const state = runningState(10);

    expect(getTimerTone(state, 1_000 + 449_999)).toBe("neutral");
    expect(getTimerTone(state, 1_000 + 450_000)).toBe("orange");
    expect(getTimerTone(state, 1_000 + 539_999)).toBe("orange");
    expect(getTimerTone(state, 1_000 + 540_000)).toBe("red");
  });

  it("stays on the segment at zero and derives increasing overtime below zero", () => {
    const state = runningState(1);

    expect(getRemainingMs(state, 61_000)).toBe(0);
    expect(getTimerTone(state, 61_000)).toBe("red");
    expect(getOvertimeMs(state, 61_000)).toBe(0);
    expect(getRemainingMs(state, 63_500)).toBe(-2_500);
    expect(getTimerTone(state, 63_500)).toBe("overtime");
    expect(getOvertimeMs(state, 63_500)).toBe(2_500);
    expect(getRemainingProportion(state, 63_500)).toBe(0);
  });
});

describe("timer formatting", () => {
  it("formats countdowns as MM:SS or H:MM:SS and does not show zero early", () => {
    expect(formatTimerValue(90_001)).toBe("01:31");
    expect(formatTimerValue(60_000)).toBe("01:00");
    expect(formatTimerValue(0)).toBe("00:00");
    expect(formatTimerValue(3_661_000)).toBe("1:01:01");
  });

  it("formats overtime and signed variance explicitly", () => {
    expect(formatTimerValue(-1_500)).toBe("+00:01");
    expect(formatSignedDuration(61_000)).toBe("+01:01");
    expect(formatSignedDuration(-61_000)).toBe("-01:01");
    expect(formatSignedDuration(0)).toBe("00:00");
  });
});
