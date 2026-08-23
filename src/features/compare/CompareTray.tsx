import type { CSSProperties } from 'react';
import type { SeriesChannels } from '@/components/charts/ladder';
import { LegendKey } from '@/components/charts/MarkerGlyph';
import { COMPARISON_CAP } from '@/components/charts/ladder';
import { X } from '@/components/ui/icons';
import { cssVar } from '@/lib/entityColor';
import { winShare } from './model';
import type { CompareEntity, CompareIdentity } from './types';

/**
 * **`CompareTray`** — `DESIGN_SYSTEM.md` §6.6.6.2. The selection, and the page's masthead at the
 * same time.
 *
 * **It is not a chip row.** A chip row would be the obvious build and it would waste the one place
 * on the page where the reader is guaranteed to look. The tray is instead **four bays**, and a
 * filled bay is a full identity card: the surname at display size, the forename above it, the span
 * and the seasons in mono, and the one figure that is comparable across every era — the share of
 * same-car races the driver finished ahead of a teammate.
 *
 * **Four, because four is the cap** (§3.2 rule 3, `COMPARISON_CAP`). The empty bays are drawn, not
 * omitted: a tray that grew as you added would hide the ceiling until you hit it, and the cap is a
 * measured property of the palette rather than an arbitrary limit.
 *
 * **Identity is a 3px leading bar in the team colour, beside a name in ink** — §3.3a.4's first
 * permitted identity form, and never the card's background: 6 of 11 brand colours fall below 3:1
 * against a light surface (§9.2 V-8), so a tinted card would be unreadable for half the grid.
 *
 * **The `LegendKey` is here and not only in the charts below.** It is the tray that teaches the
 * reader which mark is whose, and it carries all three channels at once — colour, dash, marker —
 * so the rest of the page can be read without a second legend per chart (§6.5.2).
 */

export interface CompareTrayProps {
  entities: CompareEntity[];
  channels: SeriesChannels[];
  available: CompareIdentity[];
  onRemove: (ref: string) => void;
  onAdd: (ref: string) => void;
}

export function CompareTray({ entities, channels, available, onRemove, onAdd }: CompareTrayProps) {
  const bays = COMPARISON_CAP;
  const empties = Math.max(0, bays - entities.length);

  return (
    <section className="tray" aria-label="Selected drivers">
      <ol className="tray-bays">
        {entities.map((entity, index) => {
          const channel = channels[index];
          if (channel === undefined) return null;
          const share = winShare(entity.teammates.race, 'a');
          return (
            <li
              className="tray-bay"
              key={entity.identity.ref}
              style={
                {
                  '--identity': cssVar(channel.identity),
                  '--series': cssVar(channel.plot),
                } as CSSProperties
              }
            >
              <span className="tray-identity" aria-hidden="true" />
              <div className="tray-body">
                <p className="tray-forename">{entity.identity.forename}</p>
                <p className="tray-surname">{entity.identity.surname}</p>
                <p className="tray-span">
                  {entity.firstSeason}–{entity.lastSeason}
                  <span className="tray-dot" aria-hidden="true">
                    ·
                  </span>
                  {entity.seasonsEntered} seasons
                </p>
                <p className="tray-metric">
                  <span className="tray-metric-figure">
                    {share === null ? '—' : `${String(Math.round(share * 100))}%`}
                  </span>
                  <span className="tray-metric-label">
                    ahead of a teammate
                    <br />
                    {entity.teammates.race.a + entity.teammates.race.b} same-car races
                  </span>
                </p>
                <span className="tray-key">
                  <LegendKey shape={channel.marker} dash={channel.dash} token={channel.plot} />
                </span>
              </div>
              <button
                className="tray-remove"
                onClick={() => {
                  onRemove(entity.identity.ref);
                }}
                type="button"
              >
                <X size={16} aria-hidden="true" />
                <span className="sr-only">
                  Remove {entity.identity.forename} {entity.identity.surname}
                </span>
              </button>
            </li>
          );
        })}

        {Array.from({ length: empties }, (_, slot) => {
          const candidate = available[slot];
          return (
            <li className="tray-bay" data-empty="true" key={`empty-${String(slot)}`}>
              {candidate === undefined ? (
                <p className="tray-empty-copy">
                  Bay {entities.length + slot + 1}
                  <span>Comparison holds four drivers.</span>
                </p>
              ) : (
                <button
                  className="tray-add"
                  onClick={() => {
                    onAdd(candidate.ref);
                  }}
                  type="button"
                >
                  <span className="tray-add-plus" aria-hidden="true">
                    +
                  </span>
                  <span className="tray-add-label">
                    Add {candidate.forename} {candidate.surname}
                  </span>
                </button>
              )}
            </li>
          );
        })}
      </ol>
    </section>
  );
}
