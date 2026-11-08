import { claimCropAlerts, listAlertedKeys, recordCropAlertDelivery, type ClaimedCropAlert, type CropAlertDraftRecord, type CropAlertKind } from '@/db/crop-alerts/alerts';
import {
  listCropAlertCommon,
  listCropAlertForecastDays,
  listDryingRevisions,
  listFrostLinks,
  readCropAlertSettings,
  readLatestForecastLocation,
  readWeatherPosition,
  readWorkspaceOwner,
} from '@/db/crop-alerts/inputs';
import { newPushAlarmRevision } from '@/db/irrigation-event/push-schedule';
import { readLatestPlanForUser } from '@/db/planning-repository';
import { findWorkspaceIdForUser } from '@/db/workspace-repository';
import { logJsonLine, type LogLevel } from '../adapters/log';
import { dryingNotification, evaluateDrying } from '../domain/crop-alerts/drying';
import { evaluateFrost, frostAlertKey, frostDrafts, frostNotifications, frostSubjects, type CropAlertNotification } from '../domain/crop-alerts/frost';
import { evaluateSprinklers, sprinklerAlertKey, sprinklerNotifications, type SprinklerSlot } from '../domain/crop-alerts/sprinkler';
import type { CropAlertCommonEntry } from '../domain/crop-alerts/thresholds';
import { frostMarginsOf } from '../domain/crop-alerts/settings';
import type { IrrigationSnapshot } from '../domain/domain';
import { isPartActive } from '../domain/features/socle';
import type { IrrigationPushSendRequest } from '../domain/irrigation-push-contract';
import { effectiveProposalStatus } from '../domain/planning/contract';
import { addDaysToDateKey, dateKeyInTimeZone, FARM_TIME_ZONE, weekStartDateKey } from '../domain/water-management';
import type { WeatherAlertDeliveryStatus } from '../domain/weather/weather-alerts';
import { getEnabledFeaturesForWorkspace, listFarmsWithFeature } from './feature-selection-service';
import { type IrrigationPushSendResult, sendIrrigationPushNotification } from './irrigation-push-service';
import { readCachedIrrigationSnapshot } from './irrigation-service';

/**
 * L'évaluation et l'envoi des alertes par culture
 * (docs/weather-crop-alerts-contract.md, D-058) : le gel et les aspersions
 * après chaque écriture réussie de prévisions, les aspersions aussi après un
 * changement du planning, le séchage chaque matin même si la météo est en
 * panne. Les alertes sont enregistrées avant l'envoi, puis le résultat est
 * écrit sur elles. Les séries sont celles de l'instantané déjà en cache :
 * aucun appel nouveau vers Ouvre ta ferme. Rien ici ne touche le besoin,
 * l'objectif, le planning ni la dose (D-010, D-028). Une panne ne lève
 * jamais : elle se journalise sans nommer personne.
 */

export type CropAlertSender = (request: IrrigationPushSendRequest) => Promise<IrrigationPushSendResult>;
type Log = (level: LogLevel, entry: Record<string, unknown>) => void;
type Context = { workspaceId: string; now: Date; send: CropAlertSender; log: Log };

/** Les jours de prévisions qu'une évaluation lit : l'horizon le plus long, aujourd'hui compris. */
const FORECAST_DAYS = 7;

