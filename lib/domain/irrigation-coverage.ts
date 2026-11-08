import type { EquipmentPlacementRecord } from './equipment-placement-record.ts';
import type { EquipmentListItem, EquipmentSettingRecord } from './equipment-record.ts';
import type { GardenGroupRecord } from './garden-group-record.ts';
import type { Bed } from './domain.ts';
import type { EquipmentKind } from './irrigation-domain.ts';
import { sortBedsByName } from './bed-order.ts';
import {
  interpolateSprinklerRate,
  litersPerHourForBed,
  wettedAreaSquareMeters,
} from './irrigation-calculations.ts';
import { rateText } from './figure-origin.ts';

const POSITION_EPSILON = 1e-9;

type BedIrrigationContribution = {
  equipmentId: string;
  equipmentName: string;
  settingId: string;
  settingName: string;
  kind: EquipmentKind;
  rateMmPerHour: number;
};

export type BedIrrigationCoverage = {
  bedId: string;
  totalRateMmPerHour: number;
  contributions: BedIrrigationContribution[];
};

type EquipmentCoverageSummary = {
  equipmentId: string;
  equipmentName: string;
  settingId: string;
  settingName: string;
  bedCount: number;
  /** Planches arrosées sans passe-pied connu : hors du débit, jamais comptées zéro. */
  unknownAreaBedCount: number;
  totalLitersPerHour: number;
};

export type IrrigationCoverageResult = {
  beds: BedIrrigationCoverage[];
  equipment: EquipmentCoverageSummary[];
  overlapBedCount: number;
  maxRateMmPerHour: number;
};

type BedAxisPosition = {
  bed: Bed;
  startMeters: number;
  endMeters: number;
  centerMeters: number;
};

export function calculateIrrigationCoverage({
  beds,
  groups,
  equipment,
  placements,
}: {
  beds: readonly Bed[];
  groups: readonly GardenGroupRecord[];
  equipment: readonly EquipmentListItem[];
  placements: readonly EquipmentPlacementRecord[];
}): IrrigationCoverageResult {
  const bedById = new Map(beds.map((bed) => [bed.id, bed]));
  const equipmentById = new Map(equipment.map((item) => [item.id, item]));
  const contributionsByBedId = new Map<string, BedIrrigationContribution[]>();

  for (const placement of placements) {
    const item = equipmentById.get(placement.equipmentId);
    if (!item || item.status !== 'active') continue;
    const setting = item.settings.find(
      (candidate) => candidate.id === placement.settingId,
    );
    if (!setting || setting.kind !== item.kind) continue;

    if (setting.kind === 'drip') {
      addDripCoverage(
        placement,
        item,
        setting,
        bedById,
        contributionsByBedId,
      );
      continue;
    }

    addSprinklerCoverage(
      placement,
      item,
      setting,
      beds,
      groups,
      contributionsByBedId,
    );
  }

  const bedCoverage = beds.flatMap((bed) => {
    const contributions = contributionsByBedId.get(bed.id) ?? [];
    if (contributions.length === 0) return [];
    return [{
      bedId: bed.id,
      totalRateMmPerHour: contributions.reduce(
        (total, contribution) => total + contribution.rateMmPerHour,
        0,
      ),
      contributions,
    }];
  });

  const summaries = new Map<string, EquipmentCoverageSummary>();
  for (const coverage of bedCoverage) {
    const bed = bedById.get(coverage.bedId);
    if (!bed) continue;
    for (const contribution of coverage.contributions) {
      const current = summaries.get(contribution.equipmentId) ?? {
        equipmentId: contribution.equipmentId,
        equipmentName: contribution.equipmentName,
        settingId: contribution.settingId,
        settingName: contribution.settingName,
        bedCount: 0,
        unknownAreaBedCount: 0,
        totalLitersPerHour: 0,
      };
      current.bedCount += 1;
      // Le débit se calcule sur la surface mouillée par le matériel, pas sur la
      // planche seule : une aspersion arrose aussi le passe-pied (D-022).
      const wettedArea = wettedAreaSquareMeters(bed, contribution.kind);
      if (wettedArea === null) {
        current.unknownAreaBedCount += 1;
      } else {
        current.totalLitersPerHour += litersPerHourForBed(
          contribution.rateMmPerHour,
          wettedArea,
        );
      }
      summaries.set(contribution.equipmentId, current);
    }
  }

  return {
    beds: bedCoverage,
    equipment: placements.flatMap((placement) => {
      const summary = summaries.get(placement.equipmentId);
      if (!summary) return [];
      summaries.delete(placement.equipmentId);
      return [summary];
    }),
    overlapBedCount: bedCoverage.filter(
      (coverage) => coverage.contributions.length > 1,
    ).length,
    maxRateMmPerHour: bedCoverage.reduce(
      (maximum, coverage) => Math.max(maximum, coverage.totalRateMmPerHour),
      0,
    ),
  };
}

