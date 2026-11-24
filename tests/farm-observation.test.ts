import assert from 'node:assert/strict';
import test from 'node:test';
import {
  emptyFarmObservation,
  farmObservationLines,
  type FarmObservationContext,
  type FarmObservationRecord,
} from '../lib/domain/operations/farm-observation.ts';
import { operatorStatusView } from '../lib/domain/operations/operator-status-view.ts';
import { TASK_REGISTRY } from '../lib/domain/operations/task-registry.ts';
import { EMPTY_TASK_RUN, taskState } from '../lib/domain/operations/task-state.ts';
import { NO_UNDELIVERED_ALERTS, undeliveredAlertWindows } from '../lib/domain/operations/undelivered-alerts.ts';

/**
 * La ligne de chaque ferme sur la page d'état (4.5, PR 2 ;
 * docs/tranche-4-contract.md, F564, F565, et 10 bis.13, F616) : jugée avec
 * les seuils du registre, jamais un vert qui cache un manque, la plus en
 * difficulté d'abord.
 */

/** Vendredi 20 novembre 2026, 10 h à Paris. */
const NOW = new Date('2026-11-20T09:00:00.000Z');
const UNKNOWN = 'clé-du-déploiement·ferme-inconnue';

function context(overrides: Partial<FarmObservationContext> = {}): FarmObservationContext {
  return { now: NOW, deploymentFarm: '17', unknownFarmKey: UNKNOWN, planningFarms: new Set(['17', '18']), ...overrides };
}

function hoursAgo(hours: number): string {
  return new Date(NOW.getTime() - hours * 3_600_000).toISOString();
}

/** Une ferme qui va bien : un espace, lue, servie en météo et calculée il y a quatre heures. */
function healthy(farmKey: string, overrides: Partial<FarmObservationRecord> = {}): FarmObservationRecord {
  return {
    ...emptyFarmObservation(farmKey),
    spaces: 1,
    connection: farmKey === '17' ? null : 'linked',
    callsToday: 12,
    outcomes24h: { ok: 12 },
    outcomes7d: { ok: 80 },
    lastCompleteReadAt: hoursAgo(4),
    lastWeatherAt: hoursAgo(4),
    lastMorningPlanAt: hoursAgo(4),
    ...overrides,
  };
}

test('une ferme qui va bien est verte, sans verdict ; ses lignes disent ses nombres en mots', () => {
  const [line] = farmObservationLines([healthy('17')], context());
  assert.equal(line.tone, 'ok');
  assert.equal(line.state, 'Va bien');
  assert.equal(line.verdict, null);
  assert.equal(line.errors24h, 'aucune erreur sur 12 appels');
  assert.equal(line.lastOtfRead, 'le 20/11 à 6 h 00');
});

test('les âges se jugent avec les seuils du registre : orange au-delà de 26 heures, rouge au-delà de 36', () => {
  const late = farmObservationLines([healthy('17', { lastWeatherAt: hoursAgo(27) })], context())[0];
  assert.equal(late.tone, 'warn');
  assert.equal(late.verdict, 'Aucune météo automatique réussie depuis le 19/11 à 7 h 00.');
  const broken = farmObservationLines([healthy('17', { lastCompleteReadAt: hoursAgo(37) })], context())[0];
  assert.equal(broken.tone, 'danger');
  assert.equal(broken.verdict, 'Ouvre ta ferme pas lu en entier depuis le 18/11 à 21 h 00.');
  const atThreshold = farmObservationLines([healthy('17', { lastMorningPlanAt: hoursAgo(26) })], context())[0];
  assert.equal(atThreshold.tone, 'ok', 'au seuil orange compris, la ferme est à l’heure');
  // Les seuils sont ceux du registre, au même endroit que l'état des tâches.
  const morning = TASK_REGISTRY.find((task) => task.key === 'morning-calculation')!;
  assert.equal(taskState(morning, { ...EMPTY_TASK_RUN, lastSuccessAt: hoursAgo(37) }, NOW).kind, 'broken');
});

