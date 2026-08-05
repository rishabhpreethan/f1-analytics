import { useRetryMeta } from '@/features/meta/useMeta';
import { Button } from '@/components/ui/Button';
import { StateCard } from '@/components/ui/StateCard';
import { Database } from '@/components/ui/icons';

/**
 * The state a contributor meets on a fresh clone (Design Spec §7.1, `DESIGN_SYSTEM.md`
 * §7.4). Copy is fixed and instructional, and the component takes no props because there
 * is nothing about it to configure.
 *
 * **The path in the copy is static UI text, never echoed from the server** (S-6). The API
 * answers `503 DATABASE_UNAVAILABLE` with a fixed message and no path, no SQLite code and
 * no stack frame; everything specific shown here is written into this file, which is why
 * it can be specific without leaking anything.
 *
 * The header keeps rendering around this — a broken data layer is not a reason to lose the
 * nav or the theme control.
 */
export function DataUnavailableState() {
  const retry = useRetryMeta();

  return (
    <div className="state-block">
      <StateCard
        icon={<Database size={20} />}
        title="No database found"
        code="DATABASE_UNAVAILABLE"
        action={
          <Button variant="primary" onClick={retry}>
            Try again
          </Button>
        }
      >
        <p>
          This application reads a local SQLite database at{' '}
          <span className="chip t-mono t-xs">data/f1.db</span>. That file is supplied separately and
          is not part of the repository.
        </p>

        <ol className="t-sm flex list-decimal flex-col gap-2 ps-5">
          <li>
            Put the database file at <span className="chip t-mono t-xs">data/f1.db</span>, relative
            to the project root.
          </li>
          <li>
            Restart the dev server: <span className="chip t-mono t-xs">npm run dev</span>
          </li>
        </ol>

        <p className="t-xs text-ink-tertiary">
          Seasons 1950–2026 are available once the database is in place.
        </p>
      </StateCard>
    </div>
  );
}
