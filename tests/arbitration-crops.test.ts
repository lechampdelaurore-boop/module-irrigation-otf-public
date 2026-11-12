import assert from 'node:assert/strict';
import test from 'node:test';
import type { CropPlan, CropSeries, ImplantationTask } from '../lib/domain/domain.ts';
import { arbitrationCrops, type BedStageToday } from '../lib/domain/arbitration-crops.ts';

/**
 * L'écran d'arbitrage façon plan d'assolement (docs/shortage-contract.md,
 * 2 bis, D-083) : la frise des cultures de chaque planche et la phrase
 * « Cette semaine ». Le mercredi 22 juillet 2026, semaine 30 (du lundi 20 au
 * dimanche 26), comme la maquette validée.
 */

const TODAY = '2026-07-22';

type Culture = { id: string; plant: string; kind?: ImplantationTask['kind']; week: number; harvest?: number[]; done?: boolean };
const semaine = (n: number) => `2026-W${String(n).padStart(2, '0')}` as const;
const plan = (beds: Record<string, Culture[]>): CropPlan => {
  const series: CropSeries[] = [];
  const places: CropPlan['places'] = [];
  const implantationTasks: ImplantationTask[] = [];
  for (const [bedId, cultures] of Object.entries(beds)) {
    for (const culture of cultures) {
      series.push({ id: `serie-${culture.id}`, name: `Série ${culture.plant}`, season: 2026, use: 'bed', cycle: 'annual', cultivations: [{
        id: `culture-${culture.id}`, plantId: `plante-${culture.plant}`, plantName: culture.plant,
        harvestWeeks: [], harvestWeeksExpected: (culture.harvest ?? []).map(semaine),
      }] });
      places.push({ id: `place-${culture.id}`, seriesId: `serie-${culture.id}`, bedId, lengthMeters: 30 });
      implantationTasks.push({ id: `tache-${culture.id}`, seriesId: `serie-${culture.id}`, cultivationId: null, kind: culture.kind ?? 'planting',
        plannedWeek: semaine(culture.week), doneWeek: culture.done === false ? null : semaine(culture.week), status: culture.done === false ? 'todo' : 'done' });
    }
  }
  return { series, places, implantationTasks, readSummary: { seriesRead: series.length, placesRead: places.length, tasksRead: implantationTasks.length, tasksRetained: implantationTasks.length, placesWithoutSeries: 0, placesOfUnknownSeries: 0, placesWithUnknownBed: 0 } };
};
const range = (from: number, to: number) => Array.from({ length: to - from + 1 }, (_, i) => from + i);

const ferme = plan({
  'T1-1': [{ id: 'tomate', plant: 'Tomate', week: 18, harvest: range(27, 41) }],
  'T2-1': [{ id: 'poivron', plant: 'Poivron', week: 19, harvest: range(30, 41) }],
  'T2-2': [{ id: 'mesclun', plant: 'Mesclun', week: 20, harvest: range(24, 27) }, { id: 'laitue-t22', plant: 'Laitue', week: 29, harvest: [33, 34] }],
  A2: [{ id: 'haricot', plant: 'Haricot vert', kind: 'direct-sowing', week: 24, harvest: range(31, 34) }],
  A3: [{ id: 'laitue-a3', plant: 'Laitue', week: 24, harvest: [29, 30] }, { id: 'epinard', plant: 'Épinard', kind: 'direct-sowing', week: 35, harvest: range(41, 44), done: false }],
  A4: [{ id: 'poireau', plant: 'Poireau', week: 22, harvest: range(40, 50) }],
  B4: [{ id: 'feve', plant: 'Fève', kind: 'direct-sowing', week: 10, harvest: range(24, 28) }, { id: 'engrais', plant: 'Engrais vert', kind: 'direct-sowing', week: 32, done: false }],
  B5: [{ id: 'radis', plant: 'Radis', kind: 'direct-sowing', week: 30 }],
  B6: [{ id: 'chou', plant: 'Chou', week: 28 }],
  B7: [{ id: 'courge', plant: 'Courge', week: 19 }],
  B8: [{ id: 'ail', plant: 'Ail', week: 5, harvest: range(15, 20) }],
  B9: [],
});
const stages = new Map<string, BedStageToday[]>([
  ['T1-1', [{ cultivationId: 'culture-tomate', plantName: 'Tomate', stage: 'Récolte', kc: 1.15, surfaceState: false }]],
  ['A3', [{ cultivationId: 'culture-laitue-a3', plantName: 'Laitue', stage: 'Fin de récolte', kc: 0.95, surfaceState: false }]],
  ['T2-2', [{ cultivationId: 'culture-laitue-t22', plantName: 'Laitue', stage: 'Reprise', kc: 0.7, surfaceState: false }]],
]);
const vue = arbitrationCrops({ cropPlan: ferme, bedIds: [...Object.keys(ferme.places.reduce((all, place) => ({ ...all, [place.bedId]: true }), {})), 'B9'], today: TODAY, stagesToday: stages });
const semaineDe = (bedId: string) => vue.beds[bedId].week;