export async function evaluateCropAlertsAfterForecastWrite({
  workspaceId,
  locationKey,
  now,
  send = sendIrrigationPushNotification,
  log = logJsonLine,
}: {
  workspaceId: string;
  locationKey: string;
  now: Date;
  send?: CropAlertSender;
  log?: Log;
}): Promise<void> {
  try {
    // Alertes cultures décochée : rien ne s'évalue ni ne part ; les aspersions demandent aussi le Planning (3.8, R1, P1).
    const enabled = await getEnabledFeaturesForWorkspace(workspaceId);
    if (!enabled.includes('alertes-cultures')) return;
    const settings = await readCropAlertSettings(workspaceId);
    const sprinklerActive = settings.sprinklerActive && isPartActive(enabled, 'sprinkler-reconsideration');
    if (!settings.frostActive && !sprinklerActive) return;
    const loaded = await loadFarm(workspaceId, now);
    if (!loaded) return;
    const { ownerUserId, snapshot, today } = loaded;
    const forecasts = await listCropAlertForecastDays(workspaceId, locationKey, today, addDaysToDateKey(today, FORECAST_DAYS - 1));
    const context = { workspaceId, now, send, log };
    if (settings.frostActive && snapshot.cropPlan) {
      const common = commonMap(await listCropAlertCommon());
      const { subjects } = frostSubjects({
        series: snapshot.cropPlan.series,
        tasks: snapshot.cropPlan.implantationTasks,
        revisions: await listFrostLinks(workspaceId),
        common,
        shelteredSeriesIds: shelteredSeries(snapshot),
        today,
      });
      const evaluation = evaluateFrost({
        subjects,
        forecasts,
        today,
        horizonDays: settings.horizonDays,
        offsetCelsius: settings.frostOffsetCelsius,
        margins: frostMarginsOf(settings),
        alertedKeys: await listAlertedKeys(workspaceId, 'frost'),
      });
      const claimed = await claimCropAlerts(workspaceId, frostDrafts(evaluation).map((draft): CropAlertDraftRecord => ({
        kind: 'frost',
        subjectKey: draft.subjectKey,
        subjectVersion: draft.subjectVersion,
        plantId: draft.plantId,
        seriesId: null,
        name: draft.name,
        targetDate: draft.targetDate,
        damageCelsius: draft.damageCelsius,
        marginCelsius: draft.marginCelsius,
        offsetCelsius: draft.offsetCelsius,
        dryingDays: null,
        forecastValue: draft.forecastCelsius,
        unit: '°C',
        forecastedAt: draft.forecastedAt,
        detail: null,
      })), now);
      const claimedKeys = new Set(claimed.map((alert) => frostAlertKey(alert.subjectKey, alert.subjectVersion, alert.targetDate)));
      for (const day of evaluation.days) {
        for (const crossing of day.crossings) {
          crossing.alreadyAlerted = !claimedKeys.has(frostAlertKey(crossing.subjectKey, crossing.subjectVersion, day.date));
        }
      }
      await notify(context, 'frost', claimed, frostNotifications(evaluation));
    }
    if (sprinklerActive) await evaluateSprinklerAlerts(context, ownerUserId, snapshot, today, locationKey, forecasts, settings);
  } catch (error) {
    log('warn', { event: 'crop_alert_evaluation_failed', error: describe(error), failedAt: now.toISOString() });
  }
}

/**
 * Après un changement du planning (proposition validée, créneau déplacé),
 * les aspersions sont jugées de nouveau sur la prévision déjà conservée, du
 * lieu météo le plus récemment lu de l'exploitation.
 */
export async function evaluateSprinklerAlertsForUser(
  ownerUserId: string,
  { now = new Date(), send = sendIrrigationPushNotification, log = logJsonLine }: { now?: Date; send?: CropAlertSender; log?: Log } = {},
): Promise<void> {
  try {
    const workspaceId = await findWorkspaceIdForUser(ownerUserId);
    if (!workspaceId) return;
    if (!isPartActive(await getEnabledFeaturesForWorkspace(workspaceId), 'sprinkler-reconsideration')) return;
    const settings = await readCropAlertSettings(workspaceId);
    if (!settings.sprinklerActive) return;
    const locationKey = await readLatestForecastLocation(workspaceId);
    if (!locationKey) return;
    const loaded = await loadFarm(workspaceId, now);
    if (!loaded) return;
    const forecasts = await listCropAlertForecastDays(workspaceId, locationKey, loaded.today, addDaysToDateKey(loaded.today, FORECAST_DAYS - 1));
    await evaluateSprinklerAlerts({ workspaceId, now, send, log }, ownerUserId, loaded.snapshot, loaded.today, locationKey, forecasts, settings);
  } catch (error) {
    log('warn', { event: 'crop_alert_evaluation_failed', error: describe(error), failedAt: now.toISOString() });
  }
}

