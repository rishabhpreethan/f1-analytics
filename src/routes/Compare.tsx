import { RoutePlaceholder } from '@/components/ui/RoutePlaceholder';

/**
 * `/compare`. F0 introduces **no** query parameter (Technical Spec §3.7); the whole
 * `?kind=…&e=…` contract in `ARCHITECTURE.md` §5 belongs to F7, so nothing is read here.
 */
export function Compare() {
  return <RoutePlaceholder eyebrow="Comparison workspace" title="Compare" ships="F7" />;
}