test('« Cette semaine » : la récolte, de la première à la dernière semaine', () => {
  assert.equal(vue.weekStart, '2026-07-20');
  assert.equal(semaineDe('T1-1').main, 'En récolte jusqu’au 11 octobre');
  assert.equal(semaineDe('T2-1').main, 'Première récolte cette semaine');
  assert.equal(semaineDe('A3').main, 'Dernière semaine de récolte');
  assert.equal(semaineDe('A2').main, 'Première récolte la semaine prochaine');
  assert.equal(semaineDe('A4').main, 'Récolte à partir du 28 septembre');
});

test('« Cette semaine » : l’implantation récente, la culture en place, la planche nue', () => {
  assert.equal(semaineDe('T2-2').main, 'Plantation la semaine dernière');
  assert.equal(semaineDe('B5').main, 'Semis cette semaine');
  assert.equal(semaineDe('B6').main, 'Plantation il y a deux semaines');
  assert.equal(semaineDe('B7').main, 'En place depuis le 4 mai');
  assert.equal(semaineDe('B4').main, 'Planche nue depuis le 13 juillet');
  assert.equal(semaineDe('B8').main, 'Planche nue depuis le 18 mai');
  assert.equal(semaineDe('B9').main, 'Planche nue');
});

test('le stade et le Kc du jour, à titre d’information, puis la prochaine culture prévue', () => {
  assert.equal(semaineDe('T1-1').detail, 'Récolte · Kc 1,15');
  assert.equal(semaineDe('A3').detail, 'Fin de récolte · Kc 0,95 · Épinard à partir du 24 août');
  assert.equal(semaineDe('B4').detail, 'Engrais vert à partir du 3 août');
  assert.equal(semaineDe('B9').detail, null);
  const deux = arbitrationCrops({
    cropPlan: plan({ C1: [{ id: 'tomate-c1', plant: 'Tomate', week: 18, harvest: range(27, 41) }, { id: 'basilic', plant: 'Basilic', week: 20, harvest: range(26, 38) }] }),
    bedIds: ['C1'], today: TODAY,
    stagesToday: new Map([['C1', [
      { cultivationId: 'culture-tomate-c1', plantName: 'Tomate', stage: 'Récolte', kc: 1.15, surfaceState: false },
      { cultivationId: 'culture-basilic', plantName: 'Basilic', stage: null, kc: null, surfaceState: false },
    ]]]),
  });
  // Deux cultures en place : chacune nommée ; la phrase porte sur la plus ancienne.
  assert.equal(deux.beds.C1.week.main, 'En récolte jusqu’au 11 octobre');
  assert.equal(deux.beds.C1.week.detail, 'Tomate : Récolte · Kc 1,15');
  assert.deepEqual(deux.beds.C1.present, ['Tomate', 'Basilic']);
  const engrais = arbitrationCrops({ cropPlan: plan({ D1: [{ id: 'phacelie', plant: 'Phacélie', kind: 'direct-sowing', week: 26 }] }), bedIds: ['D1'], today: TODAY,
    stagesToday: new Map([['D1', [{ cultivationId: 'culture-phacelie', plantName: 'Phacélie', stage: null, kc: null, surfaceState: true }]]]) });
  assert.equal(engrais.beds.D1.week.detail, 'engrais vert');
});

test('la frise : chaque culture en semaines depuis la semaine en cours, la récolte, le prévu, la fin inconnue', () => {
  const tomate = vue.beds['T1-1'].crops[0];
  assert.deepEqual({ start: tomate.startWeek, harvest: tomate.harvestWeek, end: tomate.endWeek, planned: tomate.planned }, { start: -12, harvest: -3, end: 11, planned: false });
  assert.equal(tomate.label, 'Tomate');
  assert.match(tomate.title, /^Tomate · Série Tomate · en place depuis le 27 avril · récolte du 29 juin au 11 octobre$/);
  const [laitue, epinard] = vue.beds.A3.crops;
  assert.deepEqual([laitue.endWeek, laitue.planned], [0, false]);
  assert.deepEqual({ start: epinard.startWeek, harvest: epinard.harvestWeek, end: epinard.endWeek, planned: epinard.planned }, { start: 5, harvest: 11, end: 14, planned: true });
  assert.match(epinard.title, /^Épinard · Série Épinard · prévu à partir du 24 août · récolte du 5 octobre au 1 novembre$|^Épinard · Série Épinard · prévu à partir du 24 août · récolte du 5 octobre au 1er novembre$/);
  const engrais = vue.beds.B4.crops.find((crop) => crop.label === 'Engrais vert')!;
  assert.deepEqual([engrais.startWeek, engrais.harvestWeek, engrais.endWeek, engrais.planned], [2, null, null, true]);
  // L'ail, fini en semaine 20, sort de la frise (huit semaines avant la semaine en cours) ; la fève, finie en semaine 28, y reste.
  assert.deepEqual(vue.beds.B8.crops, []);
  assert.deepEqual(vue.beds.B4.crops.map((crop) => crop.label), ['Fève', 'Engrais vert']);
  // Une même espèce garde sa teinte d'une planche à l'autre.
  assert.equal(vue.beds['T2-2'].crops.find((crop) => crop.label === 'Laitue')!.tone, laitue.tone);
});

test('les cultures en place, pour la case « Servir » ; une planche inconnue n’a ni frise ni culture', () => {
  assert.deepEqual(vue.beds['T1-1'].present, ['Tomate']);
  assert.deepEqual(vue.beds.B4.present, []);
  assert.deepEqual(vue.beds.B9, { crops: [], present: [], week: { main: 'Planche nue', detail: null } });
});
