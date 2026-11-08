import assert from 'node:assert/strict';
import test from 'node:test';
import { bedWaterDays } from '../lib/domain/crop-water/proposal.ts';
import { bedSoilReserve, type SoilReserveDay } from '../lib/domain/soil-reserve/gauge.ts';
import {
  cappedDepth,
  cropRooting,
  cropThresholdPercent,
  rootingProfileProblems,
  rowDepth,
  thresholdMm,
} from '../lib/domain/soil-reserve/rooting.ts';
import { doseBeyondSoilMm, gardenSoilSummary, soilReserveSummary } from '../lib/domain/soil-reserve/signals.ts';
import {
  FARM_THRESHOLD,
  labRfuWarning,
  resolveBedSoil,
  soilRecordProblems,
  soilRfuMmPerMeter,
  soilSettingsProblems,
  DEFAULT_SOIL_SETTINGS,
} from '../lib/domain/soil-reserve/soil.ts';
import { cultivation, series, task, TOMATO } from './support/crop-water-references.ts';
import {
  BED,
  crop,
  cropDay,
  cropWithoutKc,
  dates,
  dryDays,
  FARM_SOIL,
  farmThreshold,
  fixed,
  irrigation,
  observation,
  profile,
  progressive,
  rain,
  SHELTER_BED,
  soilInput,
  soilRecord,
  staged,
} from './support/soil-reserve-fixtures.ts';

/**
 * La réserve du sol d'une planche cultivée (docs/soil-reserve-contract.md,
 * scénarios 1 à 18 et 32 à 41, D-059) : le sol, la capacité selon le stade,
 * le seuil, la jauge jour par jour, le départ, l'inconnue, la moyenne du
 * jardin, le prévu et les signaux.
 */

const close = (actual: number | null | undefined, expected: number, digits = 3) => {
  assert.ok(actual !== null && actual !== undefined, `valeur attendue ${expected}, obtenue ${actual}`);
  assert.equal(Number(actual.toFixed(digits)), Number(expected.toFixed(digits)));
};
const MONDAY = '2026-06-01';
/** Lundi 1er juin 2026, minuit à Paris (UTC+2). */
const MONDAY_MIDNIGHT = '2026-05-31T22:00:00.000Z';
const at = (days: readonly SoilReserveDay[], date: string) => {
  const day = days.find((candidate) => candidate.date === date);
  assert.ok(day, `jour ${date} absent`);
  return day;
};

test('scénario 1 : plein champ, la jauge suit l’ETM, l’irrigation et la pluie, l’excédent est drainé', () => {
  const [monday, tuesday, wednesday] = dates(MONDAY, 3);
  const days = bedSoilReserve(soilInput({
    waterDays: [cropDay(monday, [crop({ etmMm: 4 })]), cropDay(tuesday, [crop({ etmMm: 4 })]), cropDay(wednesday, [crop({ etmMm: 2 })])],
    observations: [observation(100, MONDAY_MIDNIGHT)],
    irrigations: [irrigation('2026-06-02T04:00:00.000Z', '2026-06-02T05:00:00.000Z', 10)],
    rain: rain({ [monday]: 0, [tuesday]: 0, [wednesday]: 20 }),
  }));
  close(at(days, monday).capacityMm, 31);
  close(at(days, monday).startMm, 31);
  close(at(days, monday).stateMm, 27);
  close(at(days, tuesday).stateMm, 31);
  close(at(days, tuesday).drainageMm, 2);
  close(at(days, wednesday).stateMm, 31);
  close(at(days, wednesday).drainageMm, 18);
  assert.equal(at(days, monday).restart, 'observation');
  assert.equal(at(days, monday).nature, 'estimated');
});

test('scénario 2 : le jour de l’observation ne compte qu’après son heure', () => {
  const days = bedSoilReserve(soilInput({
    waterDays: [cropDay(MONDAY, [crop({ etmMm: 4 })])],
    observations: [observation(50, '2026-06-01T16:00:00.000Z')],
  }));
  close(days[0].startMm, 15.5);
  close(days[0].fraction, 0.25);
  close(days[0].stateMm, 14.5);
});

test('le jour de l’observation compte 25 heures au passage à l’heure d’hiver', () => {
  // Dimanche 25 octobre 2026 : 25 heures ; observation à 12 h 00 (11 h 00 UTC), 12 heures restent.
  const days = bedSoilReserve(soilInput({
    waterDays: [cropDay('2026-10-25', [crop({ etmMm: 5 })])],
    observations: [observation(100, '2026-10-25T11:00:00.000Z')],
  }));
  close(days[0].fraction, 12 / 25);
  close(days[0].stateMm, 31 - 5 * 12 / 25);
});

