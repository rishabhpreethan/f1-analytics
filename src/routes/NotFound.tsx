import { ButtonLink } from '@/components/ui/Button';
import { StateCard } from '@/components/ui/StateCard';
import { AlertTriangle } from '@/components/ui/icons';

/**
 * The catch-all. It uses the `404` StateCard from `DESIGN_SYSTEM.md` §7.4 rather than
 * the route-placeholder shape, and it renders **inside** `AppShell` — a wrong address is
 * not a reason to lose the nav or the theme control (E13).
 *
 * F9 owns the searchable version.
 */
export function NotFound() {
  return (
    <StateCard
      icon={<AlertTriangle />}
      title="No page at this address"
      action={
        <ButtonLink to="/" variant="primary">
          Go to the current season
        </ButtonLink>
      }
    >
      <p>The link may be wrong, or the season, driver or team may not exist.</p>
    </StateCard>
  );
}
