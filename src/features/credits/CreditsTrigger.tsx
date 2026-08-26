import { Camera } from '@/components/ui/icons';
import { useCredits } from './CreditsContext';

/**
 * **`Photograph credits`** — §7.18.1's surface-level entry point, used in the footer on every page
 * and in the compare tray beside the picker.
 *
 * It is a plain labelled control rather than an icon-only one, and that is the licence's doing
 * rather than §2.5's: a reader has to be able to *find* the attribution, and a lone camera glyph in
 * a footer is a thing people scroll past.
 */
export function CreditsTrigger({ className = '' }: { className?: string }) {
  const { open } = useCredits();
  return (
    <button
      type="button"
      className={`credits-trigger ${className}`.trim()}
      onClick={() => {
        open(null);
      }}
    >
      <Camera size={16} />
      Photograph credits
    </button>
  );
}
