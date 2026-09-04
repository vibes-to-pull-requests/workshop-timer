import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import type { Segment } from "../domain/types";
import PlanEditor from "./PlanEditor";

const plan: Segment[] = [
  { id: "intro", name: "Introduction", facilitator: "", durationMinutes: 15 },
  { id: "lesson", name: "Lesson", facilitator: "", durationMinutes: 45 },
];

function setup(segments: readonly Segment[] = plan) {
  const onChange = vi.fn();
  const onStart = vi.fn();
  render(
    <PlanEditor
      segments={segments}
      onChange={onChange}
      onStart={onStart}
      onRetry={vi.fn()}
      createId={() => "new-segment"}
      canPersist
    />,
  );
  return { onChange, onStart, user: userEvent.setup() };
}

describe("PlanEditor", () => {
  it("adds, edits, deletes, and reorders segments with stable IDs", async () => {
    const { onChange, user } = setup();

    await user.click(screen.getByRole("button", { name: "Add segment" }));
    expect(onChange).toHaveBeenLastCalledWith([
      ...plan,
      { id: "new-segment", name: "", facilitator: "", durationMinutes: 0 },
    ]);

    const first = screen.getByTestId("segment-intro");
    await user.clear(within(first).getByLabelText("Segment name"));
    await user.type(within(first).getByLabelText("Segment name"), "Welcome");
    expect(onChange).toHaveBeenLastCalledWith([
      { ...plan[0], name: "Welcome" },
      plan[1],
      { id: "new-segment", name: "", facilitator: "", durationMinutes: 0 },
    ]);

    await user.click(
      within(screen.getByTestId("segment-lesson")).getByRole("button", {
        name: "Move Lesson up",
      }),
    );
    expect(onChange).toHaveBeenLastCalledWith([
      plan[1],
      { ...plan[0], name: "Welcome" },
      { id: "new-segment", name: "", facilitator: "", durationMinutes: 0 },
    ]);

    await user.click(within(first).getByRole("button", { name: "Delete Welcome" }));
    expect(onChange).toHaveBeenLastCalledWith([
      plan[1],
      { id: "new-segment", name: "", facilitator: "", durationMinutes: 0 },
    ]);
  });

  it("shows movement boundaries and the total planned duration", () => {
    setup();

    expect(screen.getByRole("button", { name: "Move Introduction up" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Move Lesson down" })).toBeDisabled();
    expect(screen.getByText("1 hr total")).toBeInTheDocument();
  });

  it.each(["0", "-2", "1.5", "later"])(
    "identifies invalid duration %s and prevents starting",
    async (value) => {
      const { user } = setup([plan[0]]);
      const duration = screen.getByLabelText("Duration in minutes");

      await user.clear(duration);
      await user.type(duration, value);

      expect(screen.getByText("Enter a positive whole number of minutes.")).toBeInTheDocument();
      expect(screen.getByRole("button", { name: "Start workshop" })).toBeDisabled();
    },
  );

  it("identifies blank names and allows duplicate names", async () => {
    const { user } = setup();
    const names = screen.getAllByLabelText("Segment name");

    await user.clear(names[0]!);
    expect(screen.getByText("Enter a segment name.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Start workshop" })).toBeDisabled();

    await user.type(names[0]!, "Lesson");
    expect(screen.getByRole("button", { name: "Start workshop" })).toBeEnabled();
  });

  it("stores facilitator names on segments", async () => {
    const { onChange, user } = setup([plan[0]]);

    await user.type(screen.getByLabelText("Facilitator"), "Alex");

    expect(onChange).toHaveBeenLastCalledWith([
      { ...plan[0], facilitator: "Alex" },
    ]);
  });

  it("accepts optional YouTube and Spotify links per segment", async () => {
    const { onChange, onStart, user } = setup([plan[0]]);
    const music = screen.getByLabelText("Segment music (optional)");

    await user.type(music, "https://www.youtube.com/watch?v=dQw4w9WgXcQ");
    expect(onChange).toHaveBeenLastCalledWith([
      {
        ...plan[0],
        music: {
          provider: "youtube",
          url: "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
        },
      },
    ]);
    expect(screen.getByText("Linked from YouTube.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Start workshop" })).toBeEnabled();

    await user.clear(music);
    await user.type(music, "https://open.spotify.com/track/11dFghVXANMlKmJXsNCbNl");
    expect(onChange).toHaveBeenLastCalledWith([
      {
        ...plan[0],
        music: {
          provider: "spotify",
          url: "https://open.spotify.com/track/11dFghVXANMlKmJXsNCbNl",
        },
      },
    ]);
    await user.click(screen.getByRole("button", { name: "Start workshop" }));
    expect(onStart).toHaveBeenCalledWith([
      {
        ...plan[0],
        music: {
          provider: "spotify",
          url: "https://open.spotify.com/track/11dFghVXANMlKmJXsNCbNl",
        },
      },
    ]);
  });

  it("rejects invalid music links and blocks starting", async () => {
    const { user } = setup([plan[0]]);
    const music = screen.getByLabelText("Segment music (optional)");

    await user.type(music, "https://example.com/not-music");
    expect(screen.getByText("Enter a valid YouTube or Spotify link.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Start workshop" })).toBeDisabled();
  });

  it("blocks Start when durable storage is unavailable", () => {
    render(
      <PlanEditor
        segments={plan}
        onChange={() => undefined}
        onStart={() => undefined}
        onRetry={() => undefined}
        createId={() => "unused"}
        canPersist={false}
        persistenceMessage="Browser storage is unavailable."
      />,
    );

    expect(screen.getByRole("alert")).toHaveTextContent("Browser storage is unavailable.");
    expect(screen.getByRole("button", { name: "Start workshop" })).toBeDisabled();
  });
});
