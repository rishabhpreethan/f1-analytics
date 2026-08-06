import { useEffect, useRef } from 'react';
import { Link } from 'react-router';
import { isActiveNavItem, type NavItem } from '@/components/layout/navItems';
import { ICONS } from '@/components/ui/iconRegistry';
import { X } from '@/components/ui/icons';

/**
 * The bottom dock's overflow sheet, below 1024px (Design Spec §5.3).
 *
 * **It lists all seven destinations, not just the four the dock had no room for.** Someone who
 * opens "More" is asking where they can go; showing them the remainder of a list they cannot
 * see is a worse answer than showing them the map.
 *
 * Motion is **G-5**, built by `useDisclosure` in `CommandDock` — the scrim, then the panel
 * rising, then the rows. This component provides the `data-motion` hooks the builders select
 * on, and nothing else: it creates no tween, because `gsap` may only be imported inside
 * `src/lib/motion/**`.
 *
 * `role="dialog"` with `aria-modal`, focus trapped, `Esc` closes, and focus returns to the
 * trigger — which `CommandDock` does synchronously, without waiting for the exit tween.
 */

export interface DockSheetProps {
  items: readonly NavItem[];
  pathname: string;
  onClose: () => void;
  /** Called when a destination is chosen, so the sheet does not stay open over the new page. */
  onNavigate: () => void;
}

export function DockSheet({ items, pathname, onClose, onNavigate }: DockSheetProps) {
  const panelRef = useRef<HTMLDivElement>(null);

  // Focus moves into the sheet when it opens (§10). First row, not the close button: the
  // point of the sheet is the destinations.
  useEffect(() => {
    panelRef.current?.querySelector<HTMLAnchorElement>('a')?.focus();
  }, []);

  /** Traps Tab inside the panel and returns focus on the way out. */
  function onKeyDown(event: React.KeyboardEvent<HTMLDivElement>) {
    if (event.key === 'Escape') {
      event.preventDefault();
      onClose();
      return;
    }
    if (event.key !== 'Tab') return;

    const focusable = panelRef.current?.querySelectorAll<HTMLElement>('a, button');
    if (focusable === undefined || focusable.length === 0) return;
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    if (first === undefined || last === undefined) return;

    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  }

  return (
    <>
      <div className="dock-scrim" data-motion="scrim" aria-hidden="true" onClick={onClose} />

      <div
        ref={panelRef}
        className="dock-sheet"
        data-motion="sheet-panel"
        role="dialog"
        aria-modal="true"
        aria-label="Go to"
        onKeyDown={onKeyDown}
      >
        <p className="t-2xs text-ink-tertiary px-3 py-2">Go to</p>

        <ul className="flex flex-col">
          {items.map((item) => {
            const active = isActiveNavItem(pathname, item.to);
            const Glyph = ICONS[item.icon];
            return (
              <li key={item.to} data-motion="sheet-row">
                <Link
                  to={item.to}
                  aria-current={active ? 'page' : undefined}
                  className={`dock-sheet-row t-md gap-3 px-3 ${
                    active ? 'dock-sheet-row-active' : ''
                  }`}
                  onClick={onNavigate}
                >
                  <Glyph size={20} />
                  <span className="flex-1">{item.label}</span>
                </Link>
              </li>
            );
          })}
        </ul>

        <button type="button" className="dock-sheet-close t-base gap-3 px-3" onClick={onClose}>
          <X size={16} />
          <span className="flex-1 text-left">Close</span>
        </button>
      </div>
    </>
  );
}
