'use server';

import { getAuthenticatedUser } from '@/app/access-auth';
import {
  clearHydricGoalsForUser,
  deleteManualRainfallForUser,
  saveDailyWaterLimitForUser,
  saveHydricGoalForUser,
  saveManualRainfallForUser,
  saveWeatherGeocodeForUser,
  saveWeatherPreferenceForUser,
} from '@/db/water-management-repository';
import type { IrrigationSnapshot } from '@/lib/domain/domain';
import { getIrrigationSnapshot } from '@/lib/services/irrigation-service';
import { recalculatePlanAfterEvent } from '@/lib/services/planning-recalculation';
import {
  getWaterDashboardForUser,
  type WaterDashboard,
} from '@/lib/services/water-dashboard';
import { locationKeyForCandidate } from '@/lib/domain/weather/location';
import {
  weekStartDateKey,
  isValidDateKey,
  dateKeyInTimeZone,
  type HydricGoalScope,
} from '@/lib/domain/water-management';
import { openMeteoWeatherProvider } from '@/lib/adapters/weather/open-meteo-provider';
import type { WeatherLocationCandidate } from '@/lib/domain/weather/weather-provider';
import {
  createWeatherAlertCriterionForUser,
  deleteWeatherAlertCriterionForUser,
  updateWeatherAlertCriterionForUser,
} from '@/db/weather-alert-repository';
import { saveCropAlertSettingsForUser, saveDryingDaysForUser, saveFrostLinkForUser } from '@/db/crop-alerts/inputs';
import type { CropAlertSettings } from '@/lib/domain/crop-alerts/settings';
import {
  validateWeatherAlertCriterion,
  type WeatherAlertCriterionInput,
  type WeatherAlertCriterionValidation,
} from '@/lib/domain/weather/weather-alerts';

export type WaterActionResult =
  | { ok: true; message: string; dashboard: WaterDashboard }
  | {
    ok: false;
    message: string;
    /** Les refus d'un critère d'alerte météo, champ par champ. */
    refusals?: Extract<WeatherAlertCriterionValidation, { ok: false }>['refusals'];
  };

export type WeatherSearchActionResult =
  | { ok: true; candidates: WeatherLocationCandidate[] }
  | { ok: false; message: string };

export async function loadWaterDashboardAction(input: {
  season: number;
  weekStart: string;
  forceWeatherRefresh?: boolean;
  allowWeatherRefresh?: boolean;
}): Promise<WaterActionResult> {
  const context = await loadContext(input.season);
  if (!context.ok) return context;
  try {
    const dashboard = await getWaterDashboardForUser({
      ...context.value,
      weekStart: input.weekStart,
      forceWeatherRefresh: input.forceWeatherRefresh === true,
      allowWeatherRefresh: input.allowWeatherRefresh !== false,
      includeWeatherAlerts: true,
    });
    return {
      ok: true,
      message: input.forceWeatherRefresh
        ? !dashboard.weather.refreshAttempted
          ? 'Une actualisation météo est déjà en cours ou temporairement limitée.'
          : dashboard.weather.error
            ? 'Actualisation météo incomplète : les dernières données disponibles sont conservées.'
            : 'La météo a été actualisée.'
        : 'Semaine affichée.',
      dashboard,
    };
  } catch (error) {
    return actionFailure(error);
  }
}

export async function saveHydricGoalAction(input: {
  season: number;
  weekStart: string;
  scopeType: HydricGoalScope;
  otfZoneId: string | null;
  otfPlotId: string | null;
  otfBedId: string | null;
  amountMm: number;
}): Promise<WaterActionResult> {
  const context = await loadContext(input.season);
  if (!context.ok) return context;
  const weekStart = safeWeekStart(input.weekStart);
  if (!weekStart || !Number.isFinite(input.amountMm) || input.amountMm < 0 || input.amountMm > 500) {
    return { ok: false, message: 'L’objectif doit être compris entre 0 et 500 mm par semaine.' };
  }
  if (!validGoalScope(input, context.value.snapshot)) {
    return { ok: false, message: 'Le niveau OTF choisi pour cet objectif est invalide.' };
  }
  await saveHydricGoalForUser(context.value.ownerUserId, {
    season: input.season,
    weekStart,
    scopeType: input.scopeType,
    otfZoneId: input.otfZoneId,
    otfPlotId: input.otfPlotId,
    otfBedId: input.otfBedId,
    amountMm: input.amountMm,
  });
  // Un objectif vaut de sa semaine jusqu'à ce qu'un autre le remplace : le plan se recalcule dès qu'il n'est pas à venir (3.7, règle 4).
  await recalculatePlanAfterEvent(context.value.ownerUserId, { kind: 'objective-changed', season: input.season, at: weekStart, lasting: true });
  return successWithDashboard(context.value, weekStart, 'L’objectif hebdomadaire a été enregistré.');
}

