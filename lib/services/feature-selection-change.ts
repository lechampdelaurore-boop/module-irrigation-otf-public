import { saveFeatureSelectionForUser } from '@/db/feature-selection-repository';
import type { FeatureId } from '../domain/features/catalogue';
import { selectionChangeCancelsIrrigationAlarms, selectionChangeRecalculatesPlan } from '../domain/features/selection';
import { getEnabledFeaturesForUser } from './feature-selection-service';
import { cancelUpcomingIrrigationAlarmsForUser } from './irrigation-push-orchestration';
import { recalculatePlanAfterFeatureChange } from './planning-recalculation';

/**
 * Un changement des cases prend effet tout de suite (3.8,
 * docs/feature-selection-contract.md, R9) : le choix s'enregistre, puis ce
 * qu'il change hors de l'écran suit avant la réponse, pour que la page
 * rechargée le montre. Arrosages décochée retire les alarmes encore à venir
 * (P29) ; un changement qui touche le plan le recalcule (P8, P28). Ni l'un ni
 * l'autre ne défait le choix enregistré.
 */
export async function changeFeatureSelectionForUser(
  ownerUserId: string,
  enabled: readonly FeatureId[],
  { season, now = new Date() }: { season: number; now?: Date },
): Promise<void> {
  const before = await getEnabledFeaturesForUser(ownerUserId);
  await saveFeatureSelectionForUser(ownerUserId, enabled, now);
  if (selectionChangeCancelsIrrigationAlarms(before, enabled)) await cancelUpcomingIrrigationAlarmsForUser(ownerUserId, { now });
  if (selectionChangeRecalculatesPlan(before, enabled)) await recalculatePlanAfterFeatureChange(ownerUserId, season, { now });
}
