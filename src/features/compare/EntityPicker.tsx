import { useId, useMemo, useRef, useState, type CSSProperties } from 'react';
import { COMPARISON_CAP } from '@/components/charts/ladder';
import { normalise } from '@/components/entity/indexModel';
import { Search, X } from '@/components/ui/icons';
import { cssVar, identityToken } from '@/lib/entityColor';
import type { CompareCandidate } from './types';

/**
 * **`EntityPicker`** — `DESIGN_SYSTEM.md` §7.16. How a driver gets into the tray.
 *
 * The page shipped without one, and Rishabh's first question about `/compare` was why it was fixed
 * to four drivers. It never was: the four were the fixture. But a comparison workspace whose
 * selection cannot be changed **is** a hardcoded page as far as anyone using it is concerned, and
 * he should not have had to ask.
 *
 * ---
 *
 * **It reuses the index pages' search rather than inventing a second one.** `/drivers` already
 * solved "choose from 881", and the two things it got right are imported literally from
 * `indexModel.ts`: `normalise`, so `hakkinen` finds Häkkinen and `perez` finds Pérez without the
 * result depending on the browser's locale; and **all tokens must match as substrings, in any
 * order**, so `lewis ham` and `ham lewis` both find him. The result is never re-ranked by match
 * quality — a list that reshuffles as you type moves the row out from under the pointer (§6.6.4.2).
 *
 * **One field, not four popovers.** A picker per bay would put the same control on screen four
 * times and make the *bays* the thing you operate. The bays are the answer; the field is the
 * question, and it sits under them so the reading order is "here is your selection — add to it".
 * It also means no layer: the results list is in flow, so nothing on this page needs a z-index,
 * which is the rule §5.2a exists to protect.
 *
 * **The cap is drawn, not enforced silently.** At four the field disables itself and says why. A
 * control that accepts a fifth and then discards it is worse than one that cannot be used.
 *
 * **The field itself is `/drivers`' field, class for class.** `.index-search`, its icon, its
 * clear button and its focus underline are reused literally rather than restyled — one search
 * field in the product, not two that look alike. It also costs nothing: CSS is the binding budget
 * here at 81% and a second copy of a field would have been about 40 lines of it.
 *
 * **ARIA 1.2 combobox**, because this is the pattern screen readers are built for: the input owns
 * `aria-expanded`, `aria-controls` and `aria-activedescendant`, the results are a `listbox` of
 * `option`s, and focus never leaves the input — ↓/↑ move the active option, Enter takes it, Esc
 * closes. Moving DOM focus into the list instead is the common mistake and it breaks type-ahead.
 */

/** How many matches are shown at once. */
export const PICKER_RESULT_LIMIT = 12;

export interface EntityPickerProps {
  /** Every driver who may be added. Already excludes whoever is selected. */
  candidates: readonly CompareCandidate[];
  /** How many bays are filled. At `COMPARISON_CAP` the field is disabled and says so. */
  filled: number;
  onAdd: (ref: string) => void;
  /** The `id` of the tray's bay list, for `aria-controls` on the wrapper. */
  baysId: string;
}

