import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { app } from './app';
import { DIST_DIR } from './config';

/**
 * The response-header contract (S-9) and the error-body contract (S-6).
 *
 * Why this file exists: with no reviewer and no security-audit gate, "`script-src`
 * never includes `'unsafe-inline'`" is a sentence in a document and nothing else.
 * Asserting the **whole** Content-Security-Policy makes any widening of it a test
 * failure rather than something a reader has to notice in a diff.
 *
 * Every request here targets an unrouted path, so the 404 handler answers and the
 * database is never opened. The suite therefore holds on a fresh clone with no
 * `data/f1.db`, which matters because the headers are the same on every response —
 * `secureHeaders` is registered on `'*'` precisely so error responses carry them too.
 */

/** Parse a CSP header into `directive -> sources`, so a failure names the directive. */
function parseCsp(header: string | null): Record<string, string> {
  expect(header).not.toBeNull();
  const entries = (header ?? '')
    .split(';')
    .map((part) => part.trim())
    .filter((part) => part.length > 0)
    .map((part) => {
      const gap = part.indexOf(' ');
      return gap === -1
        ? ([part, ''] as const)
        : ([part.slice(0, gap), part.slice(gap + 1)] as const);
    });
  return Object.fromEntries(entries);
}

async function headersOfUnroutedRequest(): Promise<Headers> {
  const res = await app.request('/__no_such_route__');
  expect(res.status).toBe(404);
  return res.headers;
}

const gsapRequire = createRequire(import.meta.url);

/**
 * The gsap package root, located through its own `exports` map rather than by
 * assuming a flat `node_modules` layout.
 */
function gsapFile(relative: string): string {
  return path.join(path.dirname(gsapRequire.resolve('gsap/package.json')), relative);
}

describe('server/app — Content-Security-Policy (S-9)', () => {
  it('sends exactly the policy ARCHITECTURE.md §7.3/§7.4 specifies', async () => {
    const csp = parseCsp((await headersOfUnroutedRequest()).get('content-security-policy'));

    // Full equality on purpose. A new directive, a widened source list or a dropped
    // restriction all fail here, which is the only automated gate the policy has.
    expect(csp).toEqual({
      'default-src': "'self'",
      'base-uri': "'self'",
      'script-src': "'self'",
      'style-src': "'self'",
      'style-src-attr': "'unsafe-inline'",
      'img-src': "'self' data:",
      'font-src': "'self'",
      'connect-src': "'self'",
      'object-src': "'none'",
      'frame-ancestors': "'none'",
      'form-action': "'none'",
      'upgrade-insecure-requests': '',
    });
  });

  it("never allows inline or eval'd script, and never inline <style>", async () => {
    // Stated separately from the equality assertion above because this is the rule; the
    // equality is only the mechanism. A failure here should read as the rule breaking.
    const csp = parseCsp((await headersOfUnroutedRequest()).get('content-security-policy'));
    expect(csp['script-src']).not.toContain("'unsafe-inline'");
    expect(csp['script-src']).not.toContain("'unsafe-eval'");
    expect(csp['style-src']).not.toContain("'unsafe-inline'");
  });

  it('allows an inline style attribute, and only that', async () => {
    // ARCHITECTURE.md §7.4 / §10 #26. This is deliberate, not leftover: see the two
    // GSAP assertions below for the reachable call that needs it.
    const csp = parseCsp((await headersOfUnroutedRequest()).get('content-security-policy'));
    expect(csp['style-src-attr']).toBe("'unsafe-inline'");
  });

  it('sends the other S-9 headers and no Server/X-Powered-By', async () => {
    const headers = await headersOfUnroutedRequest();
    expect(headers.get('x-frame-options')).toBe('DENY');
    expect(headers.get('x-content-type-options')).toBe('nosniff');
    expect(headers.get('referrer-policy')).toBe('no-referrer');
    expect(headers.get('cross-origin-opener-policy')).toBe('same-origin');
    expect(headers.get('x-powered-by')).toBeNull();
  });

  it('sends no CORS header at all (S-11 by omission, §7.2)', async () => {
    const headers = await headersOfUnroutedRequest();
    // Registering `hono/cors` to "close a gap" would open one. Do not add it.
    expect(headers.get('access-control-allow-origin')).toBeNull();
    expect(headers.get('access-control-allow-credentials')).toBeNull();
  });
});

