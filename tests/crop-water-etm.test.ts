import assert from 'node:assert/strict';
import test from 'node:test';
import type { CropSeries, ImplantationTask } from '../lib/domain/domain.ts';
import {
  et0OfDay,
  mulchFactorOn,
  shadeNetProblem,
  shadeOn,
  shelterFactorOn,
  shelterFactorSettingProblem,
  type BedWaterSettings,
  type CropWaterDay,
  type Et0Reading,
} from '../lib/domain/crop-water/etm.ts';
import type { KcOverride } from '../lib/domain/crop-water/kc.ts';
import { bedWaterDays, type BedCropWaterInput, type BedWaterDay } from '../lib/domain/crop-water/proposal.ts';
import type { CorrespondenceEntry } from '../lib/domain/crop-water/species.ts';
import type { StageDeclaration } from '../lib/domain/crop-water/stage.ts';
import {
  BROCCOLI,
  CARROT,
  cultivation,
  GARLIC,
  GREEN_ONION,
  PEPPER,
  REFERENCE_CROPS,
  series,
  SUMMER_SALAD,
  task,
  TOMATO,
} from './support/crop-water-references.ts';

/**
 * L'ETM du jour, culture par culture et pour la planche
 * (docs/crop-water-need-contract.md, « Le calcul du jour », « Les
 * garde-fous ») : scénarios 1 à 4, 7, 9, 12, 19 et 21 du contrat.
 */

const BED = 'planche-a';

const reference = (plantId: string, referenceCropId: string, seriesId: string | null = null, analogy = false): CorrespondenceEntry => ({
  plantId,
  seriesId,
  target: { kind: 'reference', referenceCropId, analogy },
});

const CORRESPONDENCES: CorrespondenceEntry[] = [
  reference('plant-tomate', TOMATO.id),
  reference('plant-carotte', CARROT.id),
  reference('plant-ail', GARLIC.id),
  reference('plant-ail', GREEN_ONION.id, 'aillet'),
  reference('plant-poivron', PEPPER.id),
  reference('plant-laitue', SUMMER_SALAD.id),
  reference('plant-mache', SUMMER_SALAD.id, null, true),
  reference('plant-brocoli', BROCCOLI.id),
  { plantId: 'plant-zinnia', seriesId: null, target: { kind: 'without-reference' } },
  { plantId: 'plant-engrais-vert', seriesId: null, target: { kind: 'surface-state' } },
];

const OPEN_FIELD: BedWaterSettings = { bedId: BED, shelterId: null, shelterFactors: [], mulch: [], shadeNets: [] };
const SHELTERED: BedWaterSettings = { ...OPEN_FIELD, shelterId: 'jardin-serre' };

function input(
  seriesList: CropSeries[],
  tasks: ImplantationTask[],
  et0Readings: Et0Reading[],
  options: Partial<Pick<BedCropWaterInput, 'today' | 'settings' | 'options' | 'overrides' | 'declarations' | 'referenceCrops'>> = {},
): BedCropWaterInput {
  return {
    bedId: BED,
    today: options.today ?? '2026-11-05',
    cropPlan: {
      series: seriesList,
      places: seriesList.map((item) => ({ id: `place-${item.id}`, seriesId: item.id, bedId: BED, lengthMeters: null })),
      implantationTasks: tasks,
    },
    referenceCrops: options.referenceCrops ?? REFERENCE_CROPS,
    correspondences: CORRESPONDENCES,
    overrides: options.overrides ?? [],
    declarations: options.declarations ?? [],
    et0Readings,
    settings: options.settings ?? OPEN_FIELD,
    options: options.options,
  };
}

const reanalysis = (date: string, mm: number | null): Et0Reading => ({ date, reanalysisMm: mm, forecastMm: null });
const forecast = (date: string, mm: number | null): Et0Reading => ({ date, reanalysisMm: null, forecastMm: mm });

function oneDay(bedInput: BedCropWaterInput, date: string): BedWaterDay {
  const { days } = bedWaterDays(bedInput, [date]);
  return days[0];
}

function computed(crop: CropWaterDay | undefined): Extract<CropWaterDay, { status: 'computed' }> {
  assert.equal(crop?.status, 'computed', JSON.stringify(crop));
  return crop as Extract<CropWaterDay, { status: 'computed' }>;
}

