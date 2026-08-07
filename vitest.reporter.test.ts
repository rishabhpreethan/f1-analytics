import { describe, expect, it } from 'vitest';
import {
  formatSkipReport,
  formatSkipReportMarkdown,
  type SkippedModuleSummary,
} from './vitest.reporter';

/**
 * The reporter exists so a run cannot hide what it did not test. Its arithmetic is therefore
 * the one place a bug would be invisible in exactly the situation it is meant to expose, so
 * the pure formatter is asserted directly rather than inferred from a terminal screenshot.
 *
 * Not covered here: the GitHub Actions side effects (`$GITHUB_STEP_SUMMARY` append and the
 * `::warning::` annotation). Those need a real Actions runner to confirm, and are named as
 * unverified in the hand-off.
 */

const dbSuite: SkippedModuleSummary = {
  file: 'server/db.test.ts',
  collected: 6,
  skipped: [
    'server/db > opens the database read-only and answers a trivial query',
    'server/db > returns the identical handle on a second call',
    'server/db > creates v_entry and v_race as temp views at bootstrap',
    'server/db > v_race returns 20 rows for 2024 round 1',
    'server/db > refuses a write',
    'server/db > refuses further DDL after bootstrap, proving query_only is latched',
  ],
};

const partialSuite: SkippedModuleSummary = {
  file: 'server/app.test.ts',
  collected: 24,
  skipped: ['CSP > the call survives into the production bundle'],
};

describe('formatSkipReport', () => {
  it('says so positively when nothing skipped, so a clean run is also a statement', () => {
    const out = formatSkipReport([], { collected: 285, skipped: 0 });
    expect(out).toContain('every collected test ran');
    expect(out).toContain('285 tests, 0 skipped');
    expect(out).not.toContain('NOT TESTED');
  });

  it('leads with the count that matters — how many did not run, out of how many', () => {
    const out = formatSkipReport([dbSuite], { collected: 285, skipped: 6 });
    expect(out).toContain('NOT TESTED — 6 of 285 collected tests did not run');
  });

  it('calls out a file whose every test was skipped, because that is a whole area untested', () => {
    const out = formatSkipReport([dbSuite], { collected: 285, skipped: 6 });
    expect(out).toContain('server/db.test.ts — 6/6 skipped  ⟵ ENTIRE FILE');
    expect(out).toContain('1 file was skipped entirely');
  });

  it('does not claim a partially skipped file was skipped entirely', () => {
    const out = formatSkipReport([partialSuite], { collected: 285, skipped: 1 });
    expect(out).toContain('server/app.test.ts — 1/24 skipped');
    expect(out).not.toContain('ENTIRE FILE');
    expect(out).not.toContain('skipped entirely');
  });

  it('pluralises the entirely-skipped count rather than printing "1 files"', () => {
    const second: SkippedModuleSummary = {
      file: 'server/queries/meta.test.ts',
      collected: 2,
      skipped: ['a', 'b'],
    };
    const out = formatSkipReport([dbSuite, second], { collected: 285, skipped: 8 });
    expect(out).toContain('2 files were skipped entirely');
  });

  it('names every skipped test, so the reader sees what is missing rather than a number', () => {
    const out = formatSkipReport([dbSuite], { collected: 285, skipped: 6 });
    for (const name of dbSuite.skipped) expect(out).toContain(name);
  });

  it('explains the cause as a mechanism, naming the two inputs that are not in the repo', () => {
    const out = formatSkipReport([dbSuite], { collected: 285, skipped: 6 });
    expect(out).toContain('data/f1.db');
    expect(out).toContain('dist/');
  });
});

describe('formatSkipReportMarkdown', () => {
  it('renders a table row per module with the skipped fraction', () => {
    const out = formatSkipReportMarkdown([dbSuite, partialSuite], { collected: 285, skipped: 7 });
    expect(out).toContain('| `server/db.test.ts` | 6 / 6 | yes |');
    expect(out).toContain('| `server/app.test.ts` | 1 / 24 | no |');
  });

  it('is a plain statement when nothing skipped', () => {
    const out = formatSkipReportMarkdown([], { collected: 285, skipped: 0 });
    expect(out).toContain('Every collected test ran');
    expect(out).not.toContain('Not tested');
  });

  it('emits no raw newline inside a table row, which would break the table', () => {
    const out = formatSkipReportMarkdown([dbSuite], { collected: 285, skipped: 6 });
    const rows = out.split('\n').filter((l) => l.startsWith('| `'));
    expect(rows).toHaveLength(1);
  });
});
