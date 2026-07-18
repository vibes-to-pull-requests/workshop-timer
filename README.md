# Workshop Timer

Stay present. Stay on time.

Workshop Timer is a browser-local facilitator tool for planning a sequence of workshop segments, keeping the current segment visible while timing it, and comparing planned time with actual active time afterward.

## Set up locally

The project uses Node.js 24 and npm. With `nvm` installed:

```bash
nvm use
npm ci
npm run dev
```

The development server prints the local URL. The production build is served from the `/workshop-timer/` base path used by GitHub Pages.

## Commands

- `npm run dev` — start the Vite development server
- `npm run typecheck` — check TypeScript
- `npm run lint` — run ESLint
- `npm test` — run unit and component tests
- `npm run test:e2e` — build and run Playwright tests in Chromium, Firefox, and WebKit
- `npm run build` — create the static production build in `dist/`
- `npm run preview` — preview the production build

Install Playwright browsers once before the first browser-test run:

```bash
npx playwright install
```

## How persistence and recovery work

There is one active plan per browser profile. Drafts, live progress, and the latest completion summary are stored in local browser storage on the same computer. Only one tab is supported; opening the app in multiple tabs can cause the last write to win.

While timing, progress is checkpointed at least once per second and on browser lifecycle signals. A hard crash can therefore undercount the current segment by up to one second. Reopening an active workshop restores it paused, so time while the browser was closed is excluded. Time while the computer is suspended is not a release-gated behavior in this first version; confirm the restored time before resuming.

If saved data is incompatible or corrupt, the app preserves it until an explicit reset is confirmed. If storage itself is unavailable, timing cannot start safely and no destructive reset is offered.

The app is not offline-enabled. A cold reopen requires network access to load the GitHub Pages files, although the saved workshop remains local in the browser.

## Deployment

The Pages workflow builds and publishes `dist/` whenever `main` is updated. In the repository settings, set GitHub Pages **Source** to **GitHub Actions**. Pull requests and pushes also run type checking, linting, unit tests, browser tests, and the production build through the CI workflow.

## Real-use rehearsal

Before facilitating, create the full day’s plan, start it, pause and resume once, advance a segment, and reload the page to confirm recovery. Place the live view on the display you will monitor and verify that the warning colors, status text, and controls remain legible at that viewport. Keep the workshop’s source agenda separately available; this version intentionally manages one fixed timing plan rather than workshop content.
