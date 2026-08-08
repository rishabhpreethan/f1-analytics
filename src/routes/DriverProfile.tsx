import { useParams } from 'react-router';
import { StateCard } from '@/components/ui/StateCard';
import { Users } from '@/components/ui/icons';
import { DriverPage } from '@/features/driver/DriverPage';
import { useDriver, useRetryEntity } from '@/features/entity/useEntity';
import { resolveEntityRef } from '@/lib/entityRef';

/**
 * `/drivers/:driverRef` — a `driver.reference` slug, never an internal id (DL-3, trap 11).
 *
 * **This is the feature boundary, so this is the only thing here that fetches**
 * (ARCHITECTURE.md §3). It resolves the URL, calls one hook, and hands plain values to
 * `DriverPage`, which is a pure function of a payload and can therefore be tested against a
 * fixture with no network and no router.
 *
 * **A malformed reference is named, not defaulted.** There is no "some other driver" a
 * reader who typed a bad slug would have meant, so `resolveEntityRef` reports the invalid
 * value and this explains it in a sentence — which still satisfies §5's "never a blank page,
 * never a crash". A *well-formed* reference the archive does not hold is a different answer
 * and comes back from the server as a 404, which `DriverPage` renders as its own state.
 */
export function DriverProfile() {
  const { driverRef } = useParams();
  const ref = resolveEntityRef(driverRef);
  const reference = ref.status === 'resolved' ? ref.reference : null;

  const driver = useDriver(reference);
  const retry = useRetryEntity('driver', reference);

  if (ref.status === 'invalid') {
    return (
      <div className="shell-container entity-page px-4 md:px-6 xl:px-8">
        <StateCard icon={<Users />} tone="neutral" title="That is not a driver" code="BAD_REQUEST">
          <p>
            {`A driver is addressed by their reference — letters, digits, hyphens and underscores. “${ref.value}” isn’t one.`}
          </p>
        </StateCard>
      </div>
    );
  }

  return (
    <DriverPage
      driver={driver.data ?? null}
      pending={driver.data === undefined && driver.error === null}
      error={driver.error === null ? null : { code: driver.error.code }}
      onRetry={retry}
    />
  );
}