export async function clearHydricGoalsAction(input: {
  season: number;
  weekStart: string;
  confirmed: boolean;
}): Promise<WaterActionResult> {
  const context = await loadContext(input.season);
  if (!context.ok) return context;
  const weekStart = safeWeekStart(input.weekStart);
  if (!weekStart || input.confirmed !== true) {
    return { ok: false, message: 'La remise à zéro doit être confirmée.' };
  }
  const count = await clearHydricGoalsForUser(
    context.value.ownerUserId,
    input.season,
    weekStart,
  );
  if (count > 0) await recalculatePlanAfterEvent(context.value.ownerUserId, { kind: 'objective-changed', season: input.season, at: weekStart, lasting: true });
  return successWithDashboard(
    context.value,
    weekStart,
    `${count} objectif${count > 1 ? 's' : ''} retiré${count > 1 ? 's' : ''} de cette semaine. L’historique est conservé.`,
  );
}

export async function searchWeatherLocationsAction(input: {
  city: string;
  postcode: string;
}): Promise<WeatherSearchActionResult> {
  const user = await getAuthenticatedUser();
  if (!user) return { ok: false, message: 'Votre session a expiré.' };
  const city = input.city.trim();
  if (city.length < 2 || city.length > 100 || input.postcode.length > 12) {
    return { ok: false, message: 'Saisissez une commune valide.' };
  }
  try {
    const candidates = await openMeteoWeatherProvider.searchLocations(
      city,
      input.postcode.trim() || null,
    );
    return candidates.length > 0
      ? { ok: true, candidates }
      : { ok: false, message: 'Aucune commune correspondante n’a été trouvée.' };
  } catch (error) {
    return { ok: false, message: error instanceof Error ? error.message : 'Recherche météo impossible.' };
  }
}

export async function saveWeatherLocationAction(input: {
  season: number;
  weekStart: string;
  candidate: WeatherLocationCandidate;
}): Promise<WaterActionResult> {
  const context = await loadContext(input.season);
  if (!context.ok) return context;
  if (!validWeatherCandidate(input.candidate)) {
    return { ok: false, message: 'La commune sélectionnée est invalide.' };
  }
  const locationKey = locationKeyForCandidate(input.candidate);
  await saveWeatherPreferenceForUser(context.value.ownerUserId, {
    locationMode: 'custom',
    customCity: input.candidate.city,
    customPostcode: input.candidate.postcode,
  });
  await saveWeatherGeocodeForUser(
    context.value.ownerUserId,
    locationKey,
    input.candidate,
    'open-meteo',
  );
  return successWithDashboard(
    context.value,
    safeWeekStart(input.weekStart) ?? weekStartDateKey(new Date()),
    'La commune météo de référence a été modifiée.',
    true,
  );
}

export async function restoreOtfWeatherLocationAction(input: {
  season: number;
  weekStart: string;
}): Promise<WaterActionResult> {
  const context = await loadContext(input.season);
  if (!context.ok) return context;
  if (!context.value.snapshot.structure.legalCity) {
    return { ok: false, message: "La commune du siège n'est pas renseignée dans OTF." };
  }
  await saveWeatherPreferenceForUser(context.value.ownerUserId, {
    locationMode: 'otf',
    customCity: null,
    customPostcode: null,
  });
  return successWithDashboard(
    context.value,
    safeWeekStart(input.weekStart) ?? weekStartDateKey(new Date()),
    'La commune du siège OTF est de nouveau utilisée.',
    true,
  );
}

