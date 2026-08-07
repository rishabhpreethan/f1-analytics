import { useParams } from 'react-router';
import { DataUnavailableState } from '@/components/ui/DataUnavailableState';
import { ErrorState } from '@/components/ui/ErrorState';
import { StateCard } from '@/components/ui/StateCard';
import { CalendarDays } from '@/components/ui/icons';
import { useMeta } from '@/features/meta/useMeta';
import { SeasonCalendar } from '@/features/season/SeasonCalendar';
import { SeasonMasthead } from '@/features/season/SeasonMasthead';
import { SeasonNotes } from '@/features/season/SeasonNotes';
import { SeasonStandings } from '@/features/season/SeasonStandings';
import {
  dialCells,
  driverTitleCard,
  mergeCalendar,
  noticesFor,
  teamTitleCard,
} from '@/features/season/presenters';
import {
  type DriverStandingRow,
  type TeamStandingRow,
  resolveSeasonYear,
  selectDriverStandings,
  selectSeasonNotices,
  selectTeamStandings,
} from '@/features/season/selectors';
import { useRetrySeason, useSeason, useSeasons } from '@/features/season/useSeason';

/**
 * `/seasons` and `/seasons/:year` — **one surface, two entry points** (`ARCHITECTURE.md` §5).
 *
 * **This is the feature boundary, so this is the only thing here that fetches** (§3). It calls the
 * three hooks, runs the pure selectors and the pure presenters, and hands plain values to
 * presentational children. No section below fetches anything and none derives a championship
 * figure of its own.
 *
 * **Nothing on this page sums a point.** Every points and position figure originates in
 * `driver_championship` / `team_championship` and arrives already scored by that era's rules — 1950
 * reads Farina 30 / Fangio 27 / Fagioli 24 under the best-4 rule, which is *not* the sum of their
 * race points. A total this surface computed itself would be a defect, not an approximation
 * (`DATABASE.md` §7 trap 4).
 *
 * **The masthead outlives every failure below it.** This is the landing page's rule applied here:
 * *"no failure of `/api/meta` can blank this page"*. The year, the season picker and the arrows
 * need only the season **list**, so a failed or missing season payload replaces the content and
 * leaves the navigation — which is the one thing a reader needs in order to get somewhere else.
 * An error card that also removes the way out is two failures, not one.
 *
 * **A bad year in the URL degrades, it never crashes.** `resolveSeasonYear` returns `defaulted`
 * with the rejected string, so `/seasons/1066` renders the current season *and* an explanation —
 * which is the right outcome for what is usually a typo.
 */
export function SeasonHub() {
  const { year: yearParam } = useParams();

  const meta = useMeta();
  const resolved = resolveSeasonYear(yearParam, meta.data);
  const year = resolved.year;

  const seasons = useSeasons();
  const season = useSeason(year);
  const retry = useRetrySeason(year);

  const data = season.data;
  const pending = data === undefined && season.error === null;

  const notices = data === undefined ? [] : selectSeasonNotices(data);
  const calendar = data === undefined ? null : mergeCalendar(data.rounds, data.cancelledRounds);
  const driverStandings = data === undefined ? [] : selectDriverStandings(data);
  const teamStandings = data === undefined ? [] : selectTeamStandings(data);

  /*
   * The per-round lap marker earns its place only when the season is *partially* covered. On a
   * season where every round is the same, the season-level notice says it better and a chip on
   * every row is noise.
   */
  const markLapCoverage = notices.some((notice) => notice.code === 'partialLapData');

  const progressLine =
    data === undefined
      ? null
      : data.isComplete
        ? `${String(data.completedRounds)} rounds, all raced.`
        : `${String(data.completedRounds)} of ${String(data.scheduledRounds)} rounds complete.`;

  return (
    <div className="shell-container season px-4 md:px-6 xl:px-8">
      <SeasonMasthead
        year={year}
        years={seasons.data?.seasons.map((entry) => entry.year) ?? []}
        dial={calendar === null ? null : dialCells(calendar)}
        driverTitle={data === undefined ? null : driverTitleCard(driverStandings, data.isComplete)}
        teamTitle={data === undefined ? null : teamTitleCard(teamStandings, data.isComplete)}
        notices={noticesFor(notices, 'masthead')}
        progressLine={progressLine}
        pending={pending}
        failed={season.error !== null}
      />

      {/*
       * A year the URL named that could not be used. Rendered as a note rather than an error page:
       * the hub below it is correct and useful, and a typo should not cost the reader the surface.
       */}
      {resolved.rejected !== null && (
        <SeasonNotes
          notices={[
            {
              code: 'noStandings',
              text: `“${resolved.rejected}” isn’t a season in the record, so the current season is shown instead.`,
            },
          ]}
        />
      )}

      <SeasonBody
        season={season}
        meta={meta}
        year={year}
        retry={retry}
        calendar={calendar}
        notices={notices}
        markLapCoverage={markLapCoverage}
        pending={pending}
        driverStandings={driverStandings}
        teamStandings={teamStandings}
        asOfRound={data?.standings.asOfRound ?? null}
        isComplete={data?.isComplete ?? false}
      />
    </div>
  );
}

