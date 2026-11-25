import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import {
  approximateLine,
  detailSummary,
  NO_WEEK_OBJECTIVE,
  waterAlert,
  weatherAlert,
  weekBar,
} from '../lib/domain/today/essential';
import type { ReliabilityLine } from '../lib/domain/today/reliability';
import type { TodayWaterBlock } from '../lib/domain/today/water';
import type { TodayWeatherDay } from '../lib/domain/today/weather-days';
import type { TodayWeek } from '../lib/domain/today/week';

/**
 * Simplifier l'usage du module, lot S2, PR 5 : la page à l'essentiel
 * (docs/simplification-s2-contract.md, sections 8 et 9). Ce que le premier
 * niveau garde de chaque bloc vit dans `lib/domain/today/essential.ts` ; la
 * page le dessine et range le reste dans un seul pli, « Le détail », fermé.
 * Les bornes de hauteur se mesurent dans le navigateur (P62).
 */

const OBJECTIVE_LINK = { label: 'Poser un objectif', page: 'besoins', anchor: 'objectifs-de-la-semaine' } as const;

function week(farm: Partial<TodayWeek['farm']>, receivedDetail: string | null = null): TodayWeek {
  return {
    farm: {
      objectiveMm: 23.4,
      objectiveBeds: { withObjective: 10, total: 10 },
      receivedMm: 12,
      remainingMm: 11.4,
      bars: { irrigationPercent: 30, rainPercent: 10, objectivePercent: 78 },
      anchor: 'besoins-ferme',
      ...farm,
    },
    tiles: { receivedDetail },
    links: { objective: OBJECTIVE_LINK },
  } as unknown as TodayWeek;
}

test('« La semaine » : une barre pour la ferme, la phrase de l’objectif de S1, l’eau reçue et ce qui manque', () => {
  const bar = weekBar(week({}, 'dont 2,4 mm de pluie prévue, non mesurée'));
  assert.equal(bar.kind, 'bar');
  assert.equal(bar.sentence, '23,4 mm visés, ferme entière : 12 mm reçus. Il manque encore 11,4 mm d’ici dimanche.');
  // L'origine de la pluie garde son mot (F429, D-006).
  assert.equal(bar.kind === 'bar' ? bar.detail : null, 'dont 2,4 mm de pluie prévue, non mesurée');
  assert.deepEqual(bar.link, { label: 'Voir la semaine', page: 'besoins', anchor: 'besoins-ferme' });
  // La phrase de l'objectif est celle de S1, partielle comprise.
  assert.match(weekBar(week({ objectiveBeds: { withObjective: 7, total: 10 } })).sentence, /^23,4 mm visés, 7 planches sur 10 ont un objectif : /);
  // Atteint : jamais un reste négatif.
  assert.match(weekBar(week({ remainingMm: 0 })).sentence, /L’objectif de la semaine est atteint\.$/);
});

test('« La semaine » : un inconnu se dit inconnu, jamais zéro (D-003) ; sans objectif, pas de barre et « Poser un objectif »', () => {
  const unknown = weekBar(week({ receivedMm: null, remainingMm: null }));
  assert.equal(unknown.sentence, '23,4 mm visés, ferme entière : eau reçue inconnue. Ce qui manque est inconnu.');
  assert.doesNotMatch(unknown.sentence, /\b0 mm/);
  const none = weekBar(week({ objectiveMm: null }));
  assert.deepEqual(none, { kind: 'no-objective', sentence: NO_WEEK_OBJECTIVE, link: OBJECTIVE_LINK });
  assert.equal(NO_WEEK_OBJECTIVE, 'Aucun objectif posé pour cette semaine.');
});

function line(kind: ReliabilityLine['kind'], key = kind): ReliabilityLine {
  return { kind, key, text: `manque ${key}`, action: { kind: 'link', label: 'Voir', page: 'besoins', anchor: key } } as unknown as ReliabilityLine;
}