const round = (value: number | null, decimals = 2) => (value === null ? null : Math.round(value * 10 ** decimals) / 10 ** decimals);

const tomatoSeries = series('tomate', [cultivation('tomate-c', 'plant-tomate', 'Tomate', { expected: ['2026-W27', '2026-W40'] })]);
const tomatoTasks = [task('tomate', 'planting', '2026-W17')];
const carrotSeries = series('carotte', [cultivation('carotte-c', 'plant-carotte', 'Carotte', { expected: ['2026-W26'] })]);
const carrotTasks = [task('carotte', 'direct-sowing', '2026-W10')];
const garlicSeries = series('ail-sec', [cultivation('ail-c', 'plant-ail', 'Ail', { expected: ['2026-W28'] })]);
const garlicTasks = [task('ail-sec', 'planting', '2025-W44')];

test('scénario 1 : tomate sous abri, K_abri 0,8, Kc 0,6, ET0 7,3 : 3,50 mm/j', () => {
  const day = oneDay(input([tomatoSeries], tomatoTasks, [forecast('2026-05-11', 7.3)], { today: '2026-05-11', settings: SHELTERED }), '2026-05-11');
  assert.equal(day.status, 'computed');
  assert.equal(round(day.etmMm), 3.5);
  const tomato = computed(day.crops[0]);
  assert.equal(tomato.trace.kc.kc, 0.6);
  assert.equal(tomato.trace.shelterFactor, 0.8);
  assert.equal(tomato.trace.source, 'criiam');
  assert.equal(tomato.trace.stage.label, 'Reprise → Floraison 3e bouquet');
  assert.equal(tomato.trace.stage.origin, 'calculated');
  assert.deepEqual(tomato.et0, { mm: 7.3, nature: 'forecast' });
});

test('scénarios 2 et 3 : carotte en plein champ, ET0 5,0 : 5,0 mm/j au jour 45, 2,5 mm/j au jour 10', () => {
  const readings = [reanalysis('2026-04-16', 5), reanalysis('2026-03-12', 5)];
  assert.equal(oneDay(input([carrotSeries], carrotTasks, readings), '2026-04-16').etmMm, 5);
  assert.equal(oneDay(input([carrotSeries], carrotTasks, readings), '2026-03-12').etmMm, 2.5);
});

test('scénario 4 : ail dix jours avant sa récolte, Kc 0 : 0 mm/j, planche marquée « arrêt d\'irrigation avant récolte »', () => {
  const day = oneDay(input([garlicSeries], garlicTasks, [reanalysis('2026-07-02', 6)]), '2026-07-02');
  assert.equal(day.status, 'computed');
  assert.equal(day.etmMm, 0);
  assert.equal(day.irrigationStop, true);
  assert.equal(computed(day.crops[0]).irrigationStop, true);
});

test('scénario 7 : poivron sous filet de 45 %, ombrage activé 3,1 mm/j, désactivé 4,2 mm/j', () => {
  const pepperSeries = series('poivron', [cultivation('poivron-c', 'plant-poivron', 'Poivron', { expected: ['2026-W30', '2026-W40'] })]);
  const tasks = [task('poivron', 'planting', '2026-W17')];
  const settings: BedWaterSettings = { ...OPEN_FIELD, shadeNets: [{ bedId: BED, rate: 0.45, from: '2026-06-01', to: null }] };
  const readings = [reanalysis('2026-06-15', 6)];
  const shaded = oneDay(input([pepperSeries], tasks, readings, { settings, options: { smoothing: false, shading: true } }), '2026-06-15');
  assert.equal(computed(shaded.crops[0]).trace.kc.kc, 0.7);
  assert.equal(round(computed(shaded.crops[0]).trace.shadeFactor, 3), 0.742);
  assert.equal(computed(shaded.crops[0]).trace.shadeNetRate, 0.45, 'une hypothèse, affichée comme telle');
  assert.equal(round(shaded.etmMm, 1), 3.1);
  const plain = oneDay(input([pepperSeries], tasks, readings, { settings }), '2026-06-15');
  assert.equal(round(plain.etmMm, 1), 4.2);
  assert.equal(computed(plain.crops[0]).trace.shadeNetRate, null);
});

