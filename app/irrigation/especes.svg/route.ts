import { getAuthenticatedUser } from '@/app/access-auth';
import { requestedPlantSymbols } from '@/lib/domain/crop-water/plant-vignettes';
import { readPlantSprite } from '@/lib/services/plant-sprite-service';

/**
 * Les dessins des espèces d'Ouvre ta ferme qu'une page appelle par `<use>`
 * (précision P41). Le fichier ne porte que des dessins ; s'il était ouvert
 * seul, sa politique de contenu n'y laisserait courir aucun script.
 */
export async function GET(request: Request) {
  const user = await getAuthenticatedUser();
  if (!user) return new Response('Session expirée.', { status: 401 });
  const ids = requestedPlantSymbols(new URL(request.url).searchParams.get('ids'));
  if (ids.length === 0) return new Response('Aucun dessin demandé.', { status: 400 });
  const sprite = await readPlantSprite(ids);
  if (sprite === null) return new Response('Dessins momentanément indisponibles.', { status: 503, headers: { 'Cache-Control': 'no-store' } });
  return new Response(sprite, {
    headers: {
      'Cache-Control': 'private, max-age=86400',
      'Content-Security-Policy': "default-src 'none'; style-src 'unsafe-inline'",
      'Content-Type': 'image/svg+xml; charset=utf-8',
      'X-Content-Type-Options': 'nosniff',
    },
  });
}
