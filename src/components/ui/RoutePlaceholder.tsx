/**
 * The F0-only route placeholder (Design Spec §2.3). Deleted feature by feature as the
 * real surfaces land, so it is deliberately shallow: an eyebrow, an `h1`, one sentence
 * naming the feature that replaces it, and the resolved route params as mono chips.
 *
 * It **fetches nothing**. Every route in F0 renders one of these (except `NotFound`,
 * which is a StateCard), and the only network request the app makes is `/api/meta` from
 * the header.
 *
 * Params are echoed **unvalidated** on purpose: F0 owns no URL parameter (Technical Spec
 * §3.7), and validation arrives with the feature that gives a param meaning. React
 * escapes the text, so echoing it is not an injection path (S-8).
 */

export interface RoutePlaceholderProps {
  /** Uppercase eyebrow, e.g. `SEASON HUB`. */
  eyebrow: string;
  title: string;
  /** The feature that replaces this surface, e.g. `F2`. */
  ships: string;
  params?: ReadonlyArray<{ name: string; value: string | undefined }>;
}

export function RoutePlaceholder({ eyebrow, title, ships, params = [] }: RoutePlaceholderProps) {
  const resolved = params.filter(
    (param): param is { name: string; value: string } => param.value !== undefined,
  );

  return (
    <div className="flex flex-col items-start gap-3">
      <p className="t-2xs text-ink-tertiary">{eyebrow}</p>
      <h1 className="t-display-lg text-ink-primary">{title}</h1>
      <p className="t-md text-ink-secondary">This surface ships in {ships}.</p>

      {resolved.length > 0 && (
        <ul className="mt-1 flex flex-wrap items-center gap-2">
          {resolved.map((param) => (
            <li key={param.name} className="chip t-mono t-xs gap-1">
              <span className="text-ink-tertiary">{param.name}</span>
              <span className="text-ink-primary">{param.value}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
