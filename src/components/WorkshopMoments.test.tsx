import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import WorkshopMoments from "./WorkshopMoments";
import { MOMENTS_STORAGE_KEY, type WorkshopMoment } from "../infrastructure/momentsStorage";
import type { StorageLike } from "../infrastructure/storage";

vi.mock("../lib/image", () => ({
  prepareImageDataUrl: vi.fn(async () => "data:image/jpeg;base64,new-photo"),
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

const sampleMoment: WorkshopMoment = {
  id: "moment-1",
  caption: "Whiteboard breakthrough",
  imageDataUrl: "data:image/jpeg;base64,abc",
  createdAtMs: 1_700_000_000_000,
};

describe("WorkshopMoments", () => {
  it("renders saved moments from storage", () => {
    const storage = new MemoryStorage();
    storage.values.set(MOMENTS_STORAGE_KEY, JSON.stringify([sampleMoment]));

    render(
      <WorkshopMoments storage={storage} createId={() => "new-moment"} now={() => 1_700_000_000_000} />,
    );

    expect(screen.getByRole("heading", { name: "Workshop moments" })).toBeInTheDocument();
    expect(screen.getByText("Whiteboard breakthrough")).toBeInTheDocument();
    expect(screen.getByRole("img", { name: "Whiteboard breakthrough" })).toBeInTheDocument();
  });

  it("saves a new moment after a photo is selected", async () => {
    const storage = new MemoryStorage();
    const user = userEvent.setup();

    render(
      <WorkshopMoments storage={storage} createId={() => "moment-2"} now={() => 1_700_000_100_000} />,
    );

    const file = new File(["photo"], "workshop.jpg", { type: "image/jpeg" });
    await user.upload(screen.getByLabelText("Add workshop photo"), file);
    await user.type(screen.getByPlaceholderText("What happened in this moment?"), "Team huddle");
    await user.click(screen.getByRole("button", { name: "Save moment" }));

    expect(storage.values.get(MOMENTS_STORAGE_KEY)).toContain("Team huddle");
    expect(screen.getByText("Team huddle")).toBeInTheDocument();
  });

  it("removes a saved moment", async () => {
    const storage = new MemoryStorage();
    storage.values.set(MOMENTS_STORAGE_KEY, JSON.stringify([sampleMoment]));
    const user = userEvent.setup();

    render(
      <WorkshopMoments storage={storage} createId={() => "new-moment"} now={() => 1_700_000_000_000} />,
    );

    await user.click(screen.getByRole("button", { name: "Remove" }));

    expect(screen.getByText("No moments yet.")).toBeInTheDocument();
    expect(storage.values.get(MOMENTS_STORAGE_KEY)).toBe("[]");
  });
});