test('l’irrigation du jour de l’observation ne compte que pour sa part après l’heure observée', () => {
  const days = bedSoilReserve(soilInput({
    waterDays: [cropDay(MONDAY, [crop({ etmMm: 0 })])],
    observations: [observation(0, '2026-06-01T06:30:00.000Z')],
    irrigations: [irrigation('2026-06-01T06:00:00.000Z', '2026-06-01T07:00:00.000Z', 10)],
  }));
  close(days[0].irrigationMm, 5);
  close(days[0].stateMm, 5);
});

test('scénario 3 : sous abri, la pluie compte 0, la jauge baisse de l’ETM', () => {
  const [monday, tuesday, wednesday] = dates(MONDAY, 3);
  const days = bedSoilReserve(soilInput({
    bed: SHELTER_BED,
    soilRecords: [soilRecord({ plotId: SHELTER_BED.plotId })],
    waterDays: [cropDay(monday, [crop({ etmMm: 2 })]), cropDay(tuesday, [crop({ etmMm: 2 })]), cropDay(wednesday, [crop({ etmMm: 2 })])],
    observations: [observation(100, MONDAY_MIDNIGHT, SHELTER_BED.plotId)],
    rain: new Map([[wednesday, { mm: 20, nature: 'gauge' }]]),
  }));
  close(at(days, wednesday).rainMm, 0);
  close(at(days, wednesday).stateMm, 25);
  assert.equal(at(days, tuesday).unknown, null, 'sous abri, une pluie absente n’est pas un trou de données');
});

test('scénario 4 : un abri sans valeur propre prend la RFU de sa parcelle, sans mention', () => {
  const soil = resolveBedSoil([soilRecord()], SHELTER_BED, MONDAY);
  assert.equal(soil?.origin, 'zone');
  assert.equal(soil?.soilRfuMmPerMeter, 62);
  const days = bedSoilReserve(soilInput({
    bed: SHELTER_BED,
    waterDays: [cropDay(MONDAY, [crop({ etmMm: 0 })])],
    observations: [observation(100, MONDAY_MIDNIGHT, SHELTER_BED.plotId)],
  }));
  close(days[0].capacityMm, 31);
  assert.equal(days[0].mentions.stonesMissing, false);
  const own = resolveBedSoil([soilRecord(), soilRecord({ plotId: SHELTER_BED.plotId, labRfuMmPerMeter: 80 })], SHELTER_BED, MONDAY);
  assert.equal(own?.origin, 'plot');
  assert.equal(own?.soilRfuMmPerMeter, 80);
});

test('scénario 5 : une ETM inconnue rend la jauge inconnue dès ce jour ; une observation la rétablit', () => {
  const [monday, tuesday, wednesday, thursday] = dates(MONDAY, 4);
  const days = bedSoilReserve(soilInput({
    waterDays: [
      cropDay(monday, [crop({ etmMm: 2 })]),
      cropDay(tuesday, [crop({ etmMm: 2 })]),
      cropDay(wednesday, [crop({ etmMm: null })], null),
      cropDay(thursday, [crop({ etmMm: 2 })]),
    ],
    observations: [observation(100, MONDAY_MIDNIGHT), observation(80, '2026-06-03T22:00:00.000Z')],
  }));
  close(at(days, tuesday).stateMm, 27);
  assert.deepEqual(at(days, wednesday).unknown, { kind: 'missing-et0', date: wednesday });
  assert.equal(at(days, wednesday).stateMm, null);
  assert.equal(at(days, thursday).restart, 'observation');
  close(at(days, thursday).stateMm, 31 * 0.8 - 2);
});

test('scénario 5 : une culture sans Kc rend la jauge inconnue et elle est nommée ; la raison reste jusqu’au redémarrage', () => {
  const [monday, tuesday] = dates(MONDAY, 2);
  const days = bedSoilReserve(soilInput({
    waterDays: [cropDay(monday, [crop({ etmMm: 2 })]), cropDay(tuesday, [crop({ etmMm: 2 }), cropWithoutKc('Zinnia')])],
    observations: [observation(100, MONDAY_MIDNIGHT)],
  }));
  assert.deepEqual(at(days, tuesday).unknown, { kind: 'crop-without-etm', date: tuesday, crops: [{ seriesName: 'Série Zinnia', plantName: 'Zinnia' }] });
});

