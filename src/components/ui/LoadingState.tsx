import { motion, useReducedMotion } from 'framer-motion';
import { skeletonPulse, skeletonPulseReduced } from '@/lib/motion';

/**
 * The loading state, as skeleton geometry — never a bare spinner for a panel
 * (`DESIGN_SYSTEM.md` §7.4, §7.5). The block mirrors the shape of what is coming, so
 * nothing reflows when the value arrives.
 *
 * **M-7 branches on `useReducedMotion()` explicitly.** `MotionConfig reducedMotion="user"`
 * disables transform and layout animation but deliberately preserves opacity, so it does
 * **not** stop an opacity loop. Under a reduced-motion preference the pulse must stop —
 * not slow down — which is what `skeletonPulseReduced` (a static `opacity: 0.7`, no
 * `repeat`) does.
 *
 * Accessibility per §7.5: the container carries `aria-busy`, and the skeleton itself is
 * `aria-hidden` so a screen reader is told "busy" once instead of reading grey boxes.
 */

export interface LoadingStateProps {
  /**
   * What is loading. Becomes the busy container's accessible name, because a skeleton has
   * no text of its own.
   */
  label?: string;
  /**
   * Geometry for the skeleton block. §7.5 requires the skeleton to mirror what it
   * replaces, and geometry is per-site, so the caller supplies the sizing class from
   * `styles/index.css` — never an inline dimension.
   */
  className?: string;
}

export function LoadingState({ label = 'Loading', className }: LoadingStateProps) {
  const reduced = useReducedMotion();
  const blockClass = ['skeleton', className].filter(Boolean).join(' ');

  return (
    <span className="inline-flex" role="status" aria-busy="true" aria-label={label}>
      {reduced === true ? (
        <motion.span
          aria-hidden="true"
          className={blockClass}
          animate={skeletonPulseReduced.animate}
        />
      ) : (
        <motion.span
          aria-hidden="true"
          className={blockClass}
          animate={skeletonPulse.animate}
          transition={skeletonPulse.transition}
        />
      )}
    </span>
  );
}