test('scénario 9 : l\'ET0 d\'un jour passé sans réanalyse est la prévision enregistrée, marquée estimée ; sans rien, l\'ETM est inconnue', () => {
  assert.deepEqual(et0OfDay({ reanalysisMm: 4, forecastMm: 5 }, '2026-04-15', '2026-04-20'), { mm: 4, nature: 'reanalysis' });
  assert.deepEqual(et0OfDay({ reanalysisMm: null, forecastMm: 5 }, '2026-04-15', '2026-04-20'), { mm: 5, nature: 'estimated' });
  assert.deepEqual(et0OfDay({ reanalysisMm: 4, forecastMm: 5 }, '2026-04-20', '2026-04-20'), { mm: 5, nature: 'forecast' });
  assert.equal(et0OfDay({ reanalysisMm: 4, forecastMm: null }, '2026-04-21', '2026-04-20'), null, 'un jour à venir ne lit que la prévision');
  assert.equal(et0OfDay({ reanalysisMm: null, forecastMm: null }, '2026-04-15', '2026-04-20'), null);
  assert.equal(et0OfDay(undefined, '2026-04-15', '2026-04-20'), null);

  const estimated = oneDay(input([carrotSeries], carrotTasks, [forecast('2026-04-15', 4)], { today: '2026-04-20' }), '2026-04-15');
  assert.deepEqual(estimated.et0, { mm: 4, nature: 'estimated' });
  assert.equal(estimated.etmMm, 4);
  const unknown = oneDay(input([carrotSeries], carrotTasks, [], { today: '2026-04-20' }), '2026-04-15');
  assert.equal(unknown.status, 'unknown');
  assert.equal(unknown.etmMm, null, 'jamais 0');
  assert.equal(unknown.crops[0].status, 'unknown');
});

test('scénario 12 : une salade à 2,8 mm/j et une tomate à 3,5 mm/j sur la même planche : la planche prend 3,5 mm/j', () => {
  const saladSeries = series('salade', [cultivation('salade-c', 'plant-laitue', 'Laitue', { expected: ['2026-W24'] })]);
  const tasks = [...tomatoTasks, task('salade', 'planting', '2026-W17')];
  // 26 mai, plein champ, ET0 4 : salade au 2e stade (Kc 0,7) à 2,8 mm/j, tomate au 3e (Kc 0,9) à 3,6 mm/j.
  const day = oneDay(input([saladSeries, tomatoSeries], tasks, [reanalysis('2026-05-26', 4)]), '2026-05-26');
  const [salad, tomato] = day.crops.map(computed);
  assert.equal(round(salad.etmMm), 2.8);
  assert.equal(round(tomato.etmMm), 3.6);
  assert.equal(round(day.etmMm), 3.6);

  const scenario = oneDay(input([saladSeries, tomatoSeries], tasks, [reanalysis('2026-05-13', 4)], { settings: SHELTERED }), '2026-05-13');
  // Sous abri, ET0 4 × 0,8 : salade 0,7 → 2,24 ; tomate 0,6 → 1,92. La planche prend la plus élevée.
  assert.equal(round(scenario.etmMm), 2.24);
  assert.equal(scenario.status, 'computed');
});

test('scénario 19 : l\'ail sec et l\'aillet de la même espèce, dix jours avant leur récolte : 0 pour l\'un, Kc positif pour l\'autre', () => {
  const aillet = series('aillet', [cultivation('aillet-c', 'plant-ail', 'Ail', { expected: ['2026-W28'] })]);
  const tasks = [...garlicTasks, task('aillet', 'planting', '2025-W44')];
  const day = oneDay(input([garlicSeries, aillet], tasks, [reanalysis('2026-07-02', 6)]), '2026-07-02');
  const [dry, green] = day.crops.map(computed);
  assert.equal(dry.trace.kc.kc, 0);
  assert.equal(dry.trace.exception, false);
  assert.equal(green.trace.referenceCropName, 'Oignon vert');
  assert.equal(green.trace.source, 'fao56');
  assert.equal(green.trace.exception, true);
  assert.equal(green.trace.kc.kc, 1);
  assert.equal(day.etmMm, 6);
  assert.equal(day.irrigationStop, false, 'l\'aillet a encore soif');
});