test('une pluie inconnue en plein champ est un trou de données ; avant toute observation, la jauge n’est pas partie', () => {
  const [monday, tuesday] = dates(MONDAY, 2);
  const days = bedSoilReserve(soilInput({
    waterDays: [cropDay(monday, [crop({ etmMm: 2 })]), cropDay(tuesday, [crop({ etmMm: 2 })])],
    observations: [observation(100, MONDAY_MIDNIGHT)],
    rain: rain({ [monday]: 0 }),
  }));
  assert.deepEqual(at(days, tuesday).unknown, { kind: 'missing-rain', date: tuesday });
  const unstarted = bedSoilReserve(soilInput({ waterDays: [cropDay(monday, [crop({ etmMm: 2 })])] }));
  assert.deepEqual(unstarted[0].unknown, { kind: 'not-started' });
  const noSoil = bedSoilReserve(soilInput({ waterDays: [cropDay(monday, [crop({ etmMm: 2 })])], soilRecords: [] }));
  assert.deepEqual(noSoil[0].unknown, { kind: 'no-soil' });
});

test('scénario 6 : deux séries, la moins profonde fixe la capacité', () => {
  const deep = profile('profonde', 0.5, [fixed(null, 1)]);
  const days = bedSoilReserve(soilInput({
    rootingProfiles: [profile('exemple', 0.4, [fixed(null, 0.5)]), deep],
    waterDays: [cropDay(MONDAY, [crop({ etmMm: 0 }), crop({ referenceCropId: 'profonde', etmMm: 0 })])],
    observations: [observation(100, MONDAY_MIDNIGHT)],
  }));
  close(days[0].depthM, 0.5);
  close(days[0].capacityMm, 31);
});

test('scénario 7 : la dose au-delà de ce que le sol retient', () => {
  const days = bedSoilReserve(soilInput({
    today: MONDAY,
    waterDays: [cropDay(MONDAY, [crop({ etmMm: 0 })])],
    observations: [observation(Math.round(20 / 31 * 1e6) / 1e4, MONDAY_MIDNIGHT)],
  }));
  close(days[0].startMm, 20, 2);
  const slot = irrigation(MONDAY_MIDNIGHT, '2026-06-01T00:00:00.000Z', 15, 'planned');
  close(doseBeyondSoilMm(days[0], slot, [slot]), 4, 2);
  const small = irrigation(MONDAY_MIDNIGHT, '2026-06-01T00:00:00.000Z', 5, 'planned');
  assert.equal(doseBeyondSoilMm(days[0], small, [small]), null);
});

test('scénario 8 : la moyenne du jardin est pondérée par la surface, la planche la plus basse nommée', () => {
  const summary = gardenSoilSummary([
    { bedId: 'a', bedName: 'A', areaSquareMeters: 10, mode: 'crop', surfaceState: null, surfaceStateDeclared: false, stateMm: 31, capacityMm: 31 },
    { bedId: 'b', bedName: 'B', areaSquareMeters: 30, mode: 'crop', surfaceState: null, surfaceStateDeclared: false, stateMm: 0, capacityMm: 62 },
    { bedId: 'c', bedName: 'C', areaSquareMeters: 30, mode: 'crop', surfaceState: null, surfaceStateDeclared: false, stateMm: null, capacityMm: 62 },
    { bedId: 'd', bedName: 'D', areaSquareMeters: 30, mode: 'bare', surfaceState: 'bare', surfaceStateDeclared: false, stateMm: 10, capacityMm: 15 },
  ]);
  close(summary.percent, 310 / 2170 * 100);
  assert.equal(Math.round(summary.percent ?? 0), 14);
  assert.equal(summary.lowest?.bedName, 'B');
  assert.equal(summary.unknownBeds, 1);
  assert.deepEqual(summary.withoutCrop, [{ bedId: 'd', bedName: 'D', surfaceState: 'bare', declared: false }]);
});

test('scénario 9 : le curseur de parcelle règle le plein champ, celui du jardin son seul jardin, jamais l’abri', () => {
  const [monday, tuesday] = dates(MONDAY, 2);
  const water = [cropDay(monday, [crop({ etmMm: 0 })]), cropDay(tuesday, [crop({ etmMm: 0 })])];
  const observations = [
    observation(100, '2026-06-01T06:00:00.000Z', null),
    observation(40, '2026-06-01T10:00:00.000Z', BED.plotId),
    observation(70, '2026-06-01T06:00:00.000Z', SHELTER_BED.plotId),
    observation(90, '2026-06-02T06:00:00.000Z', null),
  ];
  const inGarden = bedSoilReserve(soilInput({ waterDays: water, observations }));
  close(at(inGarden, monday).stateMm, 31 * 0.4);
  close(at(inGarden, tuesday).stateMm, 31 * 0.9);
  const otherGarden = bedSoilReserve(soilInput({ bed: { ...BED, id: 'planche-b', plotId: 'jardin-b' }, waterDays: water, observations }));
  close(at(otherGarden, monday).stateMm, 31);
  const shelter = bedSoilReserve(soilInput({ bed: SHELTER_BED, waterDays: water, observations }));
  close(at(shelter, monday).stateMm, 31 * 0.7);
  // Le curseur de parcelle du mardi ne règle pas l’abri.
  close(at(shelter, tuesday).stateMm, 31 * 0.7);
});

