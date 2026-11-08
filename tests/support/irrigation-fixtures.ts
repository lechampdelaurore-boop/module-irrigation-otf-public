/**
 * Fixtures des tests de persistance : un matériel goutte-à-goutte actif, son
 * réglage et sa position de saison, créés par les vrais dépôts (contrat Q2 :
 * les données de test passent par les fonctions publiques quand elles le
 * permettent). Les brouillons d'irrigation en découlent.
 */
import type { EquipmentPlacementRecord } from '../../lib/domain/equipment-placement-record.ts';
import type { EquipmentListItem, EquipmentSettingRecord } from '../../lib/domain/equipment-record.ts';
import type { IrrigationBedApplicationDraft } from '../../lib/domain/irrigation-event-record.ts';
import { createEquipmentForUser } from '../../db/equipment/equipment';
import { listEquipmentForUser } from '../../db/equipment/read';
import { saveEquipmentSettingForUser } from '../../db/equipment/settings';
import { saveEquipmentPlacementForUser } from '../../db/equipment-placement-repository';
import type { CreateIrrigationEventDraft } from '../../db/irrigation-event/create';

export const FIXTURE_ZONE_ID = 'zone-1';
export const FIXTURE_PLOT_ID = 'plot-1';

export type IrrigationFixture = {
  ownerUserId: string;
  season: number;
  equipment: EquipmentListItem;
  setting: EquipmentSettingRecord;
  placement: EquipmentPlacementRecord;
  applications: IrrigationBedApplicationDraft[];
};

export type DripFixtureOptions = {
  name?: string;
  season?: number;
  rateMmPerHour?: number;
  beds?: string[];
  bedAreaSquareMeters?: number;
  /** Par défaut la surface de planche : la fixture est un goutte-à-goutte. `null` simule un passe-pied inconnu. */
  wettedAreaSquareMeters?: number | null;
  /** Date de pose ; par défaut le 1er janvier de la saison, avant toute irrigation des tests. */
  placedAt?: string;
};

export async function createDripFixture(ownerUserId: string, options: DripFixtureOptions = {}): Promise<IrrigationFixture> {
  const season = options.season ?? 2026;
  const rateMmPerHour = options.rateMmPerHour ?? 10;
  const beds = options.beds ?? ['bed-1', 'bed-2'];
  const bedAreaSquareMeters = options.bedAreaSquareMeters ?? 30;
  const wettedAreaSquareMeters = options.wettedAreaSquareMeters === undefined ? bedAreaSquareMeters : options.wettedAreaSquareMeters;

  const equipmentId = await createEquipmentForUser(ownerUserId, {
    name: options.name ?? 'Goutte-à-goutte',
    kind: 'drip',
    mobility: 'mobile',
  });
  const settingId = await saveEquipmentSettingForUser(ownerUserId, equipmentId, null, {
    name: 'Réglage 1',
    kind: 'drip',
    rateMmPerHour,
  });
  if (!settingId) throw new Error('Fixture : réglage non créé.');
  const placement = await saveEquipmentPlacementForUser(ownerUserId, {
    equipmentId,
    settingId,
    season,
    gardenGroupId: null,
    otfZoneId: FIXTURE_ZONE_ID,
    otfPlotId: FIXTURE_PLOT_ID,
    anchor: { type: 'bed_center', anchorBedOtfId: beds[0] },
    selectedBeds: beds.map((otfBedId) => ({ otfZoneId: FIXTURE_ZONE_ID, otfPlotId: FIXTURE_PLOT_ID, otfBedId })),
  }, options.placedAt ?? `${season}-01-01T08:00:00.000Z`);
  if (!placement) throw new Error('Fixture : position non créée.');
  const equipment = (await listEquipmentForUser(ownerUserId)).find((item) => item.id === equipmentId);
  const setting = equipment?.settings.find((item) => item.id === settingId);
  if (!equipment || !setting) throw new Error('Fixture : matériel ou réglage introuvable après création.');

  return {
    ownerUserId,
    season,
    equipment,
    setting,
    placement,
    applications: beds.map((otfBedId) => ({
      otfZoneId: FIXTURE_ZONE_ID,
      otfPlotId: FIXTURE_PLOT_ID,
      otfBedId,
      rateMmPerHour,
      bedAreaSquareMeters,
      wettedAreaSquareMeters,
    })),
  };
}

type DraftOverrides = Partial<Omit<CreateIrrigationEventDraft, 'equipment' | 'setting' | 'placement'>>;

function baseDraft(fixture: IrrigationFixture, overrides: DraftOverrides): CreateIrrigationEventDraft {
  return {
    kind: 'planned',
    season: fixture.season,
    note: null,
    equipment: fixture.equipment,
    setting: fixture.setting,
    placement: fixture.placement,
    plannedStartAt: null,
    plannedEndAt: null,
    actualStartAt: null,
    actualEndAt: null,
    plannedDurationSeconds: 0,
    actualDurationSeconds: 0,
    applications: fixture.applications,
    pumpAssignment: null,
    ...overrides,
  };
}

/** Irrigation planifiée sur une période, durée prévue en secondes. */
export function plannedDraft(
  fixture: IrrigationFixture,
  period: { startAt: string; endAt: string; durationSeconds: number },
  overrides: DraftOverrides = {},
): CreateIrrigationEventDraft {
  return baseDraft(fixture, {
    kind: 'planned',
    plannedStartAt: period.startAt,
    plannedEndAt: period.endAt,
    plannedDurationSeconds: period.durationSeconds,
    ...overrides,
  });
}

/** Irrigation déjà réalisée, saisie a posteriori. */
export function completedDraft(
  fixture: IrrigationFixture,
  period: { startAt: string; endAt: string; durationSeconds: number },
  overrides: DraftOverrides = {},
): CreateIrrigationEventDraft {
  return baseDraft(fixture, {
    kind: 'completed',
    actualStartAt: period.startAt,
    actualEndAt: period.endAt,
    plannedDurationSeconds: period.durationSeconds,
    actualDurationSeconds: period.durationSeconds,
    ...overrides,
  });
}

/** Irrigation démarrée immédiatement au minuteur. */
export function runningDraft(
  fixture: IrrigationFixture,
  durationSeconds: number,
  overrides: DraftOverrides = {},
): CreateIrrigationEventDraft {
  return baseDraft(fixture, { kind: 'running', plannedDurationSeconds: durationSeconds, ...overrides });
}
