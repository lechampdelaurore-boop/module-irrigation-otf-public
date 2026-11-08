import { logJsonLine } from '../log.ts';
import { extractPlantSymbols, OTF_PLANT_SPRITE_URL } from '../../domain/crop-water/plant-vignettes.ts';

/**
 * La lecture du fichier des dessins d'Ouvre ta ferme (précision P41) : un
 * fichier statique public, hors de l'API et sans clé. Il est gardé quinze
 * jours au bord du réseau, comme Ouvre ta ferme le demande à un navigateur :
 * le module ne le relit qu'une fois par quinzaine et par point de présence.
 */

type FetchLike = (input: string | URL, init?: RequestInit) => Promise<Response>;
type CloudflareRequestInit = RequestInit & {
  cf?: { cacheEverything?: boolean; cacheTtlByStatus?: Record<string, number> };
};

const EDGE_CACHE_SECONDS = 15 * 24 * 60 * 60;
const TIMEOUT_MS = 8_000;

/** Les symboles demandés, lus chez Ouvre ta ferme ; `null` si le fichier ne se lit pas. */
export async function readPlantSymbols(ids: readonly string[], fetchImpl: FetchLike = fetch): Promise<string | null> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const init: CloudflareRequestInit = {
      method: 'GET',
      headers: { Accept: 'image/svg+xml' },
      signal: controller.signal,
      cf: { cacheEverything: true, cacheTtlByStatus: { '200-299': EDGE_CACHE_SECONDS, '300-599': -1 } },
    };
    const response = await fetchImpl(OTF_PLANT_SPRITE_URL, init);
    if (!response.ok) {
      logJsonLine('warn', { event: 'otf_plant_sprite_response', status: response.status });
      return null;
    }
    return extractPlantSymbols(await response.text(), ids);
  } catch (error) {
    logJsonLine('warn', { event: 'otf_plant_sprite_failed', reason: error instanceof Error ? error.name : 'unknown' });
    return null;
  } finally {
    clearTimeout(timeout);
  }
}
