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
        caption: "Opening circle",
        imageDataUrl: "data:image/jpeg;base64,abc",
        createdAtMs: 100,
      },
    ];

    expect(saveMoments(storage, moments)).toBe(true);
    expect(loadMoments(storage)).toEqual(moments);
  });

  it("ignores invalid stored payloads", () => {
    const storage = new MemoryStorage();
    storage.values.set("workshop-timer:moments:v1", JSON.stringify([{ id: "bad" }]));

    expect(loadMoments(storage)).toEqual([]);
  });
});