test('scénario 10 : la RFU du sol corrigée des cailloux ; sans cailloux renseignés, 62 mm/m avec la mention', () => {
  assert.equal(soilRfuMmPerMeter(62, 18), 51);
  assert.equal(soilRfuMmPerMeter(62, null), 62);
  const soil = resolveBedSoil([soilRecord({ stoneSharePercent: null })], BED, MONDAY);
  assert.equal(soil?.stonesMissing, true);
  const days = bedSoilReserve(soilInput({ soilRecords: [soilRecord({ stoneSharePercent: null })], waterDays: [cropDay(MONDAY, [crop()])] }));
  assert.equal(days[0].mentions.stonesMissing, true);
});

test('le sol : bornes de la saisie et avertissement de vraisemblance au-delà de 200 mm/m', () => {
  assert.deepEqual(soilRecordProblems(FARM_SOIL), []);
  assert.equal(soilRecordProblems({ ...FARM_SOIL, labRfuMmPerMeter: 0 }).length, 1);
  assert.equal(soilRecordProblems({ ...FARM_SOIL, stoneSharePercent: 100 }).length, 1);
  assert.equal(soilRecordProblems({ ...FARM_SOIL, referenceShare: 1 }).length, 1);
  assert.equal(soilRecordProblems({ ...FARM_SOIL, rewMm: 14 }).length, 1);
  assert.equal(soilRecordProblems({ ...FARM_SOIL, soilDepthCeilingM: 0 }).length, 1);
  assert.equal(labRfuWarning(62), null);
  assert.match(labRfuWarning(310) ?? '', /mm par mètre de sol/);
  const revised = resolveBedSoil([FARM_SOIL, { ...FARM_SOIL, labRfuMmPerMeter: 70, effectiveFrom: '2026-06-02' }], BED, MONDAY);
  assert.equal(revised?.record.labRfuMmPerMeter, 62, 'une révision vaut à partir de son jour');
});

test('scénario 11 : capacité et seuil des cultures de la ferme, part de référence 2/3', () => {
  const share = 2 / 3;
  const crop = { mode: 'crop' } as const;
  close(51 * 0.65, 33.15);
  close(thresholdMm(51 * 0.65, 0.4, share, crop), 13.26);
  close(thresholdMm(51 * 0.5, 0.5, share, crop), 6.375);
  close(thresholdMm(51 * 0.25, 0.3, share, crop), 7.0125);
  close(thresholdMm(51 * 0.25, 0.2, share, crop), 8.925);
  close(thresholdMm(51 * 0.7, 0.35, share, crop), 16.9575);
});

test('scénario 12 : la profondeur suit le stade de la tomate, et la jauge garde son % au changement de stade', () => {
  // Tomate plantée en 2026-W20 (lundi 11 mai) : stade 1 dès le 11 mai, stade 2 au 26 mai (J+15), stade 3 au 10 juin (J+30).
  const tomatoes = series('tomate', [cultivation('tomate-c', 'plant-tomate', 'Tomate', { expected: ['2026-W35'] })]);
  const plan = {
    series: [tomatoes],
    places: [{ id: 'place', seriesId: 'tomate', bedId: BED.id, lengthMeters: null }],
    implantationTasks: [task('tomate', 'planting', '2026-W20')],
  };
  const followed = dates('2026-05-24', 20);
  const { days: water } = bedWaterDays({
    bedId: BED.id,
    today: '2026-07-01',
    cropPlan: plan,
    referenceCrops: [TOMATO],
    correspondences: [{ plantId: 'plant-tomate', seriesId: null, target: { kind: 'reference', referenceCropId: TOMATO.id, analogy: false } }],
    overrides: [],
    declarations: [],
    et0Readings: followed.map((date) => ({ date, reanalysisMm: 0, forecastMm: null })),
    settings: { bedId: BED.id, shelterId: null, shelterFactors: [], mulch: [], shadeNets: [] },
  }, followed);
  const tomatoProfile = profile(TOMATO.id, 0.4, [fixed(1, 0.2), fixed(2, 0.45), fixed(3, 0.65), fixed(4, 0.65)]);
  const days = bedSoilReserve(soilInput({
    soilRecords: [FARM_SOIL],
    rootingProfiles: [tomatoProfile],
    waterDays: water,
    observations: [observation(50, '2026-05-23T22:00:00.000Z')],
    rain: dryDays(followed),
  }));
  close(at(days, '2026-05-24').capacityMm, 10.2);
  close(at(days, '2026-05-25').stateMm, 5.1);
  close(at(days, '2026-05-26').capacityMm, 22.95);
  close(at(days, '2026-05-26').startMm, 11.475);
  close(at(days, '2026-06-10').capacityMm, 33.15);
  close(at(days, '2026-06-10').percent, 50);
});

