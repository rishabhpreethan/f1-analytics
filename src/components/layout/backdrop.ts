/**
 * How loud the atmosphere is on a given route — **a pure function of the pathname**, not
 * context and not an effect (§S.3.5).
 *
 * That shape is deliberate. A provider would introduce an ordering bug the first time a
 * route rendered before its own effect ran; a route setting the attribute itself would mean
 * a route that forgets gets whatever the last one left behind. As a function of the URL there
 * is nothing to forget and nothing to sequence, and it is unit-testable without a DOM
 * (CT-13).
 *
 * **The safe default is the quiet one.** An unrecognised path is `muted`, never `full`: a
 * future route that nobody thought about here gets a background that cannot compete with it.
 */

/** The Technical Spec's vocabulary (§S.3.5). */
export type BackdropIntensity = 'full' | 'muted' | 'off';

/** The Design Spec's `data-bg` attribute values (`DESIGN_SYSTEM.md` §7.7.2). */
export type BackdropAttribute = 'hero' | 'calm' | 'off';

export const BACKDROP_ATTRIBUTE = 'data-bg';

/**
 * `/` is the only `full` route. `/seasons/:year/races/:round` is `off` — that is the
 * lap-chart surface from F3, and an animated field behind a lap-time trace is a legibility
 * defect, which CR-007 says in as many words. Everything else is `muted`.
 */
export function backdropIntensityFor(pathname: string): BackdropIntensity {
  const path = pathname.length > 1 && pathname.endsWith('/') ? pathname.slice(0, -1) : pathname;

  if (path === '/') return 'full';
  // `/seasons/{year}/races/{round}` — matched on shape rather than on a parsed year, because
  // this decides how loud a background is, not what data to fetch. `:year` is validated
  // where it means something, which is F2's job and not this function's.
  if (/^\/seasons\/[^/]+\/races\/[^/]+$/.test(path)) return 'off';
  return 'muted';
}

/**
 * The two vocabularies, mapped in one place. They differ because the Technical Spec named
 * the *levels* and the Design Spec named the *attribute*; keeping both and converting here
 * means neither spec has to be quietly renamed, and the conversion is visible.
 */
const ATTRIBUTE: Record<BackdropIntensity, BackdropAttribute> = {
  full: 'hero',
  muted: 'calm',
  off: 'off',
};

export function backdropAttributeFor(pathname: string): BackdropAttribute {
  return ATTRIBUTE[backdropIntensityFor(pathname)];
}
