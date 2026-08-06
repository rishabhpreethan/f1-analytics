/**
 * The loading state, as skeleton geometry — never a bare spinner for a panel
 * (`DESIGN_SYSTEM.md` §7.4, §7.5). The block mirrors the shape of what is coming, so
 * nothing reflows when the value arrives.
 *
 * **G-11's pulse is CSS, and this component now contains no motion code at all.** It used
 * to branch on the reduced-motion preference in JavaScript, because the retired library's
 * global provider did not stop an opacity loop. Under MR-1 a loop is `@keyframes`
 * (`styles/motion.css`),
 * the resting opacity is exactly the value G-11 specifies for the reduced state, and the
 * global reduced-motion chokepoint stops the animation dead — so there is nothing left
 * here to get wrong, and nothing to forget at the next call site.
 *
 * Accessibility per §7.5: the container carries `aria-busy`, and the skeleton itself is
 * `aria-hidden` so a screen reader is told "busy" once instead of reading grey boxes.
 */

export interface LoadingStateProps {
  /**
   * What is loading. Becomes the busy container's accessible name, because a skeleton has
   * no text of its own. Ignored when `announce` is `false`, where there is no region to name.
   */
  label?: string;
  /**
   * Geometry for the skeleton block. §7.5 requires the skeleton to mirror what it
   * replaces, and geometry is per-site, so the caller supplies the sizing class from
   * `styles/index.css` — never an inline dimension.
   */
  className?: string;
  /**
   * `false` when the **caller** already owns the busy region for the whole group, and this is
   * one block of several inside it.
   *
   * §7.5's rule is "told busy once", and a panel whose skeleton is several blocks breaks it by
   * default: eight of these in one strip is eight `role="status"` regions with the same name
   * inside one `aria-busy` container, which is eight announcements of the same fact. The
   * container is the right place for the region — it is the thing that is loading — so this
   * renders the geometry alone and nothing else.
   */
  announce?: boolean;
}

export function LoadingState({ label = 'Loading', className, announce = true }: LoadingStateProps) {
  const blockClass = ['skeleton', className].filter(Boolean).join(' ');

  if (!announce) return <span aria-hidden="true" className={blockClass} />;

  return (
    <span className="inline-flex" role="status" aria-busy="true" aria-label={label}>
      <span aria-hidden="true" className={blockClass} />
    </span>
  );
}
