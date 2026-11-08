import type { EquipmentPlacementRecord } from '../lib/domain/equipment-placement-record.ts';
import type { EquipmentListItem } from '../lib/domain/equipment-record.ts';
import type { GardenGroupRecord } from '../lib/domain/garden-group-record.ts';
import assert from 'node:assert/strict';
import test from 'node:test';
import type { Bed } from '../lib/domain/domain.ts';
import { calculateIrrigationCoverage } from '../lib/domain/irrigation-coverage.ts';

const profile = [
  { distanceMeters: 0, rateMmPerHour: 12 },
  { distanceMeters: 1, rateMmPerHour: 8 },
  { distanceMeters: 2, rateMmPerHour: 5 },
  { distanceMeters: 3, rateMmPerHour: 3 },
  { distanceMeters: 4, rateMmPerHour: 2 },
];

test('une rampe entre deux planches utilise la distance au centre', () => {
  const beds = [bed('b1', 'p1'), bed('b2', 'p1'), bed('b3', 'p1')];
  const result = calculateIrrigationCoverage({
    beds,
    groups: [],
    equipment: [sprinkler('e1', profile, profile)],
    placements: [betweenPlacement('e1', 'p1', 'b1', 'b2')],
  });

  assertCloseTo(rateFor(result, 'b1'), 9.6);
  assertCloseTo(rateFor(result, 'b2'), 9.6);
  assertCloseTo(rateFor(result, 'b3'), 5.6);
});

test('une aspersion traverse la distance entre deux jardins alignés', () => {
  const beds = [bed('a1', 'p1'), bed('b1', 'p2')];
  const result = calculateIrrigationCoverage({
    beds,
    groups: [group([
      member('p1', 1, 'normal', 0),
      member('p2', 2, 'normal', 1),
    ])],
    equipment: [sprinkler('e1', profile, profile)],
    placements: [centerPlacement('e1', 'p1', 'a1', 'g1')],
  });

  assertCloseTo(rateFor(result, 'a1'), 12);
  assertCloseTo(rateFor(result, 'b1'), 5.75);
});

test('la planche zéro précède la planche un et l’aspersion reste symétrique entre trois jardins', () => {
  const block1 = [
    ...Array.from({ length: 10 }, (_, index) =>
      bed(`b1-${index + 1}`, 'p1', `B1-${index + 1}`),
    ),
    bed('b1-0', 'p1', 'B1-0'),
  ];
  const block2 = Array.from({ length: 10 }, (_, index) =>
    bed(`b2-${index + 1}`, 'p2', `B2-${index + 1}`),
  );
  const block3 = Array.from({ length: 10 }, (_, index) =>
    bed(`b3-${index + 1}`, 'p3', `B3-${index + 1}`),
  );
  const symmetricProfile = [
    { distanceMeters: 0, rateMmPerHour: 12 },
    { distanceMeters: 10.2, rateMmPerHour: 1 },
  ];
  const result = calculateIrrigationCoverage({
    beds: [...block1, ...block2, ...block3],
    groups: [group([
      member('p1', 1, 'normal', 0),
      member('p2', 2, 'normal', 1.65),
      member('p3', 3, 'normal', 1.65),
    ])],
    equipment: [sprinkler('e1', symmetricProfile, symmetricProfile)],
    placements: [betweenPlacement('e1', 'p2', 'b2-5', 'b2-6', 'g1')],
  });

  assert.deepEqual(
    ['b1-0', 'b1-1', 'b1-7'].map((id) => rateFor(result, id)),
    [0, 0, 0],
  );
  assert.ok(['b1-8', 'b1-9', 'b1-10'].every((id) => rateFor(result, id) > 0));
  assert.ok(['b3-1', 'b3-2', 'b3-3'].every((id) => rateFor(result, id) > 0));
  assert.equal(rateFor(result, 'b3-4'), 0);
  assert.equal(result.equipment[0].bedCount, 16);
});

test('le sens inversé d’un jardin échange les côtés physiques des planches', () => {
  const beds = [bed('b1', 'p1'), bed('b2', 'p1')];
  const result = calculateIrrigationCoverage({
    beds,
    groups: [group([member('p1', 1, 'reversed', 0)])],
    equipment: [sprinkler(
      'e1',
      [{ distanceMeters: 0, rateMmPerHour: 4 }, { distanceMeters: 1, rateMmPerHour: 4 }],
      [{ distanceMeters: 0, rateMmPerHour: 10 }, { distanceMeters: 1, rateMmPerHour: 10 }],
    )],
    placements: [betweenPlacement('e1', 'p1', 'b1', 'b2', 'g1')],
  });

  assert.equal(rateFor(result, 'b2'), 4);
  assert.equal(rateFor(result, 'b1'), 10);
});

test('les apports de plusieurs matériels se cumulent par planche', () => {
  const beds = [bed('b1', 'p1')];
  const result = calculateIrrigationCoverage({
    beds,
    groups: [],
    equipment: [
      sprinkler('e1', [{ distanceMeters: 0, rateMmPerHour: 8 }], [{ distanceMeters: 0, rateMmPerHour: 8 }]),
      drip('e2', 14),
    ],
    placements: [
      centerPlacement('e1', 'p1', 'b1'),
      dripPlacement('e2', 'p1', ['b1']),
    ],
  });

  assert.equal(rateFor(result, 'b1'), 22);
  assert.equal(result.overlapBedCount, 1);
  // L'aspersion mouille la planche et son passe-pied : 15 m² + 20 m × 0,45 m = 24 m²
  // (D-022) ; le goutte-à-goutte, la planche seule.
  assert.equal(result.equipment[0].totalLitersPerHour, 192);
  assert.equal(result.equipment[1].totalLitersPerHour, 210);
  assert.equal(result.beds[0].contributions.map((contribution) => contribution.kind).join(','), 'sprinkler,drip');
});

