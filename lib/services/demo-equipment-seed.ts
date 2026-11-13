import { createEquipmentForUser } from '@/db/equipment/equipment';
import { listEquipmentForUser } from '@/db/equipment/read';
import { createIrrigationEventForUser } from '@/db/irrigation-event/create';
import { saveEquipmentSettingForUser } from '@/db/equipment/settings';
import { saveEquipmentPlacementForUser } from '@/db/equipment-placement-repository';
import { saveEquipmentDefaultPumpForUser, savePumpForUser } from '@/db/pump-repository';
import {
  saveDefaultWaterSupplyForUser,
  saveResourceReservoirLinkForUser,
  saveWaterReservoirForUser,
  saveWaterResourceForUser,
} from '@/db/water-resource-repository';
import {
  DEMO_EQUIPMENT,
  DEMO_HISTORY_HOUR_UTC,
  DEMO_HISTORY_MINUTES_BY_MONTH,
  DEMO_HISTORY_START,
  DEMO_PLACED_AT,
  DEMO_WATER,
} from '../adapters/demo/module-data.ts';
import type { EquipmentPlacementRecord } from '../domain/equipment-placement-record.ts';
import { MILLISECONDS_PER_HOUR, MINUTES_PER_HOUR, SECONDS_PER_HOUR } from '../domain/units.ts';
import { addDaysToDateKey } from '../domain/water-management.ts';
import type { DemoChoice } from '../domain/demo/catalogue.ts';
import type { IrrigationSnapshot } from '../domain/domain.ts';
import { normalizeWaterReservoirDraft, normalizeWaterResourceDraft } from '../domain/water-resources.ts';

/**
 * Le matériel et l'eau d'une ferme fictive (docs/demo-guided-contract.md,
 * section 6 ; D2), écrits par les dépôts ordinaires comme la ferme les
 * aurait saisis dans « Matériel et placement » et « Ressources et pompes ».
 * Le niveau du bassin est celui du moment : relevé le matin du jour simulé.
 */
export async function seedDemoEquipment(ownerUserId: string, choice: DemoChoice, snapshot: IrrigationSnapshot): Promise<void> {
  const season = snapshot.configuration.seasonFirst;
  const pumpId = await seedDemoWater(ownerUserId, choice);
  for (const definition of DEMO_EQUIPMENT[choice.profile.id] ?? []) {
    const beds = snapshot.beds.filter((bed) => bed.plotId === definition.plotId);
    const plot = snapshot.plots.find((candidate) => candidate.id === definition.plotId);
    if (!plot || beds.length === 0) throw new Error(`Démonstration : parcelle ${definition.plotId} introuvable.`);
    const equipmentId = await createEquipmentForUser(ownerUserId, { name: definition.name, kind: 'drip', mobility: 'fixed' });
    const settingId = await saveEquipmentSettingForUser(ownerUserId, equipmentId, null, {
      name: 'Réglage habituel',
      kind: 'drip',
      rateMmPerHour: definition.rateMmPerHour,
    });
    if (!settingId) throw new Error(`Démonstration : réglage de ${definition.name} non créé.`);
    const placement = await saveEquipmentPlacementForUser(ownerUserId, {
      equipmentId,
      settingId,
      season,
      gardenGroupId: null,
      otfZoneId: plot.zoneId,
      otfPlotId: plot.id,
      anchor: { type: 'bed_center', anchorBedOtfId: beds[0].id },
      selectedBeds: beds.map((bed) => ({ otfZoneId: plot.zoneId, otfPlotId: plot.id, otfBedId: bed.id })),
    }, DEMO_PLACED_AT);
    if (!placement) throw new Error(`Démonstration : ${definition.name} non posé.`);
    if (pumpId) await saveEquipmentDefaultPumpForUser(ownerUserId, ownerUserId, equipmentId, pumpId);
    if (choice.profile.features.includes('arrosages')) {
      await seedDemoHistory(ownerUserId, choice, snapshot, equipmentId, settingId, placement, definition.rateMmPerHour);
    }
  }
}

/**
 * Les arrosages faits avant le jour du moment, saisis comme une ferme les
 * aurait notés : un par semaine, aux habitudes de la ferme fictive.
 */
