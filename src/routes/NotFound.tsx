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
    // `main` no longer carries the page gutters (Design Spec §5.5).
    <div className="shell-container px-4 py-6 md:px-6 md:py-8 xl:px-8 xl:py-12">
      <StateCard
        icon={<AlertTriangle />}
        title="No page at this address"
        action={
          // `/` is the landing page from CR-007, not the season hub, so the label follows.
          <ButtonLink to="/" variant="primary">
            Go to the home page
          </ButtonLink>
        }
      >
        <p>The link may be wrong, or the season, driver or team may not exist.</p>
      </StateCard>
    </div>
  );
}
