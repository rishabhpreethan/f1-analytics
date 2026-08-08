import { useId, useRef } from 'react';
import { Search, X } from '@/components/ui/icons';
import type { SortOption } from './indexModel';

/**
 * **`IndexConsole`** — `DESIGN_SYSTEM.md` §7.13. The instrument at the top of every index page.
 *
 * Sticky under the header, glass, and it is sticky for a measured reason: on an 881-row list the
 * control has to still be there when the reader is 400 rows down. Everything about how the page is
 * *read* lives here — search, sort and the count — and nothing about how it is fetched.
 *
 * ---
 *
 * **The sort is a real `<fieldset>` of radios**, not `role="radio"` buttons. Arrow-key roving,
 * `:checked`, the group's accessible name and form semantics all come from the platform; the
 * alternative is thirty lines of keyboard code that has to be right, and §8 asks for full keyboard
 * operation rather than an approximation of it.
 *
 * **The label is visually hidden, never replaced by the placeholder.** A placeholder is not a label:
 * it disappears exactly when the reader needs it, which on this page is the moment they start
 * typing into the page's primary control.
 *
 * **The count is both `aria-describedby` and an `aria-live` region.** A screen-reader user hears
 * "12 of 881" change without leaving the input, and meets the same sentence on first focus.
 */

export interface IndexConsoleProps {
  /** `Search 881 drivers` — the visually-hidden label, and what the field is *for*. */
  label: string;
  placeholder: string;
  query: string;
  onQueryChange: (query: string) => void;
  sorts: readonly SortOption[];
  sortId: string;
  onSortChange: (id: string) => void;
  /** `881 drivers` at rest, `12 of 881 drivers` while filtering. Built by the page. */
  countLabel: string;
  /** The `id` of the list the field controls, for `aria-controls`. */
  listId: string;
}

export function IndexConsole({
  label,
  placeholder,
  query,
  onQueryChange,
  sorts,
  sortId,
  onSortChange,
  countLabel,
  listId,
}: IndexConsoleProps) {
  const fieldId = useId();
  const countId = useId();
  const sortName = useId();
  const input = useRef<HTMLInputElement>(null);

  return (
    <div className="index-console">
      <div className="index-search">
        <label className="sr-only" htmlFor={fieldId}>
          {label}
        </label>
        <Search size={20} className="index-search-icon" />
        <input
          ref={input}
          id={fieldId}
          className="index-search-input"
          /*
           * `type="search"` and not `text`: it gets the platform's own semantics, and the UA's
           * cancel affordance is suppressed in CSS so there are never two clear buttons.
           * Autocomplete and correction are off — a driver's reference is not a word.
           */
          type="search"
          value={query}
          placeholder={placeholder}
          autoComplete="off"
          autoCorrect="off"
          spellCheck={false}
          aria-controls={listId}
          aria-describedby={countId}
          onChange={(event) => {
            onQueryChange(event.target.value);
          }}
          onKeyDown={(event) => {
            /* Esc clears rather than blurs — the field keeps focus, so a mistyped query costs
             * one key rather than a re-click. Only when there is something to clear, so Esc
             * still reaches anything above it on an empty field. */
            if (event.key === 'Escape' && query !== '') {
              event.preventDefault();
              onQueryChange('');
            }
          }}
        />
        {query !== '' && (
          <button
            type="button"
            className="index-search-clear"
            aria-label="Clear search"
            onClick={() => {
              onQueryChange('');
              input.current?.focus();
            }}
          >
            <X size={16} />
          </button>
        )}
        <span className="index-search-underline" aria-hidden="true" />
      </div>

      <div className="index-console-row">
        <fieldset className="index-sort">
          <legend className="sr-only">Sort by</legend>
          {sorts.map((sort) => (
            <label className="index-sort-option" key={sort.id}>
              <input
                type="radio"
                name={sortName}
                value={sort.id}
                checked={sort.id === sortId}
                onChange={() => {
                  onSortChange(sort.id);
                }}
              />
              <span>{sort.label}</span>
            </label>
          ))}
        </fieldset>

        {/*
         * `aria-live="polite"` and not `status`: the same node is the field's description, and a
         * `role="status"` there would be announced twice on focus in some readers.
         */}
        <p id={countId} className="index-count t-mono" aria-live="polite">
          {countLabel}
        </p>
      </div>
    </div>
  );
}