test('scénario 21 et 10 : une planche de zinnia, ou d\'une espèce sans correspondance, n\'a pas d\'ETM ; la culture est nommée', () => {
  const zinnia = series('zinnia', [cultivation('zinnia-c', 'plant-zinnia', 'Zinnia', { expected: ['2026-W30'] })]);
  const day = oneDay(input([zinnia], [task('zinnia', 'planting', '2026-W20')], [reanalysis('2026-06-15', 5)]), '2026-06-15');
  assert.equal(day.status, 'no-etm');
  assert.equal(day.etmMm, null, 'la jauge de la 5 ter y est inconnue');
  assert.deepEqual(day.crops.map((crop) => [crop.plantName, crop.status === 'no-etm' && crop.reason]), [['Zinnia', 'without-reference']]);

  const unknownSpecies = series('physalis', [cultivation('physalis-c', 'plant-physalis', 'Physalis', { expected: ['2026-W30'] })]);
  const mixed = oneDay(input([unknownSpecies, tomatoSeries], [task('physalis', 'planting', '2026-W20'), ...tomatoTasks], [reanalysis('2026-06-15', 5)]), '2026-06-15');
  assert.equal(mixed.status, 'partial', 'rien ne s\'arrête : la tomate a son ETM');
  assert.equal(mixed.etmMm, 4.5);
  assert.deepEqual(mixed.crops.filter((crop) => crop.status === 'no-etm').map((crop) => crop.plantName), ['Physalis']);
});

test('l\'engrais vert est l\'état de la surface d\'une planche nue : la planche compte 0, sans culture à Kc', () => {
  const greenManure = series('engrais-vert', [cultivation('ev', 'plant-engrais-vert', 'Engrais vert', { expected: ['2026-W40'] })]);
  const day = oneDay(input([greenManure], [task('engrais-vert', 'direct-sowing', '2026-W30')], [reanalysis('2026-08-10', 5)]), '2026-08-10');
  assert.equal(day.status, 'no-crop');
  assert.equal(day.etmMm, 0);
  assert.deepEqual(day.crops.map((crop) => crop.status), ['surface-state']);
});

test('une valeur hors bornes bloque le calcul du jour avec un message qui la nomme', () => {
  const tooHigh: KcOverride = { referenceCropId: CARROT.id, target: { rank: 2 }, kc: 1.5, effectiveFrom: '2026-04-10', recordedAt: '2026-04-10T08:00:00.000Z' };
  const kc = oneDay(input([carrotSeries], carrotTasks, [reanalysis('2026-04-16', 5)], { overrides: [tooHigh] }), '2026-04-16');
  assert.equal(kc.status, 'blocked');
  assert.equal(kc.etmMm, null);
  assert.deepEqual(kc.problems, ['Kc hors bornes pour Carotte, 30 j → Récolte : 1,5 (entre 0 et 1,3).']);

  const et0 = oneDay(input([carrotSeries], carrotTasks, [reanalysis('2026-04-16', 13.2)]), '2026-04-16');
  assert.deepEqual(et0.problems, ['ET0 hors bornes le 16 avril 2026 : 13,2 mm/j (entre 0 et 12).']);

  const shelter: BedWaterSettings = { ...SHELTERED, shelterFactors: [{ shelterId: 'jardin-serre', value: 0.4, effectiveFrom: '2026-01-01', recordedAt: '2026-01-01T00:00:00.000Z' }] };
  const kAbri = oneDay(input([carrotSeries], carrotTasks, [reanalysis('2026-04-16', 5)], { settings: shelter }), '2026-04-16');
  assert.deepEqual(kAbri.problems, ['K_abri hors bornes : 0,4 (entre 0,5 et 1).']);
});

