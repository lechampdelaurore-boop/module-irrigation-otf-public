/**
 * Le mode de démonstration (docs/demo-guided-contract.md, section 5, couche 2 ;
 * D1 de la sous-tranche 4.0) : un déploiement est soit la production, soit la
 * démonstration, jamais un mélange des deux. La règle échoue fermée : au
 * moindre doute, le module refuse de démarrer, plutôt que de servir une
 * démonstration branchée sur une vraie ferme, ou une ferme réelle en
 * démonstration.
 *
 * Fonction pure : le service `lib/services/deployment-mode.ts` lui donne les
 * réglages du Worker ; aucun secret n'est lu ici, seulement leur présence.
 */

/** Les réglages du déploiement qui décident du mode, tels que le Worker les voit. */
export type DeploymentSettings = {
  /** `DEMO_MODE` : vide, `true` ou `false` ; toute autre valeur est illisible. */
  demoMode: string | undefined;
  /** `OTF_DATA_SOURCE` : `live` lit Ouvre ta ferme. */
  otfDataSource: string | undefined;
  /** `WEATHER_DATA_SOURCE` : `live` (la valeur par défaut hors démonstration) lit la vraie météo. */
  weatherDataSource: string | undefined;
  /** Présence d'un secret réel, jamais sa valeur. */
  otfApiToken: boolean;
  visualCrossingApiKey: boolean;
  pushServiceToken: boolean;
  weatherSyncServiceToken: boolean;
  /** La liaison de service vers le Worker Push de la production. */
  pushServiceBinding: boolean;
};

export type DeploymentRefusal =
  | 'demo-mode-unreadable'
  | 'otf-live-source'
  | 'otf-token'
  | 'weather-live-source'
  | 'weather-key'
  | 'push-token'
  | 'push-binding'
  | 'weather-sync-token';

export type DeploymentMode =
  | { kind: 'production' }
  | { kind: 'demonstration' }
  | { kind: 'refused'; refusals: readonly DeploymentRefusal[] };

/** Les motifs du refus, en clair : ils nomment le réglage, jamais une valeur. */
const DEPLOYMENT_REFUSAL_LABELS: Readonly<Record<DeploymentRefusal, string>> = {
  'demo-mode-unreadable': 'DEMO_MODE ne vaut ni « true » ni « false »',
  'otf-live-source': 'la démonstration lit Ouvre ta ferme (OTF_DATA_SOURCE=live)',
  'otf-token': 'la démonstration a un jeton Ouvre ta ferme (OTF_API_TOKEN)',
  'weather-live-source': 'la démonstration lit la vraie météo (WEATHER_DATA_SOURCE=live)',
  'weather-key': 'la démonstration a une clé de météo (VISUAL_CROSSING_API_KEY)',
  'push-token': 'la démonstration a le jeton du service de notification (IRRIGATION_PUSH_SERVICE_TOKEN)',
  'push-binding': 'la démonstration est liée au Worker de notification (IRRIGATION_PUSH)',
  'weather-sync-token': 'la démonstration a le jeton de synchronisation météo (WEATHER_SYNC_SERVICE_TOKEN)',
};

const LIVE = 'live';

/**
 * Le mode du déploiement. Sans `DEMO_MODE`, le module se comporte comme
 * avant D1 (`production`, nom qui couvre aussi le développement local et les
 * parcours navigateur). Avec `DEMO_MODE=true`, il démarre en démonstration
 * seulement si rien de réel n'est branché ; sinon il refuse, dans les deux
 * sens : une démonstration qui reçoit un secret réel, une production qui
 * reçoit `DEMO_MODE`.
 */
export function deploymentMode(settings: DeploymentSettings): DeploymentMode {
  const demo = readDemoMode(settings.demoMode);
  if (demo === 'unreadable') return { kind: 'refused', refusals: ['demo-mode-unreadable'] };
  if (!demo) return { kind: 'production' };
  const refusals: DeploymentRefusal[] = [];
  if (settings.otfDataSource?.trim() === LIVE) refusals.push('otf-live-source');
  if (settings.otfApiToken) refusals.push('otf-token');
  if (settings.weatherDataSource?.trim() === LIVE) refusals.push('weather-live-source');
  if (settings.visualCrossingApiKey) refusals.push('weather-key');
  if (settings.pushServiceToken) refusals.push('push-token');
  if (settings.pushServiceBinding) refusals.push('push-binding');
  if (settings.weatherSyncServiceToken) refusals.push('weather-sync-token');
  return refusals.length > 0 ? { kind: 'refused', refusals } : { kind: 'demonstration' };
}

function readDemoMode(value: string | undefined): boolean | 'unreadable' {
  const trimmed = value?.trim() ?? '';
  if (trimmed === '' || trimmed === 'false') return false;
  if (trimmed === 'true') return true;
  return 'unreadable';
}

/** Le message du refus de démarrer : les réglages en cause, sans aucune valeur. */
export function deploymentRefusalMessage(refusals: readonly DeploymentRefusal[]): string {
  return `Démarrage refusé : ${refusals.map((refusal) => DEPLOYMENT_REFUSAL_LABELS[refusal]).join(' ; ')}. Une démonstration ne touche jamais une vraie ferme (docs/demo-guided-contract.md).`;
}

/** La bannière permanente de la démonstration (contrat, section 4). */
export const DEMO_BANNER_TEXT = 'Démonstration : données fictives. Rien ici ne touche une vraie ferme.';

/** Ce qui remplace les réglages des notifications du téléphone en démonstration (contrat, C7). */
export const DEMO_PUSH_NOTICE = 'Démonstration : les notifications du téléphone sont désactivées, rien n’est envoyé.';
