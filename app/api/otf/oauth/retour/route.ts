import { otfOauthReturnNotOpenYet } from '@/lib/domain/otf/oauth-return';

/**
 * L'adresse de retour fixe de la connexion à Ouvre ta ferme (4.8, D-153),
 * derrière la connexion du module comme tout le reste. Elle n'ouvre rien tant
 * que la 4.3 n'est pas faite, et ne lit pas l'adresse demandée.
 */
export function GET(): Response {
  const page = otfOauthReturnNotOpenYet();
  return new Response(page.body, { status: page.status, headers: page.headers });
}
