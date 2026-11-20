'use client';

import { onboardingExplanation, onboardingSummary, verificationLine, type ResolvedOnboarding } from '@/lib/domain/onboarding/steps';

const TONE_WORDS = { confirmed: 'Confirmé', skipped: 'Passé', missing: 'À faire' } as const;

/**
 * L'accueil de la ferme, dans Réglages (4.4, docs/tranche-4-contract.md,
 * F417, F426, F427 ; PR 1, F581) : chaque étape, son état et d'où vient ce
 * qui est en place. Une ferme d'avant l'accueil y lit que ses réglages sont
 * gardés tels quels ; une ferme neuve, ce qui lui reste à faire. Fermé par
 * défaut, en bas de la page ; l'étape de la commune mène au lieu de la
 * météo, plus haut (PR 2, F582). Absent de la
 * démonstration, dont les fermes fictives sont déjà réglées.
 */
export function OnboardingSettings({ onboarding, locationHere, plotsHere, soilHref }: {
  onboarding: ResolvedOnboarding;
  /** Le lieu de la météo est sur cette page (une case cochée lit la météo) : l'étape « Où est la ferme » y mène (F582). */
  locationHere: boolean;
  /** « Parcelles et abris » est sur cette page : l'étape y mène (F583). */
  plotsHere: boolean;
  /** Où saisir le sol de la première parcelle qui n'en a pas, sur la page « Réserve du sol » (F584) ; `null` : rien à y faire. */
  soilHref: string | null;
}) {
  if (onboarding.kind === 'demonstration') return null;
  const lines = onboarding.steps.map(verificationLine);
  return (
    <section className="water-management-section onboarding-settings" aria-labelledby="accueil-de-la-ferme">
      <details className="water-panel water-fold">
        <summary>
          <h2 id="accueil-de-la-ferme">Accueil de la ferme</h2>
          <small>{onboardingSummary(onboarding)}</small>
        </summary>
        <div className="water-fold-body">
          <p>{onboardingExplanation(onboarding)}</p>
          <ol className="onboarding-steps">
            {lines.map((line) => (
              <li key={line.id} className={`onboarding-step onboarding-step-${line.tone}`}>
                <strong>{line.label}</strong>
                <span className="onboarding-step-state">{TONE_WORDS[line.tone]}</span>
                <span>{line.text}</span>
                {line.id === 'location' && line.tone === 'missing' && locationHere ? <a href="#water-weather-title">Choisir la commune</a> : null}
                {line.id === 'plots' && line.tone === 'missing' && plotsHere ? <a href="#parcelles-et-abris">Classer les jardins</a> : null}
                {line.id === 'soil' && line.tone === 'missing' && soilHref ? <a href={soilHref}>Saisir le sol</a> : null}
              </li>
            ))}
          </ol>
        </div>
      </details>
    </section>
  );
}
