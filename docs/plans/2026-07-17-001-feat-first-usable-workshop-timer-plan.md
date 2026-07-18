---
title: First Usable Workshop Timer - Plan
type: feat
date: 2026-07-17
topic: first-usable-workshop-timer
artifact_contract: ce-unified-plan/v1
artifact_readiness: implementation-ready
product_contract_source: ce-brainstorm
execution: code
deepened: 2026-07-17
---

# First Usable Workshop Timer - Plan

## Goal Capsule

- **Objective:** Deliver a first usable Workshop Timer that can guide a solo facilitator through a real multi-hour workshop with less clock-watching and greater control over timing.
- **Product authority:** STRATEGY.md
- **Execution profile:** Greenfield client-only web application; prove timer and persistence behavior deterministically before visual integration.
- **Stop conditions:** Stop if implementation requires changing a session-settled behavior, adding a server component, or cannot maintain the one-second foreground-checkpoint target and latest-durable-checkpoint recovery contract.
- **Tail ownership:** The executor owns implementation, automated verification, deployment configuration, user-facing setup documentation, and removal of abandoned approaches.
- **Open blockers:** None.

---

## Product Contract

### Summary

Implement the single-user Workshop Timer as a static Vite, React, and TypeScript application with framework-independent timing and persistence logic.
Tailwind CSS and selected shadcn components support the conventional interface, while the focused live timer remains custom.

### Problem Frame

A solo facilitator must deliver content, read the room, respond to participants, and monitor questions at the same time.
Planning timings in a table is manageable, but reliably following that plan during delivery is not.
Existing workarounds such as Miro timers, desk timers, and manual clock-checking either add friction or disappear from attention once the facilitator becomes absorbed in the workshop.

### Key Decisions