/** Chaque matin, pour chaque ferme, les dates d'arrêt d'arrosage venues ; un échec d'une ferme n'arrête pas les autres. */
export async function evaluateCropDryingForAllWorkspaces({
  now = new Date(),
  send = sendIrrigationPushNotification,
  log = logJsonLine,
}: { now?: Date; send?: CropAlertSender; log?: Log } = {}): Promise<{ evaluated: number; failed: number }> {
  let evaluated = 0;
  let failed = 0;
  // Seules les fermes qui ont coché Alertes cultures reçoivent l'arrêt d'arrosage avant récolte (3.8, R1).
  for (const { workspaceId } of await listFarmsWithFeature('alertes-cultures')) {
    try {
      const settings = await readCropAlertSettings(workspaceId);
      if (!settings.dryingActive) continue;
      const loaded = await loadFarm(workspaceId, now);
      if (!loaded?.snapshot.cropPlan) continue;
      const { snapshot, today } = loaded;
      const evaluation = evaluateDrying({
        series: snapshot.cropPlan?.series ?? [],
        bedNamesBySeries: bedNamesBySeries(snapshot),
        frostRevisions: await listFrostLinks(workspaceId),
        dryingRevisions: await listDryingRevisions(workspaceId),
        common: commonMap(await listCropAlertCommon()),
        today,
        alertedSeriesIds: await listAlertedKeys(workspaceId, 'drying'),
      });
      const claimed = await claimCropAlerts(workspaceId, evaluation.due.map((deadline): CropAlertDraftRecord => ({
        kind: 'drying',
        subjectKey: deadline.seriesId,
        subjectVersion: '',
        plantId: deadline.plantId,
        seriesId: deadline.seriesId,
        name: deadline.plantName,
        targetDate: deadline.stopDate,
        damageCelsius: null,
        marginCelsius: null,
        offsetCelsius: null,
        dryingDays: deadline.dryingDays,
        forecastValue: null,
        unit: null,
        forecastedAt: null,
        detail: null,
      })), now);
      const claimedSeries = new Set(claimed.map((alert) => alert.subjectKey));
      const notification = dryingNotification(evaluation.due.filter((deadline) => claimedSeries.has(deadline.seriesId)));
      await notify({ workspaceId, now, send, log }, 'drying', claimed, notification ? [notification] : []);
      evaluated += 1;
    } catch (error) {
      failed += 1;
      log('warn', { event: 'crop_alert_drying_failed', error: describe(error), failedAt: now.toISOString() });
    }
  }
  return { evaluated, failed };
}

async function evaluateSprinklerAlerts(
  context: Context,
  ownerUserId: string,
  snapshot: IrrigationSnapshot,
  today: string,
  locationKey: string,
  forecasts: Awaited<ReturnType<typeof listCropAlertForecastDays>>,
  settings: Awaited<ReturnType<typeof readCropAlertSettings>>,
): Promise<void> {
  const position = await readWeatherPosition(context.workspaceId, locationKey);
  if (!position) return;
  const slots = await readSprinklerSlots(ownerUserId, snapshot, today, context.now);
  if (!slots) return;
  const thresholds = { maxTemperatureCelsius: settings.sprinklerMaxTemperatureCelsius, radiationWattsPerSquareMeter: settings.sprinklerRadiationWattsPerSquareMeter };
  const evaluation = evaluateSprinklers({ slots, forecasts, thresholds, location: position, alertedKeys: await listAlertedKeys(context.workspaceId, 'sprinkler') });
  const fresh = evaluation.flags.filter((flag) => !flag.alreadyAlerted);
  const claimed = await claimCropAlerts(context.workspaceId, fresh.map((flag): CropAlertDraftRecord => ({
    kind: 'sprinkler',
    subjectKey: flag.slotKey,
    subjectVersion: '',
    plantId: null,
    seriesId: null,
    name: `planche${flag.bedNames.length > 1 ? 's' : ''} ${flag.bedNames.join(', ')}`,
    targetDate: flag.date,
    damageCelsius: null,
    marginCelsius: null,
    offsetCelsius: null,
    dryingDays: null,
    forecastValue: flag.cool ? flag.maximumCelsius : flag.radiationWattsPerSquareMeter,
    unit: flag.cool ? '°C' : 'W/m²',
    forecastedAt: forecasts.find((day) => day.date === flag.date)?.forecastedAt ?? null,
    detail: null,
  })), context.now);
  const claimedKeys = new Set(claimed.map((alert) => sprinklerAlertKey(alert.subjectKey, alert.targetDate)));
  for (const flag of evaluation.flags) flag.alreadyAlerted = !claimedKeys.has(sprinklerAlertKey(flag.slotKey, flag.date));
  await notify(context, 'sprinkler', claimed, sprinklerNotifications(evaluation, thresholds));
}

/** Chaque notification part une fois ; son résultat et son texte s'écrivent sur les alertes des jours qu'elle annonce. */
async function notify(context: Context, kind: CropAlertKind, claimed: readonly ClaimedCropAlert[], notifications: readonly CropAlertNotification[]): Promise<void> {
  for (const notification of notifications) {
    const ids = claimed.filter((alert) => notification.targetDates.includes(alert.targetDate)).map((alert) => alert.id);
    if (ids.length === 0) continue;
    const result = await sendSafely(context.send, {
      notificationId: notification.tag,
      recipientKey: context.workspaceId,
      revision: newPushAlarmRevision(context.now),
      notification: { title: notification.title, body: notification.body, tag: notification.tag, data: { url: notification.url } },
    });
    const status = deliveryStatus(result);
    await recordCropAlertDelivery(context.workspaceId, ids, status, notification.body);
    context.log(status === 'sent' || status === 'no-subscriber' ? 'info' : 'warn', {
      event: 'crop_alert_evaluated',
      kind,
      targetDates: notification.targetDates,
      alerts: ids.length,
      deliveryStatus: status,
      error: result.status === 'unreachable' ? result.message : undefined,
      evaluatedAt: context.now.toISOString(),
    });
  }
}

