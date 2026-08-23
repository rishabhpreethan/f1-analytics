import type { CSSProperties } from 'react';
import type { SeriesChannels } from '@/components/charts/ladder';
import { LegendKey } from '@/components/charts/MarkerGlyph';
import { COMPARISON_CAP } from '@/components/charts/ladder';
import { X } from '@/components/ui/icons';
import { cssVar, identityToken } from '@/lib/entityColor';
import { EntityPicker } from './EntityPicker';
import { winShare } from './model';
import type { CompareCandidate, CompareEntity } from './types';

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
 *
 * ---
 *
 * **The picker sits below the bays** _(added 2026-08-23, §7.16)_. Reading order: here is your
 * selection, now add to it. An empty bay is a **slot**, never a button — four buttons that all do
 * the same thing is four times the control for one job, and it made the bays look operable when
 * the thing you operate is the field.
 */

/**
 * A bay's contents. `pending` is a driver the reader has chosen whose comparison payload has not
 * arrived — the real loading state, and while `GET /api/compare` is still being built it is also
 * what every driver outside the fixture's four resolves to.
 */
export type TrayBay =
  { kind: 'ready'; entity: CompareEntity } | { kind: 'pending'; candidate: CompareCandidate };

export interface CompareTrayProps {
  bays: readonly TrayBay[];
  channels: readonly SeriesChannels[];
  /** Everyone who may be added. Already excludes whoever is selected. */
  candidates: readonly CompareCandidate[];
  onRemove: (ref: string) => void;
  onAdd: (ref: string) => void;
}

const BAYS_ID = 'compare-tray-bays';

export function CompareTray({ bays, channels, candidates, onRemove, onAdd }: CompareTrayProps) {
  const empties = Math.max(0, COMPARISON_CAP - bays.length);

  /*
   * **Channels are looked up by reference, never by bay position.** The ladder is computed over the
   * entities that have a record; the bays include the pending ones too. So a pending bay sitting
   * before a ready one shifts every index after it — and because `ReadyBay` returns `null` on a
   * missing channel, the symptom is a **bay that silently disappears** rather than an error.
   * `CompareTray.test.tsx` holds the case, and it fails against the index version.
   */
  const channelOf = new Map(channels.map((channel) => [channel.reference, channel]));

  return (
    <section className="tray" aria-label="Selected drivers">
      <ol className="tray-bays" id={BAYS_ID}>
        {bays.map((bay) =>
          bay.kind === 'ready' ? (
            <ReadyBay
              key={bay.entity.identity.ref}
              channel={channelOf.get(bay.entity.identity.ref)}
              entity={bay.entity}
              onRemove={onRemove}
            />
          ) : (
            <PendingBay key={bay.candidate.ref} candidate={bay.candidate} onRemove={onRemove} />
          ),
        )}

        {Array.from({ length: empties }, (_, slot) => (
          <li className="tray-bay" data-empty="true" key={`empty-${String(slot)}`}>
            <p className="tray-empty-copy">
              Bay {bays.length + slot + 1}
              <span>Comparison holds four drivers.</span>
            </p>
          </li>
        ))}
      </ol>

      <EntityPicker baysId={BAYS_ID} candidates={candidates} filled={bays.length} onAdd={onAdd} />
    </section>
  );
}

function ReadyBay({
  entity,
  channel,
  onRemove,
}: {
  entity: CompareEntity;
  channel: SeriesChannels | undefined;
  onRemove: (ref: string) => void;
}) {
  if (channel === undefined) return null;
  const share = winShare(entity.teammates.race, 'a');
  return (
    <li
      className="tray-bay"
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
      <RemoveButton identity={entity.identity} onRemove={onRemove} />
    </li>
  );
}

/**
 * A bay whose driver is chosen and whose record has not arrived.
 *
 * It is drawn from the **directory**, which is real queried data — name, span, races, team colour
 * — so the bay is recognisably that driver rather than a grey box. What it does not claim is the
 * one figure it does not have: the metric slot reads `—` and says why. §1.0's rule, applied to a
 * loading state: something absent must never be given the meaning of something present.
 */
function PendingBay({
  candidate,
  onRemove,
}: {
  candidate: CompareCandidate;
  onRemove: (ref: string) => void;
}) {
  return (
    <li
      className="tray-bay"
      data-pending="true"
      style={
        candidate.colorTeamRef === undefined
          ? undefined
          : ({ '--identity': cssVar(identityToken(candidate.colorTeamRef)) } as CSSProperties)
      }
    >
      <span className="tray-identity" aria-hidden="true" />
      <div className="tray-body">
        <p className="tray-forename">{candidate.forename}</p>
        <p className="tray-surname">{candidate.surname}</p>
        {candidate.firstSeason !== undefined && candidate.lastSeason !== undefined && (
          <p className="tray-span">
            {candidate.firstSeason}–{candidate.lastSeason}
            {candidate.races !== undefined && (
              <>
                <span className="tray-dot" aria-hidden="true">
                  ·
                </span>
                {candidate.races} races
              </>
            )}
          </p>
        )}
        <p className="tray-metric">
          <span className="tray-metric-figure">—</span>
          <span className="tray-metric-label">
            record loading
            <br />
            not yet published by the API
          </span>
        </p>
      </div>
      <RemoveButton identity={candidate} onRemove={onRemove} />
    </li>
  );
}

function RemoveButton({
  identity,
  onRemove,
}: {
  identity: { ref: string; forename: string; surname: string };
  onRemove: (ref: string) => void;
}) {
  return (
    <button
      className="tray-remove"
      onClick={() => {
        onRemove(identity.ref);
      }}
      type="button"
    >
      <X size={16} aria-hidden="true" />
      <span className="sr-only">
        Remove {identity.forename} {identity.surname}
      </span>
    </button>
  );
}
