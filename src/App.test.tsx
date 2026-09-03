import { act, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";

import App from "./App";
import { STORAGE_KEY, type StorageLike } from "./infrastructure/storage";

class MemoryStorage implements StorageLike {
  readonly values = new Map<string, string>();
  failWrites = false;

  getItem(key: string) {
    return this.values.get(key) ?? null;
  }

  setItem(key: string, value: string) {
    if (this.failWrites) throw new Error("Unavailable");
    this.values.set(key, value);
  }

  removeItem(key: string) {
    if (this.failWrites) throw new Error("Unavailable");
    this.values.delete(key);
  }
}

describe("App", () => {
  it("renders the preparation view", () => {
    render(<App storage={new MemoryStorage()} now={() => 100} createId={() => "intro"} />);

    expect(
      screen.getByRole("heading", {
        name: "Plan your AMAZING workshop!!!",
      }),
    ).toBeInTheDocument();
    expect(screen.getByText("Stay present. Stay on time.")).toBeInTheDocument();
  });

  it("autosaves an unfinished draft and hydrates it on the next render", async () => {
    const storage = new MemoryStorage();
    const user = userEvent.setup();
    const first = render(
      <App storage={storage} now={() => 100} createId={() => "intro"} />,
    );

    await user.click(screen.getByRole("button", { name: "Add segment" }));
    await user.type(screen.getByLabelText("Segment name"), "Welcome");
    await user.type(screen.getByLabelText("Duration in minutes"), "15");
    expect(storage.values.get(STORAGE_KEY)).toContain("Welcome");
    expect(screen.queryByText("Started Welcome.")).not.toBeInTheDocument();
    first.unmount();

    render(<App storage={storage} now={() => 200} createId={() => "other"} />);
    expect(screen.getByLabelText("Segment name")).toHaveValue("Welcome");
    expect(screen.getByLabelText("Duration in minutes")).toHaveValue("15");
  });

  it("persists a valid start before showing the live state", async () => {
    const storage = new MemoryStorage();
    const user = userEvent.setup();
    render(<App storage={storage} now={() => 500} createId={() => "intro"} />);

    await user.click(screen.getByRole("button", { name: "Add segment" }));
    await user.type(screen.getByLabelText("Segment name"), "Welcome");
    await user.type(screen.getByLabelText("Duration in minutes"), "15");
    await user.click(screen.getByRole("button", { name: "Start workshop" }));

    expect(screen.getByRole("heading", { name: "Welcome" })).toBeInTheDocument();
    expect(screen.getByText("Started Welcome.")).toBeInTheDocument();
    expect(storage.values.get(STORAGE_KEY)).toContain('"status":"running"');
  });

  it("keeps preparation visible when the start write fails", async () => {
    const storage = new MemoryStorage();
    const user = userEvent.setup();
    render(<App storage={storage} now={() => 500} createId={() => "intro"} />);
    await user.click(screen.getByRole("button", { name: "Add segment" }));
    await user.type(screen.getByLabelText("Segment name"), "Welcome");
    await user.type(screen.getByLabelText("Duration in minutes"), "15");
    storage.failWrites = true;

    await user.click(screen.getByRole("button", { name: "Start workshop" }));

    expect(screen.getByRole("heading", { name: "Plan your AMAZING workshop!!!" })).toBeInTheDocument();
    expect(screen.getByRole("alert")).toHaveTextContent("could not be saved");
  });

  it("restores a running snapshot paused without counting closed time", async () => {
    const storage = new MemoryStorage();
    const setupUser = userEvent.setup();
    const first = render(<App storage={storage} now={() => 1_000} createId={() => "intro"} />);
    await setupUser.click(screen.getByRole("button", { name: "Add segment" }));
    await setupUser.type(screen.getByLabelText("Segment name"), "Welcome");
    await setupUser.type(screen.getByLabelText("Duration in minutes"), "1");
    await setupUser.click(screen.getByRole("button", { name: "Start workshop" }));
    first.unmount();

    render(<App storage={storage} now={() => 999_999} createId={() => "unused"} />);
    expect(screen.getByText("Paused")).toBeInTheDocument();
    expect(screen.getByTestId("timer-value")).toHaveTextContent("01:00");
    expect(screen.getByText("Workshop restored and paused.")).toBeInTheDocument();
  });

  it("fails closed at one cutoff and remains paused after a durable retry", async () => {
    const storage = new MemoryStorage();
    let nowMs = 1_000;
    const user = userEvent.setup();
    render(<App storage={storage} now={() => nowMs} createId={() => "intro"} />);
    await user.click(screen.getByRole("button", { name: "Add segment" }));
    await user.type(screen.getByLabelText("Segment name"), "Welcome");
    await user.type(screen.getByLabelText("Duration in minutes"), "1");
    await user.click(screen.getByRole("button", { name: "Start workshop" }));

    nowMs = 6_000;
    storage.failWrites = true;
    act(() => window.dispatchEvent(new PageTransitionEvent("pagehide")));

    expect(screen.getByRole("alert")).toHaveTextContent("Timing paused");
    expect(screen.getByTestId("timer-value")).toHaveTextContent("00:55");
    expect(screen.getByRole("button", { name: "Resume" })).toBeDisabled();

    nowMs = 100_000;
    storage.failWrites = false;
    await user.click(screen.getByRole("button", { name: "Retry save" }));
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Resume" })).toBeEnabled();
    expect(screen.getByTestId("timer-value")).toHaveTextContent("00:55");
  });

  it("rebases the display clock with a successful checkpoint", async () => {
    const storage = new MemoryStorage();
    let nowMs = 1_000;
    const user = userEvent.setup();
    render(<App storage={storage} now={() => nowMs} createId={() => "intro"} />);
    await user.click(screen.getByRole("button", { name: "Add segment" }));
    await user.type(screen.getByLabelText("Segment name"), "Welcome");
    await user.type(screen.getByLabelText("Duration in minutes"), "1");
    await user.click(screen.getByRole("button", { name: "Start workshop" }));

    nowMs = 6_000;
    act(() => window.dispatchEvent(new PageTransitionEvent("pagehide")));

    expect(screen.getByTestId("timer-value")).toHaveTextContent("00:55");
    expect(screen.getByRole("button", { name: "Pause" })).toBeEnabled();
  });

  it("retries the current local draft and re-enables Start only after it is durable", async () => {
    const storage = new MemoryStorage();
    const user = userEvent.setup();
    render(<App storage={storage} now={() => 500} createId={() => "intro"} />);
    await user.click(screen.getByRole("button", { name: "Add segment" }));
    storage.failWrites = true;
    await user.type(screen.getByLabelText("Segment name"), "Current draft");
    await user.type(screen.getByLabelText("Duration in minutes"), "15");

    expect(screen.getByRole("button", { name: "Start workshop" })).toBeDisabled();
    await user.click(screen.getByRole("button", { name: "Retry save" }));
    expect(screen.getByRole("button", { name: "Start workshop" })).toBeDisabled();

    storage.failWrites = false;
    await user.click(screen.getByRole("button", { name: "Retry save" }));
    expect(screen.getByRole("button", { name: "Start workshop" })).toBeEnabled();
    expect(storage.values.get(STORAGE_KEY)).toContain("Current draft");
    expect(storage.values.get(STORAGE_KEY)).toContain('"durationMinutes":15');
  });

  it("pauses a running workshop when replacing it with a new plan cannot be saved", async () => {
    const storage = new MemoryStorage();
    let nowMs = 1_000;
    const user = userEvent.setup();
    render(<App storage={storage} now={() => nowMs} createId={() => "intro"} />);
    await user.click(screen.getByRole("button", { name: "Add segment" }));
    await user.type(screen.getByLabelText("Segment name"), "Welcome");
    await user.type(screen.getByLabelText("Duration in minutes"), "1");
    await user.click(screen.getByRole("button", { name: "Start workshop" }));

    nowMs = 6_000;
    await user.click(screen.getByRole("button", { name: "New plan" }));
    storage.failWrites = true;
    await user.click(screen.getByRole("button", { name: "Discard workshop" }));

    expect(screen.getByRole("alert")).toHaveTextContent("Timing paused");
    expect(screen.getByTestId("timer-value")).toHaveTextContent("00:55");
    storage.failWrites = false;
    nowMs = 100_000;
    await user.click(screen.getByRole("button", { name: "Retry save" }));
    expect(screen.getByRole("button", { name: "Resume" })).toBeEnabled();
    expect(screen.getByTestId("timer-value")).toHaveTextContent("00:55");
  });

  it("closes a destructive dialog when a failed checkpoint disables live controls", async () => {
    const storage = new MemoryStorage();
    let nowMs = 1_000;
    const user = userEvent.setup();
    render(<App storage={storage} now={() => nowMs} createId={() => "intro"} />);
    await user.click(screen.getByRole("button", { name: "Add segment" }));
    await user.type(screen.getByLabelText("Segment name"), "Welcome");
    await user.type(screen.getByLabelText("Duration in minutes"), "1");
    await user.click(screen.getByRole("button", { name: "Start workshop" }));
    await user.click(screen.getByRole("button", { name: "New plan" }));
    expect(screen.getByRole("dialog", { name: "Discard this workshop?" })).toBeInTheDocument();

    nowMs = 6_000;
    storage.failWrites = true;
    act(() => window.dispatchEvent(new PageTransitionEvent("pagehide")));

    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Resume" })).toBeDisabled();
    expect(screen.queryByRole("heading", { name: "Plan your AMAZING workshop!!!" })).not.toBeInTheDocument();

    storage.failWrites = false;
    await user.click(screen.getByRole("button", { name: "Retry save" }));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Resume" })).toBeEnabled();
    expect(screen.queryByRole("heading", { name: "Plan your AMAZING workshop!!!" })).not.toBeInTheDocument();
  });

  it("renders a storage-unavailable state when the browser storage getter throws", () => {
    const descriptor = Object.getOwnPropertyDescriptor(window, "localStorage");
    const originalStorage = window.localStorage;
    Object.defineProperty(window, "localStorage", {
      configurable: true,
      get() {
        throw new DOMException("Blocked", "SecurityError");
      },
    });

    try {
      render(<App now={() => 100} createId={() => "intro"} />);
      expect(screen.getByRole("alert")).toHaveTextContent("storage is unavailable");
      expect(screen.getByRole("button", { name: "Start workshop" })).toBeDisabled();
    } finally {
      if (descriptor) Object.defineProperty(window, "localStorage", descriptor);
      else Object.defineProperty(window, "localStorage", { configurable: true, value: originalStorage });
    }
  });

  it("preserves an incompatible snapshot until the user confirms reset", async () => {
    const storage = new MemoryStorage();
    const raw = '{"version":999,"state":{"status":"preparing","segments":[]}}';
    storage.values.set(STORAGE_KEY, raw);
    const user = userEvent.setup();
    render(<App storage={storage} now={() => 100} createId={() => "intro"} />);

    expect(screen.getByRole("heading", { name: "Saved workshop needs attention" })).toBeInTheDocument();
    expect(storage.values.get(STORAGE_KEY)).toBe(raw);
    await user.click(screen.getByRole("button", { name: "Reset saved workshop" }));
    expect(screen.getByRole("dialog", { name: "Reset saved workshop?" })).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Cancel" }));
    expect(storage.values.get(STORAGE_KEY)).toBe(raw);
    await user.click(screen.getByRole("button", { name: "Reset saved workshop" }));
    await user.click(screen.getByRole("button", { name: "Reset and start over" }));
    expect(screen.getByRole("heading", { name: "Plan your AMAZING workshop!!!" })).toBeInTheDocument();
    expect(storage.values.get(STORAGE_KEY)).toContain('"status":"preparing"');
  });

  it("does not offer destructive reset when browser storage is unavailable", () => {
    const storage = new MemoryStorage();
    storage.failWrites = true;
    render(<App storage={storage} now={() => 100} createId={() => "intro"} />);

    expect(screen.getByRole("alert")).toHaveTextContent("storage is unavailable");
    expect(screen.queryByRole("button", { name: /reset saved workshop/i })).not.toBeInTheDocument();
  });

  it("persists and restores the completed summary, then replaces it only after confirmation", async () => {
    const storage = new MemoryStorage();
    let nowMs = 1_000;
    const user = userEvent.setup();
    const first = render(<App storage={storage} now={() => nowMs} createId={() => "intro"} />);
    await user.click(screen.getByRole("button", { name: "Add segment" }));
    await user.type(screen.getByLabelText("Segment name"), "Welcome");
    await user.type(screen.getByLabelText("Duration in minutes"), "1");
    await user.click(screen.getByRole("button", { name: "Start workshop" }));
    nowMs = 31_000;
    await user.click(screen.getByRole("button", { name: "Finish workshop" }));
    await user.click(within(screen.getByRole("dialog")).getByRole("button", { name: "Finish workshop" }));
    expect(screen.getByRole("heading", { name: "How the time was used" })).toBeInTheDocument();
    expect(storage.values.get(STORAGE_KEY)).toContain('"status":"completed"');
    first.unmount();

    nowMs = 999_999;
    render(<App storage={storage} now={() => nowMs} createId={() => "other"} />);
    expect(screen.getByRole("heading", { name: "How the time was used" })).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "New plan" }));
    await user.click(screen.getByRole("button", { name: "Keep summary" }));
    expect(storage.values.get(STORAGE_KEY)).toContain('"status":"completed"');
    await user.click(screen.getByRole("button", { name: "New plan" }));
    await user.click(screen.getByRole("button", { name: "Start new plan" }));
    expect(screen.getByRole("heading", { name: "Plan your AMAZING workshop!!!" })).toBeInTheDocument();
    expect(storage.values.get(STORAGE_KEY)).toContain('"status":"preparing"');
  });
});
