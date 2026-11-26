import type { IrrigationPageId } from './pages';

/**
 * Le « + » de la barre du bas et sa feuille « Que voulez-vous faire ? »
 * (simplification, lot S3, PR 2, docs/simplification-s3-contract.md,
 * sections 4 et 4.1 ; D-331) : les trois gestes qu'on fait au champ, à une
 * touche de n'importe quelle page. Aucun n'écrit rien tant qu'on n'a pas
 * appuyé sur son bouton (D-028) : deux ouvrent un formulaire d'« Arrosages »,
 * le troisième monte dans la feuille la fenêtre « Noter la pluie » de S2.
 */

/** Le nom accessible du « + » (règle 5). */
export const PLUS_BUTTON_LABEL = 'Arroser ou noter';
/** Le titre de la feuille. */
export const PLUS_SHEET_TITLE = 'Que voulez-vous faire ?';

type PlusGestureId = 'arroser-maintenant' | 'noter-la-pluie' | 'arrosage-fait';

export type PlusGesture = {
  id: PlusGestureId;
  title: string;
  /** La ligne sous le titre, les mots de la maquette. */
  text: string;
};

const GESTURES: readonly PlusGesture[] = [
  { id: 'arroser-maintenant', title: 'Arroser maintenant', text: 'Je choisis où et combien de temps' },
  { id: 'noter-la-pluie', title: 'Noter la pluie', text: 'Ce que dit votre pluviomètre' },
  { id: 'arrosage-fait', title: 'Noter un arrosage déjà fait', text: 'J’ai arrosé sans le module' },
];

/**
 * Les gestes de la ferme, dans l'ordre de la feuille (section 4.1) :
 * « Arroser maintenant » et « Noter un arrosage déjà fait » avec
 * « Arrosages » cochée ; « Noter la pluie » avec « Objectifs et besoins »
 * cochée, sauf pour une ferme toute sous abri, où la pluie vaut 0 (D-032) :
 * `rainMatters` est la règle de S2 (`farmRainMatters`), appelée, jamais
 * recopiée. Vide : pas de « + » (règle 5, section 8).
 */
export function plusGestures(menu: readonly IrrigationPageId[], rainMatters: boolean): PlusGesture[] {
  const watering = menu.includes('arrosages');
  const rain = menu.includes('besoins') && rainMatters;
  return GESTURES.filter((gesture) => (gesture.id === 'noter-la-pluie' ? rain : watering));
}

/**
 * La demande portée par l'adresse d'« Arrosages » : le formulaire à ouvrir,
 * lue une fois puis retirée, comme `?planifier=1` (section 4.1).
 */
export const WATERING_INTENT = 'arroser';

/** La valeur de la demande pour chaque geste qui ouvre un formulaire d'« Arrosages ». */
export const WATERING_INTENT_VALUES = { 'arroser-maintenant': 'maintenant', 'arrosage-fait': 'fait' } as const;

/** Le formulaire d'« Arrosages » qu'ouvre une demande : « Arroser maintenant » ou « Déjà réalisée » ; `null` pour une valeur inconnue. */
export function wateringIntentForm(value: string): 'running' | 'completed' | null {
  if (value === WATERING_INTENT_VALUES['arroser-maintenant']) return 'running';
  if (value === WATERING_INTENT_VALUES['arrosage-fait']) return 'completed';
  return null;
}
