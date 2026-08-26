import { useCallback, useMemo, useRef, useState, type ReactNode } from 'react';
import { sheetEnter, sheetExit } from '@/lib/motion/surfaces';
import { CreditsContext, type CreditsApi } from './CreditsContext';
import { useDisclosure } from '@/lib/motion/useDisclosure';
import { PhotographCredits } from './PhotographCredits';

/**
 * **The photograph-credits surface, and the three places it opens from** — `DESIGN_SYSTEM.md`
 * §7.18.
 *
 * Attribution is a **legal obligation** before it is a design problem: CC BY and CC BY-SA require
 * the author, the licence and a link to the source to travel with the work, and this repository is
 * public. So the surface has to be reachable *from where a photograph is*, not from a page you have
 * to know exists — which is what this provider is for. A footer link, a control in the compare
 * tray and a credit line on a driver's masthead all open the same panel.
 *
 * **It is not a route.** Routing is not design's to change, and a modal is the better answer
 * anyway: the reader stays where the photograph is.
 *
 * ---
 *
 * **Deliberately NOT lazily imported, unlike every route surface** (`App.tsx`). The manifest is
 * 1.96 KB gzipped and the panel is small, and against that: **a credits chunk that fails to load
 * leaves attributed photographs on screen with their attribution unreachable.** A legal obligation
 * should not depend on a second network round trip succeeding. The initial-JS budget has ~85 KB of
 * headroom and the figure is recorded in §11.
 *
 * ---
 *
 * **The motion is G-5's builders, verbatim** — `sheetEnter` / `sheetExit` from
 * `src/lib/motion/surfaces.ts`, selected on the same `data-motion` attributes the dock's overflow
 * sheet uses. G-34 is therefore "G-5 applied to a second surface" rather than a new gesture, and
 * there is no new tween code in the product. A second modal convention in one product is a defect.
 */

export function CreditsProvider({ children }: { children: ReactNode }) {
  /** Which plate to land on, or `null` for the top of the panel. */
  const [target, setTarget] = useState<string | null>(null);
  /**
   * Where focus goes back to. Captured at open time from `document.activeElement`, because the
   * three triggers live in three different components and none of them should have to hand a ref
   * across the tree for this.
   */
  const opener = useRef<HTMLElement | null>(null);

  const { scope, mounted, open, close } = useDisclosure<HTMLDivElement>({
    enter: sheetEnter,
    exit: sheetExit,
  });

  const openPanel = useCallback(
    (reference?: string | null) => {
      opener.current =
        document.activeElement instanceof HTMLElement ? document.activeElement : null;
      setTarget(reference ?? null);
      open();
    },
    [open],
  );

  const closePanel = useCallback(() => {
    close();
    // Synchronously, never on the exit tween's completion: a keyboard user must not be made to wait
    // 200ms for their focus to come back (`useDisclosure`'s rule).
    opener.current?.focus();
  }, [close]);

  const api = useMemo<CreditsApi>(() => ({ open: openPanel }), [openPanel]);

  return (
    <CreditsContext value={api}>
      {children}
      {mounted && (
        // `contents`, so the scope wrapper introduces no box of its own between the scrim and the
        // panel and their `position: fixed` still resolves against the viewport.
        <div ref={scope} className="contents">
          <PhotographCredits focusReference={target} onClose={closePanel} />
        </div>
      )}
    </CreditsContext>
  );
}
