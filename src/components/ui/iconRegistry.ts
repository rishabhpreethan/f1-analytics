import {
  ArrowRight,
  CalendarDays,
  GitCompareArrows,
  House,
  MapPin,
  MoreHorizontal,
  Pin,
  PinOff,
  Trophy,
  UserRound,
  Users,
  X,
} from '@/components/ui/icons';

/**
 * The name → component registry, so a data structure can *name* a glyph rather than
 * import one. `navItems.ts` has to stay free of JSX to remain a pure, unit-testable module
 * (CT-11 / CT-12), which means it cannot hold component references — it holds an
 * `IconName`, and the nav resolves it here.
 *
 * `IconName` is derived from this object's keys, so a nav item naming a glyph that does not
 * exist is a **compile error**, not a blank square at runtime.
 */
export const ICONS = {
  House,
  CalendarDays,
  UserRound,
  Users,
  MapPin,
  GitCompareArrows,
  Trophy,
  MoreHorizontal,
  Pin,
  PinOff,
  ArrowRight,
  X,
} as const;

export type IconName = keyof typeof ICONS;