export async function saveManualRainfallAction(input: {
  season: number;
  weekStart: string;
  date: string;
  precipitationMm: number;
}): Promise<WaterActionResult> {
  const context = await loadContext(input.season);
  if (!context.ok) return context;
  if (!isValidDateKey(input.date) || input.date > dateKeyInTimeZone(new Date())) {
    return { ok: false, message: 'Une mesure réelle doit concerner une date valide, aujourd’hui ou dans le passé.' };
  }
  if (!Number.isFinite(input.precipitationMm) || input.precipitationMm < 0 || input.precipitationMm > 1000) {
    return { ok: false, message: 'La pluie mesurée doit être comprise entre 0 et 1 000 mm.' };
  }
  await saveManualRainfallForUser(
    context.value.ownerUserId,
    input.date,
    input.precipitationMm,
  );
  // La pluie au pluviomètre, 0 mm compris, fait recalculer le plan de sa semaine (3.7, règle 4).
  await recalculatePlanAfterEvent(context.value.ownerUserId, { kind: 'rain-recorded', season: input.season, at: input.date });
  return successWithDashboard(context.value, safeWeekStart(input.weekStart) ?? weekStartDateKey(new Date()), 'La pluie mesurée a été enregistrée.');
}

/** Retirer une mesure de pluie est une saisie au pluviomètre comme une autre : la réanalyse reprend, le plan se recalcule (3.7, règle 4). */
export async function removeManualRainfallAction(input: {
  season: number;
  weekStart: string;
  date: string;
}): Promise<WaterActionResult> {
  const context = await loadContext(input.season);
  if (!context.ok) return context;
  if (!isValidDateKey(input.date)) {
    return { ok: false, message: 'Une mesure se retire pour une date valide.' };
  }
  const removed = await deleteManualRainfallForUser(context.value.ownerUserId, input.date);
  if (!removed) return { ok: false, message: 'Aucune mesure de pluie n’est saisie pour ce jour.' };
  await recalculatePlanAfterEvent(context.value.ownerUserId, { kind: 'rain-recorded', season: input.season, at: input.date });
  return successWithDashboard(context.value, safeWeekStart(input.weekStart) ?? weekStartDateKey(new Date()), 'La mesure de pluie a été retirée : la réanalyse reprend pour ce jour.');
}

export async function saveDailyWaterLimitAction(input: {
  season: number;
  weekStart: string;
  enabled: boolean;
  maxCubicMetersPerDay: number | null;
  validFrom: string;
  validUntil: string;
  note: string;
}): Promise<WaterActionResult> {
  const context = await loadContext(input.season);
  if (!context.ok) return context;
  const validDates = isValidDateKey(input.validFrom)
    && (input.validUntil === '' || (
      isValidDateKey(input.validUntil)
      && input.validFrom <= input.validUntil
    ));
  if (!validDates || (input.enabled && (
    input.maxCubicMetersPerDay === null ||
    !Number.isFinite(input.maxCubicMetersPerDay) ||
    input.maxCubicMetersPerDay <= 0 ||
    input.maxCubicMetersPerDay > 100_000
  ))) {
    return { ok: false, message: 'La restriction journalière ou sa période est invalide.' };
  }
  const note = input.note.trim().slice(0, 500) || null;
  await saveDailyWaterLimitForUser(context.value.ownerUserId, {
    season: input.season,
    enabled: input.enabled,
    maxCubicMetersPerDay: input.enabled ? input.maxCubicMetersPerDay : null,
    validFrom: input.validFrom,
    validUntil: input.validUntil || null,
    note,
  });
  // Posée, changée ou levée, une limite vaut de son premier jour : le plan se recalcule dès qu'elle n'est pas à venir (3.7, règle 4).
  await recalculatePlanAfterEvent(context.value.ownerUserId, { kind: 'daily-limit-changed', season: input.season, at: input.validFrom, lasting: true });
  return successWithDashboard(
    context.value,
    safeWeekStart(input.weekStart) ?? weekStartDateKey(new Date()),
    input.enabled ? 'La limite journalière a été enregistrée.' : 'La limite journalière est désactivée pour cette période.',
  );
}

/**
 * Ajoute ou modifie un critère d'alerte météo de l'exploitation
 * (docs/weather-alerts-contract.md, « Le critère »). Le seuil arrive tel que
 * saisi : le domaine le refuse s'il est absent, non numérique ou hors des
 * bornes du champ, avec un message qui dit pourquoi.
 */
