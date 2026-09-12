import type { Driver } from '@schemas/driver';
import { CareerRibbon } from '@/components/entity/CareerRibbon';
import { EntityMasthead, type MastheadFact } from '@/components/entity/EntityMasthead';
import { CreditLine } from '@/features/credits/CreditLine';
import { photographFor } from '@/features/credits/imagery';
import { driverRibbon } from './presenters';

/**
 * **The driver masthead** — DR-1, `DESIGN_SYSTEM.md` §6.6.2.1.
 *
 * **No current age, and that is permanent rather than a gap to close.** The schema has no date of
 * death anywhere, so an age computed against today would confidently report Fangio at 114. The
 * payload publishes `ageAtFirstRace` and `ageAtLastRace` instead — two figures derived from dates
 * the data holds, correct forever and carrying no clock — and the meta line reads them.
 *
 * **The photograph layer is wired here and only here at full priority** (§7.17.6). This portrait is
 * likely the largest element on the page and therefore the LCP candidate, so it loads eagerly; the
 * index rows and the compare tray bays are below the fold and stay lazy. 22 of 881 drivers have a
 * photograph, so for 859 of these pages the portrait is the monogram — the same shape, the same
 * border, the same identity bar — and the credit line below simply does not render.
 *
 * **A driver with no code gets no badge.** `abbreviation` is null for 774 of 881, so an empty or
 * `—` badge would be the common case and would state a fact about our source rather than about the
 * driver. The surname is already the headline (§6.5.4a's fallback rule, applied to a masthead).
 * Same for `permanentCarNumber`, null for 818 of 881.
 */

export interface DriverMastheadProps {
  driver: Driver | null;
  pending: boolean;
}

export function DriverMasthead({ driver, pending }: DriverMastheadProps) {
  const facts: MastheadFact[] = [];

  if (driver !== null) {
    const { driver: profile, career } = driver;

    if (profile.nationality !== null) {
      facts.push({ label: 'Nationality', value: profile.nationality });
    }
    if (profile.permanentCarNumber !== null) {
      facts.push({
        label: 'Car number',
        value: `No. ${String(profile.permanentCarNumber)}`,
        mono: true,
      });
    }
    if (profile.dateOfBirth !== null) {
      facts.push({ label: 'Born', value: `Born ${profile.dateOfBirth}`, mono: true });
    }
    if (career.firstSeason !== null && career.lastSeason !== null) {
      facts.push({
        label: 'Seasons',
        value:
          career.firstSeason === career.lastSeason
            ? String(career.firstSeason)
            : `${String(career.firstSeason)}–${String(career.lastSeason)}`,
        mono: true,
      });
    }
    /*
     * The two ages, and only when the data carries them. `ageAtFirstRace` alone is rendered for a
     * driver whose career is one season, because "debut at 24, last race at 24" is a sentence about
     * a rounding rather than about a career.
     */
    if (career.ageAtFirstRace !== null) {
      const sameYear =
        career.ageAtLastRace === null || career.ageAtLastRace === career.ageAtFirstRace;
      facts.push({
        label: 'Age',
        value: sameYear
          ? `Debut at ${String(career.ageAtFirstRace)}`
          : `Debut at ${String(career.ageAtFirstRace)}, last race at ${String(career.ageAtLastRace)}`,
      });
    }
  }

  const ribbon = driver === null ? [] : driverRibbon(driver.seasons);
  const photograph = photographFor(driver?.driver.ref);

  return (
    <EntityMasthead
      eyebrow="Driver"
      titleId="driver-title"
      name={driver === null ? null : `${driver.driver.forename} ${driver.driver.surname}`}
      code={driver?.driver.code ?? null}
      teamReference={driver?.races.at(-1)?.teamRef ?? null}
      portrait="driver"
      reference={driver?.driver.ref ?? null}
      priority
      credit={<CreditLine images={[photograph]} />}
      facts={facts}
      pending={pending}
    >
      {(pending || ribbon.length > 0) && (
        <CareerRibbon
          seasons={ribbon}
          pending={pending}
          measureLabel="Championship position"
          absentCopy="Did not race"
          unrankedCopy="Raced, no championship position"
          ariaLabel={
            driver === null
              ? 'Championship position by season'
              : `Championship position by season, ${String(driver.career.firstSeason ?? '')} to ${String(driver.career.lastSeason ?? '')}. Every season is listed in the table below.`
          }
        />
      )}
    </EntityMasthead>
  );
}
