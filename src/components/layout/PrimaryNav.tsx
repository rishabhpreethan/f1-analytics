import { useEffect, useRef } from 'react';
import { Link, useLocation } from 'react-router';
import { Menu, X } from '@/components/ui/icons';
import { usePressMotion } from '@/lib/motion/interactions';
import { sheetEnter, sheetExit } from '@/lib/motion/surfaces';
import { useDisclosure } from '@/lib/motion/useDisclosure';

/**
 * Primary navigation, in two pieces (Design Spec §2.2): `PrimaryNav` is the inline nav
 * at `md`+, `PrimaryNavSheet` is the menu button and the sheet at the base breakpoint.
 *
 * > ⚠ **This component is retired by CR-007 and is deleted in task C7-5**, where
 * > `CommandDock` replaces it. It is ported to GSAP here rather than deleted here for one
 * > reason: C7-2 removes the animation library, and an intermediate commit that does not
 * > build is not an acceptable commit. Nothing below should be extended.
 *
 * **Why two components and not one.** Design Spec §8 specifies two different focus
 * orders — at ≥768 the nav comes *before* `DataVintage` and `ThemeToggle`, and at <768
 * the menu button comes *after* them. Focus order follows DOM order, so a single
 * component emitting both the nav and the button as one fragment can satisfy at most one
 * of them. Split, each piece sits at its own point in `Header`'s DOM, only one is ever
 * focusable (the other is `display: none`), and both orders hold.
 *
 * Motion: **G-5** drops the sheet with its scrim, and **G-7** gives the controls their
 * press feedback. The travelling active rule is gone with the library that provided it —
 * its successor is **G-3**, a measured indicator, and it arrives with `CommandDock`. The
 * rule still marks the active item; it simply appears there rather than sliding, which is
 * exactly what §4.6 records as G-3's *reduced* behaviour, so nothing incorrect is shipped
 * in the interim.
 *
 * `aria-current="page"` carries the active state for assistive technology: the rule is
 * never the only signal (§8).
 */

export interface NavItem {
  to: string;
  label: string;
}

export interface PrimaryNavProps {
  items: ReadonlyArray<NavItem>;
}

/**
 * `/seasons/:year` and `/seasons/:year/races/:round` have no nav entry of their own —
 * they are reached from Season — so Season stays active while you are inside them.
 */
function isActive(pathname: string, to: string): boolean {
  if (to === '/') return pathname === '/' || pathname.startsWith('/seasons');
  return pathname === to || pathname.startsWith(`${to}/`);
}

export function PrimaryNav({ items }: PrimaryNavProps) {
  const { pathname } = useLocation();

  return (
    <nav aria-label="Primary" className="hidden md:block">
      <ul className="flex items-center gap-3 lg:gap-6">
        {items.map((item) => {
          const active = isActive(pathname, item.to);
          return (
            <li key={item.to}>
              <span className="nav-item">
                <Link
                  to={item.to}
                  aria-current={active ? 'page' : undefined}
                  className={`t-sm font-medium lg:text-base ${
                    active ? 'text-ink-primary' : 'text-ink-tertiary hover:text-ink-secondary'
                  }`}
                >
                  {item.label}
                </Link>
                {active && <span className="nav-rule" aria-hidden="true" />}
              </span>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

export function PrimaryNavSheet({ items }: PrimaryNavProps) {
  const { pathname } = useLocation();

  // G-5. The scrim and the panel live inside one scope so the builders' `data-motion`
  // selectors resolve, and so both leave together.
  const {
    scope: sheetScope,
    mounted: sheetMounted,
    isOpen: open,
    open: openSheet,
    close: closeSheet,
  } = useDisclosure<HTMLDivElement>({ enter: sheetEnter, exit: sheetExit });

  const { scope: menuButtonRef, press } = usePressMotion<HTMLButtonElement>();
  const sheetRef = useRef<HTMLDivElement>(null);

  // Focus moves into the sheet when it opens (§8).
  useEffect(() => {
    if (!open) return;
    sheetRef.current?.querySelector<HTMLAnchorElement>('a')?.focus();
  }, [open]);

  function close() {
    closeSheet();
    menuButtonRef.current?.focus();
  }

  /** The sheet traps Tab, and returns focus to the menu button on the way out. */
  function onSheetKeyDown(event: React.KeyboardEvent<HTMLDivElement>) {
    if (event.key === 'Escape') {
      event.preventDefault();
      close();
      return;
    }
    if (event.key !== 'Tab') return;

    const focusable = sheetRef.current?.querySelectorAll<HTMLAnchorElement>('a');
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
      <button
        ref={menuButtonRef}
        type="button"
        className="btn btn-ghost btn-icon md:hidden"
        aria-expanded={open}
        aria-label={open ? 'Close menu' : 'Open menu'}
        onClick={() => {
          if (open) close();
          else openSheet();
        }}
        {...press}
      >
        {open ? <X size={20} /> : <Menu size={20} />}
      </button>

      {sheetMounted && (
        <div ref={sheetScope} className="contents">
          <div
            className="nav-scrim md:hidden"
            data-motion="scrim"
            aria-hidden="true"
            onClick={close}
          />
          <div
            ref={sheetRef}
            className="nav-sheet md:hidden"
            data-motion="sheet-panel"
            onKeyDown={onSheetKeyDown}
          >
            <nav aria-label="Primary" className="px-4 py-2">
              <ul className="flex flex-col">
                {items.map((item) => {
                  const active = isActive(pathname, item.to);
                  return (
                    <li key={item.to} className="nav-sheet-row" data-motion="sheet-row">
                      {active && <span className="nav-sheet-rule" aria-hidden="true" />}
                      <Link
                        to={item.to}
                        aria-current={active ? 'page' : undefined}
                        // Closed at the click, not in an effect on `pathname`:
                        // leaving the sheet open over the new page would hide the
                        // thing the user just asked for, and focus is left to land on
                        // the new content rather than snapping back to the button.
                        onClick={() => {
                          closeSheet();
                        }}
                        className={`text-md flex-1 pl-3 font-medium ${
                          active ? 'text-ink-primary' : 'text-ink-secondary'
                        }`}
                      >
                        {item.label}
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </nav>
          </div>
        </div>
      )}
    </>
  );
}
