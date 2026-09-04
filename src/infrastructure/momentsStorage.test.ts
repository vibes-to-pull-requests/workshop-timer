import { describe, expect, it } from "vitest";

import { loadMoments, saveMoments } from "./momentsStorage";

class MemoryStorage {
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

describe("momentsStorage", () => {
  it("round-trips valid moments", () => {
    const storage = new MemoryStorage();
    const moments = [
      {
        id: "moment-1",
        kind: "image" as const,
        caption: "Opening circle",
        dataUrl: "data:image/jpeg;base64,abc",
        mimeType: "image/jpeg",
        createdAtMs: 100,
      },
      {
        id: "moment-2",
        kind: "note" as const,
        caption: "Vibe check",
        note: "Everyone looked tired.",
        createdAtMs: 200,
      },
    ];

    expect(saveMoments(storage, moments)).toBe(true);
    expect(loadMoments(storage)).toEqual(moments);
  });
});