test('une surcharge de Kc vaut à partir de son jour, sans réécrire les jours d\'avant (D-006)', () => {
  const override: KcOverride = { referenceCropId: CARROT.id, target: { rank: 2 }, kc: 0.9, effectiveFrom: '2026-04-15', recordedAt: '2026-04-15T08:00:00.000Z' };
  const readings = [reanalysis('2026-04-14', 5), reanalysis('2026-04-15', 5)];
  const before = oneDay(input([carrotSeries], carrotTasks, readings, { overrides: [override] }), '2026-04-14');
  const after = oneDay(input([carrotSeries], carrotTasks, readings, { overrides: [override] }), '2026-04-15');
  assert.equal(before.etmMm, 5);
  assert.equal(after.etmMm, 4.5);
  assert.deepEqual(
    { kc: computed(after.crops[0]).trace.kc.kc, referenceKc: computed(after.crops[0]).trace.kc.referenceKc, overridden: computed(after.crops[0]).trace.kc.overridden },
    { kc: 0.9, referenceKc: 1, overridden: true },
  );
  const back: KcOverride = { ...override, kc: null, effectiveFrom: '2026-04-16', recordedAt: '2026-04-16T08:00:00.000Z' };
  assert.equal(oneDay(input([carrotSeries], carrotTasks, [reanalysis('2026-04-16', 5)], { overrides: [override, back] }), '2026-04-16').etmMm, 5);
});

test('le coefficient d\'abattement s\'applique aux Kc de la FAO, pas aux surcharges de la ferme', () => {
  const broccoliSeries = series('brocoli', [cultivation('bro-c', 'plant-brocoli', 'Chou brocoli', { expected: ['2026-W30'] })]);
  const tasks = [task('brocoli', 'planting', '2026-W10')];
  const abated = REFERENCE_CROPS.map((crop) => (crop.id === BROCCOLI.id && crop.curve.shape === 'trapezoid' ? { ...crop, curve: { ...crop.curve, abatement: 0.8 } } : crop));
  const day = oneDay(input([broccoliSeries], tasks, [reanalysis('2026-04-21', 5)], { referenceCrops: abated }), '2026-04-21');
  assert.equal(round(computed(day.crops[0]).trace.kc.kc, 3), 0.84, '1,05 × 0,8 en pleine saison');
  assert.equal(computed(day.crops[0]).trace.kc.referenceKc, 1.05);
  assert.equal(computed(day.crops[0]).trace.kc.abatement, 0.8);
  const override: KcOverride = { referenceCropId: BROCCOLI.id, target: { fao: 'mid' }, kc: 0.95, effectiveFrom: '2026-01-01', recordedAt: '2026-01-01T00:00:00.000Z' };
  const overridden = oneDay(input([broccoliSeries], tasks, [reanalysis('2026-04-21', 5)], { referenceCrops: abated, overrides: [override] }), '2026-04-21');
  assert.equal(computed(overridden.crops[0]).trace.kc.kc, 0.95);
});

test('le lissage, option désactivée par défaut, passe de 0,5 à 1 sur cinq jours ; jamais vers un Kc de 0', () => {
  const dates = ['2026-03-31', '2026-04-01', '2026-04-02', '2026-04-03', '2026-04-04', '2026-04-05', '2026-04-06'];
  const readings = dates.map((date) => reanalysis(date, 1));
  const strict = bedWaterDays(input([carrotSeries], carrotTasks, readings), dates).days.map((day) => day.etmMm);
  assert.deepEqual(strict, [0.5, 1, 1, 1, 1, 1, 1]);
  const smoothed = bedWaterDays(input([carrotSeries], carrotTasks, readings, { options: { smoothing: true, shading: false } }), dates).days;
  assert.deepEqual(smoothed.map((day) => round(day.etmMm)), [0.5, 0.6, 0.7, 0.8, 0.9, 1, 1]);
  assert.equal(computed(smoothed[1].crops[0]).trace.kc.smoothed, true);
  assert.equal(computed(smoothed[5].crops[0]).trace.kc.smoothed, false);

  const stopDates = ['2026-06-21', '2026-06-22'];
  const stop = bedWaterDays(input([garlicSeries], garlicTasks, stopDates.map((date) => reanalysis(date, 5)), { options: { smoothing: true, shading: false } }), stopDates).days;
  assert.deepEqual(stop.map((day) => day.etmMm), [3, 0], 'l\'arrêt avant récolte est immédiat');
});

