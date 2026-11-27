import { readFeatureSelectionForUser, saveStartChoiceForUser } from '@/db/feature-selection-repository';
import type { IrrigationPageId } from '../domain/features/pages';
import { landingPage } from '../domain/features/pages';
import { firstEnabledFeature, normalizeSelection, resolveFeatureSelection, type FeatureSelection } from '../domain/features/selection';
import { firstArrivalPage, startWaySelection } from '../domain/features/start';
import { isStartWay, type StartMode } from '../domain/features/start-mode';

/**
 * Le choix de la première ouverture (simplification, lot S6,
 * docs/simplification-s6-contract.md, sections 3.4 et 12 ; D-336). Pour les
 * trois façons de commencer, les cases se calculent ici, depuis la table du
 * domaine : celles qu'envoie le navigateur sont ignorées (un client ne fait
 * pas la liste). Pour « Choisir moi-même » (`custom`), les cases envoyées,
 * complétées de ce dont elles ont besoin (R3), au moins une (P7). Seule une
 * ferme qui n'a jamais ouvert le module enregistre ce choix ; un second appel
 * apprend qu'il est déjà fait, et la page d'arrivée s'ouvre. Une erreur de la
 * base remonte à l'appelant, rien n'étant écrit.
 */

export type StartChoiceOutcome =
  /** Enregistré : la première arrivée, « Ma ferme » quand la mise en route a une étape (section 3.4). */
  | { kind: 'saved'; startMode: StartMode; enabled: FeatureSelection; firstPage: IrrigationPageId }
  /** Le choix était déjà fait : la page d'arrivée habituelle (F31). */
  | { kind: 'already-chosen'; firstPage: IrrigationPageId }
  | { kind: 'refused'; message: string };

export const EMPTY_SELECTION_MESSAGE = 'Cochez au moins une fonctionnalité pour continuer.';

export async function chooseStartForUser(
  ownerUserId: string,
  input: { startMode: unknown; enabled: readonly unknown[] },
  now: Date = new Date(),
): Promise<StartChoiceOutcome> {
  let startMode: StartMode;
  let enabled: FeatureSelection;
  if (isStartWay(input.startMode)) {
    startMode = input.startMode;
    enabled = startWaySelection(input.startMode);
  } else if (input.startMode === 'custom') {
    startMode = 'custom';
    enabled = normalizeSelection(input.enabled);
    if (firstEnabledFeature(enabled) === null) return { kind: 'refused', message: EMPTY_SELECTION_MESSAGE };
  } else {
    return { kind: 'refused', message: 'Choisissez une façon de commencer.' };
  }
  if (await saveStartChoiceForUser(ownerUserId, startMode, enabled, now) === 'already-chosen') {
    // Relu dans la base, pas dans la mémoire de la requête : l'autre requête vient de l'écrire.
    return { kind: 'already-chosen', firstPage: landingPage(resolveFeatureSelection(await readFeatureSelectionForUser(ownerUserId)).enabled) };
  }
  return { kind: 'saved', startMode, enabled, firstPage: firstArrivalPage(enabled) };
}
