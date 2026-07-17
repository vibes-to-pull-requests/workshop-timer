import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import type { CompletedState } from "../domain/types";
import SummaryView from "./SummaryView";

const completed: CompletedState = {
  status: "completed",
  segments: [
    { id: "intro", name: "Introduction", durationMinutes: 10 },
    { id: "lesson", name: "Lesson", durationMinutes: 20 },
  ],
  summary: {
    segments: [
      { segmentId: "intro", name: "Introduction", plannedMs: 600_000, actualMs: 720_000, varianceMs: 120_000 },
      { segmentId: "lesson", name: "Lesson", plannedMs: 1_200_000, actualMs: 1_080_000, varianceMs: -120_000 },
    ],
    plannedTotalMs: 1_800_000,
    actualTotalMs: 1_800_000,
    varianceTotalMs: 0,
  },
};

describe("SummaryView", () => {
  it("reports every segment in plan order with planned, actual, and explicit variance labels", () => {
    render(<SummaryView state={completed} onNewPlan={vi.fn()} />);

    const rows = screen.getAllByRole("row");
    expect(rows).toHaveLength(4);
    expect(within(rows[1]!).getByText("Introduction")).toBeInTheDocument();
    expect(within(rows[1]!).getByText("02:00 overtime")).toBeInTheDocument();
    expect(within(rows[2]!).getByText("Lesson")).toBeInTheDocument();
    expect(within(rows[2]!).getByText("02:00 under plan")).toBeInTheDocument();
    expect(within(rows[3]!).getByText("On plan")).toBeInTheDocument();
  });

  it("confirms replacement and preserves the summary when cancelled", async () => {
    const user = userEvent.setup();
    const onNewPlan = vi.fn();
    render(<SummaryView state={completed} onNewPlan={onNewPlan} />);

    const trigger = screen.getByRole("button", { name: "New plan" });
    await user.click(trigger);
    expect(screen.getByRole("dialog", { name: "Start a new plan?" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Keep summary" })).toHaveFocus();
    await user.tab({ shift: true });
    expect(screen.getByRole("button", { name: "Start new plan" })).toHaveFocus();
    await user.tab();
    expect(screen.getByRole("button", { name: "Keep summary" })).toHaveFocus();
    await user.click(screen.getByRole("button", { name: "Keep summary" }));
    expect(onNewPlan).not.toHaveBeenCalled();
    expect(trigger).toHaveFocus();

    await user.click(trigger);
    await user.click(screen.getByRole("button", { name: "Start new plan" }));
    expect(onNewPlan).toHaveBeenCalledOnce();
  });
});
