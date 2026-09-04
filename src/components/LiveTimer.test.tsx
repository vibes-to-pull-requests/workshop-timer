import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import type { PausedState, RunningState } from "../domain/types";
import LiveTimer from "./LiveTimer";

const running: RunningState = {
  status: "running",
  segments: [
    { id: "one", name: "Lesson one", facilitator: "Alex", durationMinutes: 10 },
    { id: "two", name: "Break", facilitator: "", durationMinutes: 5 },
  ],
  currentSegmentIndex: 0,
  completedActualMs: [],
  currentAccumulatedMs: 0,
  runStartedAtMs: 0,
};

describe("LiveTimer", () => {
  it("keeps the current segment dominant and previews what is next", () => {
    render(<LiveTimer state={running} nowMs={1_000} onPause={vi.fn()} onResume={vi.fn()} onNext={vi.fn()} onFinish={vi.fn()} onNewPlan={vi.fn()} />);

    expect(screen.getByRole("heading", { name: "Lesson one" })).toBeInTheDocument();
    expect(screen.getByText("Facilitator: Alex")).toBeInTheDocument();
    expect(screen.getByTestId("timer-value")).toHaveTextContent("09:59");
    expect(screen.getByText("Break · 5 min")).toBeInTheDocument();
  });

  it.each([
    [449_999, "neutral", "On time"],
    [450_000, "orange", "25% remaining"],
    [540_000, "red", "10% remaining"],
    [600_001, "overtime", "Overtime"],
  ] as const)("shows exact warning boundary at %i ms", (nowMs, tone, label) => {
    render(<LiveTimer state={running} nowMs={nowMs} onPause={vi.fn()} onResume={vi.fn()} onNext={vi.fn()} onFinish={vi.fn()} onNewPlan={vi.fn()} />);
    expect(screen.getByTestId("live-timer")).toHaveAttribute("data-tone", tone);
    expect(screen.getByText(label)).toBeInTheDocument();
  });

  it("freezes and visually prioritizes a paused timer", () => {
    const paused: PausedState = { ...running, status: "paused", currentAccumulatedMs: 550_000, pausedAtMs: 700_000 };
    render(<LiveTimer state={paused} nowMs={999_999} onPause={vi.fn()} onResume={vi.fn()} onNext={vi.fn()} onFinish={vi.fn()} onNewPlan={vi.fn()} />);
    expect(screen.getByTestId("live-timer")).toHaveAttribute("data-tone", "paused");
    expect(screen.getByTestId("timer-value")).toHaveTextContent("00:50");
    expect(screen.getByText("Paused")).toBeInTheDocument();
  });

  it("exposes immediate pause, resume, and next controls", async () => {
    const user = userEvent.setup();
    const onPause = vi.fn();
    const onNext = vi.fn();
    const view = render(<LiveTimer state={running} nowMs={1_000} onPause={onPause} onResume={vi.fn()} onNext={onNext} onFinish={vi.fn()} onNewPlan={vi.fn()} />);

    await user.click(screen.getByRole("button", { name: "Pause" }));
    await user.click(screen.getByRole("button", { name: "Next segment" }));
    expect(onPause).toHaveBeenCalledOnce();
    expect(onNext).toHaveBeenCalledOnce();

    const onResume = vi.fn();
    const paused: PausedState = { ...running, status: "paused", currentAccumulatedMs: 1_000, pausedAtMs: 1_000 };
    view.rerender(<LiveTimer state={paused} nowMs={2_000} onPause={vi.fn()} onResume={onResume} onNext={vi.fn()} onFinish={vi.fn()} onNewPlan={vi.fn()} />);
    await user.click(screen.getByRole("button", { name: "Resume" }));
    expect(onResume).toHaveBeenCalledOnce();
  });

  it("drains its background in proportion to exact remaining time", () => {
    render(<LiveTimer state={running} nowMs={450_000} onPause={vi.fn()} onResume={vi.fn()} onNext={vi.fn()} onFinish={vi.fn()} onNewPlan={vi.fn()} />);
    expect(screen.getByTestId("live-timer")).toHaveStyle({ "--remaining": "25%" });
  });

  it("drives urgency styling from elapsed time", () => {
    render(<LiveTimer state={running} nowMs={0} onPause={vi.fn()} onResume={vi.fn()} onNext={vi.fn()} onFinish={vi.fn()} onNewPlan={vi.fn()} />);

    const liveTimer = screen.getByTestId("live-timer");
    const timerShell = screen.getByTestId("timer-value").closest(".timer-value-shell");
    expect(liveTimer.style.getPropertyValue("--timer-base-scale")).toBe("0.05");
    expect(timerShell).toHaveAttribute("data-urgency-phase", "calm");
    expect(timerShell).toHaveAttribute("data-urgency-animate", "true");
    expect(screen.getAllByText("10:00")).toHaveLength(36);
  });

  it("pauses urgency animation while the timer is paused", () => {
    const paused: PausedState = { ...running, status: "paused", currentAccumulatedMs: 550_000, pausedAtMs: 700_000 };
    render(<LiveTimer state={paused} nowMs={999_999} onPause={vi.fn()} onResume={vi.fn()} onNext={vi.fn()} onFinish={vi.fn()} onNewPlan={vi.fn()} />);

    const timerShell = screen.getByTestId("timer-value").closest(".timer-value-shell");
    expect(timerShell).toHaveAttribute("data-urgency-animate", "false");
  });

  it("shows segment music controls when a segment has a linked soundtrack", async () => {
    const user = userEvent.setup();
    const withMusic = {
      ...running,
      segments: [
        {
          ...running.segments[0],
          music: {
            provider: "youtube" as const,
            url: "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
          },
        },
        running.segments[1],
      ],
    };
    render(
      <LiveTimer
        state={withMusic}
        nowMs={1_000}
        onPause={vi.fn()}
        onResume={vi.fn()}
        onNext={vi.fn()}
        onFinish={vi.fn()}
        onNewPlan={vi.fn()}
      />,
    );

    expect(screen.getByText("YouTube soundtrack")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Play music" }));
    expect(screen.getByTitle("YouTube player for segment")).toBeInTheDocument();
  });

  it("offers Finish on the last segment and confirms destructive actions", async () => {
    const user = userEvent.setup();
    const onFinish = vi.fn();
    const onNewPlan = vi.fn();
    const final = { ...running, currentSegmentIndex: 1, completedActualMs: [600_000] };
    render(<LiveTimer state={final} nowMs={1_000} onPause={vi.fn()} onResume={vi.fn()} onNext={vi.fn()} onFinish={onFinish} onNewPlan={onNewPlan} />);

    await user.click(screen.getByRole("button", { name: "Finish workshop" }));
    expect(screen.getByRole("dialog", { name: "Finish workshop?" })).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Keep timing" }));
    expect(onFinish).not.toHaveBeenCalled();

    await user.click(screen.getByRole("button", { name: "New plan" }));
    await user.click(screen.getByRole("button", { name: "Discard workshop" }));
    expect(onNewPlan).toHaveBeenCalledOnce();
  });
});