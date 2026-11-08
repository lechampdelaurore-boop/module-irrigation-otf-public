import { cubicMetersText, mmText, rateText } from '../figure-origin.ts';
import type { PlanBedOutcome, PlanProposal } from './contract.ts';
import { bedReasonLabels } from './presentation.ts';

/**
 * Les bulles « d'où vient ce chiffre » du planning (3.8,
 * docs/feature-selection-contract.md, section 6) : elles disent avec les
 * valeurs que le moteur a gardées la durée, la dose, ce que chaque planche
 * reçoit, le volume, et le manque d'une planche non servie. Elles ne
 * refont aucun calcul (docs/planning-contract.md).
 */

type ProposalFigures = Pick<PlanProposal, 'doseMm' | 'applications' | 'bedApplications' | 'volumeCubicMeters'>;

/** La durée, la part de chaque planche et le volume d'une proposition ; `durationText` est la durée telle que l'écran l'affiche. */
export function proposalOrigin(proposal: ProposalFigures, durationText: string): string {
  const reference = proposal.bedApplications.find((application) => application.appliedMm === proposal.doseMm);
  const rate = reference ? proposal.applications.find((application) => application.otfBedId === reference.bedId)?.rateMmPerHour : undefined;
  const duration = reference && rate !== undefined
    ? `${durationText} : le temps pour que ${reference.bedName}, la mieux arrosée (${rateText(rate)}), reçoive la dose de ${mmText(proposal.doseMm)}.`
    : `${durationText} : le temps pour que la planche la mieux arrosée reçoive la dose de ${mmText(proposal.doseMm)}.`;
  const shares = proposal.bedApplications.map((application) => {
    const surplus = application.surplusMm > 0 ? `, dont ${mmText(application.surplusMm)} de trop` : '';
    return `${application.bedName} ${mmText(application.appliedMm)} pour un besoin de ${mmText(application.needBeforeMm)}${surplus}`;
  });
  return [duration, `Pendant ce temps, chaque planche reçoit au taux de son réglage : ${shares.join(' ; ')}.`, volumeSentence(proposal)].join(' ');
}

function volumeSentence(proposal: ProposalFigures): string {
  const watered = proposal.bedApplications.filter((application) => application.appliedMm > 0);
  const unknown = watered.find((application) => application.wettedAreaSquareMeters === null);
  if (proposal.volumeCubicMeters === null || unknown) {
    return `Volume inconnu : la surface mouillée de ${unknown?.bedName ?? 'une planche'} n’est pas connue (son passe-pied manque).`;
  }
  const terms = watered.map((application) => `${mmText(application.appliedMm)} sur ${squareMeters.format(application.wettedAreaSquareMeters ?? 0)} m²`);
  return `Volume : ${terms.join(' + ')} = ${cubicMetersText(proposal.volumeCubicMeters)} (1 mm sur 1 m², c’est 1 litre).`;
}

const squareMeters = new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 2, useGrouping: false });

/** Le manque d'une planche du tableau « Non placé » et son motif. */
export function unplacedOrigin(bed: Pick<PlanBedOutcome, 'needMm' | 'targetMm' | 'placedMm' | 'deficitMm' | 'reasons' | 'protectedSlotNames'>): string {
  const sentences = [`Besoin au départ du calcul ${mmText(bed.needMm)} − placé ${mmText(bed.placedMm)} = ${mmText(bed.deficitMm)} de manque.`];
  if (bed.targetMm < bed.needMm) sentences.push(`La conduite en pénurie ou votre choix entre les demandes d’eau a ramené sa cible à ${mmText(bed.targetMm)}.`);
  sentences.push(bed.reasons.length === 0
    ? 'Motif : manque partiel, faute de place dans la semaine.'
    : `Motif : ${bedReasonLabels(bed).join(' ; ')}.`);
  return sentences.join(' ');
}
