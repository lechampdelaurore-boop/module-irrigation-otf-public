import { listOpenFarmErasures, readFarmErasureCounts } from '@/db/farm-erasure-repository';
import { readFarmObservations } from '@/db/farm-observation-repository';
import { listCostReadings, listSupportAccesses, recordCostReading, recordSupportAccess } from '@/db/operator-notes-repository';
import { readLatestOperatorNotice } from '@/db/operator-repository';
import { readTaskRuns, recordTaskRun } from '@/db/task-run-repository';
import { logJsonLine } from '../adapters/log';
import { costMonths, costReadingDecision, costReadingRecordedMessage, costView, monthWords } from '../domain/operations/costs';
import { operatorErasureLines } from '../domain/operations/farm-erasure-request';
import { farmSpaceOf } from '../domain/farm-space';
import { farmObservationLines } from '../domain/operations/farm-observation';
import { gestureDates, gestureDecision, gestureRecordedMessage, OPERATOR_GESTURES, type GestureTask } from '../domain/operations/operator-gesture';
import { operatorStatusView, type OperatorStatusView } from '../domain/operations/operator-status-view';
import { oldestKeptSupportDay, supportAccessDecision, supportAccessLines, supportAccessRecordedMessage } from '../domain/operations/support-access';
import { outcomeHourStartMs } from '../domain/otf/call-outcome';
import { parisDayOf } from '../domain/otf/shared-call-pace';
import { HOURS_PER_DAY, millisecondsFromHours } from '../domain/units';
import { isDemoDeployment } from './deployment-mode';
import { knownDeploymentFarm } from './farm-identity-service';
import { listFarmsWithFeature } from './feature-selection-service';
import { DEPLOYMENT_KEY_UNKNOWN_FARM_PACE } from './otf-farm-read';
import { readTaskStates } from './task-runs';

/**
 * La page d'état de l'exploitant (4.5, PR 2 ; docs/tranche-4-contract.md,
 * F565, F608, F612) : réservée à l'exploitant, le droit se lisant côté
 * serveur, jamais depuis le navigateur.
 */

/**
 * L'exploitant, c'est une personne dont l'espace est sur la ferme du
 * déploiement (F608). Jamais en démonstration, dont les espaces n'ont pas de
 * ferme ; aucun appel à OTF : la ferme du déploiement est celle déjà établie.
 */
export async function isOperator(spaceKey: string, deploymentFarm = knownDeploymentFarm): Promise<boolean> {
  if (isDemoDeployment()) return false;
  const { otfFarmId } = farmSpaceOf(spaceKey);
  if (otfFarmId === null) return false;
  return otfFarmId === await deploymentFarm();
}

/**
 * Ce que montre la page : les tâches du registre, la dernière notification
 * de la veille, chaque ferme (F616) et les demandes d'effacement (F646). Les
 * erreurs d'OTF se comptent par heure pleine : « 24 heures », c'est l'heure en
 * cours et les 23 d'avant.
 */
export async function readOperatorStatus(now = new Date(), deploymentFarm = knownDeploymentFarm): Promise<OperatorStatusView> {
  const hourStartMs = outcomeHourStartMs(now.getTime());
  const [tasks, latestNotice, records, farm, planning, erasures, accesses, readings, openErasures] = await Promise.all([
    readTaskStates(now),
    readLatestOperatorNotice(),
    readFarmObservations({
      parisDay: parisDayOf(now.getTime()),
      dayStartMs: hourStartMs - millisecondsFromHours(HOURS_PER_DAY - 1),
      weekStartMs: hourStartMs - millisecondsFromHours(7 * HOURS_PER_DAY - 1),
    }),
    deploymentFarm(),
    listFarmsWithFeature('planning'),
    readFarmErasureCounts(now),
    listSupportAccesses(oldestKeptSupportDay(parisDayOf(now.getTime()))),
    listCostReadings(),
    listOpenFarmErasures(),
  ]);
  const planningFarms = new Set(planning.flatMap(({ ownerUserId }) => farmSpaceOf(ownerUserId).otfFarmId ?? []));
  const farms = farmObservationLines(records, { now, deploymentFarm: farm, unknownFarmKey: DEPLOYMENT_KEY_UNKNOWN_FARM_PACE, planningFarms });
  return {
    ...operatorStatusView(tasks, latestNotice, farms, gestureDates(now), erasures),
    support: { farms: supportFarms(farms.map(({ farmKey }) => farmKey)), lines: supportAccessLines(accesses) },
    costs: { ...costView(readings, now), months: costMonths(now).map((value) => ({ value, label: monthWords(value) })) },
    erasureRequests: operatorErasureLines(openErasures),
  };
}

/** Les fermes dont un accès se note : celles de la page d'état, par leur identifiant d'Ouvre ta ferme (jamais la carte des appels sans ferme connue). */
function supportFarms(farmKeys: readonly string[]): string[] {
  return farmKeys.filter((key) => key !== DEPLOYMENT_KEY_UNKNOWN_FARM_PACE);
}

/**
 * Le journal d'accès du support (F567 ; 10 bis.21, F660, F661) : le jour, la
 * ferme et la raison en une ligne. L'appelant a vérifié que la personne est
 * l'exploitant. Le journal du Worker ne dit que le jour : la raison peut
 * nommer une personne, elle reste dans la base.
 */
export async function noteSupportAccess(
  input: { otfFarmId?: unknown; day?: unknown; reason?: unknown },
  now = new Date(),
  log = logJsonLine,
  deploymentFarm = knownDeploymentFarm,
): Promise<{ ok: boolean; message: string }> {
  const status = await readOperatorStatus(now, deploymentFarm);
  const decision = supportAccessDecision(input, now, status.support?.farms ?? []);
  if (!decision.ok) return decision;
  await recordSupportAccess(decision.access, now.toISOString());
  log('info', { event: 'support_access_recorded', day: decision.access.accessedOn });
  return { ok: true, message: supportAccessRecordedMessage(decision.access) };
}

/**
 * Le relevé des coûts du mois (F565, point 6 ; F568 ; 10 bis.21, F662),
 * copié à la main depuis le tableau de bord de Cloudflare : la page
 * n'appelle jamais son API. Un nouveau relevé du même mois remplace l'autre.
 */
export async function noteCostReading(input: Record<string, unknown>, now = new Date(), log = logJsonLine): Promise<{ ok: boolean; message: string }> {
  const decision = costReadingDecision(input, now);
  if (!decision.ok) return decision;
  const replaced = await recordCostReading(decision.reading, now.toISOString());
  log('info', { event: 'cost_reading_recorded', month: decision.reading.month, replaced });
  return { ok: true, message: costReadingRecordedMessage(decision.reading, replaced) };
}

/**
 * Les gestes « J'ai fait l'export du … » et « J'ai fait l'essai du … »
 * (10 bis.14, F625 ; 10 bis.16, F637) : le jour noté devient la dernière
 * réussite de la tâche du registre, sans jamais reculer. L'appelant a vérifié
 * que la personne est l'exploitant. Le journal ne dit que le jour.
 */
export async function recordOperatorGesture(task: GestureTask, day: unknown, now = new Date(), log = logJsonLine): Promise<{ ok: boolean; message: string }> {
  const runs = await readTaskRuns([task]);
  const decision = gestureDecision(task, day, now, runs.get(task)?.lastSuccessAt ?? null);
  if (!decision.ok) return decision;
  await recordTaskRun({ task, at: decision.at, successful: true, error: null });
  log('info', { event: OPERATOR_GESTURES[task].recordedEvent, day: decision.day });
  return { ok: true, message: gestureRecordedMessage(task, decision.day) };
}
