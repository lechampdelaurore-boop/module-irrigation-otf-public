import assert from 'node:assert/strict';
import test from 'node:test';
import type { CropWaterDay } from '../lib/domain/crop-water/etm.ts';
import { bareSoilDay, bareSoilGeometry, splitFullness } from '../lib/domain/soil-reserve/bare-soil.ts';
import { bedSoilReserve, type BedSoilInput, type SoilReserveDay } from '../lib/domain/soil-reserve/gauge.ts';
import { gardenSoilSummary, soilReserveSummary } from '../lib/domain/soil-reserve/signals.ts';
import { CARROT, SUMMER_SALAD, TOMATO } from './support/crop-water-references.ts';
import {
  bareDay,
  crop,
  cropDay,
  dates,
  declaration,
  dryDays,
  FARM_SOIL,
  fixed,
  irrigation,
  observation,
  profile,
  rain,
  soilInput,
  staged,
} from './support/soil-reserve-fixtures.ts';

/**
 * La réserve du sol d'une planche sans culture (docs/soil-reserve-contract.md,
 * « Par planche sans culture », scénarios 19 à 31, D-053) : le modèle de sol
 * nu en deux compartiments, les états de surface, les passages entre culture
 * et sol nu, la confiance.
 */

const close = (actual: number | null | undefined, expected: number, digits = 3) => {
  assert.ok(actual !== null && actual !== undefined, `valeur attendue ${expected}, obtenue ${actual}`);
  assert.equal(Number(actual.toFixed(digits)), Number(expected.toFixed(digits)));
};
const MONDAY = '2026-06-01';
const MONDAY_MIDNIGHT = '2026-05-31T22:00:00.000Z';
/** La ferme à 30 cm : RFU de surface 5,1 mm, RFU profonde 10,2 mm, capacité 15,3 mm. */
const GEOMETRY = bareSoilGeometry({ soilRfuMmPerMeter: 51, depthM: 0.3, surfaceLayerCm: 10, tewMm: 14, rewMm: 7 });

function bareRun(et0: number[], options: Partial<BedSoilInput> = {}): SoilReserveDay[] {
  const followed = dates(MONDAY, et0.length);
  return bedSoilReserve(soilInput({
    soilRecords: [FARM_SOIL],
    waterDays: followed.map((date, index) => bareDay(date, et0[index])),
    observations: [observation(100, MONDAY_MIDNIGHT)],
    rain: dryDays(followed),
    ...options,
  }));
}

test('la planche nue de la ferme à 30 cm : 5,1 mm en surface, 10,2 mm en profondeur, 15,3 mm de capacité', () => {
  close(GEOMETRY.surfaceRfuMm, 5.1);
  close(GEOMETRY.deepRfuMm, 10.2);
  const days = bareRun([0]);
  close(days[0].capacityMm, 15.3);
  assert.equal(days[0].mode, 'bare');
  assert.equal(days[0].surfaceState, 'bare');
});

test('scénario 19 : sol nu en été, la surface sèche en deux jours, la réserve profonde reste', () => {
  const days = bareRun([6, 6, 6]);
  assert.deepEqual(days.map((day) => Number(day.consumptionMm?.toFixed(2))), [7.2, 6.8, 0]);
  assert.deepEqual(days.map((day) => Number(day.bare?.depletionMm.toFixed(2))), [7.2, 14, 14]);
  for (const day of days) close(day.stateMm, 10.2);
});

test('scénario 20 : sol nu au printemps, l’évaporation ralentit passé REW', () => {
  const days = bareRun([2, 2, 2, 2, 2, 2, 2]);
  assert.deepEqual(days.map((day) => Number(day.consumptionMm?.toFixed(2))), [2.4, 2.4, 2.4, 2.33, 1.53, 1.01, 0.66]);
  const total = days.reduce((sum, day) => sum + (day.consumptionMm ?? 0), 0);
  assert.ok(total > 12.5 && total < 13, `cumul ${total}`);
  close(days[0].stateMm, 12.9);
  close(days[1].stateMm, 10.5);
  for (const day of days.slice(2)) close(day.stateMm, 10.2);
});

