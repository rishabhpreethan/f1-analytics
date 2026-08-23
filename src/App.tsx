import { lazy } from 'react';
import { BrowserRouter, Route, Routes } from 'react-router';
import { Landing } from '@/routes/Landing';
import { NotFound } from '@/routes/NotFound';
import { RootLayout } from '@/routes/RootLayout';

/**
 * The route table is `ARCHITECTURE.md` §5 verbatim — **twelve** routes plus the catch-all —
 * and every one of them is a slug or a year, never an internal integer id (DL-3, trap
 * 11).
 *
 * **CR-007 moved the season hub off `/` and put the landing page there** (§10 #23). There is
 * **no redirect** in either direction, and that is a decision rather than an omission: `/`
 * did not move, it changed meaning, nothing outside this repository has ever linked to it,
 * and a redirect would hide the change from the only reader who needs to notice. `/seasons`
 * and `/seasons/:year` are one surface with two entry points — the same component, with the
 * year resolved from `/api/meta` when it is absent.
 *
 * The Design Spec proposed `/season` redirecting to `/seasons/{latestYear}` instead. Routing
 * is not design's to ratify (it says so itself, §2) and the `principal-engineer` ruled the
 * other way; `/seasons` is what ships. Reported at gate 3.
 *
 * Declarative mode. Every API used here is exported from `react-router` itself; v8
 * removed the `react-router-dom` package and nothing in this product imported it.
 *
 * ==================================================================== code splitting
 *
 * **Every route surface below is a lazy chunk except the three the first paint needs**
 * (2026-08-23, `ARCHITECTURE.md` §8). F0 deliberately did not split — the routes were
 * one-paragraph placeholders and splitting them would have bought a waterfall for nothing.
 * Six features later the single chunk reached **225.76 KB gzipped, 90.3 % of the 250 KB
 * budget**, and §8's own basis says the honest fix at that point is splitting rather than a
 * larger number. So this is that.
 *
 * **Three things stay eager, and each for its own reason:**
 *
 *  - `RootLayout` — it is the shell, it renders on every URL, and it owns the Suspense
 *    boundary the others suspend inside. Splitting it would mean two round trips before
 *    anything at all is on screen.
 *  - `Landing` — `/` is the entry point for a visitor with no link, so its chunk is on the
 *    critical path by definition. Lazy-loading it would add a round trip to the one
 *    navigation nobody chose to make.
 *  - `NotFound` — it answers `*`, so it is what a mistyped or dead URL renders. A
 *    network round trip to tell someone their address is wrong is the wrong trade, and it
 *    costs ~0 bytes: `StateCard`, `ButtonLink` and the icon set are all in the initial
 *    chunk already, because the shell and the landing page use them.
 *
 * **`React.lazy` over a route-config `lazy` property**: this app runs `BrowserRouter` in
 * declarative mode, which has no data-router `lazy` route field to use. `React.lazy` plus
 * one Suspense boundary is the mechanism the mode supports, and it is also the one that
 * cooperates with React's transitions — see `RootLayout` for why that matters to whether a
 * navigation flashes.
 *
 * The `.then()` unwrapping is because these are **named** exports and `React.lazy` wants a
 * module with a `default`. Renaming twelve exports to defaults would lose the name at every
 * import site and in every stack frame, for no gain.
 *
 * **Each `import()` here is a chunk boundary**, so adding a static import of a route module
 * anywhere outside this file pulls that route's whole surface back into the initial chunk
 * without a single test failing. Nothing enforces that mechanically; the check is
 * `npm run build`, whose budget gate prints the per-chunk table.
 */

const SeasonHub = lazy(() => import('@/routes/SeasonHub').then((m) => ({ default: m.SeasonHub })));
const RaceDeepDive = lazy(() =>
  import('@/routes/RaceDeepDive').then((m) => ({ default: m.RaceDeepDive })),
);
const DriverIndex = lazy(() =>
  import('@/routes/DriverIndex').then((m) => ({ default: m.DriverIndex })),
);
const DriverProfile = lazy(() =>
  import('@/routes/DriverProfile').then((m) => ({ default: m.DriverProfile })),
);
const TeamIndex = lazy(() => import('@/routes/TeamIndex').then((m) => ({ default: m.TeamIndex })));
const TeamProfile = lazy(() =>
  import('@/routes/TeamProfile').then((m) => ({ default: m.TeamProfile })),
);
const CircuitIndex = lazy(() =>
  import('@/routes/CircuitIndex').then((m) => ({ default: m.CircuitIndex })),
);
const CircuitProfile = lazy(() =>
  import('@/routes/CircuitProfile').then((m) => ({ default: m.CircuitProfile })),
);
const Compare = lazy(() => import('@/routes/Compare').then((m) => ({ default: m.Compare })));
const Records = lazy(() => import('@/routes/Records').then((m) => ({ default: m.Records })));

export function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route element={<RootLayout />}>
          <Route path="/" element={<Landing />} />
          <Route path="/seasons" element={<SeasonHub />} />
          <Route path="/seasons/:year" element={<SeasonHub />} />
          <Route path="/seasons/:year/races/:round" element={<RaceDeepDive />} />
          <Route path="/drivers" element={<DriverIndex />} />
          <Route path="/drivers/:driverRef" element={<DriverProfile />} />
          <Route path="/teams" element={<TeamIndex />} />
          <Route path="/teams/:teamRef" element={<TeamProfile />} />
          <Route path="/circuits" element={<CircuitIndex />} />
          <Route path="/circuits/:circuitRef" element={<CircuitProfile />} />
          <Route path="/compare" element={<Compare />} />
          <Route path="/records" element={<Records />} />
          <Route path="*" element={<NotFound />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}
