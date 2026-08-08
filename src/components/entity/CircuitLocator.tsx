/**
 * **`CircuitLocator`** — `DESIGN_SYSTEM.md` §7.11, and the ruled answer to CI-1's "map".
 *
 * **There is no embedded map, and that is a decision rather than an omission** (§6.6.2.7). A tile
 * map is a third-party network call on a request path, which `ARCHITECTURE.md` §7 (S-1, DL-2)
 * forbids and the CSP does not whitelist. A vector basemap is a megabyte of geometry against a
 * 250 KB budget. And a **track outline does not exist in the data at all** — the `circuit` table
 * carries a name, a locality, a country and three numbers, so drawing a circuit shape would be
 * fabrication of exactly the kind this project rules out everywhere else.
 *
 * What ships instead is the three numbers, **drawn**. The projection is equirectangular, which
 * means it is the identity map — `x = longitude + 180`, `y = 90 − latitude` — so there is no
 * projection arithmetic to get wrong and nothing is claimed that the coordinates do not say.
 *
 * **It draws no coastline and implies none.** The graticule states what it is with its own labels;
 * a reader takes a latitude and a longitude off it, not a country. Adding a landmass would need a
 * topojson asset costing more than the entire chart kit, and it would be the only decorative
 * geometry in the product.
 *
 * **Altitude is a figure beside the graphic, never a mark on it.** A third dimension on a
 * two-dimensional projection is the dual-axis mistake in a different costume (§6.2).
 */

import { toDms } from './format';

export interface CircuitLocatorProps {
  latitude: number;
  longitude: number;
  /** Metres. `null` where the record has none — rendered as an absence, never as sea level. */
  altitude: number | null;
  /** For the accessible name: "Bahrain International Circuit, Sakhir, Bahrain". */
  place: string;
}

/** The reference parallels, in degrees. Drawn and labelled, because they are what makes a bare
 * graticule readable as a position rather than as a grid. */
const PARALLELS = [
  { lat: 66.5635, label: 'Arctic Circle' },
  { lat: 23.4365, label: 'Tropic of Cancer' },
  { lat: 0, label: 'Equator' },
  { lat: -23.4365, label: 'Tropic of Capricorn' },
  { lat: -66.5635, label: 'Antarctic Circle' },
] as const;

const MERIDIANS = [-150, -120, -90, -60, -30, 0, 30, 60, 90, 120, 150] as const;

const decimal = (value: number, axis: 'lat' | 'lon') =>
  `${Math.abs(value).toFixed(4)}° ${axis === 'lat' ? (value < 0 ? 'S' : 'N') : value < 0 ? 'W' : 'E'}`;

export function CircuitLocator({ latitude, longitude, altitude, place }: CircuitLocatorProps) {
  const x = longitude + 180;
  const y = 90 - latitude;

  return (
    <div className="locator">
      <svg
        className="locator-map"
        viewBox="0 0 360 180"
        preserveAspectRatio="xMidYMid meet"
        role="img"
        aria-label={`${place} — ${decimal(latitude, 'lat')}, ${decimal(longitude, 'lon')}`}
      >
        <rect className="locator-frame" x="0.5" y="0.5" width="359" height="179" />

        {MERIDIANS.map((lon) => (
          <line
            key={`m${String(lon)}`}
            className={lon === 0 ? 'locator-prime' : 'locator-graticule'}
            x1={lon + 180}
            x2={lon + 180}
            y1={0}
            y2={180}
          />
        ))}

        {PARALLELS.map((parallel) => (
          <g key={parallel.label}>
            <line
              className={parallel.lat === 0 ? 'locator-prime' : 'locator-graticule'}
              x1={0}
              x2={360}
              y1={90 - parallel.lat}
              y2={90 - parallel.lat}
            />
            <text className="locator-label" x={4} y={90 - parallel.lat - 3}>
              {parallel.label}
            </text>
          </g>
        ))}

        {/* The crosshair runs the full width and height: on a graticule with no landmass, the
         * reader locates the pip by reading it off the frame, so the lines to the frame are the
         * readout rather than decoration. */}
        <line className="locator-cross" x1={0} x2={360} y1={y} y2={y} />
        <line className="locator-cross" x1={x} x2={x} y1={0} y2={180} />
        {/* §6.3's marker ring, so the pip survives sitting exactly on a gridline. */}
        <circle className="locator-pip" cx={x} cy={y} r={3.5} />
      </svg>

      <dl className="locator-readout">
        <div>
          <dt>Latitude</dt>
          <dd className="t-mono">{decimal(latitude, 'lat')}</dd>
          <dd className="t-mono locator-dms">{toDms(latitude, 'lat')}</dd>
        </div>
        <div>
          <dt>Longitude</dt>
          <dd className="t-mono">{decimal(longitude, 'lon')}</dd>
          <dd className="t-mono locator-dms">{toDms(longitude, 'lon')}</dd>
        </div>
        <div>
          <dt>Altitude</dt>
          {/*
           * `—` and never `0 m`. Sea level is a measurement; a missing altitude is not one, and
           * printing zero would state a fact about the venue that the record does not carry.
           */}
          <dd className="t-mono">
            {altitude === null ? '—' : `${String(Math.round(altitude))} m`}
          </dd>
          <dd className="locator-dms">above sea level</dd>
        </div>
      </dl>
    </div>
  );
}
