import type { ReactNode } from 'react';
import { Link } from 'react-router';
import { usePressMotion } from '@/lib/motion/interactions';

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
}: ButtonLinkProps) {
  const { scope, press } = usePressMotion<HTMLAnchorElement>();

  return (
    <Link ref={scope} to={to} className={classesFor(variant, size, className)} {...press}>
      {children}
    </Link>
  );
}