test('scénario 13 : bilan jour par jour et jours avant le seuil au rythme des trois derniers jours', () => {
  const tomato = profile('tomate', 0.4, [fixed(null, 0.65)]);
  const followed = dates(MONDAY, 7);
  const days = bedSoilReserve(soilInput({
    today: followed[6],
    soilRecords: [FARM_SOIL],
    rootingProfiles: [tomato],
    waterDays: followed.map((date) => cropDay(date, [crop({ referenceCropId: 'tomate', etmMm: 3.5 })])),
    observations: [observation(100, MONDAY_MIDNIGHT)],
    rain: dryDays(followed),
  }));
  assert.deepEqual(days.map((day) => Number(day.stateMm?.toFixed(2))), [29.65, 26.15, 22.65, 19.15, 15.65, 12.15, 8.65]);
  close(days[0].thresholdMm, 13.26);
  const summaryDayZero = soilReserveSummary(days.slice(0, 1), MONDAY);
  assert.equal(summaryDayZero.daysBeforeThreshold, null, 'sans trois jours connus avant, pas de rythme');
  const atDayFour = soilReserveSummary(days.slice(0, 5), followed[3]);
  // Jeudi matin, 22,65 mm : (22,65 − 13,26) / 3,5 = 2,7 jours, affiché 2 ; la jauge passe sous le seuil samedi.
  assert.deepEqual(atDayFour.daysBeforeThreshold, { kind: 'pace', days: 2, paceMm: 3.5 });
  const atDaySix = soilReserveSummary(days, followed[6]);
  assert.equal(atDaySix.thresholdDay, followed[5], 'le jour où la jauge est passée sous le seuil');
});

test('scénario 13 : au jour 0, cinq jours avant le seuil, partie entière', () => {
  const tomato = profile('tomate', 0.4, [fixed(null, 0.65)]);
  const before = dates('2026-05-29', 3);
  const days = bedSoilReserve(soilInput({
    today: MONDAY,
    soilRecords: [FARM_SOIL],
    rootingProfiles: [tomato],
    waterDays: [...before, MONDAY].map((date) => cropDay(date, [crop({ referenceCropId: 'tomate', etmMm: date === MONDAY ? 0 : 3.5 })])),
    observations: [observation(100, MONDAY_MIDNIGHT)],
    rain: dryDays([...before, MONDAY]),
  }));
  const summary = soilReserveSummary(days, MONDAY);
  close(summary.current?.mm, 33.15);
  // (33,15 − 13,26) / 3,5 = 5,7 jours : affiché 5.
  assert.deepEqual(summary.daysBeforeThreshold, { kind: 'pace', days: 5, paceMm: 3.5 });
});

test('scénario 14 : le plafond, l’eau au-delà de la capacité est drainée', () => {
  const tomato = profile('tomate', 0.4, [fixed(null, 0.65)]);
  const days = bedSoilReserve(soilInput({
    soilRecords: [FARM_SOIL],
    rootingProfiles: [tomato],
    waterDays: [cropDay(MONDAY, [crop({ referenceCropId: 'tomate', etmMm: 0 })])],
    observations: [observation(30 / 33.15 * 100, MONDAY_MIDNIGHT)],
    irrigations: [irrigation('2026-06-01T05:00:00.000Z', '2026-06-01T06:00:00.000Z', 10)],
  }));
  close(days[0].stateMm, 33.15);
  close(days[0].drainageMm, 6.85);
});

test('scénario 15 : sous le seuil, la dose conseillée refait le plein ; rien ne change la priorité', () => {
  const tomato = profile('tomate', 0.4, [fixed(null, 0.65)]);
  const days = bedSoilReserve(soilInput({
    today: MONDAY,
    soilRecords: [FARM_SOIL],
    rootingProfiles: [tomato],
    waterDays: [cropDay(MONDAY, [crop({ referenceCropId: 'tomate', etmMm: 0 })])],
    observations: [observation(4.5 / 33.15 * 100, MONDAY_MIDNIGHT)],
  }));
  const summary = soilReserveSummary(days, MONDAY);
  close(summary.advisedDoseMm, 28.65);
  assert.equal(summary.thresholdDay, MONDAY);
});

