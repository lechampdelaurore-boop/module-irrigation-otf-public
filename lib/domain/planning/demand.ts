import type { Bed } from '../domain.ts';
import { wettedAreaSquareMeters } from '../irrigation-calculations.ts';
import type { EquipmentKind } from '../irrigation-domain.ts';
import type { IrrigationEventRecord } from '../irrigation-event-record.ts';
import { applyPlanningThreshold, planningNeedMm, type BedIrrigationNeed, type IrrigationNeedPriority } from '../irrigation-needs.ts';
import { requestedFlowCubicMetersPerHour, type IrrigationPump, type PumpOrigin } from '../pumps.ts';
import { addDaysToDateKey, dateKeyInTimeZone, localDateStartUtc } from '../water-management.ts';
import type { PlanningInputs, UnplacedReason } from './contract.ts';
import type { PlanningSettings } from './settings.ts';

const EPSILON = 1e-9;

/**
 * La demande du planning (docs/planning-contract.md, « La quantité à placer »
 * et « Cas limites ») : pour chaque planche, ce qu'il reste à placer cette
 * semaine, d'après la 3.3 et les réglages ; pour chaque matériel positionné,
 * les planches qu'il arrose et leur taux. Aucun calcul de temps ici.
 */

export type PlanningBed = {
  bedId: string;
  bedName: string;
  plotName: string;
  priority: IrrigationNeedPriority;
  sheltered: boolean;
  areaSquareMeters: number;
  objectiveMm: number | null;
  /** Ce qu'il reste à placer au départ du calcul, en mm ; 0 quand rien ne manque. */
  needMm: number;
  /** Pourquoi rien ne peut être placé, s'il y a lieu. */
  unplannable: UnplacedReason | null;
  /** Le matériel qui sert cette planche en premier (R12), ou aucun. */
  equipmentId: string | null;
  /** Pas avant : l'instant du calcul, ou le lendemain d'une pluie prévue au-dessus du seuil (R3). */
  earliestStartAt: Date;
  /** Le premier jour de planning permis, après la pluie prévue ;  sans attente. */
  earliestDateKey: string | null;
  waitsForForecastRain: boolean;
  /** Débuts des arrosages déjà connus cette semaine, réels ou planifiés, pour R6 et R7. */
  irrigationStartsAt: Date[];
};

type CoveredBed = {
  bedId: string;
  rateMmPerHour: number;
  bedAreaSquareMeters: number;
  wettedAreaSquareMeters: number | null;
  otfZoneId: string;
  otfPlotId: string;
  /** Vrai quand la planche commande l'arrosage de ce matériel : son taux atteint la part R13 du taux le plus fort (D-025). */
  commands: boolean;
};

export type PlanningEquipment = {
  id: string;
  name: string;
  kind: EquipmentKind;
  settingId: string;
  settingName: string;
  placementId: string;
  pump: IrrigationPump | null;
  origin: PumpOrigin | null;
  /**
   * La pompe habituelle du matériel quand elle est archivée, ou introuvable : le matériel n'est pas « sans pompe »,
   * rien ne peut le servir (point ouvert 52, D-088). Nulle quand sa pompe habituelle est active, ou qu'il n'en a pas.
   */
  unavailablePump: { id: string; name: string | null } | null;
  coveredBeds: CoveredBed[];
  /** Débit demandé à la pompe quand tout le matériel arrose ; nul si une surface mouillée est inconnue. */
  flowCubicMetersPerHour: number | null;
};

/**
 * Le besoin restant à placer d'une planche. Il part du « reste à planifier »
 * de la 3.3 — objectif − pluie réelle − pluie prévue − irrigation réelle −
 * irrigation planifiée, après seuil et remplacement manuel — et n'y ajoute
 * que la part réglable de la pluie prévue (R2). Un remplacement manuel est
 * une quantité absolue : le moteur en déduit lui-même ce qui est déjà
 * planifié, sans quoi il la replacerait à chaque calcul. Il tient lieu
 * d'objectif, comme la faisabilité 3.4 le sert déjà (D-033, point ouvert
 * 15) : seule une planche sans objectif ni besoin manuel est non planifiable.
 */
