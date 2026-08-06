import { Button } from '@/components/ui/Button';
import { StateCard } from '@/components/ui/StateCard';
import { AlertTriangle, RefreshCw } from '@/components/ui/icons';

/**
 * The error state (`DESIGN_SYSTEM.md` §7.4, Design Spec §7): a `critical` icon tile, a
 * retry action, and a mono code chip.
 *
 * The chip is the point of the `code` prop. "Something went wrong" is what a reader
 * needs; `RATE_LIMITED` is what someone diagnosing it needs, and the two belong on the
 * same card. The code is one of the fixed `ErrorCode` strings — never a server message,
 * never a status line, so nothing here can leak a path, a stack frame or SQL (S-6).
 */

export interface ErrorStateProps {
  title: string;
  detail?: string;
  /** The mono chip, e.g. `INTERNAL`. */
  code?: string;
  onRetry?: () => void;
}

export function ErrorState({ title, detail, code, onRetry }: ErrorStateProps) {
  return (
    <StateCard
      icon={<AlertTriangle size={20} />}
      title={title}
      {...(code === undefined ? {} : { code })}
      action={
        onRetry === undefined ? undefined : (
          <Button variant="primary" onClick={onRetry}>
            <RefreshCw size={16} />
            Try again
          </Button>
        )
      }
    >
      {detail === undefined ? undefined : <p>{detail}</p>}
    </StateCard>
  );
}