test('scénario 16 : une culture sans profondeur saisie reçoit 30 cm proposés, avec l’avertissement', () => {
  const days = bedSoilReserve(soilInput({
    today: MONDAY,
    soilRecords: [FARM_SOIL],
    rootingProfiles: [],
    waterDays: [cropDay(MONDAY, [crop({ referenceCropId: 'navet', name: 'Navet', etmMm: 0 })])],
    observations: [observation(100, MONDAY_MIDNIGHT)],
  }));
  close(days[0].capacityMm, 15.3);
  assert.equal(days[0].crops[0].proposedDepth, true);
  assert.equal(days[0].p, 0.5);
  assert.deepEqual(soilReserveSummary(days, MONDAY).proposedDepthCrops, ['Navet']);
});

test('scénario 17 : sans observation, un jour d’apports qui atteint la capacité fait partir la jauge pleine', () => {
  const [monday, tuesday, wednesday] = dates(MONDAY, 3);
  const courgette = profile('courgette', 0.5, [fixed(null, 0.5)]);
  const days = bedSoilReserve(soilInput({
    soilRecords: [FARM_SOIL],
    rootingProfiles: [courgette],
    waterDays: [monday, tuesday, wednesday].map((date) => cropDay(date, [crop({ referenceCropId: 'courgette', etmMm: 3 })])),
    rain: rain({ [monday]: 10, [tuesday]: 30, [wednesday]: 0 }),
  }));
  assert.deepEqual(at(days, monday).unknown, { kind: 'not-started' });
  close(at(days, tuesday).stateMm, 25.5);
  assert.equal(at(days, tuesday).restart, 'inflow');
  close(at(days, wednesday).stateMm, 22.5);
});

test('scénario 32 : deux cultures, un seuil : la capacité de la moins profonde, la part p de la plus sensible', () => {
  const days = bedSoilReserve(soilInput({
    soilRecords: [FARM_SOIL],
    rootingProfiles: [profile('tomate', 0.4, [fixed(null, 0.65)]), profile('epinard', 0.2, [fixed(null, 0.25)])],
    waterDays: [cropDay(MONDAY, [crop({ referenceCropId: 'tomate', etmMm: 0 }), crop({ referenceCropId: 'epinard', etmMm: 0 })])],
    observations: [observation(100, MONDAY_MIDNIGHT)],
  }));
  close(days[0].capacityMm, 12.75);
  close(days[0].thresholdMm, 8.925);
});

test('scénario 33 : arrêt avant récolte, ni seuil atteint ni dose conseillée', () => {
  const garlic = profile('ail', 0.3, [fixed(null, 0.3)]);
  const followed = dates(MONDAY, 3);
  const days = bedSoilReserve(soilInput({
    today: followed[2],
    soilRecords: [FARM_SOIL],
    rootingProfiles: [garlic],
    waterDays: followed.map((date) => cropDay(date, [crop({ referenceCropId: 'ail', etmMm: 0, kc: 0 })])),
    observations: [observation(6 / 15.3 * 100, MONDAY_MIDNIGHT)],
    rain: dryDays(followed),
  }));
  close(days[0].capacityMm, 15.3);
  close(days[0].thresholdMm, 8.415);
  close(days[2].stateMm, 6);
  const summary = soilReserveSummary(days, followed[2]);
  assert.equal(summary.irrigationStop, true);
  assert.equal(summary.thresholdDay, null);
  assert.equal(summary.advisedDoseMm, null);
});

test('scénario 34 : sous paillage plastique, la pluie comptée en entier par défaut, ou selon la part réglée', () => {
  const water = [cropDay(MONDAY, [crop({ etmMm: 0 })])];
  const mulch = { bedId: BED.id, shelterId: null, shelterFactors: [], mulch: [{ bedId: BED.id, season: 2026, plasticMulch: true }] };
  const full = bedSoilReserve(soilInput({ waterDays: water, waterSettings: mulch, rain: rain({ [MONDAY]: 20 }), observations: [observation(0, MONDAY_MIDNIGHT)] }));
  close(full[0].rainMm, 20);
  assert.equal(full[0].mentions.mulchRainShare, 1);
  const half = { ...farmThreshold(50), threshold: { mode: 'crop' as const }, plasticMulchRainShare: 0.5 };
  const reduced = bedSoilReserve(soilInput({ waterDays: water, waterSettings: mulch, settings: [half], rain: rain({ [MONDAY]: 20 }), observations: [observation(0, MONDAY_MIDNIGHT)] }));
  close(reduced[0].rainMm, 10);
  assert.equal(reduced[0].mentions.mulchRainShare, 0.5);
});