test('scénario 21 : une petite pluie sur sol sec mouille la surface sans changer la jauge', () => {
  const [monday, tuesday, wednesday] = dates(MONDAY, 3);
  const days = bareRun([0, 0, 6], { observations: [observation(0, MONDAY_MIDNIGHT)], rain: rain({ [monday]: 0, [tuesday]: 5, [wednesday]: 0 }) });
  close(days[0].bare?.depletionMm, 14);
  close(days[1].bare?.depletionMm, 9);
  close(days[1].stateMm, 0);
  close(days[2].consumptionMm, 5);
  close(days[2].bare?.depletionMm, 14);
  close(days[2].stateMm, 0);
});

test('scénario 22 : une grosse pluie sur sol sec remplit la surface, puis la réserve profonde, puis draine', () => {
  const day = bareSoilDay({ geometry: GEOMETRY, previous: { depletionMm: 14, deepMm: 6 }, inflowMm: 20, et0Mm: 0, shelterFactor: 1, evaporationShare: 1, fraction: 1 });
  close(day.state.depletionMm, 0);
  close(day.state.deepMm, 10.2);
  close(day.drainageMm, 1.8);
});

test('scénario 23 : sous une bâche imperméable, De et la jauge restent figés, la pluie ne compte pas', () => {
  const followed = dates(MONDAY, 10);
  const days = bareRun(followed.map(() => 6), {
    observations: [observation(50, MONDAY_MIDNIGHT)],
    surfaceDeclarations: [declaration('2026-05-20', 'impermeable-tarp')],
    rain: rain(Object.fromEntries(followed.map((date) => [date, 12]))),
  });
  for (const day of days) {
    close(day.bare?.depletionMm, 7);
    close(day.stateMm, 7.65);
    close(day.rainMm, 0);
  }
  assert.equal(days[0].surfaceStateSince, '2026-05-20', 'date de pose affichée');
});

test('à la dépose d’une bâche imperméable, une surface humide à la pose repart mouillée', () => {
  const [monday, tuesday] = dates(MONDAY, 2);
  const days = bareRun([6, 0], {
    observations: [observation(75, MONDAY_MIDNIGHT)],
    surfaceDeclarations: [declaration('2026-05-20', 'impermeable-tarp'), declaration(tuesday, 'bare')],
  });
  close(days[0].bare?.depletionMm, 3.5);
  assert.equal(days[0].date, monday);
  close(days[1].bareStart?.depletionMm, 0);
});

test('scénario 24 : sous un paillage, la moitié de l’évaporation du sol nu', () => {
  const days = bareRun([6], { surfaceDeclarations: [declaration('2026-05-20', 'mulched')] });
  close(days[0].consumptionMm, 3.6);
  const tarp = bareRun([6], { surfaceDeclarations: [declaration('2026-05-20', 'permeable-tarp')] });
  close(tarp[0].consumptionMm, 0.72);
});

test('scénario 25 : un engrais vert couvrant consomme comme une culture et a un seuil à 25 %', () => {
  const days = bareRun([5], { surfaceDeclarations: [declaration('2026-05-20', 'green-manure-full')], today: MONDAY });
  assert.equal(days[0].mode, 'cover');
  close(days[0].consumptionMm, 5);
  close(days[0].capacityMm, 15.3);
  close(days[0].thresholdMm, 3.825);
  close(days[0].stateMm, 10.3);
});

test('scénario 26 : du sol nu à une culture, la jauge garde son % ; aucun conseil avant le seuil', () => {
  const [monday, tuesday] = dates(MONDAY, 2);
  const lettuce = profile(SUMMER_SALAD.id, 0.3, [fixed(1, 0.15), fixed(2, 0.25)]);
  const days = bedSoilReserve(soilInput({
    today: tuesday,
    soilRecords: [FARM_SOIL],
    rootingProfiles: [lettuce],
    waterDays: [bareDay(monday, 0), cropDay(tuesday, [crop({ referenceCropId: SUMMER_SALAD.id, rank: 1, startedOn: tuesday, etmMm: 0 })])],
    observations: [observation(60, MONDAY_MIDNIGHT)],
    rain: dryDays([monday, tuesday]),
  }));
  close(days[0].stateMm, 9.18);
  close(days[1].capacityMm, 7.65);
  close(days[1].startMm, 4.59);
  close(days[1].thresholdMm, 4.2075, 2);
  const summary = soilReserveSummary(days, tuesday);
  assert.equal(summary.advisedDoseMm, null);
  assert.equal(summary.thresholdDay, null);
});