- **Solve for the solo multi-hour workshop facilitator first** (session-settled: user-directed — chosen over a broad meeting, lesson, and workshop audience: the product must solve the creator's own facilitation problem before generalizing).
- **Move timing decisions into segment planning** (session-settled: user-approved — chosen over a conventional standalone timer: pre-planned segments reduce decisions during attention-heavy delivery).
- **Separate preparation from a focused live view** (session-settled: user-directed — chosen over a full run-of-show dashboard and a compact companion: the current segment should dominate while the next segment provides transition context).
- **Advance segments manually** (session-settled: user-directed — chosen over automatic advancement or stopping at zero: the facilitator decides when the workshop moves on and can see overtime accumulate).
- **Keep the live plan fixed** (session-settled: user-directed — chosen over editing upcoming segments during delivery: the first version should remain simple while real use develops an informed recovery model).
- **Use a draining background as the ambient progress cue** (session-settled: user-directed — chosen over a radial dial and a progress strip: a changing field is easier to perceive peripherally).
- **Use proportional warning thresholds** (session-settled: user-approved — chosen over fixed-minute and per-segment thresholds: orange at 25% and red at 10% scale predictably across segment lengths without configuration).
- **Keep one active plan on one computer** (session-settled: user-directed — chosen over multiple saved plans and cross-device access: plan management is unnecessary for the first real-use test).
- **Include a completion summary** (session-settled: user-directed — chosen over ending when the final timer stops: planned-versus-actual timing supports reflection after the workshop).

### Requirements

**Plan preparation**

- R1. The facilitator can create one active plan as an ordered sequence of segments, each with a trimmed non-empty name and a positive whole-minute duration.
- R2. Before starting, the facilitator can rename, reorder, remove, and change the duration of any segment.
- R3. The preparation view shows the total planned duration of all segments.
- R4. Creating a new plan replaces the existing plan and any completed summary after confirmation.

**Focused live guidance**

- R5. Starting the plan begins its first segment and switches from preparation to a focused live view.
- R6. The live view makes the current segment name and remaining time dominant while showing the next segment name and duration as secondary context.
- R7. A draining background represents the proportion of the current segment that remains.
- R8. The background enters an orange warning state at 25% remaining and a red warning state at 10% remaining.
- R9. At zero, the timer stays on the current segment, enters a distinct overtime state, and counts upward until the facilitator advances.
- R10. The facilitator can pause and resume the current segment.
- R11. Selecting Next ends the current segment and immediately starts the following segment.
- R12. The active plan cannot be edited, reordered, extended, or shortened after it starts.

**Persistence and recovery**

- R13. The active plan and its progress persist in the same browser on the same computer.
- R14. Once the static application has loaded, reopening after a refresh, closure, or crash restores the same segment in a paused state. A cold reopen of the GitHub Pages deployment requires network access in this version.
- R15. Time while paused or while the browser is closed does not reduce the countdown or contribute to the segment's actual duration.

**Completion and reflection**

- R16. Finishing the final segment ends the live session and shows a summary of every segment's planned and actual duration.
- R17. Actual duration is measured from entering a segment until selecting Next or Finish, excluding paused and closed-browser time.
- R18. The completed summary remains available until the facilitator creates a new plan.
- R19. Every preparation edit is saved locally so an unfinished draft reopens in the preparation view.
- R20. Start remains unavailable until the plan contains at least one valid segment; duplicate segment names are allowed.
- R21. Selecting Next or Finish while paused records only accumulated active time, and Next starts the following segment running.
- R22. The completion summary shows planned duration, actual active duration, and signed variance for each segment and for the full workshop.
- R23. Next advances without confirmation, while Finish and replacement of an active session require confirmation.

### Key Flows

~~~mermaid
flowchart TB
  Prepare["Prepare ordered segments"] --> Start["Start workshop"]
  Start --> Run["Run current segment"]
  Run --> Pause["Pause"]
  Pause --> Run
  Run --> Close["Browser closes or refreshes"]
  Close --> Restore["Restore current segment paused"]
  Restore --> Run
  Run --> Zero{"Time remaining?"}
  Zero -->|"Above zero"| Run
  Zero -->|"At zero"| Overtime["Count overtime"]
  Overtime --> Advance["Select Next or Finish"]
  Run --> Advance
  Advance --> More{"More segments?"}
  More -->|"Yes"| Run
  More -->|"No"| Summary["Review planned vs actual"]
~~~

- F1. Prepare a plan
  - **Trigger:** The facilitator opens Workshop Timer with no active plan or chooses to replace the existing plan.
  - **Steps:** If a plan exists, choose New Plan and either cancel to preserve it or confirm replacement; then add named segments, set durations, arrange their order, review total duration, and start.
  - **Outcome:** The first segment begins in the focused live view.
  - **Covered by:** R1-R5, R19-R20, R23.

- F2. Facilitate a segment
  - **Trigger:** A segment starts.
  - **Steps:** Monitor the remaining time and ambient progress cue, pause if needed, remain in overtime when necessary, then select Next.
  - **Outcome:** The segment's actual duration is recorded and the next segment begins.
  - **Covered by:** R6-R12, R17, R21, R23.

- F3. Recover an interrupted session
  - **Trigger:** The active session is refreshed, closed, or interrupted by a browser crash.
  - **Steps:** Reopen Workshop Timer, review the restored current segment, and resume when ready.
  - **Outcome:** The workshop continues without losing the plan or counting the interruption.
  - **Covered by:** R13-R15.

- F4. Complete and reflect
  - **Trigger:** The facilitator selects Finish on the final segment.
  - **Steps:** End timing and review planned duration against actual active duration for each segment.
  - **Outcome:** The facilitator can see where the plan matched reality before replacing it with a future plan.
  - **Covered by:** R16-R18, R22-R23.

### Acceptance Examples

- AE1. **Covers R7-R8.** Given a 60-minute segment, when 15 minutes remain, the draining background enters orange; when 6 minutes remain, it enters red.
- AE2. **Covers R7-R8.** Given a 10-minute segment, when 2 minutes 30 seconds remain, the draining background enters orange; when 1 minute remains, it enters red.
- AE3. **Covers R9, R11.** Given the current segment reaches zero, when the facilitator does nothing, the same segment remains active and counts overtime until Next is selected.
- AE4. **Covers R10, R15, R17.** Given a segment runs for 12 minutes and is paused for 3 minutes, when it resumes and runs for 5 more minutes, its actual duration is 17 minutes.
- AE5. **Covers R13-R15.** Given the browser closes during a live segment, when the facilitator reopens it later, the same segment is restored paused and the closed interval has not consumed its remaining or actual time.
- AE6. **Covers R4, R18, R23.** Given an active or completed plan exists, when the facilitator chooses New Plan, cancel preserves the existing state and confirm replaces the previous plan, partial results, and summary.
- AE7. **Covers R1, R20.** Given an empty plan or a segment with a blank name, zero duration, negative duration, or fractional minutes, Start remains unavailable and the invalid field is identified.
- AE8. **Covers R10, R17, R21.** Given a paused segment, when Next is selected, the paused interval remains excluded, the accumulated active time is recorded, and the next segment starts running.
- AE9. **Covers R14-R15.** Given an abrupt termination prevents a final lifecycle save, when the app reopens, it restores paused from the latest durable checkpoint. While foreground JavaScript remained schedulable and storage writes succeeded, the undercount is no more than one second; suspension before termination can exceed that bound and is an explicit browser-only limitation.

### Success Criteria

- The facilitator can deliver both days of the September workshop using Workshop Timer and feel in control of the timing throughout.
- Manual clock-checking decreases because the countdown and draining background provide sufficient peripheral awareness.
- Segment overruns become visible early enough for the facilitator to make deliberate delivery choices.
- The workshop is more likely to finish on time, with the summary showing where planned and actual durations diverged.

### Scope Boundaries

**Included**

- One active plan with pre-session segment editing.
- Focused live timing with current and next segment context.
- Pause, manual advancement, overtime, proportional visual warnings, and same-browser recovery.
- One planned-versus-actual completion summary.

**Deferred for later**

- Multiple saved plans, historical summaries, templates, and reusable plans.
- Multi-day workshop structure.
- Cross-device access, accounts, and synchronization.
- Editing, adding, deleting, or reordering segments after a session starts.
- Audio cues, browser notifications, and other active attention mechanisms.
- Configurable warning thresholds.
- Recovery guidance that redistributes time after an overrun.

### Dependencies and Assumptions

- The first real-use environment is one computer with a multi-display setup, so a persistent visual cue can remain visible during facilitation.
- Visual-only guidance is sufficient for the first workshop test.
- Replacing the only active plan and its summary is acceptable in the first version.
- During normal foreground execution, successful checkpoints occur at least once per second, so an abrupt termination may lose up to one second of active elapsed time. Browser or operating-system suspension before termination can exceed that bound; normal refresh, closure, and visibility changes attempt an immediate checkpoint.
- Real workshop use will provide the evidence needed to design live schedule adjustment later.

---

## Planning Contract

### Key Technical Decisions

- **KTD1 — Use Vite, React, and TypeScript as a client-only static application** (session-settled: user-approved). Vite supplies the development and production build pipeline without introducing server rendering, routing, or server/client component boundaries that this one-screen application does not need. React owns composition and rendering; TypeScript protects the timer state model. The supported runtime is Node.js 24 LTS with npm, recorded in `.nvmrc` and `package.json`. The production artifact is deployable to GitHub Pages.
- **KTD2 — Use Tailwind CSS and selective shadcn components, but keep the live timer custom** (session-settled: user-approved). Tailwind supplies design tokens and responsive utilities. Only conventional controls that improve accessibility and consistency—such as buttons, inputs, dialogs, and cards—should be added from shadcn. The draining background, dominant countdown, warning transitions, and overtime treatment are product-specific and must not be forced into a generic component abstraction.
- **KTD3 — Model behavior as a pure TypeScript state machine.** The domain distinguishes `preparing`, `running`, `paused`, and `completed`; overtime is derived when active elapsed time exceeds the current segment's planned duration. React views dispatch domain events and render selectors rather than owning timer arithmetic. This keeps R5-R17 deterministic and allows the core behavior to be tested without a browser.
- **KTD4 — Calculate time from a monotonic clock, never from tick counts.** While running, actual active time equals previously accumulated active time plus the difference between the current `performance.now()` value and the segment's run anchor. A display loop only requests a repaint. Pausing, advancing, and finishing first settle elapsed time from the clock, preventing background-tab throttling or delayed frames from changing the result.
- **KTD5 — Persist one versioned snapshot in `localStorage` and fail closed when durability is unavailable.** Preparation edits save immediately. Live sessions save on meaningful transitions, at no more than one-second intervals while foreground execution remains schedulable, and on visibility/lifecycle opportunities. Start requires a successful storage capability check. A failed live write pauses progress, retains the last durable and in-memory states, and presents a blocking retry path instead of claiming recoverability. Hydration validates lifecycle invariants and converts a saved `running` session to `paused` without adding closed-browser time. The recovery guarantee is the latest successful checkpoint; the one-second loss bound applies only while the page remained schedulable and writes succeeded.
- **KTD6 — Support one open Workshop Timer tab.** Coordinating or transferring control across simultaneous tabs is outside the first version. The README and recovery guidance warn that opening the timer in multiple tabs can overwrite browser-local progress; the implementation does not add a locking subsystem or block otherwise-supported browsers on a coordination API.
- **KTD7 — Use explicit Move Up and Move Down actions for ordering.** Keyboard-accessible controls satisfy R2 without adding a drag-and-drop dependency or hiding essential ordering behind pointer gestures. Drag-and-drop can be reconsidered after the preparation workflow has been used in practice.
- **KTD8 — Treat visual color as reinforcement, not the only status signal.** The interface pairs the neutral, orange, red, paused, and overtime fields with text labels and accessible control states. Threshold comparisons use exact remaining seconds, including equality at 25% and 10%, rather than rounded display minutes. The per-second countdown is not a live region; assistive technology announces only meaningful transitions such as segment start, warning thresholds, pause/resume, overtime, restored-paused state, and completion. View changes focus the primary heading or recovery message, and dialogs contain and restore focus.

### High-Level Technical Design

These sketches describe responsibilities and lifecycle boundaries; they do not prescribe exact component APIs.

~~~mermaid
flowchart LR
  Views["React views\nPlan Editor · Live Timer · Summary"] -->|"domain events"| Domain["Pure TypeScript domain\nstate transitions · validation · selectors"]
  Clock["Clock adapter\nmonotonic now"] --> Domain
  Domain -->|"derived view model"| Views
  Domain -->|"versioned snapshots"| Storage["Persistence adapter\nlocalStorage"]
  Storage -->|"validated hydration"| Domain
  Domain --> Tests["Deterministic domain tests"]
  Views --> BrowserTests["Real-browser flow tests"]
~~~

~~~mermaid
stateDiagram-v2
  [*] --> Preparing
  Preparing --> Running: Start valid plan
  Running --> Paused: Pause
  Paused --> Running: Resume
  Running --> Running: Next with segments remaining
  Paused --> Running: Next with segments remaining
  Running --> Completed: Confirm Finish
  Paused --> Completed: Confirm Finish
  Running --> Preparing: Confirm New Plan
  Paused --> Preparing: Confirm New Plan
  Running --> Running: Cancel New Plan
  Paused --> Paused: Cancel New Plan
  Running --> Paused: Restore saved session
  Paused --> Paused: Restore saved session
  Completed --> Preparing: Confirm New Plan
  note right of Running
    Remaining below zero is overtime.
    It does not create a separate persisted state.
  end note
~~~

### State and Data Lifecycle

- The persisted snapshot contains a schema version, plan segments with stable local IDs, workflow state, current segment index, completed actual durations, accumulated active time for the current segment, and the last checkpoint time needed for crash recovery.
- Snapshot and rejected-payload identifiers use stable `workshop-timer` application-qualified names so other project sites sharing the same GitHub Pages origin cannot collide with this app's state.
- The in-memory run anchor uses the monotonic clock and is never treated as durable across page loads. Each checkpoint derives a candidate snapshot from one clock reading, writes it, and only then publishes the new accumulated value and anchor. A failed write leaves the previous anchor intact so a retry neither loses nor double-counts time.
- Start, Pause, Next, Finish, confirmed replacement, and periodic checkpointing use commit-before-publish semantics: validate the candidate, write it synchronously, then expose the transition in memory and UI. A failed write preserves the previous visible and durable workflow state; a running checkpoint failure additionally halts timing and requires a successful durable retry before continuing.
- A normal refresh or lifecycle save attempts to settle the current interval. Abrupt termination restores the last settled checkpoint. Foreground checkpointing targets a maximum one-second undercount, but prior browser/OS suspension is outside that bound because a client page cannot observe when termination occurred.
- Inbound and outbound snapshots share cross-field validation: segment IDs and durations are valid, indices are in range, elapsed values are finite and nonnegative, completion entries match completed segments, and state-specific fields are coherent.
- Malformed or unknown snapshots show a clear incompatible-or-corrupt-data message and require confirmation before reset. The raw value remains untouched and automatic draft saving remains disabled until that confirmation, but the first version offers no inspection, repair, export, or migration workflow.
- Creating a new plan deletes the previous session and summary only after the applicable confirmation succeeds. There is no history store or migration from a server-side format.

### Output Structure

- `package.json`, `package-lock.json`, `.nvmrc` — runtime, dependencies, and scripts.
- `vite.config.ts`, `tsconfig*.json`, `eslint.config.js`, `playwright.config.ts`, `components.json` — build, type, lint, browser-test, and shadcn configuration.
- `index.html`, `src/main.tsx`, `src/App.tsx`, `src/styles.css` — application entry point, top-level workflow, and global visual tokens.
- `src/domain/types.ts`, `src/domain/reducer.ts`, `src/domain/timer.ts`, `src/domain/validation.ts` — framework-independent workflow and timing rules.
- `src/infrastructure/clock.ts`, `src/infrastructure/storage.ts` — browser boundaries behind small adapters.
- `src/components/PlanEditor.tsx`, `src/components/LiveTimer.tsx`, `src/components/SummaryView.tsx` — the three primary experiences.
- `src/components/ui/*` — only the shadcn source files actually used by those experiences.
- `src/App.test.tsx`, `src/components/PlanEditor.test.tsx`, `src/components/LiveTimer.test.tsx`, `src/components/SummaryView.test.tsx`, `src/domain/*.test.ts`, `src/infrastructure/storage.test.ts`, `src/test/setup.ts` — deterministic smoke, unit, component, and integration coverage.
- `tests/e2e/workshop.spec.ts`, `tests/e2e/recovery.spec.ts` — real-browser primary and recovery flows.
- `.github/workflows/ci.yml`, `.github/workflows/deploy-pages.yml`, `README.md` — continuous verification, static deployment, and local/use documentation.

### Sequencing and Constraints

1. Establish the greenfield toolchain and visual primitives.
2. Prove the domain state machine and timer arithmetic with an injected clock before connecting browser persistence or visual rendering.
3. Add persistence and recovery before building the full preparation and live experiences, so every UI transition uses the durable path from the outset.
4. Build preparation, then the live timer, then completion and deployment integration.
5. Keep browser APIs confined to infrastructure adapters. Do not add a router, backend, data-fetching layer, global state package, drag-and-drop package, service worker, or notification permission flow in this version.

### Resolved During Planning

- The app is a Vite-built client SPA rather than a Next.js application; static export is possible in Next.js, but its routing and server capabilities do not serve the current one-screen, local-only scope.
- Segment duration input uses positive whole minutes. Countdown calculations and stored actual durations retain second-level precision.
- Under normal foreground scheduling, an abrupt termination can undercount active time by up to one second. Suspension before termination can exceed that bound; the app still restores the latest durable checkpoint paused. This is the explicit limit of a browser-only design that excludes closed time.
- Reopening always restores a live session paused, even if it had been running when last checkpointed.
- The first delivery target is GitHub Pages. No server or secret is required at runtime.
- The deployed application requires network access for a cold load or reopen. Offline installation and service-worker caching are deferred.

### Sources and References

- [React: Build a React app from scratch](https://react.dev/learn/build-a-react-app-from-scratch) and [Using TypeScript](https://react.dev/learn/typescript) — framework and typed-component grounding for KTD1.
- [Vite guide](https://vite.dev/guide/) and [Deploying a static site](https://vite.dev/guide/static-deploy) — build and static-deployment behavior.
- [Node.js release schedule](https://nodejs.org/en/about/previous-releases) — Node 24 LTS runtime choice.
- [MDN: High precision timing](https://developer.mozilla.org/en-US/docs/Web/API/Performance_API/High_precision_timing) and [requestAnimationFrame](https://developer.mozilla.org/en-US/docs/Web/API/Window/requestAnimationFrame) — monotonic timing and repaint-loop boundaries for KTD4.
- [MDN: Web Storage API](https://developer.mozilla.org/en-US/docs/Web/API/Web_Storage_API) and [Page Visibility API](https://developer.mozilla.org/en-US/docs/Web/API/Document/visibilitychange_event) — persistence and lifecycle behavior.
- [Vitest timer mocks](https://vitest.dev/guide/mocking/timers) and [Playwright Clock](https://playwright.dev/docs/clock) — deterministic unit and browser verification.
- [Tailwind with Vite](https://tailwindcss.com/docs/installation/using-vite), [shadcn Vite installation](https://ui.shadcn.com/docs/installation/vite), and [shadcn components](https://ui.shadcn.com/docs) — KTD2 setup and source-owned component model.
- [Next.js static exports](https://nextjs.org/docs/app/guides/static-exports) and [Server and Client Components](https://nextjs.org/docs/app/getting-started/server-and-client-components) — evidence considered in the Vite-versus-Next decision.

---

## Implementation Units

### U1. Establish the application foundation

- **Goal:** Create a reproducible Vite/React/TypeScript application with the approved styling and test toolchain.
- **Requirements:** Enables all requirements; establishes KTD1-KTD2.
- **Dependencies:** None.
- **Files:** `package.json`, `package-lock.json`, `.nvmrc`, `index.html`, `vite.config.ts`, `tsconfig*.json`, `eslint.config.js`, `playwright.config.ts`, `components.json`, `src/main.tsx`, `src/App.tsx`, `src/App.test.tsx`, `src/styles.css`, `src/test/setup.ts`.
- **Approach:** Scaffold the smallest client application, configure the GitHub Pages base path, define semantic visual tokens, and configure Tailwind/shadcn without adding unused component source. Keep the app shell intentionally thin so domain behavior lands in U2; each later UI unit adds only the primitives it actually uses.
- **Test scenarios:** The application entry point renders without runtime errors; the test harness can mount React; the production build resolves assets beneath the repository base path.
- **Verification:** Dependency installation is reproducible from the lockfile, type checking and linting pass, a smoke test passes, and the production bundle builds.

### U2. Implement the deterministic workshop domain and timer

- **Goal:** Encode the full workshop lifecycle and all timing arithmetic independently of React and browser storage.
- **Requirements:** R1, R5, R8-R12, R15-R17, R20-R23; F2 and F4; AE1-AE4, AE7-AE8; KTD3-KTD4 and KTD8.
- **Dependencies:** U1.
- **Files:** `src/domain/types.ts`, `src/domain/reducer.ts`, `src/domain/timer.ts`, `src/domain/validation.ts`, `src/domain/reducer.test.ts`, `src/domain/timer.test.ts`, `src/domain/validation.test.ts`.
- **Approach:** Define typed states and domain events, inject a monotonic clock, settle elapsed intervals at transitions, and expose derived remaining time, overtime, warning state, display formatting, and summary variance. Keep elapsed values at millisecond precision internally and format them only at the view boundary.
- **Test scenarios:** A 60-minute segment becomes orange at exactly 15:00 and red at exactly 6:00; a 10-minute segment changes at 2:30 and 1:00; delayed repaint calls do not alter elapsed-time truth; pause excludes time; Next while paused records only active time and starts the next segment; zero becomes increasing overtime; Finish produces signed per-segment and total variance; invalid plans cannot start; countdown formatting supports durations above one hour.
- **Verification:** All domain tests pass with a fake clock and no browser globals; every state transition rejects invalid events without corrupting state.

### U3. Add durable local recovery

- **Goal:** Preserve preparation and live progress locally with explicit recovery and failure behavior.
- **Requirements:** R13-R15, R19; F3; AE5 and AE9; KTD5-KTD6. Provides durable support used by the user-facing replacement behavior in U5-U6 without claiming those confirmation flows itself.
- **Dependencies:** U2.
- **Files:** `src/infrastructure/clock.ts`, `src/infrastructure/storage.ts`, `src/infrastructure/storage.test.ts`.
- **Approach:** Add a schema-versioned snapshot codec, immediate draft/transition saves, one-second-or-faster foreground checkpoints, lifecycle saves, restore-as-paused hydration, confirmed reset for incompatible data, and commit-before-publish transitions. Unsupported storage capability blocks Start with a clear explanation rather than pretending progress is recoverable. Document simultaneous tabs as unsupported instead of adding ownership coordination.
- **Test scenarios:** An unfinished draft round-trips; application-qualified keys ignore unrelated values on the same origin; running and paused snapshots hydrate paused without closed time; a schedulable crash between checkpoints loses no more than one second; repeated checkpoint write failures neither lose nor duplicate elapsed time; startup and mid-session storage failures follow the current fail-closed contract unless the deferred persistence decision is resolved before U3 begins; every load-bearing transition retains its prior visible and stored state when commit fails; malformed, cross-field-invalid, and unknown-version snapshots remain untouched until confirmed reset.
- **Verification:** Adapter tests prove snapshot invariants, transition atomicity, checkpoint ordering, failure propagation, and confirmed corrupt-data reset without requiring unfinished UI or browser flows.

### U4. Build plan preparation

- **Goal:** Let the facilitator create and validate the complete fixed plan before starting.
- **Requirements:** R1-R5, R19-R20, R23; F1; AE6-AE7; KTD7.
- **Dependencies:** U3.
- **Files:** `src/components/PlanEditor.tsx`, `src/components/PlanEditor.test.tsx`, relevant `src/components/ui/*`, `src/App.tsx`, `src/App.test.tsx`, `src/styles.css`, `tests/e2e/workshop.spec.ts`.
- **Approach:** Render an editable ordered segment list with add, rename, positive whole-minute duration, delete, and explicit Move Up/Down controls. Show total planned duration, field-level validation, draft persistence state, and a disabled Start action until the whole plan is valid. Duplicate names remain valid.
- **Test scenarios:** Add, edit, delete, and reorder segments; first/last movement controls are correctly unavailable; totals update after every edit; blank names and zero, negative, decimal, or non-numeric durations identify the affected field and disable Start; duplicate names start successfully; a valid plan starts its first segment.
- **Verification:** Component interaction tests cover validation and ordering; the primary Playwright flow creates a multi-segment plan and enters the live view with the persisted order intact.

### U5. Build focused live guidance

- **Goal:** Deliver the peripheral, low-attention live timer experience that is the product's core value.
- **Requirements:** R5-R15, R17, R21, R23; F2-F3; AE1-AE5 and AE8-AE9; KTD2-KTD4 and KTD8.
- **Dependencies:** U3, U4.
- **Files:** `src/components/LiveTimer.tsx`, `src/components/LiveTimer.test.tsx`, relevant `src/components/ui/*`, `src/App.tsx`, `src/App.test.tsx`, `src/styles.css`, `tests/e2e/workshop.spec.ts`, `tests/e2e/recovery.spec.ts`.
- **Approach:** Make current segment and countdown dominant, next segment secondary, and the background fill proportional to remaining planned time. Apply neutral, warning, urgent, paused, and overtime treatments with accompanying text. Keep Pause/Resume and Next—or Finish on the final segment—as the only prominent controls. Place New Plan separately as a lower-emphasis destructive action, and never make destructive confirmation the default. Connect controls to domain events; use the display loop only to refresh derived output. Announce meaningful state transitions without announcing each countdown tick, and manage focus across view changes, confirmations, and recovery errors.
- **Test scenarios:** Background drainage tracks remaining proportion; exact 25% and 10% boundaries change both color and label; pause visibly overrides warning presentation without losing the underlying time; overtime is distinct and counts upward; Next is immediate; Finish appears only on the final segment and is confirmed; New Plan is visually separated while running and paused, where cancel preserves the session and confirm discards it; destructive confirmation is not the default action; next-segment context disappears on the final segment; refresh returns paused with the same current segment; persistence failure presentation follows the currently selected durability contract; assistive technology is not notified every second but receives each meaningful transition; focus enters and returns from dialogs and recovery states predictably.
- **Verification:** Component tests prove accessible labels, transition announcements, focus behavior, action hierarchy, confirmation, and failure presentation; Playwright advances virtual time through neutral, warning, red, pause, restore, overtime, Next, Finish, and active-session replacement without wall-clock waits.

### U6. Complete reflection, integration, and static delivery

- **Goal:** Close the end-to-end workflow with a trustworthy summary and a deployable real-use build.
- **Requirements:** R4, R16-R18, R22-R23; F4; AE4 and AE6; supports all success criteria.
- **Dependencies:** U5.
- **Files:** `src/components/SummaryView.tsx`, `src/components/SummaryView.test.tsx`, relevant `src/components/ui/*`, `src/App.tsx`, `src/App.test.tsx`, `src/styles.css`, `tests/e2e/workshop.spec.ts`, `.github/workflows/ci.yml`, `.github/workflows/deploy-pages.yml`, `README.md`.
- **Approach:** Show planned, actual active, and signed variance per segment and in totals, where variance equals actual minus planned: positive is overtime and negative is under plan. Preserve the summary until confirmed replacement. Integrate the full application state flow, document browser-local behavior and limitations, run CI on proposed changes, and deploy the static production artifact to GitHub Pages from the repository's primary branch.
- **Test scenarios:** Completing multiple segments shows correct row and total arithmetic; a paused Finish excludes paused time; summary survives reload; canceling New Plan preserves the summary; confirming it returns to a blank preparation view; the deployed base path loads and refreshes without missing assets.
- **Verification:** The complete browser suite passes in Chromium, Firefox, and WebKit; CI executes all automated gates; the Pages build is reachable and the documented real-use smoke rehearsal succeeds on a secondary display.

---

## Verification Contract

### Automated Gates

- `npm ci` — reproduce the dependency graph from the committed lockfile.
- `npm run typecheck` — reject invalid domain and component type relationships.
- `npm run lint` — enforce the configured TypeScript and React quality rules.
- `npm run test` — execute deterministic domain, persistence, and component tests once in CI mode.
- `npm run test:e2e` — execute the primary workshop and recovery flows in Chromium, Firefox, and WebKit using virtual browser time rather than real waiting.
- `npm run build` — produce the GitHub Pages static artifact with the correct repository base path.

CI must run type checking, linting, unit/component tests, browser tests, and the production build for pull requests and primary-branch updates. Pages deployment runs only after the primary branch passes the build gate.

### Behavioral Trace

- **Preparation:** R1-R5, R19-R20, and AE7 are proven by domain validation, component interactions, and the opening portion of `workshop.spec.ts`.
- **Live timing:** R5-R12, R15, R17, R21, and AE1-AE4/AE8 are proven first by fake-clock domain tests, then by virtual-clock browser assertions.
- **Recovery:** R13-R15, R19, and AE5/AE9 are proven by snapshot tests and `recovery.spec.ts`, including the one-second foreground checkpoint target, restore-from-latest-checkpoint behavior, suspension limitation, storage-failure handling, confirmed corrupt-data reset, and the cold-reopen network prerequisite.
- **Replacement:** The active-session and completed-summary branches of AE6 are proven in U5 and U6 respectively, including cancel and confirm outcomes.
- **Completion:** R16-R18, R22-R23, and AE4/AE6 are proven by summary arithmetic tests and the final browser flow.

### Manual Real-Use Gate

Before the September workshop, run a rehearsal from the production Pages URL on the intended computer and browser with Workshop Timer visible on the secondary display. Confirm that a representative multi-hour plan can be prepared, paused, advanced through warning and overtime states, refreshed and resumed, completed, and reviewed without opening developer tools. This gate evaluates peripheral legibility, control sizing, confirmation clarity, and whether the live view reduces clock-checking; it does not replace automated timing assertions.

---

## Definition of Done

### Global Completion

- All R1-R23 requirements, F1-F4 flows, and AE1-AE9 examples are implemented and trace to automated or explicit manual verification.
- The timer derives elapsed time from the monotonic clock and passes delayed-render, pause, overtime, recovery, one-second foreground-checkpoint, and suspended-page limitation tests.
- The application persists only browser-local data, fails closed when storage is unavailable, restores live sessions paused, documents simultaneous tabs as unsupported, and never overwrites corrupt storage without confirmed reset.
- The interface communicates timing state without relying on color alone and remains usable by keyboard at the supported desktop widths.
- All automated gates pass from a clean dependency installation, and the GitHub Pages production URL passes the real-use rehearsal.
- `README.md` documents setup, scripts, deployment, browser-local persistence, one-active-plan behavior, recovery precision, and deferred capabilities.
- Dependencies and source-owned shadcn components are limited to those actually used. Experimental, superseded, and abandoned-attempt code is removed before completion.
- The implementation does not modify this plan to track execution progress; work state is recorded by the executor outside the plan artifact.

### Per-Unit Completion

- **U1:** A clean checkout installs, checks, tests, and builds the application shell reproducibly.
- **U2:** The complete state machine and timing model pass deterministic fake-clock tests without React or browser globals.
- **U3:** Drafts and sessions survive supported interruptions; transition commits are atomic; storage failures follow the current fail-closed contract unless explicitly resolved otherwise before U3 begins; schedulable abrupt-termination loss stays within one second; and corrupt payloads remain untouched until confirmed reset.
- **U4:** A valid ordered plan can be prepared and started; every invalid input path is explained and blocks Start.
- **U5:** The live view provides current/next context, proportional drainage, exact warning boundaries, pause, overtime, manual advance, and recovery with accessible state signals.
- **U6:** Completion arithmetic, summary retention/replacement, CI, documentation, static deployment, cross-browser tests, and the real-use rehearsal are complete.

---

## Risks and Dependencies

- **Browser throttling could make a tick-based countdown drift.** KTD4 derives time from monotonic timestamps; rendering frequency affects smoothness only, not recorded duration.
- **A crash can occur between storage writes or after the page is suspended.** One-second-or-faster foreground checkpoints bound loss while JavaScript remains schedulable; lifecycle saves reduce loss during normal navigation and hiding; the product explicitly reports the latest-checkpoint recovery limit when suspension prevents further writes.
- **Storage can fail at startup or mid-session.** Capability checks, commit-before-publish transitions, and a blocking paused error state prevent the visible workflow from getting ahead of durable state; injected failures verify retry continuity.
- **Persisted data can be malformed or become incompatible.** Shared cross-field validation shows a clear incompatibility message and preserves the rejected payload until the facilitator confirms reset; repair and migration tooling remain out of scope.
- **Two tabs can overwrite one local snapshot.** Simultaneous Workshop Timer tabs are explicitly unsupported in the first version and documented as a browser-local limitation.
- **Large background fields can become visually dominant or inaccessible.** Semantic tokens, contrast checks, text labels, and the real-use secondary-display rehearsal validate peripheral awareness without color-only meaning.
- **GitHub Pages serves the app from a repository subpath.** The Vite base and deployment workflow must be tested against the production project URL, not only the development root.
- **A cold reopen depends on network availability.** The first version has no service worker or installable offline artifact, so the rehearsal must verify connectivity and document that recovery cannot begin until the static application loads.
- **shadcn can encourage unnecessary component accumulation.** Install and own only the primitives used by the three views; product-specific timer visuals remain local custom code.
- **Pages activation and repository workflow permissions are external prerequisites.** If deployment cannot be enabled automatically, implementation may finish locally but real-use delivery remains incomplete until a repository administrator enables Pages and Actions permissions.

## Alternative Approaches Considered

- **Next.js with static export:** Technically viable, but its routing, server rendering, and server/client boundaries add concepts without current product value. Reconsider if the product gains accounts, server data, shareable routes, or a hosted plan library.
- **Vanilla TypeScript:** Would minimize dependencies, but hand-built DOM lifecycle and view synchronization would compete with the timer domain for attention. React provides a clearer boundary for three stateful views while the domain stays framework-independent.
- **Drag-and-drop ordering:** Familiar, but adds dependency, keyboard, touch, and testing complexity for a small list. Explicit movement controls are sufficient for first use.
- **Per-frame persistence:** Could reduce the crash-loss window below one second, but creates excessive synchronous storage writes. Checkpointing gives a declared and tested precision bound.

## Deferred / Open Questions

### From 2026-07-17 review

- **Persistence failure must prioritize timing or durability** — Goal Capsule / KTD5 / U3 / U5 (P1, product-lens-reviewer and coherence-reviewer, confidence 100)

  The current fail-closed contract can halt live timing after a storage write fails, prioritizing recoverability over uninterrupted workshop guidance. Before implementation reaches the failure path, decide whether the timer should pause until durability is restored or continue in memory with a prominent non-durable warning and recovery from the latest successful checkpoint.

- **The release-gating browser is not named** — U6 / Verification Contract / Definition of Done (P2, product-lens-reviewer and scope-guardian-reviewer, confidence 100)

  The plan currently requires the complete browser suite in Chromium, Firefox, and WebKit even though first use occurs on one known computer and browser. Name the intended September browser and decide whether other engines receive the full release-blocking suite, lightweight advisory smoke coverage, or deferred support.

- **The minimum supported secondary-display viewport is undefined** — KTD2 / U4-U6 / Definition of Done (P2, design-lens-reviewer, confidence 100)

  A narrow secondary-display window, long segment names, or a large summary can materially alter the experience. Define the minimum supported width and height, what live information must remain visible without scrolling, long-name behavior, preparation-row reflow, summary overflow, and the viewports used for verification.

- **System-sleep time has no explicit timing policy** — KTD4 / State and Data Lifecycle (P2, adversarial-document-reviewer, confidence 75)

  The plan excludes paused and closed-browser time but does not say whether operating-system sleep during an open running session counts as active time. Choose whether sleep contributes to elapsed time or forces a paused recovery from the latest checkpoint, then verify the behavior on the intended workshop computer and browser.
