import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { useEffect, useRef, useState } from 'react';
import { Link, useLocation } from 'react-router';
import { Menu, X } from '@/components/ui/icons';
import { control, scrim, sheet, sheetReduced, spring } from '@/lib/motion';

/**
 * Primary navigation, in two pieces (Design Spec §2.2): `PrimaryNav` is the inline nav
 * at `md`+, `PrimaryNavSheet` is the menu button and the sheet at the base breakpoint.
 *
 * **Why two components and not one.** Design Spec §8 specifies two different focus
 * orders — at ≥768 the nav comes *before* `DataVintage` and `ThemeToggle`, and at <768
 * the menu button comes *after* them. Focus order follows DOM order, so a single
 * component emitting both the nav and the button as one fragment can satisfy at most one
 * of them. Split, each piece sits at its own point in `Header`'s DOM, only one is ever
 * focusable (the other is `display: none`), and both orders hold.
 *
 * Motion: **M-3** moves a single 2px rule between items with `layoutId`, so the rule
 * travels rather than blinking; **M-4** drops the sheet with its scrim. Under reduced
 * motion `MotionConfig` suppresses the M-3 layout animation and the rule snaps to the
 * new item — §4.4 records that as correct and intended, not a degradation.
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
              <motion.span
                className="nav-item"
                whileTap={control.whileTap}
                transition={control.transition}
              >
                <Link
                  to={item.to}
                  aria-current={active ? 'page' : undefined}
                  className={`t-sm font-medium lg:text-base ${
                    active ? 'text-ink-primary' : 'text-ink-tertiary hover:text-ink-secondary'
                  }`}
                >
                  {item.label}
                </Link>
                {active && (
                  <motion.span
                    layoutId="nav-rule"
                    className="nav-rule"
                    transition={spring.layout}
                  />
                )}
              </motion.span>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

export function PrimaryNavSheet({ items }: PrimaryNavProps) {
  const { pathname } = useLocation();
  const reduced = useReducedMotion();
  const [open, setOpen] = useState(false);

  const menuButtonRef = useRef<HTMLButtonElement>(null);
  const sheetRef = useRef<HTMLDivElement>(null);

  // Focus moves into the sheet when it opens (§8).
  useEffect(() => {
    if (!open) return;
    sheetRef.current?.querySelector<HTMLAnchorElement>('a')?.focus();
  }, [open]);

  function close() {
    setOpen(false);
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
      <motion.button
        ref={menuButtonRef}
        type="button"
        className="btn btn-ghost btn-icon md:hidden"
        aria-expanded={open}
        aria-label={open ? 'Close menu' : 'Open menu'}
        onClick={() => {
          if (open) close();
          else setOpen(true);
        }}
        whileTap={control.whileTap}
        transition={control.transition}
      >
        {open ? <X size={20} /> : <Menu size={20} />}
      </motion.button>

      <AnimatePresence>
        {open && (
          <>
            <motion.div
              className="nav-scrim md:hidden"
              variants={scrim}
              initial="hidden"
              animate="visible"
              exit="exit"
              aria-hidden="true"
              onClick={close}
            />
            <motion.div
              ref={sheetRef}
              className="nav-sheet md:hidden"
              variants={reduced === true ? sheetReduced : sheet}
              initial="hidden"
              animate="visible"
              exit="exit"
              onKeyDown={onSheetKeyDown}
            >
              <nav aria-label="Primary" className="px-4 py-2">
                <ul className="flex flex-col">
                  {items.map((item) => {
                    const active = isActive(pathname, item.to);
                    return (
                      <li key={item.to} className="nav-sheet-row">
                        {active && <span className="nav-sheet-rule" aria-hidden="true" />}
                        <Link
                          to={item.to}
                          aria-current={active ? 'page' : undefined}
                          // Closed at the click, not in an effect on `pathname`:
                          // leaving the sheet open over the new page would hide the
                          // thing the user just asked for, and focus is left to land on
                          // the new content rather than snapping back to the button.
                          onClick={() => {
                            setOpen(false);
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
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </>
  );
}
