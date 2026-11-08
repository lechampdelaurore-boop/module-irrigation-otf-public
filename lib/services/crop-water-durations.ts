import { deleteFarmReferenceCropForUser, readCommonReferenceCrop, saveFarmReferenceCropForUser } from '@/db/crop-water/references';
import { farmDurationsOf, sameDurations, withFarmDurations, type FarmDurations } from '../domain/crop-water/farm-durations';

/**
 * Régler les durées d'une culture commune pour sa ferme (5 quater, PR 3e) :
 * la version de la ferme remplace la commune pour elle seule ; des durées
 * égales à celles du jeu commun la retirent, la commune revient. Les Kc ne
 * changent pas ici : ils se règlent par des surcharges datées.
 */
export type FarmDurationsResult =
  | { ok: true; outcome: 'saved' | 'common'; cropName: string }
  | { ok: false; problems: string[] };

/** Les dates par défaut d'une version de la ferme, telles que la carte les nomme. */
const FARM_DATES_SOURCE = 'durées réglées par la ferme';

export async function saveFarmDurationsForUser(ownerUserId: string, cropId: string, durations: FarmDurations, now = new Date()): Promise<FarmDurationsResult> {
  const common = await readCommonReferenceCrop(cropId);
  if (!common) return { ok: false, problems: ['Seule une culture du jeu commun a des durées que la ferme règle.'] };
  const crop = withFarmDurations(common.crop, durations);
  if (!crop) return { ok: false, problems: [`${common.crop.name} : les durées ne suivent pas les stades et les jeux de saison de la culture.`] };
  if (sameDurations(farmDurationsOf(crop), farmDurationsOf(common.crop))) {
    await deleteFarmReferenceCropForUser(ownerUserId, cropId);
    return { ok: true, outcome: 'common', cropName: common.crop.name };
  }
  const result = await saveFarmReferenceCropForUser(ownerUserId, crop, { sourceUrl: common.sourceUrl, datesSource: FARM_DATES_SOURCE }, now);
  if (!result.ok) return result;
  return { ok: true, outcome: 'saved', cropName: common.crop.name };
}

/** Revenir aux durées du jeu commun : la version de la ferme est retirée. */
export async function resetFarmDurationsForUser(ownerUserId: string, cropId: string): Promise<boolean> {
  return deleteFarmReferenceCropForUser(ownerUserId, cropId);
}