test('scénario 35 : le jour du seuil donné par la jauge prévue, même si le rythme des trois derniers jours dit autre chose', () => {
  const tomato = profile('tomate', 0.4, [fixed(null, 0.65)]);
  const before = dates('2026-05-29', 3);
  const week = dates(MONDAY, 7);
  const days = bedSoilReserve(soilInput({
    today: MONDAY,
    soilRecords: [FARM_SOIL],
    rootingProfiles: [tomato],
    waterDays: [
      ...before.map((date) => cropDay(date, [crop({ referenceCropId: 'tomate', etmMm: 3.5 })])),
      ...week.map((date) => cropDay(date, [crop({ referenceCropId: 'tomate', etmMm: 5 })], { mm: 5, nature: 'forecast' })),
    ],
    observations: [observation(100, MONDAY_MIDNIGHT)],
    rain: dryDays([...before, ...week]),
  }));
  assert.deepEqual(week.slice(0, 4).map((date) => Number(at(days, date).stateMm?.toFixed(2))), [28.15, 23.15, 18.15, 13.15]);
  const summary = soilReserveSummary(days, MONDAY);
  assert.equal(summary.thresholdDay, week[3], 'jeudi');
  assert.deepEqual(summary.daysBeforeThreshold, { kind: 'forecast', date: week[3] });
  assert.equal(at(days, MONDAY).nature, 'forecast');
});

test('la pluie prévue est réduite à la part retenue par le planning (R2)', () => {
  const days = bedSoilReserve(soilInput({
    today: MONDAY,
    waterDays: [cropDay(MONDAY, [crop({ etmMm: 0 })])],
    rain: rain({ [MONDAY]: 10 }, 'forecast'),
    forecastRainShare: 0.5,
    observations: [observation(0, MONDAY_MIDNIGHT)],
  }));
  close(days[0].rainMm, 5);
});

test('scénario 36 : profondeur progressive de la carotte au stade 2', () => {
  const carrot = profile('carotte', 0.35, [fixed(1, 0.2), progressive(2, 0.4, 0.7, 40)]);
  // Semis le 1er avril : le stade 2 commence au 1er mai (J+30) ; J+50 = 21 mai, 20 jours dans le stade.
  const stage = staged(2, '2026-05-01');
  const rooting = cropRooting(carrot, stage, '2026-05-21');
  close(rooting.depthM, 0.55);
  close(51 * rooting.depthM, 28.05);
  close(thresholdMm(51 * rooting.depthM, 0.35, 2 / 3, { mode: 'crop' }), 13.32375);
  close(cropRooting(carrot, stage, '2026-06-20').depthM, 0.7);
});

test('scénario 37 : un trou de données puis un jour d’apports qui remplit la planche', () => {
  const [monday, tuesday, wednesday, thursday] = dates(MONDAY, 4);
  const courgette = profile('courgette', 0.5, [fixed(null, 0.5)]);
  const days = bedSoilReserve(soilInput({
    soilRecords: [FARM_SOIL],
    rootingProfiles: [courgette],
    waterDays: [
      cropDay(monday, [crop({ referenceCropId: 'courgette', etmMm: 3 })]),
      cropDay(tuesday, [crop({ referenceCropId: 'courgette', etmMm: 3 })]),
      cropDay(wednesday, [crop({ referenceCropId: 'courgette', etmMm: null })], null),
      cropDay(thursday, [crop({ referenceCropId: 'courgette', etmMm: 3 })]),
    ],
    observations: [observation(100, MONDAY_MIDNIGHT)],
    rain: rain({ [monday]: 0, [tuesday]: 0, [wednesday]: 0, [thursday]: 30 }),
  }));
  assert.deepEqual(at(days, wednesday).unknown, { kind: 'missing-et0', date: wednesday });
  close(at(days, thursday).stateMm, 25.5);
  assert.equal(at(days, thursday).restart, 'inflow');
});

test('scénario 38 : le plafond de sol borne la profondeur ; vide, il ne limite rien', () => {
  close(cappedDepth(0.65, 0.5), 0.5);
  close(51 * cappedDepth(0.65, 0.5), 25.5);
  close(51 * cappedDepth(0.6, 0.4), 20.4);
  close(cappedDepth(0.65, null), 0.65);
  const days = bedSoilReserve(soilInput({
    soilRecords: [{ ...FARM_SOIL, soilDepthCeilingM: 0.5 }],
    rootingProfiles: [profile('tomate', 0.4, [fixed(null, 0.65)])],
    waterDays: [cropDay(MONDAY, [crop({ referenceCropId: 'tomate', etmMm: 0 })])],
    observations: [observation(100, MONDAY_MIDNIGHT)],
  }));
  close(days[0].depthM, 0.5);
  close(days[0].capacityMm, 25.5);
});