test('un stade déclaré se lit dans la trace : observé le jour dit, puis calculé et recalé', () => {
  const declarations: StageDeclaration[] = [{ seriesId: 'tomate', bedId: BED, referenceCropId: TOMATO.id, rank: 2, date: '2026-05-10', recordedAt: '2026-05-10T07:00:00.000Z' }];
  const readings = [reanalysis('2026-05-12', 5), reanalysis('2026-05-25', 5)];
  const observed = computed(oneDay(input([tomatoSeries], tomatoTasks, readings, { declarations }), '2026-05-12').crops[0]);
  assert.equal(observed.trace.stage.origin, 'observed');
  const recaled = computed(oneDay(input([tomatoSeries], tomatoTasks, readings, { declarations }), '2026-05-25').crops[0]);
  assert.equal(recaled.trace.stage.origin, 'calculated');
  assert.equal(recaled.trace.stage.declaration?.date, '2026-05-10');
  assert.equal(recaled.trace.kc.kc, 0.9);
});

test('les facteurs de la planche : K_abri daté par abri, paillage par saison, filet posé ce jour-là', () => {
  assert.equal(shelterFactorOn(OPEN_FIELD, '2026-05-01'), 1);
  assert.equal(shelterFactorOn(SHELTERED, '2026-05-01'), 0.8);
  const revisions = [
    { shelterId: 'jardin-serre', value: 0.7, effectiveFrom: '2026-04-01', recordedAt: '2026-04-01T08:00:00.000Z' },
    { shelterId: 'autre-serre', value: 0.6, effectiveFrom: '2026-04-01', recordedAt: '2026-04-01T08:00:00.000Z' },
    { shelterId: 'jardin-serre', value: 0.65, effectiveFrom: '2026-06-01', recordedAt: '2026-04-02T08:00:00.000Z' },
  ];
  assert.equal(shelterFactorOn({ ...SHELTERED, shelterFactors: revisions }, '2026-03-31'), 0.8);
  assert.equal(shelterFactorOn({ ...SHELTERED, shelterFactors: revisions }, '2026-05-15'), 0.7);
  assert.equal(shelterFactorOn({ ...SHELTERED, shelterFactors: revisions }, '2026-06-01'), 0.65);
  assert.equal(shelterFactorSettingProblem(0.6), null);
  assert.equal(shelterFactorSettingProblem(0.55), 'K_abri invalide : il se règle de 0,6 à 1.');

  const mulched = { ...OPEN_FIELD, mulch: [{ bedId: BED, season: 2026, plasticMulch: true }, { bedId: 'planche-b', season: 2027, plasticMulch: true }] };
  assert.equal(mulchFactorOn(mulched, '2026-07-01'), 0.9);
  assert.equal(mulchFactorOn(mulched, '2027-07-01'), 1);
  const mulchedDay = oneDay(input([carrotSeries], carrotTasks, [reanalysis('2026-04-16', 5)], { settings: mulched }), '2026-04-16');
  assert.equal(mulchedDay.etmMm, 4.5);

  const nets = { ...OPEN_FIELD, shadeNets: [{ bedId: BED, rate: 0.25, from: '2026-06-01', to: '2026-06-30' }, { bedId: BED, rate: 0.6, from: '2026-06-15', to: null }] };
  assert.deepEqual(shadeOn(nets, '2026-06-10', false), { factor: 1, netRate: null });
  assert.equal(round(shadeOn(nets, '2026-06-10', true).factor, 2), 0.87);
  assert.equal(round(shadeOn(nets, '2026-06-20', true).factor, 2), 0.63, 'le dernier filet posé');
  assert.deepEqual(shadeOn(nets, '2026-05-31', true), { factor: 1, netRate: null });
  assert.equal(shadeNetProblem({ rate: 1, from: '2026-06-01', to: null }), "Taux d'ombrage invalide : de 0 à moins de 100 %.");
  assert.equal(shadeNetProblem({ rate: 0.3, from: '2026-06-01', to: '2026-05-01' }), "Le filet d'ombrage est retiré avant d'être posé.");
  assert.equal(shadeNetProblem({ rate: 0.3, from: '2026-06-01', to: null }), null);
});
