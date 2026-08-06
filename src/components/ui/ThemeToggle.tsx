import { useEffect, useRef, useState } from 'react';
import { Check, Monitor, Moon, Sun } from '@/components/ui/icons';
import { usePressMotion } from '@/lib/motion/interactions';
import { popoverEnter, popoverExit } from '@/lib/motion/surfaces';
import { useDisclosure } from '@/lib/motion/useDisclosure';
import {
  THEME_PREFERENCES,
  type ResolvedTheme,
  type ThemePreference,
  applyTheme,
  readThemePreference,
  resolveTheme,
  setThemePreference,
  subscribeToSystemTheme,
} from '@/lib/theme';

/**
 * A **3-option radiogroup popover**, not a cycle (ruling R-2, Design Spec §5.2).
 *
 * The reason is not stylistic: `lib/theme.ts` models `light | dark | system`, a binary
 * control cannot express `system`, and honouring `prefers-color-scheme` on first load is
 * an F0 acceptance criterion. A cycle would also make the current value unreadable
 * without pressing the button.
 *
 * Two behaviours worth naming, because they are what the unit tests defend:
 *   - The **trigger icon reflects the preference, not the resolved theme.** With
 *     `system` selected on a dark OS the icon is a monitor, never a moon — otherwise the
 *     control lies about what it is set to.
 *   - `↑`/`↓` move the selection **within** the group without applying it. Only
 *     `Enter`/`Space` (or a click) commits, and `Esc` leaves the preference untouched.
 */

const LABELS: Record<ThemePreference, string> = {
  system: 'System',
  light: 'Light',
  dark: 'Dark',
};

const PANEL_ID = 'theme-preference-group';

function PreferenceIcon({ preference, size }: { preference: ThemePreference; size: 16 | 20 }) {
  if (preference === 'light') return <Sun size={size} />;
  if (preference === 'dark') return <Moon size={size} />;
  return <Monitor size={size} />;
}

export function ThemeToggle() {
  const [preference, setPreference] = useState<ThemePreference>(readThemePreference);
  const [resolved, setResolved] = useState<ResolvedTheme>(() =>
    resolveTheme(readThemePreference()),
  );
  // The tentative selection while the popover is open. Arrow keys move it; only a
  // commit turns it into the preference.
  const [activeIndex, setActiveIndex] = useState(0);

  // G-6, both halves. `useDisclosure` owns the three-phase machine that keeps the panel
  // in the DOM while its exit tween plays, and it unmounts immediately under reduced
  // motion because no tween is created there to complete.
  const {
    scope: panelScope,
    mounted: panelMounted,
    isOpen: open,
    open: openPanel,
    close: closePanel,
  } = useDisclosure<HTMLDivElement>({ enter: popoverEnter, exit: popoverExit });

  // G-7's press half. The hook owns the ref, so the trigger's focus restoration reads
  // through it rather than keeping a second ref on the same node.
  const { scope: triggerRef, press } = usePressMotion<HTMLButtonElement>();
  const containerRef = useRef<HTMLDivElement>(null);
  const optionRefs = useRef<Array<HTMLButtonElement | null>>([]);

  // While the preference is `system`, an OS change changes the app live
  // (`DESIGN_SYSTEM.md` §10). Once the user picks explicitly this is a no-op.
  useEffect(() => {
    if (preference !== 'system') return undefined;
    return subscribeToSystemTheme((next) => {
      setResolved(next);
      applyTheme(next);
    });
  }, [preference]);

  // Outside click dismisses (§8).
  useEffect(() => {
    if (!open) return undefined;
    const onPointerDown = (event: PointerEvent) => {
      const target = event.target;
      if (target instanceof Node && containerRef.current?.contains(target) === true) return;
      closePanel();
    };
    document.addEventListener('pointerdown', onPointerDown);
    return () => {
      document.removeEventListener('pointerdown', onPointerDown);
    };
  }, [open, closePanel]);

  // Roving tabindex: the tentatively selected option is the one that holds focus.
  useEffect(() => {
    if (!open) return;
    optionRefs.current[activeIndex]?.focus();
  }, [open, activeIndex]);

  function openPopover() {
    setActiveIndex(THEME_PREFERENCES.indexOf(preference));
    openPanel();
  }

  /**
   * Focus comes back **synchronously**, before any exit tween has finished: a keyboard
   * user must not be made to wait 80ms for their focus. Only the pixels linger.
   */
  function closePopover() {
    closePanel();
    triggerRef.current?.focus();
  }

  function commit(next: ThemePreference) {
    setPreference(next);
    setThemePreference(next);
    setResolved(resolveTheme(next));
    closePopover();
  }

  function onGroupKeyDown(event: React.KeyboardEvent<HTMLDivElement>) {
    const last = THEME_PREFERENCES.length - 1;

    if (event.key === 'ArrowDown' || event.key === 'ArrowRight') {
      event.preventDefault();
      setActiveIndex((index) => (index === last ? 0 : index + 1));
      return;
    }
    if (event.key === 'ArrowUp' || event.key === 'ArrowLeft') {
      event.preventDefault();
      setActiveIndex((index) => (index === 0 ? last : index - 1));
      return;
    }
    if (event.key === 'Home') {
      event.preventDefault();
      setActiveIndex(0);
      return;
    }
    if (event.key === 'End') {
      event.preventDefault();
      setActiveIndex(last);
      return;
    }
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      const next = THEME_PREFERENCES[activeIndex];
      if (next !== undefined) commit(next);
    }
  }

  return (
    <div
      ref={containerRef}
      className="relative"
      onKeyDown={(event) => {
        if (event.key === 'Escape' && open) {
          event.preventDefault();
          closePopover();
        }
      }}
    >
      <button
        ref={triggerRef}
        type="button"
        className="btn btn-ghost btn-icon"
        aria-expanded={open}
        /*
         * No `aria-haspopup`, for the same reason as `DataVintage`: ARIA 1.2 requires the
         * value to match a popup container role of menu / listbox / tree / grid / dialog,
         * `"true"` means `"menu"`, and this panel is a `radiogroup` — which is not an
         * allowed popup role at all, so no value of the attribute would be correct.
         * `aria-expanded` + `aria-controls` carry the disclosure relationship.
         */
        aria-controls={PANEL_ID}
        aria-label={`Theme: ${LABELS[preference]} (currently ${resolved}). Change theme.`}
        onClick={() => {
          if (open) closePopover();
          else openPopover();
        }}
        {...press}
      >
        <PreferenceIcon preference={preference} size={20} />
      </button>

      {panelMounted && (
        <div
          ref={panelScope}
          id={PANEL_ID}
          className="popover-panel popover-theme flex flex-col gap-0 p-1.5"
          role="radiogroup"
          aria-label="Theme"
          onKeyDown={onGroupKeyDown}
        >
          {THEME_PREFERENCES.map((option, index) => {
            const selected = index === activeIndex;
            return (
              <button
                key={option}
                ref={(node) => {
                  optionRefs.current[index] = node;
                }}
                type="button"
                role="radio"
                aria-checked={selected}
                tabIndex={selected ? 0 : -1}
                className={`option-row t-base gap-2 px-2 ${selected ? 'option-row-selected' : ''}`}
                onClick={() => {
                  commit(option);
                }}
              >
                <PreferenceIcon preference={option} size={16} />
                <span className="flex-1">{LABELS[option]}</span>
                {selected && <Check size={16} />}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
