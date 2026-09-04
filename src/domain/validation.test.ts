import { describe, expect, it } from "vitest";

import { isPlanValid, validatePlan } from "./validation";
import type { Segment } from "./types";

const segment = (overrides: Partial<Segment> = {}): Segment => ({
  id: "segment-1",
  name: "Introduction",
  facilitator: "",
  durationMinutes: 30,
  ...overrides,
});

describe("validatePlan", () => {
  it("accepts duplicate names and valid positive whole-minute durations", () => {
    const plan = [segment(), segment({ id: "segment-2" })];

    expect(validatePlan(plan)).toEqual([]);
    expect(isPlanValid(plan)).toBe(true);
  });

  it.each([
    ["empty plan", [], "plan", "empty-plan"],
    ["blank name", [segment({ name: "   " })], "name", "blank-name"],
    ["zero duration", [segment({ durationMinutes: 0 })], "durationMinutes", "invalid-duration"],
    ["negative duration", [segment({ durationMinutes: -5 })], "durationMinutes", "invalid-duration"],
    ["fractional duration", [segment({ durationMinutes: 2.5 })], "durationMinutes", "invalid-duration"],
  ] as const)("rejects an %s", (_label, plan, field, code) => {
    expect(validatePlan(plan)).toEqual(
      expect.arrayContaining([expect.objectContaining({ field, code })]),
    );
    expect(isPlanValid(plan)).toBe(false);
  });

  it("rejects invalid music links stored on a segment", () => {
    const errors = validatePlan([
      segment({
        music: { provider: "youtube", url: "https://example.com/not-music" },
      }),
    ]);

    expect(errors).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ field: "music", code: "invalid-music" }),
      ]),
    );
  });

  it("rejects missing and duplicate stable IDs", () => {
    const errors = validatePlan([
      segment({ id: " " }),
      segment({ id: "repeated" }),
      segment({ id: "repeated" }),
    ]);

    expect(errors).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ segmentIndex: 0, field: "id", code: "blank-id" }),
        expect.objectContaining({ segmentIndex: 2, field: "id", code: "duplicate-id" }),
      ]),
    );
  });
});
