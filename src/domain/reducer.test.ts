import { describe, expect, it } from "vitest";

import { createPreparingState, transition } from "./reducer";
import type { Segment, WorkshopState } from "./types";

const segments: Segment[] = [
  { id: "intro", name: "  Introduction  ", durationMinutes: 30 },
  { id: "lesson", name: "Lesson", durationMinutes: 60 },
];

const apply = (state: WorkshopState, event: Parameters<typeof transition>[1]): WorkshopState => {
  const result = transition(state, event);
  expect(result.ok).toBe(true);
  if (!result.ok) throw new Error(result.error.message);
  return result.state;
};

describe("workshop transitions", () => {
  it("starts a valid plan at its first segment and normalizes names", () => {
    const result = transition(createPreparingState(segments), { type: "start", nowMs: 100 });

    expect(result).toEqual({
      ok: true,
      state: expect.objectContaining({
        status: "running",
        currentSegmentIndex: 0,
        currentAccumulatedMs: 0,
        runStartedAtMs: 100,
        segments: [
          expect.objectContaining({ name: "Introduction" }),
          expect.objectContaining({ name: "Lesson" }),
        ],
      }),
    });
  });

  it("rejects invalid plans without changing the original state", () => {
    const state = createPreparingState([{ id: "bad", name: " ", durationMinutes: 0 }]);
    const result = transition(state, { type: "start", nowMs: 0 });

    expect(result).toEqual(expect.objectContaining({ ok: false, state }));
    expect(state.status).toBe("preparing");
  });

  it("allows preparation edits but keeps the plan fixed after start", () => {
    const preparing = createPreparingState(segments);
    const editedSegments = [
      ...segments,
      { id: "close", name: "Close", durationMinutes: 10 },
    ];
    const edited = apply(preparing, { type: "set-plan", segments: editedSegments });
    expect(edited).toEqual(expect.objectContaining({ status: "preparing", segments: editedSegments }));

    const running = apply(edited, { type: "start", nowMs: 0 });
    expect(transition(running, { type: "set-plan", segments })).toEqual(
      expect.objectContaining({ ok: false, state: running }),
    );
  });

  it("pauses and resumes without counting paused time", () => {
    let state = apply(createPreparingState(segments), { type: "start", nowMs: 1_000 });
    state = apply(state, { type: "pause", nowMs: 12 * 60_000 + 1_000 });
    state = apply(state, { type: "resume", nowMs: 15 * 60_000 + 1_000 });
    state = apply(state, { type: "next", nowMs: 20 * 60_000 + 1_000 });

    expect(state).toEqual(
      expect.objectContaining({
        status: "running",
        currentSegmentIndex: 1,
        completedActualMs: [17 * 60_000],
        runStartedAtMs: 20 * 60_000 + 1_000,
      }),
    );
  });

  it("advances from paused using only accumulated active time", () => {
    let state = apply(createPreparingState(segments), { type: "start", nowMs: 0 });
    state = apply(state, { type: "pause", nowMs: 5_000 });
    state = apply(state, { type: "next", nowMs: 50_000 });

    expect(state).toEqual(
      expect.objectContaining({
        status: "running",
        currentSegmentIndex: 1,
        completedActualMs: [5_000],
        currentAccumulatedMs: 0,
        runStartedAtMs: 50_000,
      }),
    );
  });

  it("finishes the last segment with per-segment and total signed variance", () => {
    let state = apply(createPreparingState(segments), { type: "start", nowMs: 0 });
    state = apply(state, { type: "next", nowMs: 31 * 60_000 });
    state = apply(state, { type: "pause", nowMs: 90 * 60_000 });
    state = apply(state, { type: "finish", nowMs: 100 * 60_000 });

    expect(state).toEqual({
      status: "completed",
      segments: [
        { id: "intro", name: "Introduction", durationMinutes: 30 },
        { id: "lesson", name: "Lesson", durationMinutes: 60 },
      ],
      summary: {
        segments: [
          expect.objectContaining({ plannedMs: 30 * 60_000, actualMs: 31 * 60_000, varianceMs: 60_000 }),
          expect.objectContaining({ plannedMs: 60 * 60_000, actualMs: 59 * 60_000, varianceMs: -60_000 }),
        ],
        plannedTotalMs: 90 * 60_000,
        actualTotalMs: 90 * 60_000,
        varianceTotalMs: 0,
      },
    });
  });

  it("rejects invalid events and non-monotonic timestamps without corrupting state", () => {
    const preparing = createPreparingState(segments);
    expect(transition(preparing, { type: "pause", nowMs: 0 })).toEqual(
      expect.objectContaining({ ok: false, state: preparing }),
    );

    const running = apply(preparing, { type: "start", nowMs: 100 });
    expect(transition(running, { type: "resume", nowMs: 200 })).toEqual(
      expect.objectContaining({ ok: false, state: running }),
    );
    expect(transition(running, { type: "pause", nowMs: 99 })).toEqual(
      expect.objectContaining({ ok: false, state: running }),
    );
    expect(transition(running, { type: "finish", nowMs: 200 })).toEqual(
      expect.objectContaining({ ok: false, state: running }),
    );
  });
});
