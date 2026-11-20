import { WeatherProviderError } from '../weather/weather-provider.ts';
import { tasksOfTrigger, type TaskKey } from './task-registry.ts';

/**
 * Ce que le matin dit de chacune de ses tâches (4.5, PR 1 ;
 * docs/tranche-4-contract.md, F560 et F602).
 *
 * La route du matin enchaîne la météo, les calculs du matin, puis la rotation
 * du coffre ; son compte rendu devient ici une exécution par tâche du
 * déclencheur « weather-morning », réussie ou manquée. Une exécution n'est
 * **réussie que si elle a tout fait** : un lieu sans prévisions, une ferme
 * remise à plus tard ou une ferme dont le calcul échoue la rendent manquée,
 * avec un résumé. Le résumé ne porte que des nombres et des classes d'erreur,
 * jamais un message d'un fournisseur, une adresse, un nom de ferme ni une
 * valeur (F354, F604).
 */

/** La classe d'un échec d'appel météo, sans son message. */
export type WeatherFailureKind = WeatherProviderError['kind'] | 'unknown';

export function weatherFailureKind(error: unknown): WeatherFailureKind {
  return error instanceof WeatherProviderError ? error.kind : 'unknown';
}

/** Le compte rendu d'un matin, tel que la route l'a obtenu ; une étape absente n'a pas eu lieu. */
export type MorningRunReport = {
  weather?: {
    status: 'completed' | 'already-running';
    locations: number;
    skippedBackoff: number;
    forecastFailures: readonly WeatherFailureKind[];
    reanalysisFailures: readonly WeatherFailureKind[];
  };
  planning?: { failed: number } | null;
  cropWater?: { failed: number } | null;
  soilReserve?: { failed: number } | null;
  cropDrying?: { failed: number } | null;
  otfVault?: { status: 'dormant' | 'unavailable' | 'failed' } | { status: 'done'; unreadable: number } | null;
  /** La classe de l'erreur qui a interrompu la route, si elle l'a été. */
  interruptedBy?: string;
};

export type TaskOutcome = { task: TaskKey; successful: boolean; error: string | null };

const WEATHER_FAILURE_WORDS: Record<WeatherFailureKind, string> = {
  'rate-limit': 'limite du fournisseur',
  timeout: 'délai dépassé',
  network: 'réseau',
  server: 'erreur du fournisseur',
  client: 'demande refusée',
  'invalid-response': 'réponse illisible',
  unknown: 'erreur inconnue',
};

/**
 * Une exécution par tâche du matin, dans l'ordre du registre. Rien quand une
 * autre exécution tenait déjà le verrou de la météo : c'est elle qui dira
 * comment s'est passé le matin.
 */
export function morningTaskOutcomes(report: MorningRunReport): TaskOutcome[] {
  if (report.weather?.status === 'already-running') return [];
  const interrupted = `interrompu avant la fin (${errorClassWords(report.interruptedBy)})`;
  const outcomes: Record<TaskKey, TaskOutcome> = {
    'weather-forecast': weatherOutcome('weather-forecast', report, 'forecastFailures', 'sans prévisions', interrupted),
    'weather-reanalysis': weatherOutcome('weather-reanalysis', report, 'reanalysisFailures', 'sans pluie estimée', interrupted),
    'morning-calculation': morningCalculationOutcome(report, interrupted),
    'otf-vault-morning': vaultOutcome(report, interrupted),
  };
  return tasksOfTrigger('weather-morning').map((task) => outcomes[task]);
}

function weatherOutcome(
  task: TaskKey,
  report: MorningRunReport,
  failuresKey: 'forecastFailures' | 'reanalysisFailures',
  missingWords: string,
  interrupted: string,
): TaskOutcome {
  const weather = report.weather;
  if (!weather) return failed(task, interrupted);
  const failures = weather[failuresKey];
  const problems = [
    failures.length > 0
      ? `${countWords(failures.length, 'lieu', 'lieux')} sur ${weather.locations} ${missingWords} (${kindsWords(failures)})`
      : null,
    weather.skippedBackoff > 0
      ? `${countWords(weather.skippedBackoff, 'ferme remise', 'fermes remises')} à plus tard (limite du fournisseur)`
      : null,
  ].filter((problem): problem is string => problem !== null);
  return problems.length === 0 ? succeeded(task) : failed(task, problems.join(' ; '));
}

function morningCalculationOutcome(report: MorningRunReport, interrupted: string): TaskOutcome {
  const steps = [
    ['planning', report.planning],
    ['eau des cultures', report.cropWater],
    ['réserve du sol', report.soilReserve],
    ['séchage avant récolte', report.cropDrying],
  ] as const;
  if (!report.weather || steps.some(([, step]) => !step)) return failed('morning-calculation', interrupted);
  const problems = steps.flatMap(([name, step]) => (step && step.failed > 0
    ? [`${name} : ${countWords(step.failed, 'ferme', 'fermes')} en échec`]
    : []));
  return problems.length === 0 ? succeeded('morning-calculation') : failed('morning-calculation', problems.join(' ; '));
}

function vaultOutcome(report: MorningRunReport, interrupted: string): TaskOutcome {
  const vault = report.otfVault;
  if (!vault) return failed('otf-vault-morning', interrupted);
  switch (vault.status) {
    case 'dormant':
      // Sans clé maîtresse, le coffre est endormi (F368) : il n'y a rien à chiffrer de nouveau.
      return succeeded('otf-vault-morning');
    case 'done':
      return vault.unreadable === 0
        ? succeeded('otf-vault-morning')
        : failed('otf-vault-morning', `${countWords(vault.unreadable, 'raccordement illisible', 'raccordements illisibles')}`);
    case 'unavailable':
      return failed('otf-vault-morning', 'clé maîtresse illisible : coffre hors d\'usage');
    case 'failed':
      return failed('otf-vault-morning', 'erreur du coffre');
  }
}

function succeeded(task: TaskKey): TaskOutcome {
  return { task, successful: true, error: null };
}

function failed(task: TaskKey, error: string): TaskOutcome {
  return { task, successful: false, error };
}

function countWords(count: number, singular: string, plural: string): string {
  return `${count} ${count > 1 ? plural : singular}`;
}

/** « réseau », ou « réseau ×2, délai dépassé » : les classes d'erreur, dans l'ordre où elles sont venues. */
function kindsWords(kinds: readonly WeatherFailureKind[]): string {
  const counts = new Map<WeatherFailureKind, number>();
  for (const kind of kinds) counts.set(kind, (counts.get(kind) ?? 0) + 1);
  return [...counts].map(([kind, count]) => `${WEATHER_FAILURE_WORDS[kind]}${count > 1 ? ` ×${count}` : ''}`).join(', ');
}

/** Le nom d'une classe d'erreur, gardé seulement s'il n'est fait que de lettres (jamais un message). */
function errorClassWords(errorClass: string | undefined): string {
  return errorClass && /^[A-Za-z_]{1,40}$/.test(errorClass) ? `erreur ${errorClass}` : 'erreur inconnue';
}
