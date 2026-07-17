export interface MonotonicClock {
  now(): number;
}

interface PerformanceLike {
  now(): number;
}

export function createBrowserClock(
  performanceBoundary: PerformanceLike = performance,
): MonotonicClock {
  return { now: () => performanceBoundary.now() };
}
