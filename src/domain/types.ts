export interface Segment {
  readonly id: string;
  readonly name: string;
  readonly durationMinutes: number;
}

interface ActiveWorkshopState {
  readonly segments: readonly Segment[];
  readonly currentSegmentIndex: number;
  readonly completedActualMs: readonly number[];
  readonly currentAccumulatedMs: number;
}

export interface PreparingState {
  readonly status: "preparing";
  readonly segments: readonly Segment[];
}

export interface RunningState extends ActiveWorkshopState {
  readonly status: "running";
  readonly runStartedAtMs: number;
}

export interface PausedState extends ActiveWorkshopState {
  readonly status: "paused";
  readonly pausedAtMs: number;
}

export interface SegmentSummary {
  readonly segmentId: string;
  readonly name: string;
  readonly plannedMs: number;
  readonly actualMs: number;
  readonly varianceMs: number;
}

export interface WorkshopSummary {
  readonly segments: readonly SegmentSummary[];
  readonly plannedTotalMs: number;
  readonly actualTotalMs: number;
  readonly varianceTotalMs: number;
}

export interface CompletedState {
  readonly status: "completed";
  readonly segments: readonly Segment[];
  readonly summary: WorkshopSummary;
}

export type LiveWorkshopState = RunningState | PausedState;

export type WorkshopState = PreparingState | LiveWorkshopState | CompletedState;

export type DomainEvent =
  | { readonly type: "set-plan"; readonly segments: readonly Segment[] }
  | { readonly type: "start"; readonly nowMs: number }
  | { readonly type: "pause"; readonly nowMs: number }
  | { readonly type: "resume"; readonly nowMs: number }
  | { readonly type: "next"; readonly nowMs: number }
  | { readonly type: "finish"; readonly nowMs: number };

export type TransitionErrorCode =
  | "invalid-event"
  | "invalid-plan"
  | "invalid-time";

export interface TransitionError {
  readonly code: TransitionErrorCode;
  readonly message: string;
}

export type TransitionResult =
  | { readonly ok: true; readonly state: WorkshopState }
  | {
      readonly ok: false;
      readonly state: WorkshopState;
      readonly error: TransitionError;
    };