function remainingNeedMm(need: BedIrrigationNeed, settings: PlanningSettings): number | null {
  return remainingNeedExcludingMm(need, settings, 0);
}

/**
 * Le même besoin, sans une partie de l'irrigation planifiée : ce qu'il
 * restait avant un arrosage validé, pour sa dose utile (3.7, règle 12). Le
 * besoin repart alors de ses termes — objectif, pluies, réel, planifié —,
 * parce qu'un reste déjà borné à zéro ne se « déborne » pas en lui rendant
 * des millimètres ; sans exclusion, c'est le reste de la 3.3 tel quel.
 */
export function remainingNeedExcludingMm(need: BedIrrigationNeed, settings: PlanningSettings, excludedPlannedMm: number): number | null {
  const planned = Math.max(0, need.plannedIrrigationMm - excludedPlannedMm);
  if (need.manualOverrideMm !== null) {
    return Math.max(0, need.manualOverrideMm - planned);
  }
  if (need.objectiveMm === null) return null;
  const raw = excludedPlannedMm > 0
    ? planningNeedMm(need.objectiveMm, need.actualRainMm, need.forecastRainMm, need.actualIrrigationMm, planned)
    : need.rawPlanningNeedMm;
  if (raw === null) return null;
  const forecastRain = need.sheltered ? 0 : Math.max(0, need.forecastRainMm ?? 0);
  const adjusted = raw + (1 - settings.forecastRainShare) * forecastRain;
  return applyPlanningThreshold(Math.max(0, adjusted), need.thresholdMm) ?? 0;
}

/**
 * Le premier instant où une planche peut être arrosée : le calcul, ou le
 * lendemain de la dernière pluie prévue au-dessus du seuil (R3) — sauf s'il ne
 * reste alors aucun jour, auquel cas on arrose avant la pluie. Sous abri, la
 * pluie n'attend rien.
 */
function earliestStartForBed(
  need: Pick<BedIrrigationNeed, 'sheltered'>,
  days: PlanningInputs['days'],
  bounds: { now: Date; weekEndAt: Date; timeZone: string },
  settings: PlanningSettings,
): { earliestStartAt: Date; earliestDateKey: string | null; waitsForForecastRain: boolean } {
  if (need.sheltered || settings.waitForForecastRainAboveMm <= 0) {
    return { earliestStartAt: bounds.now, earliestDateKey: null, waitsForForecastRain: false };
  }
  const today = dateKeyInTimeZone(bounds.now, bounds.timeZone);
  let lastRainDay: string | null = null;
  for (const day of days) {
    if (day.date < today) continue;
    if ((day.forecastRainMm ?? 0) > settings.waitForForecastRainAboveMm) lastRainDay = day.date;
  }
  if (lastRainDay === null) return { earliestStartAt: bounds.now, earliestDateKey: null, waitsForForecastRain: false };
  const nextDay = addDaysToDateKey(lastRainDay, 1);
  const afterRain = localDateStartUtc(nextDay, bounds.timeZone);
  if (afterRain >= bounds.weekEndAt) return { earliestStartAt: bounds.now, earliestDateKey: null, waitsForForecastRain: false };
  return { earliestStartAt: afterRain > bounds.now ? afterRain : bounds.now, earliestDateKey: nextDay, waitsForForecastRain: true };
}

