import type { Segment } from "./types";

export type PlanValidationField = "plan" | "id" | "name" | "durationMinutes";

export type PlanValidationCode =
  | "empty-plan"
  | "blank-id"
  | "duplicate-id"
  | "blank-name"
  | "invalid-duration";

export interface PlanValidationError {
  readonly segmentIndex?: number;
  readonly field: PlanValidationField;
  readonly code: PlanValidationCode;
  readonly message: string;
}

export function validatePlan(segments: readonly Segment[]): PlanValidationError[] {
  if (segments.length === 0) {
    return [
      {
        field: "plan",
        code: "empty-plan",
        message: "Add at least one segment before starting.",
      },
    ];
  }

  const errors: PlanValidationError[] = [];
  const seenIds = new Set<string>();

  segments.forEach((segment, segmentIndex) => {
    const id = segment.id.trim();
    if (id.length === 0) {
      errors.push({
        segmentIndex,
        field: "id",
        code: "blank-id",
        message: "Each segment needs a stable ID.",
      });
    } else if (seenIds.has(id)) {
      errors.push({
        segmentIndex,
        field: "id",
        code: "duplicate-id",
        message: "Each segment ID must be unique.",
      });
    } else {
      seenIds.add(id);
    }

    if (segment.name.trim().length === 0) {
      errors.push({
        segmentIndex,
        field: "name",
        code: "blank-name",
        message: "Enter a segment name.",
      });
    }

    if (
      !Number.isFinite(segment.durationMinutes) ||
      !Number.isInteger(segment.durationMinutes) ||
      segment.durationMinutes <= 0
    ) {
      errors.push({
        segmentIndex,
        field: "durationMinutes",
        code: "invalid-duration",
        message: "Duration must be a positive whole number of minutes.",
      });
    }
  });

  return errors;
}

export function isPlanValid(segments: readonly Segment[]): boolean {
  return validatePlan(segments).length === 0;
}

export function normalizePlan(segments: readonly Segment[]): Segment[] {
  return segments.map((segment) => ({
    ...segment,
    id: segment.id.trim(),
    name: segment.name.trim(),
    facilitator: (segment.facilitator ?? "").trim(),
  }));
}
