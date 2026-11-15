import { cubicMetersFromLiters } from '../units.ts';
import { effectiveProposalStatus, type PlanBedOutcome, type StoredWeeklyPlan } from './contract.ts';
import { isCanceledValidation } from './presentation.ts';
import { uncountedWaterCount, unknownWaterChainCount, waterDeficitValue } from './water-deficit-summary.ts';

/**
 * La pénurie lue en une phrase au planning (docs/audit-ergonomie-final-lot-b-contract.md,
 * lot B de l'audit ergonomique final, R3). Affichage seul : rien ici ne
 * calcule une part, un manque ni une dose ; tout se lit sur le plan
 * enregistré, tel que le moteur l'a rangé.
 */

/** Sous un litre, le manque d'eau est un arrondi : aucune phrase (comme les notes du calcul, D-040). */
const ONE_LITER_CUBIC_METERS = cubicMetersFromLiters(1);
/** Sous un centième de millimètre, le manque d'une planche est un arrondi (`isBedUnplaced`). */
const NEGLIGIBLE_DEFICIT_MM = 0.01;

/**
 * L'eau manque au plan : chiffrée au litre au moins, ou sûre sans volume pour
 * une planche au volume inconnu (D-098). Une eau seulement inconnue n'est pas
 * un manque (D-089).
 */
function lacksWater(deficit: StoredWeeklyPlan['calculation']['summary']['deficit']): boolean {
  return deficit.waterCubicMeters >= ONE_LITER_CUBIC_METERS || (deficit.unknownVolumeBeds?.water ?? 0) > 0;
}

/** Une planche qui garde un manque : elle ne recevra pas tout son besoin. */
export function keepsDeficit(bed: Pick<PlanBedOutcome, 'deficitMm'>): boolean {
  return bed.deficitMm >= NEGLIGIBLE_DEFICIT_MM;
}

export type ShortageAction = {
  /** « Il manque 0,367 m³ d'eau d'ici dimanche : 5 planches ne recevront pas tout leur besoin. » */
  sentence: string;
  /** Une répartition validée s'applique au plan : la phrase le dit, et le lien de R4 invite à la revoir. */
  arbitrated: boolean;
};

const bedsText = (count: number) => (count > 1 ? `${count} planches ne recevront pas tout leur besoin` : '1 planche ne recevra pas tout son besoin');

/**
 * La phrase d'action en tête du résumé du planning (F243) : seulement quand
 * l'eau manque, chiffrée au litre au moins, ou sûre sans volume pour une
 * planche au volume inconnu (D-098) ; une chaîne à l'eau inconnue n'est pas
 * un manque, elle rend seulement le volume « au moins » (D-089). Le volume
 * s'écrit comme la tuile « Manque d'eau ». Nulle sans manque d'eau.
 */
export function shortageAction(plan: Pick<StoredWeeklyPlan, 'calculation'>, formatVolume: (cubicMeters: number) => string): ShortageAction | null {
  const { deficit, budgets, beds, arbitration } = plan.calculation.summary;
  if (!lacksWater(deficit)) return null;
  const uncounted = uncountedWaterCount(deficit, unknownWaterChainCount(budgets));
  const value = waterDeficitValue(deficit.waterCubicMeters, uncounted, formatVolume);
  // « non chiffré » ne se lit pas « il manque non chiffré » : la phrase dit qu'un manque existe sans le chiffrer.
  const missing = value === 'non chiffré' ? 'il manque de l’eau d’ici dimanche, sans que le manque puisse être chiffré' : `il manque ${value} d’eau d’ici dimanche`;
  // Une planche qu'aucun matériel n'arrose est un réglage à faire, jamais un manque d'eau (audit ergonomique, lot 3, cas 2).
  const count = beds.filter((bed) => keepsDeficit(bed) && !bed.reasons.includes('no-equipment')).length;
  const consequence = count > 0 ? bedsText(count) : null;
  if (arbitration) {
    return { arbitrated: true, sentence: `Votre répartition s’applique : ${missing}${consequence ? `, ${consequence}` : ''}.` };
  }
  const lead = `${missing.charAt(0).toLocaleUpperCase('fr-FR')}${missing.slice(1)}`;
  return { arbitrated: false, sentence: `${lead}${consequence ? ` : ${consequence}` : ''}.` };
}

/**
 * Une décision de répartition attend (R4, F248) : le dernier plan de la
 * semaine manque d'eau et aucune répartition validée ne s'y applique. Sur
 * « Ressources », la faisabilité passe alors en tête de page. Le plan
 * enregistré en décide, lu sans calcul ; la faisabilité, elle, ne se
 * calcule qu'à l'approche de sa section.
 */
export function shortageDecisionPending(plan: Pick<StoredWeeklyPlan, 'calculation'> | null): boolean {
  return plan !== null && !plan.calculation.summary.arbitration && lacksWater(plan.calculation.summary.deficit);
}

/** Sous cinq centièmes de millimètre, l'écart entre l'eau reçue et le placé est un arrondi : il ne s'écrit pas (F254). */
const RECEIVED_TOLERANCE_MM = 0.05;

/**
 * L'eau qu'une planche reçoit au-delà de ce qui lui est placé (remarque 2 de
 * la recette 3.9, F254) : celle que le matériel d'une voisine servie verse
 * aussi sur elle (S16), lue dans les créneaux proposés ou validés de la
 * semaine, hors des validées dont l'irrigation est annulée. `null` sous
 * l'arrondi. Ni le manque, ni le placé, ni aucun total n'en changent.
 */
export function waterReceivedWithoutShareMm(plan: Pick<StoredWeeklyPlan, 'proposals'>, bed: Pick<PlanBedOutcome, 'bedId' | 'placedMm'>, now: Date): number | null {
  let receivedMm = 0;
  for (const proposal of plan.proposals) {
    if (isCanceledValidation(proposal)) continue;
    const status = effectiveProposalStatus(proposal, now);
    if (status !== 'proposed' && status !== 'validated') continue;
    for (const application of proposal.bedApplications) if (application.bedId === bed.bedId) receivedMm += application.appliedMm;
  }
  const beyond = receivedMm - bed.placedMm;
  return beyond >= RECEIVED_TOLERANCE_MM ? beyond : null;
}

/**
 * La phrase en tête du pli du budget quand la semaine a des arrosages validés
 * (remarque 4 de la recette 3.9, F255) : les parts se comptent sur ce qui
 * reste à placer, après l'eau validée (D-086), si bien qu'une part peut
 * baisser après une validation sans qu'aucune planche reçoive moins. Le
 * volume est la somme des propositions validées dont l'irrigation n'est pas
 * annulée ; un seul volume inconnu, et la phrase dit « les arrosages déjà
 * validés » sans chiffre. Nulle sans arrosage validé.
 */
export function budgetValidatedNote(plan: Pick<StoredWeeklyPlan, 'proposals'>, formatVolume: (cubicMeters: number) => string): string | null {
  let count = 0;
  let cubicMeters: number | null = 0;
  for (const proposal of plan.proposals) {
    if (proposal.status !== 'validated' || isCanceledValidation(proposal)) continue;
    count += 1;
    cubicMeters = cubicMeters === null || proposal.volumeCubicMeters === null ? null : cubicMeters + proposal.volumeCubicMeters;
  }
  if (count === 0) return null;
  const after = cubicMeters === null ? 'après les arrosages déjà validés cette semaine' : `après les ${formatVolume(cubicMeters)} déjà validés cette semaine`;
  return `Les parts se comptent sur ce qui reste à placer, ${after} : une part qui baisse après une validation ne retire pas d’eau aux planches.`;
}