/** Les matériels positionnés qui arrosent au moins une planche, avec leur pompe habituelle. */
export function buildPlanningEquipment(inputs: PlanningInputs, settings: PlanningSettings): PlanningEquipment[] {
  const bedsById = new Map(inputs.beds.map((bed) => [bed.id, bed]));
  const pumpsById = new Map(inputs.pumps.map((pump) => [pump.id, pump]));
  const result: PlanningEquipment[] = [];
  for (const item of inputs.equipment) {
    if (item.status !== 'active') continue;
    const placement = inputs.placements.find((candidate) => candidate.equipmentId === item.id && candidate.season === inputs.season);
    if (!placement) continue;
    const setting = item.settings.find((candidate) => candidate.id === placement.settingId);
    if (!setting || setting.kind !== item.kind) continue;
    const coveredBeds = coveredBedsOf(item.id, item.kind, inputs.coverage, bedsById, settings.commandingRateShare);
    if (coveredBeds.length === 0) continue;
    const pumpDefault = inputs.pumpDefaults.find((candidate) => candidate.equipmentId === item.id);
    const pump = pumpDefault ? pumpsById.get(pumpDefault.pumpId) ?? null : null;
    const origin = pump?.origins.find((candidate) => candidate.isDefault) ?? pump?.origins[0] ?? null;
    const usable = pump !== null && pump.status === 'active';
    result.push({
      id: item.id,
      name: item.name,
      kind: item.kind,
      settingId: setting.id,
      settingName: setting.name,
      placementId: placement.id,
      pump: usable ? pump : null,
      origin: usable ? origin : null,
      unavailablePump: pumpDefault && !usable ? { id: pumpDefault.pumpId, name: pump?.name ?? null } : null,
      coveredBeds,
      flowCubicMetersPerHour: requestedFlowCubicMetersPerHour(coveredBeds),
    });
  }
  return result.sort((left, right) => left.name.localeCompare(right.name, 'fr') || left.id.localeCompare(right.id));
}

function coveredBedsOf(
  equipmentId: string,
  kind: EquipmentKind,
  coverage: PlanningInputs['coverage'],
  bedsById: ReadonlyMap<string, Bed>,
  commandingRateShare: number,
): CoveredBed[] {
  const covered: CoveredBed[] = [];
  for (const entry of coverage) {
    const bed = bedsById.get(entry.bedId);
    if (!bed || bed.area <= 0) continue;
    const contribution = entry.contributions.find((candidate) => candidate.equipmentId === equipmentId);
    if (!contribution || contribution.rateMmPerHour <= 0) continue;
    covered.push({
      bedId: bed.id,
      rateMmPerHour: contribution.rateMmPerHour,
      bedAreaSquareMeters: bed.area,
      wettedAreaSquareMeters: wettedAreaSquareMeters(bed, kind),
      otfZoneId: bed.zoneId,
      otfPlotId: bed.plotId,
      commands: false,
    });
  }
  // Le débit nominal est le taux le plus fort du matériel ; une planche commande à partir de la part R13 (D-025).
  const strongest = covered.reduce((best, entry) => Math.max(best, entry.rateMmPerHour), 0);
  for (const entry of covered) entry.commands = entry.rateMmPerHour + EPSILON >= commandingRateShare * strongest;
  return covered.sort((left, right) => left.bedId.localeCompare(right.bedId));
}

/**
 * Le matériel qui sert une planche en premier (R12) : parmi ceux qu'elle
 * commande (D-025), la nature préférée si elle y est, puis le taux le plus
 * fort, puis le nom. `null` si aucun matériel ne l'arrose assez.
 */
function primaryEquipmentForBed(
  bedId: string,
  equipment: readonly PlanningEquipment[],
  settings: PlanningSettings,
): PlanningEquipment | null {
  const candidates = equipment
    .map((item) => ({ item, covered: item.coveredBeds.find((bed) => bed.bedId === bedId) }))
    .filter((candidate): candidate is { item: PlanningEquipment; covered: CoveredBed } => candidate.covered !== undefined && candidate.covered.commands);
  if (candidates.length === 0) return null;
  const preferred = candidates.filter((candidate) => candidate.item.kind === settings.preferredKindWhenBoth);
  const pool = preferred.length > 0 ? preferred : candidates;
  pool.sort((left, right) => right.covered.rateMmPerHour - left.covered.rateMmPerHour
    || left.item.name.localeCompare(right.item.name, 'fr')
    || left.item.id.localeCompare(right.item.id));
  return pool[0].item;
}

