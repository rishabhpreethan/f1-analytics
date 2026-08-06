import type { ReactNode } from 'react';
import { Link } from 'react-router';
import { useMagnet, usePressMotion } from '@/lib/motion/interactions';
import { useMergedScope } from '@/lib/motion/useMergedScope';

/**
 * `DESIGN_SYSTEM.md` §7.1. F0 needs `primary`, `secondary`, `ghost` and — added by
 * CR-007 — `hero`, the landing page's one oversized primary action. `danger` waits for F1.
 *
 * Every visual value comes from a class in `styles/index.css`, which reads tokens. The
 * only things this module decides are which class, and **G-7**'s press feedback via
 * `usePressMotion` — which is context-safe and a no-op under reduced motion. The hover
 * step is a CSS transition on the same element, so a reduced-motion user still gets
 * feedback. `whileFocus` has no successor and needs none: the focus ring is CSS
 * `:focus-visible` (§3.5.1) and motion is never a focus indicator.
 */

export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'hero';
export type ButtonSize = 'sm' | 'md' | 'lg';

interface CommonProps {
  variant?: ButtonVariant;
  size?: ButtonSize;
  className?: string;
  children: ReactNode;
}

function classesFor(variant: ButtonVariant, size: ButtonSize, extra?: string): string {
  return ['btn', `btn-${size}`, `btn-${variant}`, extra].filter(Boolean).join(' ');
}

export interface ButtonProps extends CommonProps {
  type?: 'button' | 'submit';
  onClick?: () => void;
  disabled?: boolean;
  'aria-label'?: string;
}

export function Button({
  variant = 'secondary',
  size = 'md',
  className,
  children,
  type = 'button',
  onClick,
  disabled = false,
  'aria-label': ariaLabel,
}: ButtonProps) {
  const { scope, press } = usePressMotion<HTMLButtonElement>();

  return (
    <button
      ref={scope}
      type={type}
      className={classesFor(variant, size, className)}
      onClick={onClick}
      disabled={disabled}
      aria-label={ariaLabel}
      {...(disabled ? {} : press)}
    >
      {children}
    </button>
  );
}

export interface ButtonLinkProps extends CommonProps {
  to: string;
  /**
   * **G-9.** `true` on exactly one element in the product — the landing hero's primary action. A
   * page of magnetic buttons is a toy, and §4.6 says so; it is a prop rather than a variant
   * because `hero` is about size and colour and this is about behaviour.
   */
  magnetic?: boolean;
}

/**
 * A navigation action wearing a button's clothes. It stays an anchor, so it keeps
 * middle-click, "open in new tab" and the browser's own affordances — a `<button>` that
 * navigates loses all three.
 */
export function ButtonLink({
  variant = 'secondary',
  size = 'md',
  className,
  children,
  to,
  magnetic = false,
}: ButtonLinkProps) {
  const { scope: pressScope, press } = usePressMotion<HTMLAnchorElement>();
  const { scope: magnetScope, handlers: magnetHandlers } = useMagnet<HTMLAnchorElement>(magnetic);

  /**
   * **Two hooks, one node — merged, not chosen.** Choosing dropped G-7 from the hero CTA, which
   * is the most-clicked element on the landing page, on the reasoning that `overwrite: 'auto'`
   * would make G-9 and G-7 fight. That reasoning was wrong: auto-overwrite kills conflicting
   * tweens **of the same property**, and G-9 writes `x`/`y` while G-7 writes `scale` — distinct
   * properties of the same transform, which GSAP composes rather than contests.
   */
  const scope = useMergedScope(pressScope, magnetScope);

  /**
   * Both affordances, composed by hand rather than spread — because both define
   * `onPointerLeave` and a spread would silently drop one of them. The magnet must return to
   * zero *and* the press must release.
   */
  const handlers = magnetic
    ? {
        ...press,
        onPointerMove: magnetHandlers.onPointerMove,
        onPointerLeave: () => {
          magnetHandlers.onPointerLeave();
          press.onPointerLeave();
        },
      }
    : press;

  return (
    <Link ref={scope} to={to} className={classesFor(variant, size, className)} {...handlers}>
      {children}
    </Link>
  );
}