test('scénario 27 : l’arrosage de plantation est une irrigation comme les autres', () => {
  const tomato = profile(TOMATO.id, 0.4, [fixed(1, 0.2)]);
  const days = bedSoilReserve(soilInput({
    soilRecords: [FARM_SOIL],
    rootingProfiles: [tomato],
    waterDays: [cropDay(MONDAY, [crop({ referenceCropId: TOMATO.id, rank: 1, etmMm: 0 })])],
    observations: [observation(2 / 10.2 * 100, MONDAY_MIDNIGHT)],
    irrigations: [irrigation('2026-06-01T08:00:00.000Z', '2026-06-01T09:00:00.000Z', 6)],
  }));
  close(days[0].stateMm, 8);
  assert.equal(Math.round(days[0].percent ?? 0), 78);
});

test('scénario 28 : de la culture au sol nu, la jauge garde son % et se répartit dans les deux compartiments', () => {
  const [monday, tuesday] = dates(MONDAY, 2);
  const tomato = profile(TOMATO.id, 0.4, [fixed(null, 0.65)]);
  const days = bedSoilReserve(soilInput({
    soilRecords: [FARM_SOIL],
    rootingProfiles: [tomato],
    waterDays: [cropDay(monday, [crop({ referenceCropId: TOMATO.id, etmMm: 0 })]), bareDay(tuesday, 0)],
    observations: [observation(15 / 33.15 * 100, MONDAY_MIDNIGHT)],
    rain: dryDays([monday, tuesday]),
  }));
  close(days[0].stateMm, 15);
  close(days[1].startMm, 6.923, 3);
  close(days[1].bareStart?.depletionMm, 7.665, 3);
  close(days[1].bareStart?.deepMm, 6.923, 3);
  assert.equal(days[1].surfaceState, 'bare');
  assert.equal(days[1].surfaceStateDeclared, false);
});

test('scénario 29 : une planche sans état déclaré est traitée nue, et la jauge ne s’arrête pas', () => {
  const days = bareRun([6, 6]);
  assert.equal(days[1].surfaceState, 'bare');
  assert.equal(days[1].surfaceStateDeclared, false);
  assert.equal(days[1].unknown, null);
});

test('scénario 30 : le curseur sur sol nu se traduit dans les deux compartiments', () => {
  const dry = splitFullness(GEOMETRY, 0.25);
  close(dry.depletionMm, 10.5);
  close(dry.deepMm, 3.825);
  const wet = splitFullness(GEOMETRY, 0.75);
  close(wet.depletionMm, 3.5);
  close(wet.deepMm, 9.875);
  const days = bareRun([0], { observations: [observation(75, MONDAY_MIDNIGHT)] });
  close(days[0].startMm, 11.475);
});

test('scénario 31 : une planche nue inconnue repart pleine après au moins TEW + RFU profonde d’apports', () => {
  const [monday, tuesday] = dates(MONDAY, 2);
  const days = bareRun([0, 0], { observations: [], rain: rain({ [monday]: 20, [tuesday]: 25 }) });
  assert.deepEqual(days[0].unknown, { kind: 'not-started' });
  close(days[1].stateMm, 15.3);
  assert.equal(days[1].restart, 'inflow');
});

test('une série d’engrais vert sur la planche : engrais vert levé tant que son stade n’est pas déclaré', () => {
  const greenManure: CropWaterDay = { seriesId: 'ev', seriesName: 'Engrais vert', cultivationId: 'ev-c', plantId: 'p-phacelie', plantName: 'Phacélie', status: 'surface-state' };
  const days = bedSoilReserve(soilInput({
    soilRecords: [FARM_SOIL],
    waterDays: [bareDay(MONDAY, 5, [greenManure])],
    observations: [observation(100, MONDAY_MIDNIGHT)],
  }));
  assert.equal(days[0].surfaceState, 'green-manure-emergence');
  assert.equal(days[0].surfaceStateDeclared, false);
  close(days[0].consumptionMm, 1.5);
});

