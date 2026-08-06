/**
 * **The run must say what it did not test.**
 *
 * Several suites in this project gate themselves on inputs that are deliberately not in
 * version control:
 *
 * - `data/f1.db` is gitignored and supplied separately, so `server/db.test.ts` and
 *   `server/queries/meta.test.ts` disable themselves with `describe.skipIf`.
 * - `dist/` is build output, so the two `server/app.test.ts` cases that read the built
 *   bundle disable themselves with `it.runIf`.
 *
 * In CI the database will **never** exist. Vitest's default reporter prints
 * `Tests 272 passed | 13 skipped` and nothing else — a green run in which the entire
 * database-backed server layer was never executed looks identical to a green run in which
 * it was. That is the failure mode this reporter removes.
 *
 * **It reports what actually skipped, rather than a list of suites someone maintained by
 * hand.** A registry of "known conditional suites" would be correct on the day it was
 * written and wrong the first time a gate was added somewhere else; reading the run's own
 * results cannot drift.
 *
 * It never fails the run. Absent a database, skipping is the *correct* behaviour — the
 * defect would be doing it quietly. So the output is a warning surface, in three places:
 * the terminal, the GitHub Actions job summary (`$GITHUB_STEP_SUMMARY`, which renders on the
 * run's own page rather than inside a collapsed log), and a `::warning::` annotation.
 */

import { appendFileSync } from 'node:fs';
import path from 'node:path';
import type { Reporter, TestCase, TestModule } from 'vitest/node';

/** One module's skip tally. Repo-relative path, so the output is diffable and pasteable. */
export interface SkippedModuleSummary {
  readonly file: string;
  /** Full names (`suite > test`) of the tests that did not run, in collection order. */
  readonly skipped: readonly string[];
  /** How many tests the module collected in total, skipped or not. */
  readonly collected: number;
}

export interface SkipReportTotals {
  readonly collected: number;
  readonly skipped: number;
}

const RULE = '─'.repeat(78);

/**
 * Why the cause is described as a *mechanism* rather than named per suite: naming
 * "the database tests" here would be a second place to update when a gate moves. The
 * mechanism is stable, and the file list above it is derived from the run.
 */
const CAUSE =
  'Suites gate themselves on inputs that are not in version control: data/f1.db\n' +
  '(gitignored, supplied separately) and dist/ (build output). A skipped database\n' +
  'suite means the database was absent; a skipped dist/ case means no build had run.';

/**
 * Pure. Given the per-module tallies, produce the text to print.
 *
 * Kept separate from the reporter class and unit-tested, because the one thing this
 * mechanism must never do is under-report — and a bug in the arithmetic would be invisible
 * in exactly the situation the whole thing exists to make visible.
 */
export function formatSkipReport(
  modules: readonly SkippedModuleSummary[],
  totals: SkipReportTotals,
): string {
  if (totals.skipped === 0) {
    return `\n  ✓ every collected test ran — ${String(totals.collected)} tests, 0 skipped\n`;
  }

  const whole = modules.filter((m) => m.collected > 0 && m.skipped.length === m.collected);
  const headline =
    `NOT TESTED — ${String(totals.skipped)} of ${String(totals.collected)} collected tests did not run` +
    (whole.length > 0
      ? `, and ${String(whole.length)} ${whole.length === 1 ? 'file was' : 'files were'} skipped entirely`
      : '');

  const body = modules.map((m) => {
    const entire = m.collected > 0 && m.skipped.length === m.collected;
    const head = `  ${m.file} — ${String(m.skipped.length)}/${String(m.collected)} skipped${
      entire ? '  ⟵ ENTIRE FILE' : ''
    }`;
    return [head, ...m.skipped.map((name) => `      · ${name}`)].join('\n');
  });

  return [
    '',
    RULE,
    `  ${headline}`,
    RULE,
    ...body,
    '',
    ...CAUSE.split('\n').map((line) => `  ${line}`),
    RULE,
    '',
  ].join('\n');
}

/** The same content as GitHub-flavoured Markdown, for the job summary page. */
export function formatSkipReportMarkdown(
  modules: readonly SkippedModuleSummary[],
  totals: SkipReportTotals,
): string {
  if (totals.skipped === 0) {
    return `### Tests\n\nEvery collected test ran — **${String(totals.collected)}** tests, 0 skipped.\n`;
  }

  const lines = [
    '### ⚠ Not tested in this run',
    '',
    `**${String(totals.skipped)}** of **${String(totals.collected)}** collected tests did not run.`,
    '',
    '| File | Skipped | Entire file |',
    '| --- | --- | --- |',
    ...modules.map(
      (m) =>
        `| \`${m.file}\` | ${String(m.skipped.length)} / ${String(m.collected)} | ${
          m.collected > 0 && m.skipped.length === m.collected ? 'yes' : 'no'
        } |`,
    ),
    '',
    ...modules.map((m) =>
      [
        `<details><summary><code>${m.file}</code></summary>`,
        '',
        ...m.skipped.map((n) => `- ${n}`),
        '',
        '</details>',
      ].join('\n'),
    ),
    '',
    CAUSE.replace(/\n/g, ' '),
    '',
  ];
  return lines.join('\n');
}

/** Collapses a run's modules into the tallies `formatSkipReport` consumes. */
export function summarise(
  testModules: readonly TestModule[],
  relativise: (moduleId: string) => string,
): { modules: SkippedModuleSummary[]; totals: SkipReportTotals } {
  const modules: SkippedModuleSummary[] = [];
  let collectedTotal = 0;
  let skippedTotal = 0;

  for (const testModule of testModules) {
    const all: TestCase[] = [...testModule.children.allTests()];
    const skipped = all.filter((t) => t.result().state === 'skipped');
    collectedTotal += all.length;
    skippedTotal += skipped.length;
    if (skipped.length > 0) {
      modules.push({
        file: relativise(testModule.moduleId),
        skipped: skipped.map((t) => t.fullName),
        collected: all.length,
      });
    }
  }

  modules.sort((a, b) => a.file.localeCompare(b.file));
  return { modules, totals: { collected: collectedTotal, skipped: skippedTotal } };
}

export default class ConditionalSkipReporter implements Reporter {
  onTestRunEnd(testModules: ReadonlyArray<TestModule>): void {
    const { modules, totals } = summarise(testModules, (id) =>
      path.relative(process.cwd(), id).split(path.sep).join('/'),
    );

    process.stdout.write(`${formatSkipReport(modules, totals)}\n`);

    const summaryPath = process.env.GITHUB_STEP_SUMMARY;
    if (summaryPath !== undefined && summaryPath !== '') {
      appendFileSync(summaryPath, `${formatSkipReportMarkdown(modules, totals)}\n`, 'utf8');
    }

    if (process.env.GITHUB_ACTIONS === 'true' && totals.skipped > 0) {
      // A workflow-command annotation shows on the run's Summary page, not only in the log.
      // Newlines must be percent-encoded or the command is truncated at the first one.
      const detail = modules
        .map((m) => `${m.file}: ${String(m.skipped.length)}/${String(m.collected)}`)
        .join(', ');
      process.stdout.write(
        `::warning title=${String(totals.skipped)} tests were not run::${detail}%0A%0A${CAUSE.replace(/\n/g, '%0A')}\n`,
      );
    }
  }
}