function addDripCoverage(
  placement: EquipmentPlacementRecord,
  equipment: EquipmentListItem,
  setting: Extract<EquipmentSettingRecord, { kind: 'drip' }>,
  bedById: ReadonlyMap<string, Bed>,
  contributionsByBedId: Map<string, BedIrrigationContribution[]>,
) {
  if (setting.rateMmPerHour <= 0) return;
  for (const selected of placement.selectedBeds) {
    if (!bedById.has(selected.otfBedId)) continue;
    addContribution(contributionsByBedId, selected.otfBedId, {
      equipmentId: equipment.id,
      equipmentName: equipment.name,
      settingId: setting.id,
      settingName: setting.name,
      kind: 'drip',
      rateMmPerHour: setting.rateMmPerHour,
    });
  }
}

function addSprinklerCoverage(
  placement: EquipmentPlacementRecord,
  equipment: EquipmentListItem,
  setting: Extract<EquipmentSettingRecord, { kind: 'sprinkler' }>,
  beds: readonly Bed[],
  groups: readonly GardenGroupRecord[],
  contributionsByBedId: Map<string, BedIrrigationContribution[]>,
) {
  const group = findPlacementGroup(placement, groups);
  const axis = group
    ? buildGroupBedAxis(group, beds)
    : buildPlotBedAxis(placement.otfPlotId, beds);
  const anchorMeters = placementAnchorMeters(placement, axis);
  if (anchorMeters === null) return;

  for (const position of axis) {
    const offset = position.centerMeters - anchorMeters;
    const rateMmPerHour = sprinklerRateAtOffset(setting, offset);
    if (rateMmPerHour <= 0) continue;
    addContribution(contributionsByBedId, position.bed.id, {
      equipmentId: equipment.id,
      equipmentName: equipment.name,
      settingId: setting.id,
      settingName: setting.name,
      kind: 'sprinkler',
      rateMmPerHour,
    });
  }
}

function findPlacementGroup(
  placement: EquipmentPlacementRecord,
  groups: readonly GardenGroupRecord[],
) {
  const savedGroup = placement.gardenGroupId
    ? groups.find((group) => group.id === placement.gardenGroupId)
    : null;
  if (
    savedGroup?.members.some(
      (member) => member.otfPlotId === placement.otfPlotId,
    )
  ) {
    return savedGroup;
  }
  return groups.find((group) =>
    group.members.some((member) => member.otfPlotId === placement.otfPlotId),
  );
}

function buildGroupBedAxis(
  group: GardenGroupRecord,
  beds: readonly Bed[],
): BedAxisPosition[] {
  const result: BedAxisPosition[] = [];
  let cursorMeters = 0;
  const members = [...group.members].sort(
    (left, right) => left.position - right.position,
  );

  members.forEach((member, memberIndex) => {
    if (memberIndex > 0) cursorMeters += safeDistance(member.gapBeforeMeters);
    const plotBeds = sortBedsByName(
      beds.filter((bed) => bed.plotId === member.otfPlotId),
    );
    const orderedBeds = member.bedOrder === 'reversed'
      ? [...plotBeds].reverse()
      : plotBeds;
    const plotAxis = appendBedsToAxis(orderedBeds, cursorMeters);
    result.push(...plotAxis.positions);
    cursorMeters = plotAxis.endMeters;
  });

  return result;
}

