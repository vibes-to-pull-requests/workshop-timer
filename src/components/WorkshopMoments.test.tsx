import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import WorkshopMoments from "./WorkshopMoments";
import { shareImageForInstagram } from "../lib/share";
import { MOMENTS_STORAGE_KEY, type WorkshopMoment } from "../infrastructure/momentsStorage";
import type { StorageLike } from "../infrastructure/storage";

vi.mock("../lib/media", () => ({
  prepareImageDataUrl: vi.fn(async () => "data:image/jpeg;base64,new-photo"),
}));

vi.mock("../lib/share", () => ({
  shareImageForInstagram: vi.fn(async () => "downloaded"),
}));

class MemoryStorage implements StorageLike {
  readonly values = new Map<string, string>();

  getItem(key: string) {
    return this.values.get(key) ?? null;
  }

  setItem(key: string, value: string) {
    this.values.set(key, value);
  }

  removeItem(key: string) {
    this.values.delete(key);
  }
}

const imageMoment: WorkshopMoment = {
  id: "moment-1",
  kind: "image",
  caption: "Whiteboard breakthrough",
  dataUrl: "data:image/jpeg;base64,abc",
  mimeType: "image/jpeg",
  createdAtMs: 1_700_000_000_000,
};

const noteMoment: WorkshopMoment = {
  id: "moment-2",
  kind: "note",
  caption: "Energy check",
  note: "Room got loud after the breakout.",
  createdAtMs: 1_700_000_100_000,
};

describe("WorkshopMoments", () => {
  it("renders saved moments from storage", () => {
    const storage = new MemoryStorage();
    storage.values.set(MOMENTS_STORAGE_KEY, JSON.stringify([imageMoment, noteMoment]));

    render(
      <WorkshopMoments storage={storage} createId={() => "new-moment"} now={() => 1_700_000_000_000} />,
    );

    expect(screen.getByRole("heading", { name: "Workshop moments" })).toBeInTheDocument();
    expect(screen.getByText("Whiteboard breakthrough")).toBeInTheDocument();
    expect(screen.getByText("Room got loud after the breakout.")).toBeInTheDocument();
  });

  it("saves a note moment", async () => {
    const storage = new MemoryStorage();
    const user = userEvent.setup();

    render(
      <WorkshopMoments storage={storage} createId={() => "moment-note"} now={() => 1_700_000_200_000} />,
    );

    await user.type(screen.getByPlaceholderText("What happened in this moment?"), "Great question from the back row.");
    await user.click(screen.getByRole("button", { name: "Save moment" }));

    expect(storage.values.get(MOMENTS_STORAGE_KEY)).toContain("Great question from the back row.");
    expect(screen.getByText("Great question from the back row.")).toBeInTheDocument();
  });

  it("saves a photo moment", async () => {
    const storage = new MemoryStorage();
    const user = userEvent.setup();

    render(
      <WorkshopMoments storage={storage} createId={() => "moment-photo"} now={() => 1_700_000_300_000} />,
    );

    const file = new File(["photo"], "workshop.jpg", { type: "image/jpeg" });
    await user.upload(screen.getByLabelText("Add workshop photo"), file);
    await user.type(screen.getByPlaceholderText("Optional label for this moment"), "Team huddle");
    await user.click(screen.getByRole("button", { name: "Save moment" }));

    expect(storage.values.get(MOMENTS_STORAGE_KEY)).toContain("Team huddle");
    expect(screen.getByText("Team huddle")).toBeInTheDocument();
  });

  it("shares a saved photo moment to instagram", async () => {
    const storage = new MemoryStorage();
    storage.values.set(MOMENTS_STORAGE_KEY, JSON.stringify([imageMoment]));
    const user = userEvent.setup();

    render(
      <WorkshopMoments storage={storage} createId={() => "moment-photo"} now={() => 1_700_000_300_000} />,
    );

    await user.click(screen.getByRole("button", { name: "Share to Instagram" }));

    expect(shareImageForInstagram).toHaveBeenCalledWith(
      "data:image/jpeg;base64,abc",
      expect.objectContaining({ caption: "Whiteboard breakthrough" }),
    );
    expect(screen.getByRole("status")).toHaveTextContent("Open Instagram");
  });
});