test('scénario 39 : melon et asperge plafonnés à 0,60 m', () => {
  close(51 * 0.6, 30.6);
  close(thresholdMm(30.6, 0.4, 2 / 3, { mode: 'crop' }), 12.24);
  close(thresholdMm(30.6, 0.45, 2 / 3, { mode: 'crop' }), 9.945);
});

test('scénario 40 : culture de la FAO, profondeur progressive depuis l’origine du cycle', () => {
  const broccoli = profile('fao-brocoli', 0.45, [progressive(null, 0.2, 0.4, 50)]);
  const lengths = { initial: 20, development: 30, mid: 20, late: 10 };
  const at25 = staged(2, '2026-05-21', { position: { shape: 'trapezoid', rank: 2, daysSinceOrigin: 25, lengths } });
  close(cropRooting(broccoli, at25, '2026-05-26').depthM, 0.3);
  close(51 * cropRooting(broccoli, at25, '2026-05-26').depthM, 15.3);
  const at60 = staged(3, '2026-06-20', { position: { shape: 'trapezoid', rank: 3, daysSinceOrigin: 60, lengths } });
  close(cropRooting(broccoli, at60, '2026-06-30').depthM, 0.4);
});

test('scénario 41 : toutes les parts p donnent un seuil sous 100 %, 25 % pour les moins sensibles', () => {
  for (const p of [0.2, 0.3, 0.35, 0.4, 0.45, 0.5]) assert.ok(cropThresholdPercent(p, 2 / 3) < 100);
  close(cropThresholdPercent(0.5, 2 / 3), 25);
  close(cropThresholdPercent(0.2, 2 / 3), 70);
  close(cropThresholdPercent(0.3, 2 / 3), 55);
});

test('D-059 : le seuil réglé par l’exploitation remplace la formule par culture, de 20 à 80 % par pas de 5 %', () => {
  close(thresholdMm(33.15, 0.4, 2 / 3, { mode: 'farm', percent: 50 }), 16.575);
  const days = bedSoilReserve(soilInput({
    soilRecords: [FARM_SOIL],
    settings: [farmThreshold(30)],
    rootingProfiles: [profile('laitue', 0.3, [fixed(null, 0.25)])],
    waterDays: [cropDay(MONDAY, [crop({ referenceCropId: 'laitue', etmMm: 0 })])],
    observations: [observation(100, MONDAY_MIDNIGHT)],
  }));
  close(days[0].thresholdMm, 12.75 * 0.3);
  // Le seuil de la laitue selon la culture, rappelé à côté.
  close(days[0].cropThresholdPercent, 55);
  assert.deepEqual(soilSettingsProblems(DEFAULT_SOIL_SETTINGS), []);
  assert.deepEqual(soilSettingsProblems({ ...DEFAULT_SOIL_SETTINGS, threshold: { mode: 'farm', percent: FARM_THRESHOLD.proposedPercent } }), []);
  for (const percent of [15, 85, 52, 50.5]) {
    assert.equal(soilSettingsProblems({ ...DEFAULT_SOIL_SETTINGS, threshold: { mode: 'farm', percent } }).length, 1, `${percent} %`);
  }
  assert.equal(soilSettingsProblems({ ...DEFAULT_SOIL_SETTINGS, plasticMulchRainShare: 1.2 }).length, 1);
});

test('les profils racinaires : bornes de la saisie et profondeur progressive', () => {
  assert.deepEqual(rootingProfileProblems(profile('carotte', 0.35, [fixed(1, 0.2), progressive(2, 0.4, 0.7, 40)]), 'Carotte'), []);
  assert.equal(rootingProfileProblems(profile('x', 1, [fixed(null, 0.3)]), 'X').length, 1);
  assert.equal(rootingProfileProblems(profile('x', 0.3, [fixed(null, 0)]), 'X').length, 1);
  assert.equal(rootingProfileProblems(profile('x', 0.3, [fixed(1, 0.2), fixed(1, 0.3)]), 'X').length, 1);
  assert.equal(rootingProfileProblems(profile('x', 0.3, [{ rank: 1, depthM: 0.2, endDepthM: 0.4, progressionDays: null }]), 'X').length, 1);
  close(rowDepth(progressive(1, 0.2, 0.35, 60), 30), 0.275);
  close(rowDepth(progressive(1, 0.2, 0.35, 60), 90), 0.35);
});
