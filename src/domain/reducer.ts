import { getActiveElapsedMs, segmentPlannedMs } from "./timer";
import type {
  CompletedState,
  DomainEvent,
  LiveWorkshopState,
  PreparingState,
  Segment,
  TransitionErrorCode,
  TransitionResult,
  WorkshopState,
  WorkshopSummary,
} from "./types";
import { normalizePlan, validatePlan } from "./validation";

export function createPreparingState(
  segments: readonly Segment[] = [],
): PreparingState {
  return { status: "preparing", segments: clonePlan(segments) };
}

export function transition(
  state: WorkshopState,
  event: DomainEvent,
): TransitionResult {
  switch (event.type) {
    case "set-plan":
      if (state.status !== "preparing") {
        return rejected(state, "invalid-event", "A live or completed plan is fixed.");
      }
      return accepted(createPreparingState(event.segments));

    case "start": {
      if (state.status !== "preparing") {
        return rejected(state, "invalid-event", "Only a prepared plan can start.");
      }
      const errors = validatePlan(state.segments);
      if (errors.length > 0) {
        return rejected(state, "invalid-plan", errors[0]?.message ?? "The plan is invalid.");
      }
      if (!isValidNow(event.nowMs)) return invalidTime(state);
      return accepted({
        status: "running",
        segments: normalizePlan(state.segments),
        currentSegmentIndex: 0,
        completedActualMs: [],
        currentAccumulatedMs: 0,
        runStartedAtMs: event.nowMs,
      });
    }

    case "pause": {
      if (state.status !== "running") {
        return rejected(state, "invalid-event", "Only a running segment can pause.");
      }
      const elapsed = settledElapsed(state, event.nowMs);
      if (elapsed === undefined) return invalidTime(state);
      return accepted({
        ...withoutTemporalAnchor(state),
        status: "paused",
        currentAccumulatedMs: elapsed,
        pausedAtMs: event.nowMs,
      });
    }

    case "resume":
      if (state.status !== "paused") {
        return rejected(state, "invalid-event", "Only a paused segment can resume.");
      }
      if (!isValidNow(event.nowMs) || event.nowMs < state.pausedAtMs) {
        return invalidTime(state);
      }
      return accepted({
        ...withoutTemporalAnchor(state),
        status: "running",
        runStartedAtMs: event.nowMs,
      });

    case "next": {
      if (!isLive(state)) {
        return rejected(state, "invalid-event", "Only a live segment can advance.");
      }
      if (state.currentSegmentIndex >= state.segments.length - 1) {
        return rejected(state, "invalid-event", "The final segment must be finished.");
      }
      const elapsed = settledElapsed(state, event.nowMs);
      if (elapsed === undefined) return invalidTime(state);
      return accepted({
        status: "running",
        segments: state.segments,
        currentSegmentIndex: state.currentSegmentIndex + 1,
        completedActualMs: [...state.completedActualMs, elapsed],
        currentAccumulatedMs: 0,
        runStartedAtMs: event.nowMs,
      });
    }

    case "finish": {
      if (!isLive(state)) {
        return rejected(state, "invalid-event", "Only a live workshop can finish.");
      }
      if (state.currentSegmentIndex !== state.segments.length - 1) {
        return rejected(state, "invalid-event", "Advance to the final segment before finishing.");
      }
      const elapsed = settledElapsed(state, event.nowMs);
      if (elapsed === undefined) return invalidTime(state);
      return accepted(completeWorkshop(state, elapsed));
    }
  }
}

function completeWorkshop(
  state: LiveWorkshopState,
  currentActualMs: number,
): CompletedState {
  const actualDurations = [...state.completedActualMs, currentActualMs];
  const summarySegments = state.segments.map((segment, index) => {
    const plannedMs = segmentPlannedMs(segment);
    const actualMs = actualDurations[index] ?? 0;
    return {
      segmentId: segment.id,
      name: segment.name,
      plannedMs,
      actualMs,
      varianceMs: actualMs - plannedMs,
    };
  });
  const summary: WorkshopSummary = {
    segments: summarySegments,
    plannedTotalMs: summarySegments.reduce((total, item) => total + item.plannedMs, 0),
    actualTotalMs: summarySegments.reduce((total, item) => total + item.actualMs, 0),
    varianceTotalMs: summarySegments.reduce((total, item) => total + item.varianceMs, 0),
  };
  return { status: "completed", segments: state.segments, summary };
}

function settledElapsed(state: LiveWorkshopState, nowMs: number): number | undefined {
  if (!isValidNow(nowMs)) return undefined;
  if (state.status === "paused") {
    return nowMs < state.pausedAtMs ? undefined : state.currentAccumulatedMs;
  }
  try {
    return getActiveElapsedMs(state, nowMs);
  } catch {
    return undefined;
  }
}

function isLive(state: WorkshopState): state is LiveWorkshopState {
  return state.status === "running" || state.status === "paused";
}

function isValidNow(nowMs: number): boolean {
  return Number.isFinite(nowMs) && nowMs >= 0;
}

function withoutTemporalAnchor(state: LiveWorkshopState) {
  return {
    segments: state.segments,
    currentSegmentIndex: state.currentSegmentIndex,
    completedActualMs: state.completedActualMs,
    currentAccumulatedMs: state.currentAccumulatedMs,
  };
}

function clonePlan(segments: readonly Segment[]): Segment[] {
  return segments.map((segment) => ({ ...segment }));
}

function accepted(state: WorkshopState): TransitionResult {
  return { ok: true, state };
}

function rejected(
  state: WorkshopState,
  code: TransitionErrorCode,
  message: string,
): TransitionResult {
  return { ok: false, state, error: { code, message } };
}

function invalidTime(state: WorkshopState): TransitionResult {
  return rejected(state, "invalid-time", "The clock value must be finite and monotonic.");
}