test('jamais un vert qui cache un manque : une ferme jamais lue, sans météo ni calcul du matin, est en orange', () => {
  const [line] = farmObservationLines([emptyFarmObservation('17')], context());
  assert.equal(line.tone, 'warn');
  assert.equal(line.verdict, 'Ouvre ta ferme jamais lu en entier.');
  assert.equal(line.lastWeather, 'sans objet : aucun espace sur cette ferme');
  const withSpace = farmObservationLines([{ ...emptyFarmObservation('17'), spaces: 1 }], context())[0];
  assert.equal(withSpace.verdict, 'Ouvre ta ferme jamais lu en entier. Aucune météo automatique réussie. Aucun calcul du matin.');
  assert.equal(withSpace.lastOtfRead, 'aucune enregistrée');
  assert.equal(withSpace.lastMorning, 'aucun enregistré');
});

test('la ferme de la clé du déploiement a toujours sa ligne, même sans rien d’enregistré', () => {
  const lines = farmObservationLines([healthy('18')], context());
  assert.deepEqual(lines.map((line) => line.title), ['Ferme n° 17, celle de la clé du déploiement', 'Ferme n° 18']);
  assert.deepEqual(farmObservationLines([], context({ deploymentFarm: null })), []);
});

test('le raccordement : révoqué ou refusé, rouge ; absent hors de la ferme de la clé, orange', () => {
  const lines = farmObservationLines([
    healthy('18', { connection: 'read-refused' }),
    healthy('19', { connection: 'reconnect-required' }),
    healthy('20', { connection: null }),
  ], context({ deploymentFarm: null, planningFarms: new Set(['18', '19', '20']) }));
  assert.deepEqual(lines.map((line) => [line.farmKey, line.tone, line.verdict]), [
    ['18', 'danger', 'Lecture refusée par Ouvre ta ferme.'],
    ['19', 'danger', 'Raccordement révoqué par Ouvre ta ferme.'],
    ['20', 'warn', 'Pas reliée à Ouvre ta ferme.'],
  ]);
  assert.equal(lines[0].connection, 'Hors d’usage : Ouvre ta ferme refuse la lecture de cette ferme.');
  assert.equal(lines[2].lastOtfRead, 'le 20/11 à 6 h 00', 'une lecture ancienne reste dite, même quand la ferme n’est plus lue');
});

test('les erreurs d’OTF sur 24 heures : une seule met la ferme en orange, la moitié des appels la met en rouge', () => {
  const some = farmObservationLines([healthy('17', { outcomes24h: { ok: 9, 'rate-limited': 1 } })], context())[0];
  assert.equal(some.tone, 'warn');
  assert.equal(some.errors24h, '1 erreur sur 10 appels (10 %) : 1 limite atteinte (429)');
  const half = farmObservationLines([healthy('17', { outcomes24h: { ok: 2, unauthorized: 1, forbidden: 1 } })], context())[0];
  assert.equal(half.tone, 'danger');
  assert.equal(half.verdict, '2 erreurs d’Ouvre ta ferme sur 4 appels en 24 heures.');
  const pastOnly = farmObservationLines([healthy('17', { outcomes7d: { ok: 70, server: 10 } })], context())[0];
  assert.equal(pastOnly.tone, 'ok', 'une erreur passée, plus vue depuis 24 heures, se lit sans colorer la ferme');
  assert.equal(pastOnly.errors7d, '10 erreurs sur 80 appels (13 %) : 10 erreurs d’OTF (5xx)');
});

test('le calcul du matin n’est attendu que d’une ferme qui a coché le Planning', () => {
  const [line] = farmObservationLines([healthy('17', { lastMorningPlanAt: null })], context({ planningFarms: new Set() }));
  assert.equal(line.tone, 'ok');
  assert.equal(line.lastMorning, 'sans objet : le Planning n’est coché sur aucun de ses espaces');
});

