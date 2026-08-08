import { describe, expect, it } from 'vitest';
import { resolveEntityRef, selectAgeYears } from './entityRef';

/**
 * The client's copy of the server's `:reference` rule.
 *
 * These two must agree, and the test that matters is the **uppercase** one: a client that
 * rejected `scott_Brown` would never send the request, so the server's acceptance of it
 * would be untestable through the UI and three real drivers would be unreachable.
 */

describe('resolveEntityRef', () => {
  it.each(['alonso', 'max_verstappen', 'campbell-jones', 'brabham-alfa_romeo', 'monza'])(
    'resolves %s',
    (reference) => {
      expect(resolveEntityRef(reference)).toEqual({ status: 'resolved', reference });
    },
  );

  it.each(['scott_Brown', 'Changy', 'Cannoc'])(
    'resolves the uppercase reference %s — the pattern that reads right is wrong',
    (reference) => {
      expect(resolveEntityRef(reference)).toEqual({ status: 'resolved', reference });
    },
  );

  it.each([
    'max verstappen',
    'max.verstappen',
    "alonso'--",
    '../../etc/passwd',
    '<script>',
    'dräger',
    'a'.repeat(33),
  ])('rejects %s and reports the value so the surface can name it', (value) => {
    expect(resolveEntityRef(value)).toEqual({ status: 'invalid', value });
  });

  it('treats a missing parameter as invalid rather than fetching nothing silently', () => {
    expect(resolveEntityRef(undefined)).toEqual({ status: 'invalid', value: '' });
  });

  /** The format's ceiling, matching `server/schemas/entity.ts` exactly. */
  it('accepts 32 characters and refuses 33', () => {
    expect(resolveEntityRef('a'.repeat(32)).status).toBe('resolved');
    expect(resolveEntityRef('a'.repeat(33)).status).toBe('invalid');
  });
});

describe('selectAgeYears', () => {
  it('counts whole years', () => {
    expect(selectAgeYears('1918-07-13', '1950-09-03')).toBe(32);
    expect(selectAgeYears('1918-07-13', '1950-05-21')).toBe(31);
  });

  it('counts the birthday itself as the new age', () => {
    expect(selectAgeYears('1918-07-13', '1950-07-13')).toBe(32);
  });

  it('is null when either date is absent — 16 drivers carry no date of birth', () => {
    expect(selectAgeYears(null, '1950-09-03')).toBeNull();
    expect(selectAgeYears('1918-07-13', null)).toBeNull();
  });

  it('is null for a malformed date rather than producing NaN', () => {
    expect(selectAgeYears('13/07/1918', '1950-09-03')).toBeNull();
    expect(selectAgeYears('1918-07-13', 'today')).toBeNull();
  });

  it('is null rather than negative when the reference date precedes the birth', () => {
    expect(selectAgeYears('1990-01-01', '1980-01-01')).toBeNull();
  });
});
