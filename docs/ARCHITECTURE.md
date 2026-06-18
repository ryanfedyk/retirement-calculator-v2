# Horizon — Architecture & Key Principles

A retirement-countdown + financial-forecasting app ("Horizon — The Elegant Taper").
Originally a single-user prototype hardcoded to one person; now a multi-user product
with accounts, streamlined onboarding, and cloud save.

## Tech stack

- **Next.js 16** (App Router, Turbopack) — ⚠️ **breaking changes vs. older Next**. Per
  [AGENTS.md](../AGENTS.md), read the relevant guide in `node_modules/next/dist/docs/`
  before writing framework code.
- **React 19**, **TypeScript** (strict).
- **Zustand** (+ `persist`) for client state.
- **Firebase** — Auth (Google + email/password) and Firestore (per-user cloud save).
- **Recharts** for charts, **Tailwind v4** present but most styling is inline via a JS
  token object (see Conventions).
- Deployed on **Firebase App Hosting** (git-push-triggered rollouts).

## Core principles

1. **Single source of truth = the Zustand store** ([store/useFinancialStore.ts](../store/useFinancialStore.ts)).
   It holds three persisted slices: `profile`, `config`, `snapshot`. Everything the user
   sees derives from these. `livePrice` is transient (not persisted).
2. **No hardcoded personal data.** Per-user data lives in `profile`; generic blank-slate
   defaults live in [config/sharedConfig.ts](../config/sharedConfig.ts). Avoid
   reintroducing person- or employer-specific constants.
3. **Cloud wins on login; localStorage is the offline cache.** See Data flow.
4. **Responsive = two trees.** `useIsMobile()` switches between the desktop tree and the
   mobile tree; most feature components have a desktop and a mobile variant. Change both.
5. **Styling via color tokens.** Import `C` from [config/colors.ts](../config/colors.ts)
   and use inline styles. Don't hardcode hex values in components.

## Directory map

```
app/                 App Router entry
  layout.tsx         wraps AuthProvider > CloudSyncProvider
  page.tsx           the GATE: spinner / sign-in / onboarding / dashboard
  api/               route handlers (quotes, analyze[Gemini], seasons)
components/
  auth/              SignInScreen
  onboarding/        OnboardingFlow (name, birth year, retirement date, savings)
  forecasting/       LifeEventsFab
  finance/           desktop financial dashboard (LeftPanel/RightPanel/PriceTicker/…)
  mobile/            mobile variants (MobileApp/MobileFinancial/MobileForecasting/ConfigSheet)
  DashboardShell.tsx desktop shell (Financial + Forecasting views)
  Header.tsx         desktop header + account menu
  FlightMap.tsx      forecasting timeline (SVG)
config/              sharedConfig (defaults+types), horizonConfig (static + useHorizonProfile), colors
engine/              calculator.ts (runSimulation) + tax_engine.ts  ← pure, no React
hooks/, lib/         useRetirementDate, horizonUtils, firebase, auth/, cloud/
store/               useFinancialStore (the source of truth)
```

## Auth & app gating

- [lib/auth/AuthProvider.tsx](../lib/auth/AuthProvider.tsx) exposes `{ user, loading,
  configured, signInWithGoogle, signInWithEmail, signUpWithEmail, signOutUser }`.
- [app/page.tsx](../app/page.tsx) gates: **not configured / loading → spinner or sign-in →
  onboarding (if `!profile.onboarded`) → DashboardShell**.
- If `NEXT_PUBLIC_FIREBASE_*` env is missing, `firebaseConfigured` is false and the app
  shows the sign-in screen with a "not configured" banner instead of throwing.

## Data flow (cloud sync)

[lib/cloud/CloudSyncProvider.tsx](../lib/cloud/CloudSyncProvider.tsx):

- On login: `getDoc(users/{uid})`. If it exists → `store.hydrate(doc)` (**cloud wins**).
  If not → reset to defaults (so a new account on a shared browser doesn't inherit the
  previous user's localStorage). Then `ready = true`.
- On change: debounced (~1.5s) `setDoc(users/{uid}, {profile, config, snapshot})`. A
  serialized-slice guard skips writes that don't change persisted data (e.g. livePrice).
- Firestore rules ([firestore.rules](../firestore.rules)): a user may read/write only
  `users/{their-uid}`.

## The financial engine

[engine/calculator.ts](../engine/calculator.ts) `runSimulation(snapshot, config, livePrice)`
returns a monthly `TrajectoryPoint[]`. It's **pure** (no React) — keep it that way.

- Models career phases (working → optional sabbatical/jump/bridge → retired), income,
  taxes ([engine/tax_engine.ts](../engine/tax_engine.ts)), spending, ACA/Medicare, and a
  **concentrated equity position**.
- **Concentrated position (`config.concentrated_symbol`)**: the user's employer/RSU stock.
  The holding whose symbol matches gets its own growth rate
  (`market_assumptions.goog_growth_rate`, labeled "Employer Stock Growth"), vesting, and a
  divestment strategy (`config.divestment_strategy`). Default `""` = no concentrated
  position (all holdings grow at their own `expected_return`). Internal identifiers still
  say `goog*`/`GOOGLE` for historical reasons — these are NOT Google-specific anymore;
  user-facing labels say "Employer Stock" / "Career".

## Forecasting view

- [config/horizonConfig.ts](../config/horizonConfig.ts): **static** parts (`phases`,
  `mantras`, `work`) in `HORIZON_CONFIG`; **per-user** parts (name, retirement/career
  dates, children) via the `useHorizonProfile()` hook (derives from `profile`).
- [lib/horizonUtils.ts](../lib/horizonUtils.ts): pure date/milestone helpers — child-aware
  functions take `children` as a parameter (they can't read the store).
- [components/FlightMap.tsx](../components/FlightMap.tsx): SVG timeline. Renders phase
  bands, kids' milestones, and **user life events** (`config.life_events`) added via the
  Life Events FAB.
- [components/finance/PriceTicker.tsx](../components/finance/PriceTicker.tsx): live-price
  ticker built from `snapshot.other_investments` (not a hardcoded symbol).

## Firebase / project specifics

- **Project: `retirement-calc-v2`** (the old `retirement-calculator-cd0d8` is v1 — ignore).
  The Firebase CLI may default to the wrong one; pass `--project retirement-calc-v2`.
- App Hosting backend `retirement-calc-v2` deploys from GitHub repo
  `ryanfedyk/retirement-calculator-v2` on **push to `main`**. Serves at
  `https://retirement-calc-v2--retirement-calc-v2.us-east4.hosted.app`.
- Public web config lives in [apphosting.yaml](../apphosting.yaml) (inlined at build).
  `GEMINI_API_KEY` is a Secret Manager secret; the backend must be granted access
  (`firebase apphosting:secrets:grantaccess`).
- **Local secrets are NOT in the repo** (`.env.local` is git-ignored). To run locally / in
  a web session, recreate the `NEXT_PUBLIC_FIREBASE_*` + `GEMINI_API_KEY` env vars.
- After deploy, add the prod domain to **Authentication → Authorized domains** or Google
  sign-in popups are blocked.

## Conventions & gotchas

- **Edit desktop AND mobile** variants for any feature change.
- Bump the `persist` store name (currently `horizon-financial-v8`) only with a migration
  plan — it changes the localStorage key.
- `useMemo` Date objects on primitive deps (see `useRetirementDate`) — fresh `Date`
  instances every render break downstream dependency checks.
- Test accounts exist: `horizon-tester-01..10@example.com`, password `HorizonTest123!`
  (blank accounts that go through onboarding).
