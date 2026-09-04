import { describe, expect, it } from "vitest";

import { createPreparingState, transition } from "../domain/reducer";
import type { CompletedState, RunningState, Segment } from "../domain/types";
import {
  STORAGE_KEY,
  checkpointWorkshop,
  commitWorkshopState,
  loadWorkshopState,
  probeStorage,
  resetStoredWorkshop,
  saveWorkshopState,
  type StorageLike,
} from "./storage";

const segments: Segment[] = [
  { id: "intro", name: "Introduction", facilitator: "", durationMinutes: 30 },
  { id: "lesson", name: "Lesson", facilitator: "", durationMinutes: 60 },
];

class MemoryStorage implements StorageLike {
  readonly values = new Map<string, string>();
  failReads = false;
  failWrites = false;

  getItem(key: string): string | null {
    if (this.failReads) throw new DOMException("Storage unavailable", "SecurityError");
    return this.values.get(key) ?? null;
  }

  setItem(key: string, value: string): void {
    if (this.failWrites) throw new DOMException("Quota exceeded", "QuotaExceededError");
    this.values.set(key, value);
  }

  removeItem(key: string): void {
    if (this.failWrites) throw new DOMException("Storage unavailable", "SecurityError");
    this.values.delete(key);
  }
}

function start(nowMs = 0): RunningState {
  const result = transition(createPreparingState(segments), { type: "start", nowMs });
  if (!result.ok || result.state.status !== "running") throw new Error("Expected running state");
  return result.state;
}

function finishWorkshop(): CompletedState {
  const advanced = transition(start(), { type: "next", nowMs: 10_000 });
  if (!advanced.ok) throw new Error("Expected next transition");
  const finished = transition(advanced.state, { type: "finish", nowMs: 30_000 });
  if (!finished.ok || finished.state.status !== "completed") throw new Error("Expected completed state");
  return finished.state;
}

describe("storage capability", () => {
  it("probes an unrelated temporary key without changing the application snapshot", () => {
    const storage = new MemoryStorage();
    storage.values.set(STORAGE_KEY, "existing");

    expect(probeStorage(storage)).toEqual({ ok: true });
    expect(storage.values).toEqual(new Map([[STORAGE_KEY, "existing"]]));
  });

  it("returns typed errors when storage access is unavailable", () => {
    const storage = new MemoryStorage();
    storage.failWrites = true;

    expect(probeStorage(storage)).toEqual({
      ok: false,
      error: expect.objectContaining({ code: "storage-unavailable" }),
    });
  });
});

describe("snapshot round trips", () => {
  it("round-trips an unfinished preparation draft and ignores unrelated origin keys", () => {
    const storage = new MemoryStorage();
    const draft = createPreparingState([
      { id: "draft", name: "", facilitator: "", durationMinutes: 0 },
    ]);
    storage.values.set("another-app:key", "leave me alone");

    expect(saveWorkshopState(storage, draft, 100)).toEqual({ ok: true });
    expect(loadWorkshopState(storage, 500)).toEqual({ ok: true, kind: "loaded", state: draft });
    expect(storage.values.get("another-app:key")).toBe("leave me alone");
  });

  it("round-trips completed state with its summary", () => {
    const storage = new MemoryStorage();
    const completed = finishWorkshop();

    expect(saveWorkshopState(storage, completed, 100)).toEqual({ ok: true });
    expect(loadWorkshopState(storage, 500)).toEqual({ ok: true, kind: "loaded", state: completed });
  });

  it("hydrates running and paused snapshots as paused without adding closed time", () => {
    const runningStorage = new MemoryStorage();
    expect(saveWorkshopState(runningStorage, start(1_000), 11_000)).toEqual({ ok: true });
    expect(loadWorkshopState(runningStorage, 9_999_999)).toEqual({
      ok: true,
      kind: "loaded",
      state: expect.objectContaining({
        status: "paused",
        currentAccumulatedMs: 10_000,
        pausedAtMs: 9_999_999,
      }),
    });

    const pausedResult = transition(start(1_000), { type: "pause", nowMs: 7_000 });
    if (!pausedResult.ok) throw new Error("Expected pause transition");
    const pausedStorage = new MemoryStorage();
    expect(saveWorkshopState(pausedStorage, pausedResult.state, 50_000)).toEqual({ ok: true });
    expect(loadWorkshopState(pausedStorage, 80_000)).toEqual({
      ok: true,
      kind: "loaded",
      state: expect.objectContaining({ status: "paused", currentAccumulatedMs: 6_000, pausedAtMs: 80_000 }),
    });
  });
});

