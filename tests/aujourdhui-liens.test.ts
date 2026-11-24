import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { pageHref } from '../lib/domain/features/pages';
import { todayWeek, type TodayWeekBed, type TodayWeekInputs } from '../lib/domain/today/week';

/**
 * « Aujourd'hui » mène aux menus (docs/aujourdhui-liens-contract.md, D-308).
 *
 * L1 (D-310) : les quatre tuiles de la semaine mènent à leur menu, avec un
 * mot d'action écrit ; deux textes corrigés (« rien aujourd'hui », un seul
 * « sur » par phrase). Les cas sont ceux du contrat, section 3.
 */

const bed = (plotId: string, plotName: string, objectiveMm: number | null, values: Partial<TodayWeekBed> = {}): TodayWeekBed => ({
  plotId, plotName, sheltered: false, areaSquareMeters: 10, objectiveMm, actualRainMm: 2, actualIrrigationMm: 4,
  realRemainingMm: objectiveMm === null ? null : Math.max(0, objectiveMm - 6), ...values,
});

const week = (beds: TodayWeekBed[], values: Partial<TodayWeekInputs> = {}) => {
  const result = todayWeek({ weekStart: '2026-06-15', weekEnd: '2026-06-21', beds, water: null, ...values });
  assert.ok(result);
  return result;
};

const actions = (result: ReturnType<typeof week>) => Object.fromEntries(
  Object.entries(result.links).map(([tile, link]) => [tile, `${link.label} → ${link.page}#${link.anchor}`]),
);

test('L1, cas 1 : maraîchage, début d’été, 7 planches sur 10 ont un objectif : « Modifier les objectifs »', () => {
  const result = week([
    ...Array.from({ length: 7 }, () => bed('g1', 'Champ du haut', 23.4)),
    ...Array.from({ length: 3 }, () => bed('g2', 'Champ du bas', null)),
  ], { rainOrigins: { measuredMm: 2, reanalysisMm: 0, forecastMm: 0 } });
  assert.equal(result.tiles.objective, '23,4 mm');
  assert.equal(result.tiles.objectiveDetail, '7 planches sur 10 ont un objectif, du lun. 15 juin au dim. 21 juin');
  assert.deepEqual(actions(result), {
    objective: 'Modifier les objectifs → besoins#objectifs-de-la-semaine',
    received: 'Noter une pluie mesurée → besoins#manual-rain',
    remaining: 'Voir par planche → besoins#irrigation-needs-title',
    water: 'Voir jour par jour → besoins#weather',
  });
});

test('L1, cas 2 : petite ferme sans objectif : « Poser un objectif », reste inconnu : « Voir ce qui manque »', () => {
  const result = week([bed('g1', 'Potager', null), bed('g1', 'Potager', null)]);
  assert.equal(result.tiles.objective, null);
  assert.equal(result.tiles.remaining, null);
  assert.equal(result.links.objective.label, 'Poser un objectif');
  assert.equal(result.links.objective.anchor, 'objectifs-de-la-semaine');
  assert.equal(result.links.remaining.label, 'Voir ce qui manque');
  assert.equal(result.links.remaining.anchor, 'irrigation-needs-title');
});

test('L1, cas 3 : automne, pluie prévue non mesurée : « Noter une pluie mesurée » ; toute sous abri : « Voir jour par jour »', () => {
  const outside = week([bed('g1', 'Champ', 20, { actualRainMm: 2.4 })], { rainOrigins: { measuredMm: 0, reanalysisMm: 0, forecastMm: 2.4 } });
  assert.match(outside.tiles.receivedDetail ?? '', /2,4 mm de pluie prévue, non mesurée/);
  assert.equal(outside.links.received.label, 'Noter une pluie mesurée');
  assert.equal(outside.links.received.anchor, 'manual-rain');
  // Toute sous abri, la pluie ne compte pas (D-032) : la tuile mène aux jours de la semaine.
  const sheltered = week([bed('g1', 'Tunnel', 20, { sheltered: true, actualRainMm: 0 })]);
  assert.deepEqual([sheltered.links.received.label, sheltered.links.received.anchor], ['Voir jour par jour', 'weather']);
  // Une seule planche dehors suffit à proposer la pluie mesurée.
  const mixed = week([bed('g1', 'Tunnel', 20, { sheltered: true, actualRainMm: 0 }), bed('g2', 'Champ', 20)]);
  assert.equal(mixed.links.received.anchor, 'manual-rain');
});

test('L1, cas 4 : eau utilisée sans volume aujourd’hui : « rien aujourd’hui », jamais « dont 0 m³ »', () => {
  const nothing = week([bed('g1', 'Champ', 20)], { water: { weekCubicMeters: 0.768, todayCubicMeters: 0, incomplete: false } });
  assert.equal(nothing.tiles.water, '768 L');
  assert.equal(nothing.tiles.waterToday, 'rien aujourd’hui');
  assert.equal(nothing.links.water.label, 'Voir jour par jour');
  const some = week([bed('g1', 'Champ', 20)], { water: { weekCubicMeters: 18, todayCubicMeters: 4, incomplete: false } });
  assert.equal(some.tiles.waterToday, 'dont 4 m³ aujourd’hui');
  // Une surface mouillée manque : un zéro peut cacher une irrigation sans volume, la tuile n'affirme pas « rien » (F757).
  const unsure = week([bed('g1', 'Champ', 20)], { water: { weekCubicMeters: 3, todayCubicMeters: 0, incomplete: true } });
  assert.equal(unsure.tiles.waterToday, 'dont au moins 0 m³ aujourd’hui');
});

test('L1 : une planche sur deux, au singulier, un seul « sur » ; ferme entière inchangée', () => {
  assert.equal(week([bed('g1', 'A', 20), bed('g1', 'A', null)]).tiles.objectiveDetail, '1 planche sur 2 a un objectif, du lun. 15 juin au dim. 21 juin');
  assert.equal(week([bed('g1', 'A', 20)]).tiles.objectiveDetail, 'ferme entière, du lun. 15 juin au dim. 21 juin');
});

test('L1 : la cible garde la saison et la zone de la page', () => {
  const result = week([bed('g1', 'Champ', 20)]);
  assert.equal(pageHref(result.links.objective.page, { season: 2026, zone: 'z1' }, result.links.objective.anchor), '/irrigation/besoins?season=2026&zone=z1#objectifs-de-la-semaine');
});

test('L1 : chaque tuile est un lien entier, le mot d’action écrit dessus ; le lien n’enregistre rien (D-028)', () => {
  const view = readFileSync('app/irrigation/today/today-week.tsx', 'utf8');
  assert.match(view, /<a className="today-kpi" data-tone=\{tone\} href=\{href\}>/);
  assert.match(view, /<span className="today-kpi-action"><ActionWords label=\{link\.label\} \/><\/span>/);
  assert.match(view, /<span className="today-kpi-action-end">\{label\.slice\(cut \+ 1\)\}<Icon name="chevron" \/><\/span>/);
  assert.doesNotMatch(view, /<div className="today-kpi"/);
  assert.doesNotMatch(view, /onClick|Action\(/, 'une tuile ne fait aucun geste');
  const css = readFileSync('app/irrigation/styles/today-board.css', 'utf8');
  assert.match(css, /\.today-kpi:focus-visible \{\n {2}outline: 3px solid var\(--focus-ring\);/);
});
