import { env } from 'cloudflare:workers';
import { readPlantSymbols } from '../adapters/otf/plant-sprite.ts';
import { demonstrationPlantSymbols } from '../domain/crop-water/plant-vignettes.ts';
import { isDemoDeployment } from './deployment-mode.ts';

/**
 * Les dessins des espèces qu'une page demande (précision P41) : lus chez Ouvre
 * ta ferme pour une ferme réelle, ceux de la démonstration sinon, sans appel
 * réseau, comme les données de la ferme. `null` si le fichier ne se lit pas.
 */
export async function readPlantSprite(ids: readonly string[]): Promise<string | null> {
  // Comme pour l'instantané d'Ouvre ta ferme, le lanceur local prime sur les
  // réglages du site publié.
  const configured = process.env.OTF_DATA_SOURCE ?? env.OTF_DATA_SOURCE;
  if (isDemoDeployment() || configured !== 'live') return demonstrationPlantSymbols(ids);
  return readPlantSymbols(ids);
}