export function EntityPicker({ candidates, filled, onAdd, baysId }: EntityPickerProps) {
  const fieldId = useId();
  const listId = useId();
  const countId = useId();
  const optionId = (index: number) => `${listId}-o${String(index)}`;

  const [query, setQuery] = useState('');
  const [active, setActive] = useState(0);
  const input = useRef<HTMLInputElement>(null);

  const full = filled >= COMPARISON_CAP;

  const matches = useMemo(() => {
    const tokens = normalise(query).split(/\s+/).filter(Boolean);
    if (tokens.length === 0) return [];
    return candidates.filter((candidate) => {
      const haystack = normalise(
        `${candidate.forename} ${candidate.surname} ${candidate.code ?? ''}`,
      );
      return tokens.every((token) => haystack.includes(token));
    });
  }, [candidates, query]);

  const shown = matches.slice(0, PICKER_RESULT_LIMIT);
  const open = shown.length > 0 && !full;
  const activeIndex = Math.min(active, Math.max(0, shown.length - 1));

  const take = (index: number) => {
    const candidate = shown[index];
    if (candidate === undefined) return;
    onAdd(candidate.ref);
    setQuery('');
    setActive(0);
    input.current?.focus();
  };

  /*
   * The count is both the field's `aria-describedby` and an `aria-live` region — `/drivers`'
   * device (§7.13). A screen-reader user hears the result count change without leaving the input,
   * and meets the same sentence on first focus.
   */
  const countLabel = full
    ? `Four is the ceiling. Remove a driver to add another.`
    : query === ''
      ? `${candidates.length.toLocaleString('en-GB')} drivers to choose from`
      : matches.length === 0
        ? `No driver matches “${query}”`
        : matches.length > shown.length
          ? `${String(shown.length)} of ${String(matches.length)} matches`
          : `${String(matches.length)} ${matches.length === 1 ? 'match' : 'matches'}`;

  return (
    <div className="picker" data-full={full}>
      <div className="index-search">
        <label className="sr-only" htmlFor={fieldId}>
          Search {candidates.length.toLocaleString('en-GB')} drivers to add to the comparison
        </label>
        <Search size={20} className="index-search-icon" aria-hidden="true" />
        <input
          ref={input}
          id={fieldId}
          className="index-search-input"
          /*
           * `type="text"`, not `type="search"` — a combobox owns its own clear affordance and the
           * UA's cancel button would be a second one with different keyboard semantics. `/drivers`
           * uses `type="search"` because it is a filter over a visible list, not a combobox.
           */
          type="text"
          role="combobox"
          value={query}
          disabled={full}
          placeholder={full ? 'Four bays, all full' : 'Add a driver — try “senna” or “ham lewis”'}
          autoComplete="off"
          autoCorrect="off"
          spellCheck={false}
          aria-expanded={open}
          aria-controls={open ? listId : baysId}
          aria-describedby={countId}
          aria-autocomplete="list"
          aria-activedescendant={open ? optionId(activeIndex) : undefined}
          onChange={(event) => {
            setQuery(event.target.value);
            setActive(0);
          }}
          onKeyDown={(event) => {
            if (event.key === 'Escape' && query !== '') {
              /* Clears rather than blurs — the field keeps focus, so a mistyped query costs one
               * key. Only when there is something to clear, so Esc still reaches anything above. */
              event.preventDefault();
              setQuery('');
              return;
            }
            if (!open) return;
            if (event.key === 'ArrowDown') {
              event.preventDefault();
              setActive((current) => (current + 1) % shown.length);
            } else if (event.key === 'ArrowUp') {
              event.preventDefault();
              setActive((current) => (current - 1 + shown.length) % shown.length);
            } else if (event.key === 'Home') {
              event.preventDefault();
              setActive(0);
            } else if (event.key === 'End') {
              event.preventDefault();
              setActive(shown.length - 1);
            } else if (event.key === 'Enter') {
              event.preventDefault();
              take(activeIndex);
            }
          }}
        />
        {query !== '' && (
          <button
            type="button"
            className="index-search-clear"
            onClick={() => {
              setQuery('');
              input.current?.focus();
            }}
          >
            <X size={16} aria-hidden="true" />
            <span className="sr-only">Clear the search</span>
          </button>
        )}
        <span className="index-search-underline" aria-hidden="true" />
      </div>

      <p className="index-count" id={countId} aria-live="polite">
        {countLabel}
      </p>

      {open && (
        <ul className="picker-results" id={listId} role="listbox" aria-label="Matching drivers">
          {shown.map((candidate, index) => (
            <li
              key={candidate.ref}
              id={optionId(index)}
              role="option"
              aria-selected={index === activeIndex}
              className="picker-option"
              data-active={index === activeIndex}
              style={
                candidate.colorTeamRef === undefined
                  ? undefined
                  : ({
                      '--identity': cssVar(identityToken(candidate.colorTeamRef)),
                    } as CSSProperties)
              }
              /* `onMouseDown` and not `onClick`: a click fires after blur, and blurring the input
               * would close the list out from under the pointer. */
              onMouseDown={(event) => {
                event.preventDefault();
                take(index);
              }}
              onMouseMove={() => {
                setActive(index);
              }}
            >
              <span className="picker-swatch" aria-hidden="true" />
              <span className="picker-name">
                {candidate.forename} {candidate.surname}
              </span>
              {candidate.firstSeason !== undefined && candidate.lastSeason !== undefined && (
                <span className="picker-span t-mono">
                  {candidate.firstSeason}–{candidate.lastSeason}
                </span>
              )}
              {candidate.races !== undefined && (
                <span className="picker-races t-mono">
                  {candidate.races.toLocaleString('en-GB')} races
                </span>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