/**
 * Everything below the masthead. Split out so the four failure states are one `switch`-shaped
 * block rather than four early returns that each take the navigation down with them.
 */
function SeasonBody({
  season,
  meta,
  year,
  retry,
  calendar,
  notices,
  markLapCoverage,
  pending,
  driverStandings,
  teamStandings,
  asOfRound,
  isComplete,
}: {
  season: ReturnType<typeof useSeason>;
  meta: ReturnType<typeof useMeta>;
  year: number | null;
  retry: () => void;
  calendar: ReturnType<typeof mergeCalendar> | null;
  notices: ReturnType<typeof selectSeasonNotices>;
  markLapCoverage: boolean;
  pending: boolean;
  driverStandings: readonly DriverStandingRow[];
  teamStandings: readonly TeamStandingRow[];
  asOfRound: number | null;
  isComplete: boolean;
}) {
  // The fresh-clone case gets the instructional state, not an error card.
  const unavailable =
    meta.error?.code === 'DATABASE_UNAVAILABLE' || season.error?.code === 'DATABASE_UNAVAILABLE';

  if (unavailable) return <DataUnavailableState />;

  /*
   * A 404 on a well-formed request is different from a malformed one and says so. It is reachable
   * for a year inside the schema's range that the data does not hold, which is not a fault of the
   * reader and not a fault of the product — so it is `neutral`, never `critical` (§3.4.3).
   */
  if (season.error?.code === 'NOT_FOUND' && year !== null) {
    return (
      <StateCard
        icon={<CalendarDays />}
        tone="neutral"
        as="h2"
        title={`No ${String(year)} season`}
        code="NOT_FOUND"
      >
        {/*
         * **Both halves of the sentence have to stay true.** An earlier draft read "seasons run
         * from X to Y, and {year} is not one of them", which contradicts itself for any year
         * inside the range — and this state is *only* reachable for a year `resolveSeasonYear`
         * could not range-check, because `/api/meta` had not answered yet. So it states the
         * absence and then the range, rather than deriving one from the other.
         */}
        <p>There is no {year} season in the record.</p>
        {meta.data !== undefined && (
          <p>
            It holds every season from {meta.data.seasons.firstYear} to{' '}
            {meta.data.seasons.latestYear}.
          </p>
        )}
      </StateCard>
    );
  }

  if (season.error !== null) {
    return (
      <ErrorState
        title="This season could not be loaded"
        detail="Nothing was lost — the record is read-only. Try again."
        code={season.error.code}
        onRetry={retry}
      />
    );
  }

  // A season with no rounds at all has nothing to put in a calendar, and the notice says so.
  const pageNotices = noticesFor(notices, 'page');
  if (pageNotices.length > 0) return <SeasonNotes notices={pageNotices} />;

  return (
    <>
      <SeasonCalendar
        entries={calendar}
        notices={noticesFor(notices, 'calendar')}
        markLapCoverage={markLapCoverage}
        pending={pending}
      />

      <SeasonStandings
        year={year ?? 0}
        drivers={driverStandings}
        teams={teamStandings}
        driverNotices={noticesFor(notices, 'standings')}
        teamNotices={noticesFor(notices, 'constructors')}
        asOfRound={asOfRound}
        isComplete={isComplete}
        pending={pending}
      />
    </>
  );
}
