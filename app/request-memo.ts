import { cacheForRequest } from 'vinext/cache';
import { createRequestMemo, provideRequestMemo } from '@/db/request-memo';

/**
 * La mémoire de chaque requête (`db/request-memo.ts`, section 5 sexies du
 * contrat de la tranche 4) : `cacheForRequest` de vinext rend la même pendant
 * toute une requête, une neuve à chaque requête, et aucune qui dure hors d'une
 * requête (une tâche sans requête et les tests lisent alors la base à chaque
 * fois). Toute la requête, pas seulement le rendu : à un changement de page,
 * vinext exécute la page une première fois pour y chercher une redirection,
 * puis la rend ; les deux passages partagent la même mémoire (la page
 * elle-même n'est calculée qu'une fois, `app/irrigation/render-once.ts`).
 * Posée au chargement de `app/access-auth.ts`, par où passe toute page avant
 * de lire la base.
 */
export const requestMemoOfRequest = cacheForRequest(createRequestMemo);

provideRequestMemo(requestMemoOfRequest);