describe("checkpoint and atomic publication", () => {
  it("settles a running checkpoint once at the supplied monotonic time", () => {
    const storage = new MemoryStorage();
    const running = start(1_000);

    const first = checkpointWorkshop(storage, running, 6_000);
    expect(first).toEqual({
      ok: true,
      state: expect.objectContaining({
        status: "running",
        currentAccumulatedMs: 5_000,
        runStartedAtMs: 6_000,
      }),
    });
    if (!first.ok) throw new Error("Expected checkpoint");

    const second = checkpointWorkshop(storage, first.state, 8_000);
    expect(second).toEqual({
      ok: true,
      state: expect.objectContaining({ currentAccumulatedMs: 7_000, runStartedAtMs: 8_000 }),
    });
    expect(loadWorkshopState(storage, 100_000)).toEqual({
      ok: true,
      kind: "loaded",
      state: expect.objectContaining({ status: "paused", currentAccumulatedMs: 7_000 }),
    });
  });

  it("leaves prior memory and durable state unchanged when a checkpoint write fails", () => {
    const storage = new MemoryStorage();
    const running = start(1_000);
    expect(saveWorkshopState(storage, running, 2_000)).toEqual({ ok: true });
    const durableBefore = storage.values.get(STORAGE_KEY);
    storage.failWrites = true;

    const result = checkpointWorkshop(storage, running, 6_000);

    expect(result).toEqual({
      ok: false,
      state: running,
      error: expect.objectContaining({ code: "write-failed", action: "pause-and-retry" }),
    });
    expect(storage.values.get(STORAGE_KEY)).toBe(durableBefore);
  });

  it("publishes a candidate state only after its durable write succeeds", () => {
    const storage = new MemoryStorage();
    const prior = createPreparingState(segments);
    const candidate = start(100);
    expect(saveWorkshopState(storage, prior, 100)).toEqual({ ok: true });
    const durableBefore = storage.values.get(STORAGE_KEY);
    storage.failWrites = true;

    expect(commitWorkshopState(storage, prior, candidate, 100)).toEqual({
      ok: false,
      state: prior,
      error: expect.objectContaining({ code: "write-failed", action: "pause-and-retry" }),
    });
    expect(storage.values.get(STORAGE_KEY)).toBe(durableBefore);
  });
});

describe("invalid stored data", () => {
  const invalidPayloads = [
    "not-json",
    JSON.stringify({ version: 2, state: { status: "preparing", segments: [] } }),
    JSON.stringify({ version: 1, state: { status: "running", segments, currentSegmentIndex: 8, completedActualMs: [], currentAccumulatedMs: 0 } }),
    JSON.stringify({ version: 1, state: { status: "running", segments, currentSegmentIndex: 1, completedActualMs: [], currentAccumulatedMs: 0 } }),
    JSON.stringify({ version: 1, state: { status: "paused", segments: [{ id: "bad", name: "Bad", durationMinutes: 0 }], currentSegmentIndex: 0, completedActualMs: [], currentAccumulatedMs: 0 } }),
    JSON.stringify({ version: 1, state: { status: "paused", segments, currentSegmentIndex: 0, completedActualMs: [null], currentAccumulatedMs: 0 } }),
  ];

  it.each(invalidPayloads)("preserves malformed or cross-field-invalid raw data until confirmed reset", (raw) => {
    const storage = new MemoryStorage();
    storage.values.set(STORAGE_KEY, raw);

    expect(loadWorkshopState(storage, 1_000)).toEqual({
      ok: false,
      error: expect.objectContaining({ code: "invalid-snapshot", raw }),
    });
    expect(storage.values.get(STORAGE_KEY)).toBe(raw);
    expect(resetStoredWorkshop(storage, false)).toEqual({ ok: false, error: expect.objectContaining({ code: "reset-not-confirmed" }) });
    expect(storage.values.get(STORAGE_KEY)).toBe(raw);
    expect(resetStoredWorkshop(storage, true)).toEqual({ ok: true });
    expect(storage.values.has(STORAGE_KEY)).toBe(false);
  });

  it("reports read failures without changing stored or in-memory data", () => {
    const storage = new MemoryStorage();
    const raw = JSON.stringify({ version: 1, state: { status: "preparing", segments: [] } });
    storage.values.set(STORAGE_KEY, raw);
    storage.failReads = true;

    expect(loadWorkshopState(storage, 1_000)).toEqual({
      ok: false,
      error: expect.objectContaining({ code: "storage-unavailable" }),
    });
    expect(storage.values.get(STORAGE_KEY)).toBe(raw);
  });
});

describe("empty storage", () => {
  it("reports an empty application slot", () => {
    expect(loadWorkshopState(new MemoryStorage(), 0)).toEqual({ ok: true, kind: "empty" });
  });
});
