import handler from 'vinext/server/fetch-handler';
import { installRequestTiming, timeRequest } from './lib/services/request-timing';

/**
 * Le point d'entrée du Worker du module en production (accélérer le site,
 * A1, D-358 ; docs/acceleration-du-site-contract.md, section 3) : celui de
 * vinext, `vinext/server/fetch-handler`, sous le chronomètre des requêtes.
 * Chaque réponse dit, par l'en-tête `Server-Timing`, ce qu'elle a attendu de
 * la base, d'Ouvre ta ferme, de la météo et des autres appels, et si
 * l'instance venait de démarrer ; le journal reçoit la même mesure. Rien
 * d'autre ne change : chaque requête est servie par vinext, telle quelle. La
 * démonstration a le sien (`demo-worker.ts`), sous le même chronomètre.
 */

type FetchHandler = { fetch: (request: Request, env: unknown, context: unknown) => Promise<Response> };

const vinextWorker = handler as FetchHandler;

installRequestTiming();

/** Le Worker de vinext, chacune de ses propriétés gardée ; seul `fetch` passe sous le chronomètre. */
const siteWorker: FetchHandler = {
  ...vinextWorker,
  fetch(request: Request, env: unknown, context: unknown): Promise<Response> {
    return timeRequest(request, () => vinextWorker.fetch(request, env, context));
  },
};

export default siteWorker;