test('5.0 une aspersion sur une planche sans passe-pied connu est exclue du débit et comptée', () => {
  const beds = [{ ...bed('b1', 'p1'), alleyWidth: null }, bed('b2', 'p1')];
  const flat = [{ distanceMeters: 0, rateMmPerHour: 8 }, { distanceMeters: 1, rateMmPerHour: 8 }];
  const result = calculateIrrigationCoverage({
    beds,
    groups: [],
    equipment: [sprinkler('e1', flat, flat), drip('e2', 14)],
    placements: [betweenPlacement('e1', 'p1', 'b1', 'b2'), dripPlacement('e2', 'p1', ['b1'])],
  });

  const [aspersion, goutte] = result.equipment;
  assert.equal(aspersion.bedCount, 2);
  assert.equal(aspersion.unknownAreaBedCount, 1, 'b1 est comptée, pas remplacée par zéro ni par la planche seule');
  assert.equal(aspersion.totalLitersPerHour, 192, 'seule b2 entre dans le débit');
  assert.equal(goutte.unknownAreaBedCount, 0, 'le passe-pied ne compte pas en goutte-à-goutte');
  assert.equal(goutte.totalLitersPerHour, 210);
});

test('le goutte-à-goutte irrigue uniquement les planches choisies', () => {
  const beds = [bed('b1', 'p1'), bed('b2', 'p1'), bed('b3', 'p1')];
  const result = calculateIrrigationCoverage({
    beds,
    groups: [],
    equipment: [drip('e1', 14)],
    placements: [dripPlacement('e1', 'p1', ['b1', 'b3'])],
  });

  assert.equal(rateFor(result, 'b1'), 14);
  assert.equal(rateFor(result, 'b2'), 0);
  assert.equal(rateFor(result, 'b3'), 14);
});

function bed(id: string, plotId: string, name = id): Bed {
  return {
    id,
    plotId,
    zoneId: 'z1',
    name,
    length: 20,
    width: 0.75,
    alleyWidth: 0.45,
    area: 15,
    seasons: [2026],
  };
}

function sprinkler(
  id: string,
  leftProfile: { distanceMeters: number; rateMmPerHour: number }[],
  rightProfile: { distanceMeters: number; rateMmPerHour: number }[],
): EquipmentListItem {
  return {
    id,
    name: id,
    kind: 'sprinkler',
    mobility: 'mobile',
    status: 'active',
    settingsCount: 1,
    archivedAt: null,
    settings: [{
      id: `${id}-setting`,
      name: 'Réglage 1',
      position: 1,
      kind: 'sprinkler',
      leftProfile,
      rightProfile,
    }],
  };
}

function drip(id: string, rateMmPerHour: number): EquipmentListItem {
  return {
    id,
    name: id,
    kind: 'drip',
    mobility: 'fixed',
    status: 'active',
    settingsCount: 1,
    archivedAt: null,
    settings: [{
      id: `${id}-setting`,
      name: 'Réglage 1',
      position: 1,
      kind: 'drip',
      rateMmPerHour,
    }],
  };
}

function group(members: GardenGroupRecord['members']): GardenGroupRecord {
  return {
    id: 'g1',
    name: 'Groupe 1',
    position: 1,
    copiedFromGroupId: null,
    members,
  };
}

function member(
  otfPlotId: string,
  position: number,
  bedOrder: 'normal' | 'reversed',
  gapBeforeMeters: number,
): GardenGroupRecord['members'][number] {
  return {
    otfZoneId: 'z1',
    otfPlotId,
    position,
    bedOrder,
    gapBeforeMeters,
  };
}

function centerPlacement(
  equipmentId: string,
  plotId: string,
  bedId: string,
  gardenGroupId: string | null = null,
): EquipmentPlacementRecord {
  return {
    id: `${equipmentId}-placement`,
    equipmentId,
    settingId: `${equipmentId}-setting`,
    season: 2026,
    gardenGroupId,
    otfZoneId: 'z1',
    otfPlotId: plotId,
    anchor: { type: 'bed_center', anchorBedOtfId: bedId },
    selectedBeds: [],
  };
}

function betweenPlacement(
  equipmentId: string,
  plotId: string,
  beforeBedOtfId: string,
  afterBedOtfId: string,
  gardenGroupId: string | null = null,
): EquipmentPlacementRecord {
  return {
    ...centerPlacement(equipmentId, plotId, beforeBedOtfId, gardenGroupId),
    anchor: { type: 'between_beds', beforeBedOtfId, afterBedOtfId },
  };
}

function dripPlacement(
  equipmentId: string,
  plotId: string,
  bedIds: string[],
): EquipmentPlacementRecord {
  return {
    ...centerPlacement(equipmentId, plotId, bedIds[0]),
    selectedBeds: bedIds.map((otfBedId) => ({
      otfZoneId: 'z1',
      otfPlotId: plotId,
      otfBedId,
    })),
  };
}

function rateFor(
  result: ReturnType<typeof calculateIrrigationCoverage>,
  bedId: string,
) {
  return result.beds.find((coverage) => coverage.bedId === bedId)
    ?.totalRateMmPerHour ?? 0;
}

function assertCloseTo(actual: number, expected: number) {
  assert.ok(Math.abs(actual - expected) < 1e-9, `${actual} ≠ ${expected}`);
}
