/**
 * Les numéros des réglages du planning (docs/planning-contract.md,
 * « Réglages ») hors des libellés visibles (audit ergonomique final, lot D,
 * J6, F297) : chaque groupe de réglages les donne dans sa bulle « Pour les
 * experts », sous la forme « Réglage R13 », à côté de ce qu'ils règlent. Les
 * libellés, eux, sont en mots simples.
 */

export type PlanningSettingGroup = 'forecast-rain' | 'equipment' | 'shortage' | 'reach' | 'tracking';

const SETTING_CODES: Record<PlanningSettingGroup, readonly (readonly [code: string, label: string])[]> = {
  'forecast-rain': [
    ['R2', 'part de la pluie prévue déduite du besoin'],
    ['R3', 'pluie prévue qui fait attendre'],
  ],
  equipment: [
    ['R4', 'dose minimale par arrosage'],
    ['R5', 'dose maximale par arrosage'],
    ['R6', 'arrosages par jour et par planche'],
    ['R7', 'espacement entre deux arrosages'],
    ['R8', 'plage horaire'],
  ],
  shortage: [
    ['R9', 'conduite en pénurie'],
    ['R10', 'report du déficit'],
    ['R11', 'dose d’un matériel qui arrose plusieurs planches'],
    ['R12', 'matériel qui sert d’abord'],
  ],
  reach: [['R13', 'part du débit le plus fort qui commande l’arrosage']],
  tracking: [['R14', 'tolérance du retard']],
};

/** « Pour les experts : Réglage R2, part de la pluie prévue déduite du besoin ; Réglage R3, … ». */
export function planningSettingCodesNote(group: PlanningSettingGroup): string {
  return `Pour les experts : ${SETTING_CODES[group].map(([code, label]) => `Réglage ${code}, ${label}`).join(' ; ')}.`;
}