/** Les planches du calcul, dans l'ordre stable des besoins. */
export function buildPlanningBeds(
  inputs: PlanningInputs,
  equipment: readonly PlanningEquipment[],
  settings: PlanningSettings,
  bounds: { weekEndAt: Date },
): PlanningBed[] {
  const startsByBed = irrigationStartsByBed(inputs.events, inputs.now, settings.commandingRateShare);
  return inputs.needs.map((need) => {
    const remaining = remainingNeedMm(need, settings);
    const primary = primaryEquipmentForBed(need.bedId, equipment, settings);
    const timing = earliestStartForBed(need, inputs.days, { now: inputs.now, weekEndAt: bounds.weekEndAt, timeZone: inputs.timeZone }, settings);
    const reached = equipment.some((item) => item.coveredBeds.some((covered) => covered.bedId === need.bedId && covered.rateMmPerHour > 0));
    const unplannable: UnplacedReason | null = remaining === null
      ? 'no-objective'
      : remaining > 0 && primary === null
        ? (reached ? 'insufficient-reach' : 'no-equipment')
        : null;
    return {
      bedId: need.bedId,
      bedName: need.bedName,
      plotName: need.plotName,
      priority: need.priority,
      sheltered: need.sheltered,
      areaSquareMeters: need.areaSquareMeters,
      objectiveMm: need.objectiveMm,
      needMm: remaining ?? 0,
      unplannable,
      equipmentId: primary?.id ?? null,
      earliestStartAt: timing.earliestStartAt,
      earliestDateKey: timing.earliestDateKey,
      waitsForForecastRain: timing.waitsForForecastRain,
      irrigationStartsAt: startsByBed.get(need.bedId) ?? [],
    };
  });
}

/**
 * Les débuts d'arrosage déjà connus par planche : irrigations réelles de la
 * semaine (leur début réel), planifiées ou en cours (leur début prévu, ou
 * maintenant pour un minuteur qui tourne). Sert à R6 et R7. Une planche
 * arrosée sous la part R13 du taux le plus fort de l'irrigation n'a pas été
 * arrosée au sens de ces règles (D-025).
 */
function irrigationStartsByBed(events: readonly IrrigationEventRecord[], now: Date, commandingRateShare: number): Map<string, Date[]> {
  const result = new Map<string, Date[]>();
  for (const event of events) {
    if (event.status === 'canceled') continue;
    const equipment = event.equipment;
    const start = equipment.actualStartAt
      ?? (equipment.timerState ? now.toISOString() : null)
      ?? (equipment.status === 'planned' && equipment.remainingCanceledAt === null ? equipment.plannedStartAt : null);
    if (!start) continue;
    const at = new Date(start);
    if (!Number.isFinite(at.getTime())) continue;
    const strongest = equipment.applications.reduce((best, application) => Math.max(best, application.rateMmPerHour), 0);
    for (const application of equipment.applications) {
      if (application.plannedAmountMm <= 0 && application.actualAmountMm <= 0) continue;
      if (application.rateMmPerHour + EPSILON < commandingRateShare * strongest) continue;
      const starts = result.get(application.otfBedId) ?? [];
      starts.push(at);
      result.set(application.otfBedId, starts);
    }
  }
  return result;
}

/** Ordre de service (contrat, « Où placer les créneaux », point 3). */
export const PRIORITY_RANK: Record<IrrigationNeedPriority, number> = { high: 0, normal: 1, low: 2 };

export function compareBedsForService(left: PlanningBed, right: PlanningBed): number {
  return PRIORITY_RANK[left.priority] - PRIORITY_RANK[right.priority]
    || relativeDeficit(right) - relativeDeficit(left)
    || left.bedName.localeCompare(right.bedName, 'fr')
    || left.bedId.localeCompare(right.bedId);
}

function relativeDeficit(bed: PlanningBed): number {
  return bed.objectiveMm && bed.objectiveMm > 0 ? bed.needMm / bed.objectiveMm : bed.needMm > 0 ? 1 : 0;
}
