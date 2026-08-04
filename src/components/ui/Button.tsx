import { motion } from 'framer-motion';
import type { ReactNode } from 'react';
import { Link } from 'react-router';
import { control } from '@/lib/motion';

/**
 * `DESIGN_SYSTEM.md` §7.1. F0 needs `primary`, `secondary` and `ghost` only — `danger`
 * waits for F1, per Design Spec §3.
 *
 * Every visual value comes from a class in `styles/index.css`, which reads tokens. The
 * only thing this module decides is which class, and the M-6 gesture — `whileTap` at
 * `spring.control`. `whileFocus` is deliberately unused: the focus ring is CSS
 * `:focus-visible` (§3.5.1) and motion is never a focus indicator.
 */

export type ButtonVariant = 'primary' | 'secondary' | 'ghost';
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
  return (
    <motion.button
      type={type}
      className={classesFor(variant, size, className)}
      onClick={onClick}
      disabled={disabled}
      aria-label={ariaLabel}
      {...(disabled ? {} : { whileTap: control.whileTap })}
      transition={control.transition}
    >
      {children}
    </motion.button>
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
  return (
    <motion.span
      whileTap={control.whileTap}
      transition={control.transition}
      className="inline-flex"
    >
      <Link to={to} className={classesFor(variant, size, className)}>
        {children}
      </Link>
    </motion.span>
  );
}
