import { saveWeatherPreferenceForUser } from '../../db/water-management-repository';
import type { OtfStructure } from '../../lib/domain/domain';

/**
 * La personne confirme la commune de sa ferme (4.4, F419, F582), ici le siège
 * de sa structure, d'un geste, comme dans Réglages : sans ce geste, un espace
 * créé par un test n'a ni météo, ni gel, ni ET0.
 */
export async function confirmFarmLocation(spaceKey: string, structure: OtfStructure): Promise<void> {
  await saveWeatherPreferenceForUser(spaceKey, {
    locationMode: 'otf',
    customCity: null,
    customPostcode: null,
    legalCity: structure.legalCity,
    legalPostcode: structure.legalPostcode,
  });
}
