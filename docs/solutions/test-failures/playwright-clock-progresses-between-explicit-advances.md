---
title: Freeze Playwright time before exact elapsed-time assertions
date: 2026-07-18
category: test-failures
module: workshop timer end-to-end tests
problem_type: test_failure
component: testing_framework
symptoms:
  - The workshop-flow test reported a segment as one second longer than the explicit clock advance
  - The same exact-time assertion failed in Chromium, Firefox, and WebKit CI jobs
root_cause: async_timing
resolution_type: test_fix
severity: medium
tags:
  - playwright
  - clock-mocking
  - e2e-tests
  - deterministic-time
---

# Freeze Playwright time before exact elapsed-time assertions

## Problem

An end-to-end test asserted exact workshop elapsed times after calling `page.clock.runFor()`, but the installed Playwright clock resumed advancing after each explicit clock operation. Real time spent on assertions and live-workshop interactions before pausing or advancing the segment became part of its measured duration, making the result depend on runner speed rather than only the duration passed to `runFor()`.

The correction is pending in [PR #1](https://github.com/jngo/workshop-timer/pull/1). It changes only the Playwright test setup; the product timing logic is unchanged.

## Symptoms

GitHub Actions failed the workshop-flow assertion across Chromium, Firefox, and WebKit, the three projects configured in `playwright.config.ts:14`. The test expected `00:15 under plan`, but the summary row contained `00:14 under plan` and showed `00:46` actual time after nominally advancing a one-minute segment by 45 seconds.

The boundary drift appeared clearly because the application uses deliberate rounding rules:

- Active elapsed time includes `nowMs - runStartedAtMs` while the timer is running (`src/domain/timer.ts:17`).
- A non-negative live countdown rounds remaining milliseconds up (`src/domain/timer.ts:52`).
- Completed variance is `actualMs - plannedMs` (`src/domain/reducer.ts:124`) and its duration formatter rounds absolute milliseconds down (`src/domain/timer.ts:60`).

## What Didn't Work

Installing the clock at the intended epoch did not freeze it:

```ts
await page.clock.install({ time: new Date("2026-09-01T08:00:00Z") });
await page.goto("./");

// After runFor(), assertions and live controls happen while time progresses.
await page.getByRole("button", { name: "Start workshop" }).click();
await page.clock.runFor(45_000);
```

`clock.install()` replaces the browser's time-related APIs but does not pause their progression. Adding retries or weakening the expected text would only hide the nondeterminism; the exact assertions at `tests/e2e/workshop.spec.ts:18` and `tests/e2e/workshop.spec.ts:35` express the intended temporal contract.

Local browser execution could not prove the fix because the managed macOS sandbox blocked Playwright's browser launch. The successful GitHub Actions runs supplied the cross-browser verification instead.

## Solution

Initialize the fake clock before the test epoch, navigate while page timers can progress normally, and then pause at the exact epoch before any user interaction:

```ts
await page.clock.install({ time: new Date("2026-09-01T07:59:00Z") });
await page.goto("./");
await page.clock.pauseAt(new Date("2026-09-01T08:00:00Z"));

// Later assertions and live controls cannot leak real elapsed time.
await page.getByRole("button", { name: "Add segment" }).click();
```

This sequence is implemented at `tests/e2e/workshop.spec.ts:4`. The test advances time only through explicit `runFor()` calls after the workshop starts (`tests/e2e/workshop.spec.ts:16` and `tests/e2e/workshop.spec.ts:26`). The pending fix in PR #1 passed CI in all three configured browser projects.

## Why This Works

Loading the page before pausing allows startup timers to run normally. `pauseAt()` then establishes a deterministic epoch; form setup occurs at that fixed time, and the workshop starts from a stable clock value. From that point, simulated time changes only when the test explicitly advances it, so `runFor(45_000)` contributes exactly 45 seconds.

That stable input matches the application's existing arithmetic: running elapsed time is accumulated duration plus `nowMs - runStartedAtMs` (`src/domain/timer.ts:17`), and advancing to the next segment stores that settled elapsed duration (`src/domain/reducer.ts:91`). The test fix therefore removes harness drift instead of compensating for it in production code.

## Prevention

Use the same bootstrap whenever a browser test makes exact elapsed-time assertions:

```ts
await page.clock.install({ time: shortlyBeforeEpoch });
await page.goto("./");
await page.clock.pauseAt(exactEpoch);
```

- Do not assume `clock.install({ time })` freezes the clock.
- Pause after navigation but before any action whose timestamp affects the feature under test.
- Advance simulated time only through explicit clock operations.
- Keep exact assertions at meaningful rounding boundaries so unintended real-time leakage remains visible.
- Distinguish non-browser checks from browser proof when a local environment cannot launch the browser.

A shared helper becomes worthwhile only if this sequence is repeated across several specifications. Until then, keeping the three lines explicit makes the temporal contract easy to audit.

## Related Issues

- [PR #1: Deliver the first usable workshop timer](https://github.com/jngo/workshop-timer/pull/1)
- [Playwright clock documentation](https://playwright.dev/docs/clock)