async function loadFarm(workspaceId: string, now: Date): Promise<{ ownerUserId: string; snapshot: IrrigationSnapshot; today: string } | null> {
  const ownerUserId = await readWorkspaceOwner(workspaceId);
  if (!ownerUserId) return null;
  const today = dateKeyInTimeZone(now, FARM_TIME_ZONE);
  const snapshot = await readCachedIrrigationSnapshot(ownerUserId, Number(today.slice(0, 4)));
  return snapshot ? { ownerUserId, snapshot, today } : null;
}

/**
 * Les créneaux d'aspersion jugés (« Précisions faites en codant la
 * persistance et l'envoi », point 6) : les propositions d'aspersion du plan
 * de la semaine en cours qui ne sont pas encore commencées, encore proposées
 * ou validées avec une irrigation encore planifiée ; `null` sans plan.
 */
export async function readSprinklerSlots(ownerUserId: string, snapshot: IrrigationSnapshot, today: string, now: Date): Promise<SprinklerSlot[] | null> {
  const plan = await readLatestPlanForUser(ownerUserId, Number(today.slice(0, 4)), weekStartDateKey(today));
  if (!plan) return null;
  const sheltered = shelteredBeds(snapshot);
  return plan.proposals
    .filter((proposal) => proposal.kind === 'sprinkler' && Date.parse(proposal.startAt) > now.getTime())
    .filter((proposal) => effectiveProposalStatus(proposal, now) === 'proposed'
      || (proposal.status === 'validated' && proposal.irrigationStatus === 'planned'))
    .map((proposal) => ({
      slotKey: `${proposal.storedId}@${proposal.startAt}`,
      startAt: proposal.startAt,
      sprinkler: true,
      beds: proposal.bedApplications.map((bed) => ({ bedName: bed.bedName, underShelter: sheltered.has(bed.bedId) })),
    }));
}

/** Les noms des planches de chaque série. */
export function bedNamesBySeries(snapshot: IrrigationSnapshot): Map<string, string[]> {
  const bedNames = new Map(snapshot.beds.map((bed) => [bed.id, bed.name]));
  const names = new Map<string, string[]>();
  for (const place of snapshot.cropPlan?.places ?? []) {
    const name = bedNames.get(place.bedId);
    if (name !== undefined) names.set(place.seriesId, [...(names.get(place.seriesId) ?? []), name]);
  }
  return names;
}

/** Les planches d'un jardin sous abri. */
function shelteredBeds(snapshot: IrrigationSnapshot): Set<string> {
  const greenhouses = new Set(snapshot.plots.filter((plot) => plot.mode === 'greenhouse').map((plot) => plot.id));
  return new Set(snapshot.beds.filter((bed) => greenhouses.has(bed.plotId)).map((bed) => bed.id));
}

/** Les séries posées sur au moins une planche sous abri. */
export function shelteredSeries(snapshot: IrrigationSnapshot): Set<string> {
  const beds = shelteredBeds(snapshot);
  return new Set((snapshot.cropPlan?.places ?? []).filter((place) => beds.has(place.bedId)).map((place) => place.seriesId));
}

function commonMap(entries: readonly CropAlertCommonEntry[]): Map<string, CropAlertCommonEntry> {
  return new Map(entries.map((entry) => [entry.key, entry]));
}

async function sendSafely(send: CropAlertSender, request: IrrigationPushSendRequest): Promise<IrrigationPushSendResult> {
  try {
    return await send(request);
  } catch (error) {
    return { status: 'unreachable', message: error instanceof Error ? error.message : 'Le service d’alerte est indisponible.' };
  }
}

/** Un service non configuré ou injoignable est un échec du service de notification. */
function deliveryStatus(result: IrrigationPushSendResult): Exclude<WeatherAlertDeliveryStatus, 'pending'> {
  return result.status === 'disabled' || result.status === 'unreachable' ? 'failed' : result.status;
}

function describe(error: unknown): string {
  return error instanceof Error ? error.message : 'unknown';
}
