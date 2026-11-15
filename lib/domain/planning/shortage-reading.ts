import { cubicMetersFromLiters } from '../units.ts';
import type { PlanBedOutcome, StoredWeeklyPlan } from './contract.ts';
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
  // Une eau inconnue n'est pas un manque : seule une planche en manque au volume inconnu en est un, sûr même sans volume (D-098).
  if (deficit.waterCubicMeters < ONE_LITER_CUBIC_METERS && (deficit.unknownVolumeBeds?.water ?? 0) === 0) return null;
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
