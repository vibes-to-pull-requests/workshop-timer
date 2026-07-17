import { describe, expect, it } from "vitest";

import { createBrowserClock, type MonotonicClock } from "./clock";

describe("clock boundary", () => {
  it("exposes an injectable monotonic clock", () => {
    const clock: MonotonicClock = { now: () => 42 };
    expect(clock.now()).toBe(42);
  });

  it("uses the supplied performance boundary", () => {
    expect(createBrowserClock({ now: () => 123 }).now()).toBe(123);
  });
});
