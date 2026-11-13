import handler from 'vinext/server/fetch-handler';
import { cookieValue, DEMO_MOMENT_COOKIE, DEMO_PROFILE_COOKIE, resolveDemoChoice } from './lib/domain/demo/catalogue';
import { installSimulatedDate, runOnSimulatedDay } from './lib/services/demo-clock';
import { isAcceptedDemonstration } from './lib/services/deployment-mode';

/**
 * Le point d'entrée du Worker de démonstration (docs/demo-guided-contract.md,
 * C1 et C3), à la place de `vinext/server/fetch-handler` dans sa propre
 * configuration (D4) ; la production garde le sien, inchangé. Chaque requête
 * se joue au jour du moment choisi par l'invité, à l'heure réelle de la
 * ferme. Hors d'une démonstration acceptée, il ne sert rien.
 */

type FetchHandler = { fetch: (request: Request, env: unknown, context: unknown) => Promise<Response> };

const demoWorker = {
  async fetch(request: Request, env: unknown, context: unknown): Promise<Response> {
    if (!isAcceptedDemonstration()) {
      return new Response('Ce point d’entrée ne sert que la démonstration.', { status: 503 });
    }
    installSimulatedDate();
    const cookies = request.headers.get('cookie');
    const choice = resolveDemoChoice(cookieValue(cookies, DEMO_PROFILE_COOKIE), cookieValue(cookies, DEMO_MOMENT_COOKIE));
    return runOnSimulatedDay(choice.moment.dateKey, () => (handler as FetchHandler).fetch(request, env, context));
  },
};

export default demoWorker;
