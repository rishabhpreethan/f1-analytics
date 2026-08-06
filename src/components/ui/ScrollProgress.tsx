import { useScrollProgress } from '@/lib/motion/scroll';

/**
 * **G-14** — a 2px `--accent-mark` bar at `top: 0`, `scaleX` scrubbed against the document.
 *
 * **Rendered on `/` only**, and **not rendered at all under reduced motion** (§4.6, §10): a
 * scroll-linked bar is inherently motion, and document-level progress is not information the page
 * needs — so the honest reduced variant is its absence, not a static bar at 0% that looks broken.
 *
 * That decision is made here rather than inside the hook because it is about what to *render*, and
 * `useMotion` already exposes `reduced` for exactly this class of decision.
 *
 * `aria-hidden`: it duplicates the scrollbar, which the browser already exposes.
 */
export function ScrollProgress() {
  const { scope, reduced } = useScrollProgress<HTMLDivElement>();

  if (reduced) return null;

  return <div ref={scope} className="scroll-progress" aria-hidden="true" />;
}