test('« Calcul approximatif » : la première donnée qui manque dans l’ordre du contrat, « + n autres », rien sans manque', () => {
  assert.equal(approximateLine([]), null);
  const alone = approximateLine([line('soil')]);
  assert.equal(alone?.line.kind, 'soil');
  assert.equal(alone?.othersLabel, null);
  // La pluie mesurée d'abord, puis l'objectif automatique, les espèces, le sol, les réserves, le plan.
  const many = approximateLine([line('plan'), line('reservoir-volume'), line('soil'), line('species'), line('actual-rain')]);
  assert.equal(many?.line.kind, 'actual-rain');
  assert.equal(many?.othersLabel, '+ 4 autres');
  assert.equal(approximateLine([line('plan'), line('automatic-objective')])?.line.kind, 'automatic-objective');
  // Chaque donnée passe avant la suivante, dans les deux sens d'arrivée.
  const order = ['actual-rain', 'automatic-objective', 'species', 'soil', 'reservoir-volume', 'plan'] as const;
  for (let index = 1; index < order.length; index += 1) {
    assert.equal(approximateLine([line(order[index]), line(order[index - 1])])?.line.kind, order[index - 1]);
    assert.equal(approximateLine([line(order[index - 1]), line(order[index])])?.line.kind, order[index - 1]);
  }
  assert.equal(approximateLine([line('plan'), line('species')])?.othersLabel, '+ 1 autre');
});

function reservoir(anchor: string, belowMinimumText: string | null, stale: boolean): TodayWaterBlock['reservoirs'][number] {
  return { label: `Cuve ${anchor}`, anchor, belowMinimumText, stale } as unknown as TodayWaterBlock['reservoirs'][number];
}
function limit(anchor: string, remainingCubicMeters: number): TodayWaterBlock['limits'][number] {
  return { label: `Forage ${anchor}`, anchor, remainingCubicMeters } as unknown as TodayWaterBlock['limits'][number];
}
function water(reservoirs: TodayWaterBlock['reservoirs'], limits: TodayWaterBlock['limits']): TodayWaterBlock {
  return { kind: 'water', lines: [], empty: null, reservoirs, limits };
}

test('la ligne d’eau : seulement quand elle dit quelque chose (S2-h)', () => {
  assert.equal(waterAlert(null), null);
  // Tout va bien : l'eau reste dans le pli.
  assert.equal(waterAlert(water([reservoir('a', null, false)], [limit('f', 3)])), null);
  // Sous le minimum de sécurité, relevé ancien ou jamais saisi, limite atteinte.
  assert.deepEqual(waterAlert(water([reservoir('a', 'sous le minimum', false)], [])), { label: 'Cuve a', anchor: 'a', othersLabel: null });
  assert.equal(waterAlert(water([reservoir('a', null, true)], []))?.anchor, 'a');
  assert.equal(waterAlert(water([], [limit('f', 0)]))?.label, 'Forage f');
  const two = waterAlert(water([reservoir('a', null, false), reservoir('b', null, true)], [limit('f', -1), limit('g', 2)]));
  assert.deepEqual(two, { label: 'Cuve b', anchor: 'b', othersLabel: '+ 1 autre' });
});

function day(date: string, tone: TodayWeatherDay['tone']): TodayWeatherDay {
  return { date, label: date, tone } as unknown as TodayWeatherDay;
}

test('« Gel ou chaleur » : un jour en alerte ou la prévision qui manque ; un jour calme reste dans le pli', () => {
  assert.equal(weatherAlert(null), null);
  assert.equal(weatherAlert({ tone: 'calm', lines: ['Rien d’annoncé sur trois jours.'], days: [day('a', 'calm')] }), null);
  const alert = weatherAlert({ tone: 'alert', lines: [], days: [day('a', 'calm'), day('b', 'alert'), day('c', 'alert')] });
  assert.deepEqual(alert?.days.map((d) => d.date), ['b', 'c']);
  assert.equal(alert?.unavailable, null);
  const unknown = weatherAlert({ tone: 'unknown', lines: ['Prévision indisponible : à vérifier.'], days: [day('a', 'unknown')] });
  assert.deepEqual(unknown, { days: [], unavailable: 'Prévision indisponible : à vérifier.' });
});