async function seedDemoHistory(
  ownerUserId: string,
  choice: DemoChoice,
  snapshot: IrrigationSnapshot,
  equipmentId: string,
  settingId: string,
  placement: EquipmentPlacementRecord,
  rateMmPerHour: number,
): Promise<void> {
  const equipment = (await listEquipmentForUser(ownerUserId)).find((item) => item.id === equipmentId);
  const setting = equipment?.settings.find((item) => item.id === settingId);
  if (!equipment || !setting) throw new Error('Démonstration : matériel introuvable après sa création.');
  const beds = new Map(snapshot.beds.map((bed) => [bed.id, bed]));
  const applications = placement.selectedBeds.map((selected) => {
    const area = beds.get(selected.otfBedId)?.area ?? 0;
    return { ...selected, rateMmPerHour, bedAreaSquareMeters: area, wettedAreaSquareMeters: area };
  });
  for (let day = DEMO_HISTORY_START; day < choice.moment.dateKey; day = addDaysToDateKey(day, 7)) {
    const minutes = DEMO_HISTORY_MINUTES_BY_MONTH[day.slice(5, 7)] ?? 0;
    if (minutes === 0) continue;
    const hours = minutes / MINUTES_PER_HOUR;
    const seconds = hours * SECONDS_PER_HOUR;
    const start = new Date(`${day}T${String(DEMO_HISTORY_HOUR_UTC).padStart(2, '0')}:00:00.000Z`);
    const end = new Date(start.getTime() + hours * MILLISECONDS_PER_HOUR);
    await createIrrigationEventForUser(ownerUserId, {
      kind: 'completed',
      season: snapshot.configuration.seasonFirst,
      note: null,
      equipment,
      setting,
      placement,
      plannedStartAt: null,
      plannedEndAt: null,
      actualStartAt: start.toISOString(),
      actualEndAt: end.toISOString(),
      plannedDurationSeconds: seconds,
      actualDurationSeconds: seconds,
      applications,
      pumpAssignment: null,
    });
  }
}

/** La ressource, la réserve et la pompe qui en tire l'eau ; la pompe, quand la ferme en a une. */
async function seedDemoWater(ownerUserId: string, choice: DemoChoice): Promise<string | null> {
  const water = DEMO_WATER[choice.profile.id];
  if (!water) return null;
  const dry = water.dryMoments[choice.moment.id] ?? null;
  const resourceId = await saveWaterResourceForUser(ownerUserId, ownerUserId, null, normalizeWaterResourceDraft({
    ...water.resource,
    status: dry ? 'inactive' : 'active',
    availableFrom: null,
    availableUntil: null,
    notes: dry,
  }));
  if (!water.reservoir) {
    await saveDefaultWaterSupplyForUser(ownerUserId, ownerUserId, { sourceKind: 'resource', resourceId, reservoirId: null });
    return null;
  }
  const reservoirId = await saveWaterReservoirForUser(ownerUserId, ownerUserId, null, normalizeWaterReservoirDraft({
    name: water.reservoir.name,
    type: 'pond',
    capacityCubicMeters: water.reservoir.capacityCubicMeters,
    currentVolumeCubicMeters: water.reservoir.volumeByMoment[choice.moment.id] ?? null,
    minimumSafetyCubicMeters: water.reservoir.minimumSafetyCubicMeters,
    exposedSurfaceSquareMeters: 0,
    receivesRain: false,
    evaporationEnabled: false,
    evaporationCoefficient: 0,
    status: 'active',
    notes: null,
  }), `${choice.moment.dateKey}T06:00:00.000Z`);
  await saveResourceReservoirLinkForUser(ownerUserId, ownerUserId, { resourceId, reservoirId, fillMode: 'automatic', active: true });
  await saveDefaultWaterSupplyForUser(ownerUserId, ownerUserId, { sourceKind: 'reservoir', resourceId: null, reservoirId });
  if (!water.pump) return null;
  return savePumpForUser(ownerUserId, ownerUserId, null, {
    name: water.pump.name,
    maximumFlowCubicMetersPerHour: water.pump.maximumFlowCubicMetersPerHour,
    status: 'active',
    notes: null,
    origins: [{ sourceKind: 'reservoir', resourceId: null, reservoirId, isDefault: true }],
  });
}