export async function saveWeatherAlertCriterionAction(input: {
  season: number;
  weekStart: string;
  criterionId: string | null;
  criterion: WeatherAlertCriterionInput;
}): Promise<WaterActionResult> {
  const context = await loadContext(input.season);
  if (!context.ok) return context;
  const validation = validateWeatherAlertCriterion(input.criterion);
  if (!validation.ok) {
    return { ok: false, message: validation.refusals.map((refusal) => refusal.message).join(' '), refusals: validation.refusals };
  }
  const weekStart = safeWeekStart(input.weekStart) ?? weekStartDateKey(new Date());
  if (input.criterionId === null) {
    await createWeatherAlertCriterionForUser(context.value.ownerUserId, validation.settings);
    return successWithDashboard(context.value, weekStart, 'L’alerte météo a été ajoutée. Elle sera évaluée à chaque nouvelle prévision.');
  }
  const saved = await updateWeatherAlertCriterionForUser(context.value.ownerUserId, input.criterionId, validation.settings);
  if (!saved) return { ok: false, message: 'Cette alerte météo n’existe plus.' };
  return successWithDashboard(
    context.value,
    weekStart,
    saved.active ? 'L’alerte météo a été enregistrée.' : 'L’alerte météo est désactivée : elle n’est plus évaluée.',
  );
}

/** Supprime un critère d'alerte météo : il n'est plus évalué ; ses alertes passées restent dans l'historique. */
export async function deleteWeatherAlertCriterionAction(input: {
  season: number;
  weekStart: string;
  criterionId: string;
}): Promise<WaterActionResult> {
  const context = await loadContext(input.season);
  if (!context.ok) return context;
  const deleted = await deleteWeatherAlertCriterionForUser(context.value.ownerUserId, input.criterionId);
  if (!deleted) return { ok: false, message: 'Cette alerte météo n’existe plus.' };
  return successWithDashboard(
    context.value,
    safeWeekStart(input.weekStart) ?? weekStartDateKey(new Date()),
    'L’alerte météo a été supprimée. Ses alertes passées restent dans l’historique.',
  );
}

/**
 * Enregistre les réglages des alertes par culture de l'exploitation
 * (docs/weather-crop-alerts-contract.md, « L'écran ») : une révision
 * nouvelle, validée par le domaine ; elle vaut à la prochaine prévision lue.
 */
export async function saveCropAlertSettingsAction(input: {
  season: number;
  weekStart: string;
  settings: Partial<Record<keyof CropAlertSettings, unknown>>;
}): Promise<WaterActionResult> {
  const context = await loadContext(input.season);
  if (!context.ok) return context;
  const saved = await saveCropAlertSettingsForUser(context.value.ownerUserId, input.settings);
  if (!saved.ok) return { ok: false, message: saved.problems.join(' ') };
  return successWithDashboard(
    context.value,
    safeWeekStart(input.weekStart) ?? weekStartDateKey(new Date()),
    'Les réglages des alertes cultures ont été enregistrés. Ils valent dès la prochaine prévision lue.',
  );
}

/**
 * Rattache une espèce de la saison, ou une seule de ses séries, au jeu
 * commun, avec ou sans seuil de dégâts propre à la ferme. L'espèce et la
 * série doivent être celles du plan de culture lu : rien d'autre ne
 * s'enregistre.
 */
export async function saveCropFrostLinkAction(input: {
  season: number;
  weekStart: string;
  plantId: string;
  seriesId: string | null;
  commonKey: string | null;
  damageCelsius: string;
}): Promise<WaterActionResult> {
  const context = await loadContext(input.season);
  if (!context.ok) return context;
  if (!knownCultivation(context.value.snapshot, input.plantId, input.seriesId)) {
    return { ok: false, message: 'Cette culture n’est pas dans le plan de culture de la saison.' };
  }
  const saved = await saveFrostLinkForUser(context.value.ownerUserId, {
    plantId: input.plantId,
    seriesId: input.seriesId,
    commonKey: input.commonKey,
    damageCelsius: input.damageCelsius,
  });
  if (!saved.ok) return { ok: false, message: saved.problems.join(' ') };
  return successWithDashboard(
    context.value,
    safeWeekStart(input.weekStart) ?? weekStartDateKey(new Date()),
    saved.value.commonKey === null && saved.value.damageCelsius === null
      ? 'La culture est enregistrée sans seuil de gel : elle ne sera pas alertée.'
      : 'Le seuil de gel de la culture a été enregistré. Ses jours déjà alertés repartent de zéro.',
  );
}

