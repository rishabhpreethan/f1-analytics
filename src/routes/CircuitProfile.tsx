import { useParams } from 'react-router';
import { StateCard } from '@/components/ui/StateCard';
import { MapPin } from '@/components/ui/icons';
import { CircuitPage } from '@/features/circuit/CircuitPage';
import { useCircuit, useRetryEntity } from '@/features/entity/useEntity';
import { resolveEntityRef } from '@/lib/entityRef';

/**
 * `/circuits/:circuitRef` — a `circuit.reference` slug, never an internal id (DL-3).
 *
 * **This is the feature boundary, so this is the only thing here that fetches**
 * (`ARCHITECTURE.md` §3). It resolves the URL, calls one hook, and hands plain values to
 * `CircuitPage`, which is a pure function of a payload and is tested against a fixture with no
 * network and no router.
 *
 * ---
 *
 * **This file is the `developer`'s territory and was written by the `designer`, deliberately.** The
 * previous version was a placeholder whose own comment said the endpoint shipped, `useCircuit`
 * existed, and only the surface was missing — *"wiring this route is then the same six lines as
 * `DriverProfile`"*. The surface landed in the same session, and leaving the two halves unjoined
 * would have produced §1.0a's exact failure in a new place: **a complete feature reachable only by
 * typing a URL**, correct on both sides of a seam that belonged to neither.
 *
 * It mirrors `DriverProfile` and `TeamProfile` line for line rather than introducing anything, and
 * it is flagged in the hand-off so the boundary is crossed visibly rather than quietly.
 */
export function CircuitProfile() {
  const { circuitRef } = useParams();
  const ref = resolveEntityRef(circuitRef);
  const reference = ref.status === 'resolved' ? ref.reference : null;

  const circuit = useCircuit(reference);
  const retry = useRetryEntity('circuit', reference);

  if (ref.status === 'invalid') {
    return (
      <div className="shell-container entity-page px-4 md:px-6 xl:px-8">
        <StateCard
          icon={<MapPin />}
          tone="neutral"
          title="That is not a circuit"
          code="BAD_REQUEST"
        >
          <p>
            {`A circuit is addressed by its reference — letters, digits, hyphens and underscores. “${ref.value}” isn’t one.`}
          </p>
        </StateCard>
      </div>
    );
  }

  return (
    <CircuitPage
      circuit={circuit.data ?? null}
      pending={circuit.data === undefined && circuit.error === null}
      error={circuit.error === null ? null : { code: circuit.error.code }}
      onRetry={retry}
    />
  );
}
