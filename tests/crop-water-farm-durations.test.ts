import assert from 'node:assert/strict';
import test from 'node:test';
import { farmDurationsOf, sameDurations, withFarmDurations } from '../lib/domain/crop-water/farm-durations.ts';
import { referenceCropProblems, type ReferenceCrop } from '../lib/domain/crop-water/reference.ts';

/**
 * Les durées propres à une ferme (5 quater, PR 3e) : la ferme règle les
 * délais de levée, le début des stades en jours, les phases de la FAO et
 * l'abattement, les jours du calendrier ; la forme, les Kc et les repères
 * restent ceux du jeu commun. Une valeur changée n'est plus « estimée ».
 */

const steps: ReferenceCrop = {
  id: 'criiam-tomate',
  name: 'Tomate',
  source: 'criiam',
  emergenceDelayDays: { 'direct-sowing': 10, planting: 7 },
  curve: {
    shape: 'steps',
    stages: [
      { rank: 1, label: 'Plantation → Reprise', kc: 0.2 },
      { rank: 2, label: 'Reprise → Floraison', kc: 0.5 },
      { rank: 3, label: 'Récolte', kc: 0.9 },
    ],
    sets: [{
      months: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12],
      value: [
        { anchor: { from: 'implantation', days: 0 }, estimated: false },
        { anchor: { from: 'emergence', days: 20 }, estimated: true },
        { anchor: { from: 'first-harvest' }, estimated: false },
      ],
    }],
  },
};

const trapezoid: ReferenceCrop = {
  id: 'fao-cruciferes',
  name: 'Crucifères',
  source: 'fao56',
  emergenceDelayDays: { 'direct-sowing': 8, planting: 5 },
  curve: {
    shape: 'trapezoid',
    kcInitial: 0.7,
    kcMid: 1.05,
    kcEnd: 0.95,
    abatement: 1,
    sets: [
      { months: [3, 4, 5, 6, 7, 8], value: { initial: 20, development: 30, mid: 20, late: 10 } },
      { months: [9, 10, 11, 12, 1, 2], value: { initial: 30, development: 35, mid: 25, late: 10 } },
    ],
  },
};

const calendar: ReferenceCrop = {
  id: 'criiam-asperge',
  name: 'Asperge',
  source: 'criiam',
  emergenceDelayDays: { 'direct-sowing': 0, planting: 0 },
  curve: {
    shape: 'calendar',
    stages: [
      { rank: 2, label: 'Récolte', kc: 0.3, start: '03-15', estimated: false },
      { rank: 3, label: 'Végétation', kc: 0.9, start: '06-01', estimated: true },
    ],
    end: '10-31',
    establishment: { rank: 1, label: 'Installation', kc: 0.4, months: 3 },
  },
};

test('les durées d’une culture se lisent pour le formulaire, sans les repères sans durée', () => {
  assert.deepEqual(farmDurationsOf(steps), {
    emergence: { directSowing: 10, planting: 7 },
    stepDays: [[0, 20, null]],
    phaseLengths: null,
    abatement: null,
    calendar: null,
  });
  assert.deepEqual(farmDurationsOf(calendar).calendar, { starts: ['03-15', '06-01'], end: '10-31', establishmentMonths: 3 });
});

test('un escalier prend les jours de la ferme ; une valeur changée n’est plus estimée, les Kc et les repères restent', () => {
  const durations = { ...farmDurationsOf(steps), emergence: { directSowing: 12, planting: 7 }, stepDays: [[0, 25, null]] };
  const farm = withFarmDurations(steps, durations);
  assert.ok(farm && farm.curve.shape === 'steps');
  assert.deepEqual(farm.emergenceDelayDays, { 'direct-sowing': 12, planting: 7 });
  assert.deepEqual(farm.curve.sets[0].value[1], { anchor: { from: 'emergence', days: 25 }, estimated: false });
  assert.equal(farm.curve.sets[0].value[0], steps.curve.shape === 'steps' ? steps.curve.sets[0].value[0] : null, 'un stade inchangé garde sa marque');
  assert.deepEqual(farm.curve.stages, steps.curve.shape === 'steps' ? steps.curve.stages : null);
  assert.deepEqual(referenceCropProblems(farm), []);
});

test('des durées qui ne suivent pas les stades ou les jeux de saison sont refusées', () => {
  const base = farmDurationsOf(steps);
  assert.equal(withFarmDurations(steps, { ...base, stepDays: [[0, 25]] }), null, 'un stade de moins');
  assert.equal(withFarmDurations(steps, { ...base, stepDays: [[0, 25, 3]] }), null, 'une durée sur un repère de récolte');
  assert.equal(withFarmDurations(steps, { ...base, stepDays: [[0, 25, null], [0, 25, null]] }), null, 'un jeu de trop');
  assert.equal(withFarmDurations(trapezoid, { ...farmDurationsOf(trapezoid), abatement: null }), null);
  assert.equal(withFarmDurations(calendar, { ...farmDurationsOf(calendar), calendar: { starts: ['03-15'], end: '10-31', establishmentMonths: 3 } }), null);
});

test('un trapèze prend les phases et l’abattement de la ferme ; une durée illisible est dite par la règle du jeu', () => {
  const durations = farmDurationsOf(trapezoid);
  const farm = withFarmDurations(trapezoid, {
    ...durations,
    phaseLengths: [{ initial: 15, development: 30, mid: 20, late: 10 }, durations.phaseLengths![1]],
    abatement: 0.8,
  });
  assert.ok(farm && farm.curve.shape === 'trapezoid');
  assert.equal(farm.curve.abatement, 0.8);
  assert.equal(farm.curve.kcMid, 1.05);
  assert.deepEqual(farm.curve.sets.map((set) => set.value.initial), [15, 30]);
  const invalid = withFarmDurations(trapezoid, { ...durations, abatement: 1.4 });
  assert.ok(invalid);
  assert.match(referenceCropProblems(invalid).join(' '), /abattement invalide/);
});

test('un calendrier prend ses jours et son installation ; des durées égales à celles du jeu commun se reconnaissent', () => {
  const farm = withFarmDurations(calendar, { ...farmDurationsOf(calendar), calendar: { starts: ['03-01', '06-01'], end: '10-31', establishmentMonths: 4 } });
  assert.ok(farm && farm.curve.shape === 'calendar');
  assert.deepEqual(farm.curve.stages.map((stage) => [stage.start, stage.estimated]), [['03-01', false], ['06-01', true]]);
  assert.equal(farm.curve.establishment?.months, 4);
  assert.equal(sameDurations(farmDurationsOf(farm), farmDurationsOf(calendar)), false);
  assert.equal(sameDurations(farmDurationsOf(withFarmDurations(calendar, farmDurationsOf(calendar))!), farmDurationsOf(calendar)), true);
});