test('« Le détail » : sa ligne de résumé compte ce qu’il contient ; rien à montrer, pas de pli', () => {
  assert.equal(
    detailSummary({ tiles: 4, gardens: 3, weatherDays: 0, reservoirs: 0, limits: 0, toRefresh: 2, reliability: true }),
    '4 chiffres · 3 jardins · 2 données à rafraîchir',
  );
  assert.equal(
    detailSummary({ tiles: 0, gardens: 1, weatherDays: 3, reservoirs: 1, limits: 2, toRefresh: 0, reliability: true }),
    '1 jardin · 3 jours de météo · 1 réserve · 2 limites de prélèvement · données à jour',
  );
  assert.equal(detailSummary({ tiles: 0, gardens: 0, weatherDays: 0, reservoirs: 0, limits: 0, toRefresh: 0, reliability: false }), null);
});

test('la page : le même ordre à toutes les largeurs, un seul pli « Le détail », fermé, que chaque ancre ouvre', () => {
  const page = readFileSync('app/irrigation/today/today-page.tsx', 'utf8');
  // Aucun ordre propre au téléphone : l'ordre de lecture suit l'ordre affiché (L6).
  assert.doesNotMatch(page, /useTodayPhone|TODAY_PHONE_MAX_PX/);
  const order = ['<TodayHeader', '<TodayWeekBarView', '<TodayApproximateView', '<TodayWaterAlertView', '<TodayDetail', '<TodayWeekTiles', '<RainEntryDialog'];
  const positions = order.map((tag) => page.indexOf(tag));
  assert.ok(positions.every((position) => position >= 0), `tous présents : ${positions.join(', ')}`);
  assert.deepEqual([...positions].sort((a, b) => a - b), positions);
  // Aucun bloc n'est retiré : ils sont dans le pli.
  const fold = page.slice(page.indexOf('<TodayDetail'), page.indexOf('</TodayDetail>'));
  for (const block of ['<TodayWeekTiles', '<TodayWeekWater', '<TodaySoilBlock', '<TodayWaterBlockView', '<ReliabilityZoneView', '<TodayWeather ', '<TodayTimelineBlock']) {
    assert.ok(fold.includes(block), `${block} dans « Le détail »`);
  }
  const detail = readFileSync('app/irrigation/today/today-detail.tsx', 'utf8');
  assert.match(detail, /<details ref=\{foldRef\} id="today-detail" className="today-detail" open=\{open\}/);
  assert.match(detail, /<span className="today-detail-title">Le détail<\/span>/);
  assert.match(detail, /useState\(false\)/);
  assert.match(detail, /addEventListener\('hashchange'/);
  // « + n autres » et les pastilles ouvrent le pli ; l'adresse garde l'ancre.
  const essential = readFileSync('app/irrigation/today/today-essential.tsx', 'utf8');
  assert.match(essential, /href=\{`#\$\{id\}`\}/);
  assert.match(essential, /event\.preventDefault\(\);\s+onReveal\(id\);/);
  const header = readFileSync('app/irrigation/today/today-header.tsx', 'utf8');
  assert.match(header, /onReveal && IN_DETAIL\.has\(chip\.target\)/);
  // Les pastilles quittent le téléphone (S2-g) ; la frise aussi, comme avant.
  const css = readFileSync('app/irrigation/styles/today-essential.css', 'utf8');
  assert.match(css, /@container \(max-width: 620px\) \{\s+\.today-chips \{\s+display: none;/);
  assert.match(css, /\.today-block\[data-kind="timeline"\] \{\s+display: none;/);
});
