import { useCallback } from 'react';

/**
 * Two motion scopes, one node.
 *
 * **Why this exists at all.** `useMotion` owns its scope ref (R-G2) so that a caller cannot
 * forget to scope and a selector cannot escape. That is the right default, and it means a
 * component wanting two *named motions* on the same element gets two refs and can only attach
 * one. Choosing between them is what `ButtonLink` used to do, and it silently dropped G-7's
 * press feedback from the one element in the product that has G-9.
 *
 * A callback ref is the correct mechanism and not a workaround: React calls it during commit,
 * with the node and then with `null` on detach, which is exactly when a scope ref should be
 * written. It is `useCallback`-stable over the refs' identities — refs are stable for the life
 * of a component — so the node is not detached and re-attached on every render.
 *
 * **Two parameters, deliberately not a rest array.** Three motions on one node is a smell worth
 * having to justify, and a fixed arity keeps the dependency list a literal that the lint rule
 * can actually check.
 */
export function useMergedScope<T extends HTMLElement>(
  firstRef: React.RefObject<T | null>,
  secondRef: React.RefObject<T | null>,
): (node: T | null) => void {
  return useCallback(
    (node: T | null) => {
      firstRef.current = node;
      secondRef.current = node;
    },
    [firstRef, secondRef],
  );
}