describe('server/app — error hygiene on the wire (S-6)', () => {
  it('answers an unknown path with the fixed error body and nothing else', async () => {
    // `errors.test.ts` proves the mapping leaks nothing; this proves the app uses it, so
    // the guarantee holds on the wire and not only in a pure function.
    const res = await app.request('/__no_such_route__');
    expect(res.status).toBe(404);
    const text = await res.text();
    expect(JSON.parse(text)).toEqual({ error: { code: 'NOT_FOUND', message: 'Not found.' } });
    expect(text).not.toContain('Error:');
    expect(text).not.toContain('SQLITE_');
    expect(text).not.toMatch(/(^|[^a-z])\/[a-z]/i);
  });
});

describe('server/app — why style-src-attr is still allowed', () => {
  /**
   * A canary, not a test of our code. When a GSAP upgrade removes this call, this test
   * fails — and that failure is the prompt to re-check §7.4 and try removing the
   * directive. Without it, the allowance would be inherited forever by silence.
   */
  it('gsap/ScrollTrigger still sets the style *attribute* on its startup path', () => {
    const source = readFileSync(gsapFile('ScrollTrigger.js'), 'utf8');
    expect(
      source,
      'gsap/ScrollTrigger.js no longer calls setAttribute("style", …). That was the ' +
        "only reason style-src-attr needs 'unsafe-inline'. Re-read ARCHITECTURE.md §7.4, " +
        'try removing the directive, and confirm zero CSP violations in the ' +
        'production-preview console before updating this test.',
    ).toContain('setAttribute("style"');
  });

  /**
   * The policy applies to the shipped artefact, not to `node_modules`. Minification
   * rewrites the literal — esbuild emits backticks — so this is asserted on the built
   * bundle rather than assumed to survive. Runs only after `npm run build`; `dist/` is
   * gitignored, and the run reports it as skipped rather than passing quietly.
   */
  it.runIf(existsSync(DIST_DIR))('the call survives into the production bundle', () => {
    const bundles = readdirSync(path.join(DIST_DIR, 'assets')).filter((name) =>
      name.endsWith('.js'),
    );
    expect(bundles.length).toBeGreaterThan(0);
    const code = bundles
      .map((name) => readFileSync(path.join(DIST_DIR, 'assets', name), 'utf8'))
      .join('\n');
    // Either quoting style: esbuild currently emits template literals at this target.
    expect(code).toMatch(/setAttribute\((["'`])style\1\s*,/);
  });
});

describe('server/app — nothing we author needs an inline style or script', () => {
  const repoRoot = path.dirname(DIST_DIR);

  /**
   * Asserted on the authored `index.html`, which is tracked and always present.
   * `theme-init.js` is external for exactly this reason (§7.3).
   */
  it('index.html has no inline <style>, no inline <script> body and no style attribute', () => {
    const html = readFileSync(path.join(repoRoot, 'index.html'), 'utf8');
    expect(html).not.toMatch(/<style[\s>]/i);
    expect(html).not.toMatch(/\sstyle\s*=/i);
    // Every <script> must carry a src; a script with a body would need 'unsafe-inline'.
    for (const tag of html.match(/<script\b[^>]*>/gi) ?? []) {
      expect(tag).toMatch(/\ssrc=/i);
    }
  });

  /**
   * The build output is the artefact the policy actually applies to, and Vite can inject
   * things the source does not have (the module-preload polyfill is an inline script).
   * `dist/` is gitignored, so this runs only after `npm run build` — and it reports as
   * skipped rather than silently passing when it has not run.
   */
  it.runIf(existsSync(path.join(DIST_DIR, 'index.html')))(
    'built dist/index.html has no inline <style>, no inline <script> body and no style attribute',
    () => {
      const html = readFileSync(path.join(DIST_DIR, 'index.html'), 'utf8');
      expect(html).not.toMatch(/<style[\s>]/i);
      expect(html).not.toMatch(/\sstyle\s*=/i);
      for (const tag of html.match(/<script\b[^>]*>/gi) ?? []) {
        expect(tag).toMatch(/\ssrc=/i);
      }
    },
  );
});
