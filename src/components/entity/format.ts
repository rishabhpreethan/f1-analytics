/**
 * **Pure string formatting for the entity pages.**
 *
 * Separated from the components that use it for the reason `geometry.ts` is separated from the
 * chart kit: every interesting case here is a *data* case, invisible in a rendering test and wrong
 * in a way that still looks like a plausible value — a mononym read past its end, a coordinate
 * whose seconds round to sixty, a monogram derived where the sport's own code exists.
 *
 * (It is also what keeps `react-refresh/only-export-components` satisfied, but that is the
 * consequence rather than the reason.)
 */

/**
 * The monogram. **Two letters for a driver, up to three initials for a team.**
 *
 * Exported and pure because the interesting cases are all data cases and none of them is visible
 * in a rendering test: a mononym ("Moss"), a name whose surname carries a diacritic ("Häkkinen"),
 * a team whose name is one word ("Ferrari") and a team whose name is five ("Scuderia Toro Rosso").
 */
export function monogram(name: string, kind: 'driver' | 'team'): string {
  const words = name.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return '—';

  if (kind === 'team') {
    /* Initials, capped at three. A five-word team name reduced to five letters is a word again. */
    return words
      .slice(0, 3)
      .map((word) => word.charAt(0).toLocaleUpperCase())
      .join('');
  }

  /* A driver's monogram comes from the **surname**, which is the last word — the part the sport
   * itself uses on a timing screen, and the part a reader is looking for. */
  const surname = words.at(-1) ?? '';
  return surname.slice(0, 2).toLocaleUpperCase();
}

/**
 * Degrees, minutes and seconds. Pure and exported, because every interesting case is arithmetic:
 * the sign, the wrap at 60 seconds, and the hemisphere letter — all invisible in a rendering test
 * and all wrong in a way that still looks like a coordinate.
 */
export function toDms(value: number, axis: 'lat' | 'lon'): string {
  const hemisphere = axis === 'lat' ? (value < 0 ? 'S' : 'N') : value < 0 ? 'W' : 'E';
  const abs = Math.abs(value);
  let degrees = Math.floor(abs);
  let minutes = Math.floor((abs - degrees) * 60);
  let seconds = Math.round((abs - degrees - minutes / 60) * 3600);
  /* 59′59.6″ rounds to 60″, which is not a second — it is the next minute. Left alone this prints
   * `26°01′60″`, which is a real coordinate written in a way no atlas would write it. */
  if (seconds === 60) {
    seconds = 0;
    minutes += 1;
  }
  if (minutes === 60) {
    minutes = 0;
    degrees += 1;
  }
  return `${String(degrees)}°${String(minutes).padStart(2, '0')}′${String(seconds).padStart(2, '0')}″ ${hemisphere}`;
}
