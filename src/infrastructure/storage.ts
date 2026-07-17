import { getActiveElapsedMs, segmentPlannedMs } from "../domain/timer";
import type {
  CompletedState,
  PausedState,
  PreparingState,
  RunningState,
  Segment,
  WorkshopState,
} from "../domain/types";
import { validatePlan } from "../domain/validation";

export const STORAGE_KEY = "workshop-timer:state:v1";
const PROBE_KEY = "workshop-timer:capability-probe:v1";
const SNAPSHOT_VERSION = 1;

export interface StorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

export type PersistenceErrorCode =
  | "storage-unavailable"
  | "write-failed"
  | "invalid-snapshot"
  | "invalid-state"
  | "invalid-time"
  | "reset-not-confirmed";

export interface PersistenceError {
  readonly code: PersistenceErrorCode;
  readonly message: string;
  readonly action?: "pause-and-retry" | "confirm-reset";
  readonly raw?: string;
}

export type PersistenceResult =
  | { readonly ok: true }
  | { readonly ok: false; readonly error: PersistenceError };

export type LoadResult =
  | { readonly ok: true; readonly kind: "empty" }
  | { readonly ok: true; readonly kind: "loaded"; readonly state: WorkshopState }
  | { readonly ok: false; readonly error: PersistenceError };

export type CommitResult =
  | { readonly ok: true; readonly state: WorkshopState }
  | {
      readonly ok: false;
      readonly state: WorkshopState;
      readonly error: PersistenceError;
    };

type PortableLiveState = {
  readonly status: "running" | "paused";
  readonly segments: readonly Segment[];
  readonly currentSegmentIndex: number;
  readonly completedActualMs: readonly number[];
  readonly currentAccumulatedMs: number;
};

type PortableState = PreparingState | PortableLiveState | CompletedState;

interface Snapshot {
  readonly version: typeof SNAPSHOT_VERSION;
  readonly state: PortableState;
}

export function probeStorage(storage: StorageLike): PersistenceResult {
  try {
    storage.setItem(PROBE_KEY, "1");
    storage.removeItem(PROBE_KEY);
    return { ok: true };
  } catch {
    return failed(
      "storage-unavailable",
      "Browser storage is unavailable. The workshop cannot start safely.",
    );
  }
}

export function saveWorkshopState(
  storage: StorageLike,
  state: WorkshopState,
  nowMs: number,
): PersistenceResult {
  const portable = toPortableState(state, nowMs);
  if (!portable.ok) return portable;

  const snapshot: Snapshot = { version: SNAPSHOT_VERSION, state: portable.state };
  try {
    storage.setItem(STORAGE_KEY, JSON.stringify(snapshot));
    return { ok: true };
  } catch {
    return failed(
      "write-failed",
      "Progress could not be saved. Pause the workshop and retry before continuing.",
      "pause-and-retry",
    );
  }
}

export function loadWorkshopState(
  storage: StorageLike,
  nowMs: number,
): LoadResult {
  let raw: string | null;
  try {
    raw = storage.getItem(STORAGE_KEY);
  } catch {
    return failed(
      "storage-unavailable",
      "Saved workshop data cannot be accessed in this browser.",
    );
  }

  if (raw === null) return { ok: true, kind: "empty" };
  if (!isFiniteNonNegative(nowMs)) {
    return failed("invalid-time", "The recovery clock must be finite and monotonic.");
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return invalidSnapshot(raw);
  }

  if (!isSnapshot(parsed)) return invalidSnapshot(raw);
  const hydrated = hydrate(parsed.state, nowMs);
  return hydrated === undefined
    ? invalidSnapshot(raw)
    : { ok: true, kind: "loaded", state: hydrated };
}

export function resetStoredWorkshop(
  storage: StorageLike,
  confirmed: boolean,
): PersistenceResult {
  if (!confirmed) {
    return failed(
      "reset-not-confirmed",
      "Confirm reset before removing incompatible saved data.",
      "confirm-reset",
    );
  }
  try {
    storage.removeItem(STORAGE_KEY);
    return { ok: true };
  } catch {
    return failed(
      "write-failed",
      "The saved workshop could not be reset.",
      "pause-and-retry",
    );
  }
}

export function commitWorkshopState(
  storage: StorageLike,
  priorState: WorkshopState,
  candidateState: WorkshopState,
  nowMs: number,
): CommitResult {
  const saved = saveWorkshopState(storage, candidateState, nowMs);
  return saved.ok
    ? { ok: true, state: candidateState }
    : { ok: false, state: priorState, error: saved.error };
}

export function checkpointWorkshop(
  storage: StorageLike,
  state: WorkshopState,
  nowMs: number,
): CommitResult {
  if (state.status !== "running") {
    return commitWorkshopState(storage, state, state, nowMs);
  }

  let elapsed: number;
  try {
    elapsed = getActiveElapsedMs(state, nowMs);
  } catch {
    return {
      ok: false,
      state,
      error: {
        code: "invalid-time",
        message: "The checkpoint clock must be finite and monotonic.",
      },
    };
  }

  const settled: RunningState = {
    ...state,
    currentAccumulatedMs: elapsed,
    runStartedAtMs: nowMs,
  };
  return commitWorkshopState(storage, state, settled, nowMs);
}