test('un état déclaré avant une culture ne vaut plus après elle ; la planche repasse nue', () => {
  const [monday, tuesday, wednesday] = dates(MONDAY, 3);
  const days = bedSoilReserve(soilInput({
    soilRecords: [FARM_SOIL],
    rootingProfiles: [profile('exemple', 0.4, [fixed(null, 0.3)])],
    waterDays: [bareDay(monday, 0), cropDay(tuesday, [crop({ etmMm: 0 })]), bareDay(wednesday, 0)],
    surfaceDeclarations: [declaration('2026-05-20', 'mulched')],
    observations: [observation(100, MONDAY_MIDNIGHT)],
    rain: dryDays([monday, tuesday, wednesday]),
  }));
  assert.equal(days[0].surfaceState, 'mulched');
  assert.equal(days[2].surfaceState, 'bare');
});

test('la profondeur de référence d’une planche nue : le premier stade de sa prochaine culture connue', () => {
  const carrot = profile(CARROT.id, 0.35, [fixed(1, 0.2), fixed(2, 0.4)]);
  const days = bareRun([0], {
    rootingProfiles: [carrot],
    referenceCrops: [CARROT],
    upcomingCrops: [{ presenceStart: '2026-06-15', referenceCropId: CARROT.id }, { presenceStart: '2026-05-01', referenceCropId: null }],
  });
  close(days[0].depthM, 0.2);
  close(days[0].capacityMm, 10.2);
});

test('l’enherbée consomme comme un couvert, sans seuil, avec la mention des adventices', () => {
  const days = bareRun([5], { surfaceDeclarations: [declaration('2026-05-20', 'grass')] });
  assert.equal(days[0].mode, 'cover');
  close(days[0].consumptionMm, 3);
  assert.equal(days[0].thresholdMm, null);
  assert.equal(days[0].mentions.weeds, true);
  const garden = gardenSoilSummary([
    { bedId: 'a', bedName: 'A', areaSquareMeters: 10, mode: 'cover', surfaceState: 'grass', surfaceStateDeclared: true, stateMm: 10, capacityMm: 15.3 },
    { bedId: 'b', bedName: 'B', areaSquareMeters: 10, mode: 'cover', surfaceState: 'green-manure-full', surfaceStateDeclared: true, stateMm: 7.65, capacityMm: 15.3 },
  ]);
  assert.equal(garden.countedBeds, 1, 'l’engrais vert entre dans la moyenne');
  close(garden.percent, 50);
  assert.deepEqual(garden.withoutCrop.map((bed) => bed.surfaceState), ['grass']);
});

test('une planche sans culture a besoin de l’ET0 du jour, sauf sous bâche imperméable', () => {
  const missing = bareRun([0, 0], {
    waterDays: [bareDay(MONDAY, 0), bareDay('2026-06-02', null)],
  });
  assert.deepEqual(missing[1].unknown, { kind: 'missing-et0', date: '2026-06-02' });
  const tarp = bareRun([0, 0], {
    waterDays: [bareDay(MONDAY, 0), bareDay('2026-06-02', null)],
    surfaceDeclarations: [declaration('2026-05-20', 'impermeable-tarp')],
  });
  assert.equal(tarp[1].unknown, null);
});

test('la confiance : réglée le …, puis un contrôle proposé au-delà de 30 jours sans réglage', () => {
  const followed = dates(MONDAY, 33);
  const days = bareRun(followed.map(() => 0));
  const early = soilReserveSummary(days, followed[10]);
  assert.deepEqual(early.confidence, { since: MONDAY, kind: 'observation', days: 10, checkProposed: false });
  const late = soilReserveSummary(days, followed[31]);
  assert.equal(late.confidence.days, 31);
  assert.equal(late.confidence.checkProposed, true);
});

test('le stade déclaré de la culture fixe sa profondeur, comme le calcul de la 5 quater le rend', () => {
  const tomato = profile(TOMATO.id, 0.4, [fixed(1, 0.2), fixed(2, 0.45)]);
  const days = bedSoilReserve(soilInput({
    soilRecords: [FARM_SOIL],
    rootingProfiles: [tomato],
    waterDays: [cropDay(MONDAY, [crop({ referenceCropId: TOMATO.id, stage: staged(2, '2026-05-30', { origin: 'observed' }), etmMm: 0 })])],
    observations: [observation(100, MONDAY_MIDNIGHT)],
  }));
  close(days[0].depthM, 0.45);
});
