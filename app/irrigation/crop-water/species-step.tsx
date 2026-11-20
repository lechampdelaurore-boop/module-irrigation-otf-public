'use client';

import { useState } from 'react';
import { speciesLinkCounter } from '@/lib/domain/crop-water/species-linking';
import type { SeasonSpecies } from '@/lib/domain/crop-water/species';
import { proposalOriginText, type SpeciesLinkProposal } from '@/lib/domain/onboarding/species';
import { SPECIES_STEP_ANCHOR } from '@/lib/domain/onboarding/steps';

/**
 * L'étape « Rattachez vos espèces » d'une ferme neuve (4.4,
 * docs/tranche-4-contract.md, F423 ; PR 4c, F587), en tête de la
 * correspondance des espèces : chaque proposition se lit, cochée ; la
 * personne décoche ce qu'elle ne veut pas et rattache le reste d'un geste.
 * Une espèce sans proposition se rattache à la main, dans la liste. L'étape
 * se confirme quand la personne le décide : ce qui n'est pas rattaché reste
 * « à rattacher ».
 */
export function SpeciesStep({ step, species, pending, onLink, onConfirm }: {
  step: { confirmed: boolean; proposals: readonly SpeciesLinkProposal[] };
  species: readonly SeasonSpecies[];
  pending: boolean;
  onLink: (plantIds: string[]) => void;
  onConfirm: () => void;
}) {
  const [unchecked, setUnchecked] = useState<ReadonlySet<string>>(new Set());
  if (step.confirmed && step.proposals.length === 0) return null;
  const kept = step.proposals.filter((proposal) => !unchecked.has(proposal.plantId));
  const toggle = (plantId: string) => setUnchecked((current) => {
    const next = new Set(current);
    if (next.has(plantId)) next.delete(plantId);
    else next.add(plantId);
    return next;
  });
  return (
    <section id={SPECIES_STEP_ANCHOR} className="species-step" aria-labelledby="species-step-title">
      <h3 id="species-step-title">Rattachez vos espèces</h3>
      <p>
        {speciesLinkCounter(species)}. Une espèce rattachée suit les Kc de sa culture de référence ; une espèce non rattachée
        garde votre objectif seul, son besoin n’est pas calculé.
      </p>
      {step.proposals.length === 0 ? (
        <p className="species-step-empty">Aucune proposition : rattachez chaque espèce à la main, dans la liste ci-dessous.</p>
      ) : (
        <fieldset className="species-step-proposals">
          <legend>{step.proposals.length} proposition{step.proposals.length > 1 ? 's' : ''} : décochez celles que vous ne gardez pas</legend>
          <ul>
            {step.proposals.map((proposal) => (
              <li key={proposal.plantId}>
                <label>
                  <input type="checkbox" checked={!unchecked.has(proposal.plantId)} disabled={pending} onChange={() => toggle(proposal.plantId)} />
                  <span><strong>{proposal.plantName}</strong> → {proposal.cropName}</span>
                  <small>{proposalOriginText(proposal)}</small>
                </label>
              </li>
            ))}
          </ul>
          <button type="button" className="primary" disabled={pending || kept.length === 0} onClick={() => onLink(kept.map((proposal) => proposal.plantId))}>
            {kept.length === 0 ? 'Aucune espèce cochée' : `Rattacher ${kept.length === 1 ? 'l’espèce cochée' : `les ${kept.length} espèces cochées`}`}
          </button>
        </fieldset>
      )}
      {step.confirmed ? null : (
        <div className="species-step-confirm">
          <p>Quand vos espèces vous conviennent, confirmez l’étape : celles qui restent non rattachées le restent, signalées partout.</p>
          <button type="button" disabled={pending} onClick={onConfirm}>Confirmer l’étape « Cultures »</button>
        </div>
      )}
    </section>
  );
}