function toPortableState(
  state: WorkshopState,
  nowMs: number,
):
  | { readonly ok: true; readonly state: PortableState }
  | { readonly ok: false; readonly error: PersistenceError } {
  if (!isValidWorkshopState(state)) {
    return failed("invalid-state", "The workshop state is not safe to persist.");
  }
  if (state.status !== "running") return { ok: true, state };

  try {
    return {
      ok: true,
      state: {
        status: "running",
        segments: state.segments,
        currentSegmentIndex: state.currentSegmentIndex,
        completedActualMs: state.completedActualMs,
        currentAccumulatedMs: getActiveElapsedMs(state, nowMs),
      },
    };
  } catch {
    return failed("invalid-time", "The persistence clock must be finite and monotonic.");
  }
}

function hydrate(state: PortableState, nowMs: number): WorkshopState | undefined {
  if (state.status === "preparing" || state.status === "completed") return state;
  return {
    ...state,
    status: "paused",
    pausedAtMs: nowMs,
  } satisfies PausedState;
}

function isSnapshot(value: unknown): value is Snapshot {
  if (!isRecord(value) || value.version !== SNAPSHOT_VERSION) return false;
  return isPortableState(value.state);
}

function isPortableState(value: unknown): value is PortableState {
  if (!isRecord(value) || typeof value.status !== "string") return false;
  if (value.status === "preparing") {
    return isSegments(value.segments, false);
  }
  if (value.status === "running" || value.status === "paused") {
    return isPortableLiveState(value);
  }
  if (value.status === "completed") {
    return isCompletedState(value);
  }
  return false;
}

function isPortableLiveState(value: unknown): value is PortableLiveState {
  if (!isRecord(value)) return false;
  if (!isSegments(value.segments, true)) return false;
  if (!Number.isInteger(value.currentSegmentIndex)) return false;
  const currentIndex = value.currentSegmentIndex as number;
  if (currentIndex < 0 || currentIndex >= value.segments.length) return false;
  if (!isDurationArray(value.completedActualMs)) return false;
  if (value.completedActualMs.length !== currentIndex) return false;
  return isFiniteNonNegative(value.currentAccumulatedMs);
}

function isCompletedState(value: unknown): value is CompletedState {
  if (!isRecord(value)) return false;
  if (!isSegments(value.segments, true) || !isRecord(value.summary)) return false;
  return isSummary(value.summary, value.segments);
}

function isSummary(value: Record<string, unknown>, segments: readonly Segment[]): boolean {
  if (!Array.isArray(value.segments) || value.segments.length !== segments.length) return false;

  let plannedTotalMs = 0;
  let actualTotalMs = 0;
  let varianceTotalMs = 0;
  for (let index = 0; index < segments.length; index += 1) {
    const item = value.segments[index];
    const segment = segments[index];
    if (!isRecord(item) || segment === undefined) return false;
    const plannedMs = segmentPlannedMs(segment);
    if (
      item.segmentId !== segment.id ||
      item.name !== segment.name ||
      item.plannedMs !== plannedMs ||
      !isFiniteNonNegative(item.actualMs) ||
      item.varianceMs !== item.actualMs - plannedMs
    ) {
      return false;
    }
    plannedTotalMs += plannedMs;
    actualTotalMs += item.actualMs;
    varianceTotalMs += item.varianceMs;
  }

  return (
    value.plannedTotalMs === plannedTotalMs &&
    value.actualTotalMs === actualTotalMs &&
    value.varianceTotalMs === varianceTotalMs
  );
}

function isSegments(value: unknown, requireValidPlan: boolean): value is readonly Segment[] {
  if (!Array.isArray(value)) return false;
  const shapeIsValid = value.every(
    (segment) =>
      isRecord(segment) &&
      typeof segment.id === "string" &&
      typeof segment.name === "string" &&
      typeof segment.durationMinutes === "number" &&
      Number.isFinite(segment.durationMinutes),
  );
  if (!shapeIsValid) return false;
  return !requireValidPlan || validatePlan(value as Segment[]).length === 0;
}

function isValidWorkshopState(state: WorkshopState): boolean {
  if (state.status === "preparing") return isSegments(state.segments, false);
  if (state.status === "completed") return isCompletedState(state);
  return (
    isPortableLiveState(state) &&
    (state.status === "paused"
      ? isFiniteNonNegative(state.pausedAtMs)
      : isFiniteNonNegative(state.runStartedAtMs))
  );
}

function isDurationArray(value: unknown): value is readonly number[] {
  return Array.isArray(value) && value.every(isFiniteNonNegative);
}

function isFiniteNonNegative(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value) && value >= 0;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function invalidSnapshot(raw: string): LoadResult {
  return failed(
    "invalid-snapshot",
    "Saved workshop data is incompatible. Confirm reset to start over.",
    "confirm-reset",
    raw,
  );
}

function failed(
  code: PersistenceErrorCode,
  message: string,
  action?: PersistenceError["action"],
  raw?: string,
): { readonly ok: false; readonly error: PersistenceError } {
  return {
    ok: false,
    error: {
      code,
      message,
      ...(action === undefined ? {} : { action }),
      ...(raw === undefined ? {} : { raw }),
    },
  };
}