test('les appels de la clé avant que sa ferme soit connue ont leur ligne, jugée sur leurs seules erreurs', () => {
  const [line] = farmObservationLines([{ ...emptyFarmObservation(UNKNOWN), outcomes24h: { ok: 1 }, outcomes7d: { ok: 1 } }], context({ deploymentFarm: null }));
  assert.equal(line.title, 'Clé du déploiement, avant que sa ferme soit connue');
  assert.equal(line.tone, 'ok');
  assert.equal(line.lastOtfRead, 'sans objet : seul l’appel qui fait connaître la ferme de la clé passe par ici');
});

test('les fermes se rangent la plus en difficulté d’abord, puis par nombre de problèmes, puis par identifiant', () => {
  const lines = farmObservationLines([
    healthy('30'),
    healthy('18', { lastWeatherAt: hoursAgo(27) }),
    healthy('19', { lastWeatherAt: hoursAgo(27), outcomes24h: { ok: 9, timeout: 1 } }),
    healthy('20', { connection: 'reconnect-required' }),
  ], context({ deploymentFarm: null, planningFarms: new Set(['18', '19', '20', '30']) }));
  assert.deepEqual(lines.map((line) => line.farmKey), ['20', '19', '18', '30']);
});

test('le jugement d’ensemble compte les fermes : « tout va bien » seulement quand tâches et fermes vont bien', () => {
  const okFarm = farmObservationLines([healthy('17')], context());
  const warnFarm = farmObservationLines([healthy('17', { lastWeatherAt: hoursAgo(27) })], context());
  const tasks = TASK_REGISTRY.map((declaration) => ({ declaration, state: taskState(declaration, { ...EMPTY_TASK_RUN, lastSuccessAt: hoursAgo(3) }, NOW) }));
  assert.deepEqual(operatorStatusView(tasks, null, okFarm).verdict, { tone: 'ok', text: 'Tout va bien : les 10 tâches sont à l\'heure.' });
  assert.deepEqual(operatorStatusView(tasks, null, warnFarm).verdict, { tone: 'warn', text: 'Les 10 tâches sont à l\'heure ; 1 ferme à regarder.' });
});

test('C2 (D-304) : une alerte non délivrée en 24 heures met la ferme en rouge, plus ancienne en orange ; une nouvelle tentative ne change rien', () => {
  const deliveries = (day: Partial<typeof NO_UNDELIVERED_ALERTS>, week: Partial<typeof NO_UNDELIVERED_ALERTS>, retrying7d = 0) => ({
    undelivered24h: { ...NO_UNDELIVERED_ALERTS, ...day },
    undelivered7d: { ...NO_UNDELIVERED_ALERTS, ...week },
    retrying7d,
  });
  const [today] = farmObservationLines([healthy('17', { alertDeliveries: deliveries({ noDevice: 2 }, { noDevice: 2, failed: 1 }) })], context());
  assert.equal(today.tone, 'danger');
  assert.equal(today.verdict, '2 alertes non délivrées en 24 heures (aucun appareil inscrit : 2).');
  assert.equal(today.undeliveredAlerts, '3 sur 7 jours, dont 2 en 24 heures : aucun appareil inscrit : 2, échec de l’envoi : 1');

  const [older] = farmObservationLines([healthy('17', { alertDeliveries: deliveries({}, { interrupted: 1 }) })], context());
  assert.equal(older.tone, 'warn');
  assert.equal(older.verdict, '1 alerte non délivrée sur 7 jours (envoi interrompu : 1).');

  const [retrying] = farmObservationLines([healthy('17', { alertDeliveries: deliveries({}, {}, 2) })], context());
  assert.equal(retrying.tone, 'ok', 'le service réessaie seul : ce n’est pas un problème');
  assert.equal(retrying.undeliveredAlerts, 'aucune sur 7 jours ; 2 alertes en nouvelle tentative par le service de notification');

  const [none] = farmObservationLines([healthy('17')], context());
  assert.equal(none.undeliveredAlerts, 'aucune sur 7 jours');
  assert.deepEqual(undeliveredAlertWindows(NOW), {
    dayStart: '2026-11-19T09:00:00.000Z',
    weekStart: '2026-11-13T09:00:00.000Z',
    interruptedBefore: '2026-11-20T08:00:00.000Z',
  });
});
