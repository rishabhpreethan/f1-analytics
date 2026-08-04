import { BrowserRouter, Route, Routes } from 'react-router';
import { CircuitIndex } from '@/routes/CircuitIndex';
import { CircuitProfile } from '@/routes/CircuitProfile';
import { Compare } from '@/routes/Compare';
import { DriverIndex } from '@/routes/DriverIndex';
import { DriverProfile } from '@/routes/DriverProfile';
import { NotFound } from '@/routes/NotFound';
import { RaceDeepDive } from '@/routes/RaceDeepDive';
import { Records } from '@/routes/Records';
import { RootLayout } from '@/routes/RootLayout';
import { SeasonHub } from '@/routes/SeasonHub';
import { TeamIndex } from '@/routes/TeamIndex';
import { TeamProfile } from '@/routes/TeamProfile';

/**
 * The route table is `ARCHITECTURE.md` §5 verbatim — eleven routes plus the catch-all —
 * and every one of them is a slug or a year, never an internal integer id (DL-3, trap
 * 11).
 *
 * Declarative mode. Every API used here is exported from `react-router` itself; v8
 * removed the `react-router-dom` package and nothing in this product imported it.
 *
 * Route-level code splitting is deliberately **not** introduced in F0: splitting an app
 * whose routes are one-paragraph placeholders adds a waterfall for no gain. The boundary
 * is fixed in Technical Spec §6.4 so F1 and F3 land it rather than invent it.
 */
export function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route element={<RootLayout />}>
          <Route path="/" element={<SeasonHub />} />
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