/** Corrige le délai de séchage d'une espèce de la saison ; vide, il le retire. */
export async function saveCropDryingDaysAction(input: {
  season: number;
  weekStart: string;
  plantId: string;
  dryingDays: string;
}): Promise<WaterActionResult> {
  const context = await loadContext(input.season);
  if (!context.ok) return context;
  if (!knownCultivation(context.value.snapshot, input.plantId, null)) {
    return { ok: false, message: 'Cette culture n’est pas dans le plan de culture de la saison.' };
  }
  const saved = await saveDryingDaysForUser(context.value.ownerUserId, { plantId: input.plantId, dryingDays: input.dryingDays });
  if (!saved.ok) return { ok: false, message: saved.problems.join(' ') };
  return successWithDashboard(
    context.value,
    safeWeekStart(input.weekStart) ?? weekStartDateKey(new Date()),
    saved.value.dryingDays === null
      ? 'Le délai de séchage de la culture est retiré : aucune alerte d’arrêt d’arrosage pour elle.'
      : 'Le délai de séchage de la culture a été enregistré.',
  );
}

/** L'espèce, et la série si elle est donnée, appartiennent au plan de culture lu. */
function knownCultivation(snapshot: IrrigationSnapshot, plantId: string, seriesId: string | null): boolean {
  return (snapshot.cropPlan?.series ?? []).some((series) => (seriesId === null || series.id === seriesId)
    && series.cultivations.some((cultivation) => cultivation.plantId === plantId));
}

type LoadedContext = {
  ownerUserId: string;
  season: number;
  snapshot: IrrigationSnapshot;
};

async function loadContext(season: number): Promise<
  { ok: true; value: LoadedContext } | { ok: false; message: string }
> {
  const user = await getAuthenticatedUser();
  if (!user) return { ok: false, message: 'Votre session a expiré.' };
  if (!Number.isInteger(season) || season < 1900 || season > 9999) {
    return { ok: false, message: 'Saison invalide.' };
  }
  try {
    const snapshot = await getIrrigationSnapshot(user.userId, { season });
    return {
      ok: true,
      value: { ownerUserId: user.userId, season, snapshot },
    };
  } catch (error) {
    return { ok: false, message: error instanceof Error ? error.message : 'Données indisponibles.' };
  }
}

async function successWithDashboard(
  context: LoadedContext,
  weekStart: string,
  message: string,
  forceWeatherRefresh = false,
): Promise<WaterActionResult> {
  try {
    return {
      ok: true,
      message,
      dashboard: await getWaterDashboardForUser({
        ...context,
        weekStart,
        forceWeatherRefresh,
        allowWeatherRefresh: forceWeatherRefresh,
        includeWeatherAlerts: true,
      }),
    };
  } catch (error) {
    return actionFailure(error);
  }
}

function safeWeekStart(value: string) {
  try {
    return weekStartDateKey(value);
  } catch {
    return null;
  }
}

function validGoalScope(
  input: {
    scopeType: HydricGoalScope;
    otfZoneId: string | null;
    otfPlotId: string | null;
    otfBedId: string | null;
  },
  snapshot: IrrigationSnapshot,
) {
  if (input.scopeType === 'farm') {
    return !input.otfZoneId && !input.otfPlotId && !input.otfBedId;
  }
  const zone = snapshot.zones.find((item) => item.id === input.otfZoneId);
  if (!zone || input.scopeType === 'zone') {
    return Boolean(zone) && !input.otfPlotId && !input.otfBedId;
  }
  const plot = snapshot.plots.find(
    (item) => item.id === input.otfPlotId && item.zoneId === zone.id,
  );
  if (!plot || input.scopeType === 'plot') {
    return Boolean(plot) && !input.otfBedId;
  }
  return input.scopeType === 'bed' && snapshot.beds.some(
    (item) => item.id === input.otfBedId && item.plotId === plot.id,
  );
}

function validWeatherCandidate(value: WeatherLocationCandidate) {
  return value.countryCode === 'FR'
    && value.city.trim().length >= 2
    && Number.isFinite(value.latitude) && Math.abs(value.latitude) <= 90
    && Number.isFinite(value.longitude) && Math.abs(value.longitude) <= 180
    && value.timezone.length > 0;
}

function actionFailure(error: unknown): { ok: false; message: string } {
  return {
    ok: false,
    message: error instanceof Error ? error.message : 'L’opération a échoué.',
  };
}