function buildPlotBedAxis(
  plotId: string,
  beds: readonly Bed[],
): BedAxisPosition[] {
  return appendBedsToAxis(
    sortBedsByName(beds.filter((bed) => bed.plotId === plotId)),
    0,
  ).positions;
}

function appendBedsToAxis(
  orderedBeds: readonly Bed[],
  startMeters: number,
): { positions: BedAxisPosition[]; endMeters: number } {
  let cursorMeters = startMeters;
  const positions: BedAxisPosition[] = [];
  orderedBeds.forEach((bed, index) => {
    const widthMeters = safeDistance(bed.width);
    const endMeters = cursorMeters + widthMeters;
    positions.push({
      bed,
      startMeters: cursorMeters,
      endMeters,
      centerMeters: (cursorMeters + endMeters) / 2,
    });
    cursorMeters = endMeters;
    if (index < orderedBeds.length - 1) {
      cursorMeters += adjacentAlleyWidth(
        bed,
        orderedBeds[index + 1],
      );
    }
  });
  return { positions, endMeters: cursorMeters };
}

function adjacentAlleyWidth(left: Bed, right: Bed): number {
  const widths = [left.alleyWidth, right.alleyWidth].filter(
    (value): value is number => value !== null && Number.isFinite(value) && value >= 0,
  );
  if (widths.length === 0) return 0;
  return widths.reduce((total, width) => total + width, 0) / widths.length;
}

function placementAnchorMeters(
  placement: EquipmentPlacementRecord,
  axis: readonly BedAxisPosition[],
): number | null {
  const anchor = placement.anchor;
  if (anchor.type === 'bed_center') {
    return axis.find(
      (position) => position.bed.id === anchor.anchorBedOtfId,
    )?.centerMeters ?? null;
  }
  const before = axis.find(
    (position) => position.bed.id === anchor.beforeBedOtfId,
  );
  const after = axis.find(
    (position) => position.bed.id === anchor.afterBedOtfId,
  );
  if (!before || !after) return null;
  const left = before.centerMeters < after.centerMeters ? before : after;
  const right = left === before ? after : before;
  return (left.endMeters + right.startMeters) / 2;
}

function sprinklerRateAtOffset(
  setting: Extract<EquipmentSettingRecord, { kind: 'sprinkler' }>,
  offsetMeters: number,
) {
  if (offsetMeters < -POSITION_EPSILON) {
    return interpolateSprinklerRate(setting.leftProfile, Math.abs(offsetMeters));
  }
  if (offsetMeters > POSITION_EPSILON) {
    return interpolateSprinklerRate(setting.rightProfile, offsetMeters);
  }
  return (
    interpolateSprinklerRate(setting.leftProfile, 0) +
    interpolateSprinklerRate(setting.rightProfile, 0)
  ) / 2;
}

function addContribution(
  contributionsByBedId: Map<string, BedIrrigationContribution[]>,
  bedId: string,
  contribution: BedIrrigationContribution,
) {
  const current = contributionsByBedId.get(bedId) ?? [];
  current.push(contribution);
  contributionsByBedId.set(bedId, current);
}

function safeDistance(value: number): number {
  return Number.isFinite(value) && value >= 0 ? value : 0;
}

/**
 * La bulle « d'où vient ce chiffre » de l'apport horaire d'une planche (3.8,
 * docs/feature-selection-contract.md, section 6) : chaque matériel posé qui
 * l'arrose, avec le taux que son réglage lui donne, et leur somme.
 */
export function coverageOrigin(coverage: Pick<BedIrrigationCoverage, 'totalRateMmPerHour' | 'contributions'>): string {
  const terms = coverage.contributions.map((contribution) => {
    const where = contribution.kind === 'sprinkler' ? ', à sa distance du matériel' : '';
    return `${contribution.equipmentName} (${contribution.settingName}${where}) ${rateText(contribution.rateMmPerHour)}`;
  });
  const sum = terms.length > 1 ? `${terms.join(' + ')} = ${rateText(coverage.totalRateMmPerHour)}` : terms.join('');
  return `Apport horaire : ${sum}. 1 mm/h, c’est 1 litre par heure sur chaque m² de la planche.`;
}
