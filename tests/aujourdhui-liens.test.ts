import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { pageHref } from '../lib/domain/features/pages';
import type { SoilGaugeZone } from '../lib/domain/soil-reserve/gauge-view';
import { reliabilityChecks, reliabilityLines, type ReliabilityInputs } from '../lib/domain/today/reliability';
import { todaySoil } from '../lib/domain/today/soil';
import { todayTodoLines } from '../lib/domain/today/today-irrigations';
import { todayView, weatherBlock, type TodayInputs } from '../lib/domain/today/today-view';
import { waterBlock } from '../lib/domain/today/water';
import { needsGardenAnchor, todayWeek, type TodayWeekBed, type TodayWeekInputs } from '../lib/domain/today/week';
import type { WaterInfrastructure, WaterReservoir } from '../lib/domain/water-resources';
import type { WeatherAlertCriterion, WeatherAlertForecastDay } from '../lib/domain/weather/weather-alerts';
import type { StoredProposal } from '../lib/domain/planning/contract';
import { FEATURE_IDS, type FeatureId } from '../lib/domain/features/catalogue';
import { DAY_REPLY, irrigationReply, PLAN_HEADER_REPLY, PLAN_RELIABILITY_REPLY, TODAY_REPLY_CLASSES } from '../app/irrigation/today/today-replies';

/**
 * « Aujourd'hui » mène aux menus (docs/aujourdhui-liens-contract.md, D-308).
 *
 * L1 (D-310) : les quatre tuiles de la semaine mènent à leur menu, avec un
 * mot d'action écrit ; deux textes corrigés (« rien aujourd'hui », un seul
 * « sur » par phrase). Les cas sont ceux du contrat, section 3.
 *
 * L2 (D-311) : les lignes de « Eau de la semaine » et de « Réserve du sol »,
 * les cuves et les ressources limitées d'« Eau disponible » mènent à leur
 * page ; leur lien porte la phrase écrite pour un lecteur d'écran
 * (section 4).
 *
 * L6 (D-315) : au téléphone, « Votre journée » passe avant les tuiles
 * (section 8), prouvé dans P30 ; ici, la borne et l'ordre du rendu.
 *
 * L5 (D-314) : la mise en page (section 7), prouvée par mesures dans P30 ;
 * ici, seulement les règles de dessin qui la portent.
 *
 * L4 (D-313) : la réponse d'un geste s'écrit sous le bouton pressé, par
 * `ActionReply` (section 6) ; les deux paragraphes de tête disparaissent.
 *
 * L3 (D-312) : un jour en alerte, une donnée à jour de « Fiabilité du
 * calcul », « Plan calculé … », l'état vide de « Votre journée » et une
 * proposition « Valider au planning » (section 5).
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

// L2 — les jauges mènent à leur page (section 4).

test('L2 : « Eau de la semaine » : la ferme au tableau des besoins, chaque jardin à son pli, la phrase lue en nom', () => {
  const result = week([bed('g1', 'Champ du haut', 20), bed('g2', 'Champ du bas', 20)]);
  assert.equal(result.farm.anchor, 'irrigation-needs-title');
  assert.deepEqual(result.shown.map((row) => [row.anchor, row.label]), [
    ['besoin-jardin-g2', 'Champ du bas : 6 / 20 mm'],
    ['besoin-jardin-g1', 'Champ du haut : 6 / 20 mm'],
  ]);
  assert.equal(needsGardenAnchor('g1'), 'besoin-jardin-g1');
  assert.equal(pageHref('besoins', { season: 2026 }, result.shown[0].anchor), '/irrigation/besoins?season=2026#besoin-jardin-g2');
});

const soilPlot = (plotId: string, name: string, garden: Partial<SoilGaugeZone['plots'][number]['garden']>): SoilGaugeZone['plots'][number] => ({
  plotId, name, sheltered: false, week: [], observation: null, beds: [],
  garden: { percent: null, lowest: null, countedBeds: 0, unknownBeds: 0, withoutCrop: [], ...garden },
});

test('L2 : « Réserve du sol » : chaque jardin à son pli sur « Réserve du sol », une ligne inconnue aussi', () => {
  const soil = todaySoil({ zones: [{ plots: [
    soilPlot('p1', 'Tunnel', { percent: 72.4, countedBeds: 3, lowest: { bedId: 'b3', bedName: 'T3', percent: 41.6 } }),
    soilPlot('p2', 'Nord', { percent: null, unknownBeds: 2 }),
  ] }] });
  assert.deepEqual(soil.shown.map((garden) => [garden.anchor, garden.label]), [
    ['soil-garden-p1', 'Tunnel : 72 %, la plus sèche : T3, 42 %'],
    ['soil-garden-p2', 'Nord : inconnue'],
  ]);
});

const reservoir = (id: string, name: string, volume: number | null): WaterReservoir => ({
  id, name, type: 'tank', capacityCubicMeters: 20, currentVolumeCubicMeters: volume, currentVolumeObservedAt: volume === null ? null : '2026-11-12T05:00:00.000Z',
  minimumSafetyCubicMeters: 0, exposedSurfaceSquareMeters: 0, receivesRain: false, evaporationEnabled: false,
  evaporationCoefficient: 1, status: 'active', notes: null,
});

test('L2 : « Eau disponible » : chaque cuve à sa carte, chaque ressource limitée à la liste des ressources, la phrase en nom (F759)', () => {
  const water: WaterInfrastructure = {
    resources: [{ id: 'f1', name: 'Forage', type: 'borehole', nominalFlowCubicMetersPerHour: 3, status: 'active', availableFrom: null, availableUntil: null, notes: null }],
    resourceLimits: [{ id: 'l1', resourceId: 'f1', enabled: true, maxCubicMetersPerDay: 12, validFrom: '2026-01-01', validUntil: null, referenceNote: null, createdAt: '2026-01-01T00:00:00.000Z' }],
    reservoirs: [reservoir('r1', 'Cuve', 12), reservoir('r2', 'Citerne', null)],
    resourceReservoirLinks: [], reservoirLinks: [], defaultSupply: null, movements: [],
  };
  const block = waterBlock(water, new Date('2026-11-12T05:00:00.000Z'));
  assert.deepEqual(block.reservoirs.map((gauge) => [gauge.anchor, gauge.label]), [
    ['reservoir-r2', 'Citerne : volume jamais saisi.'],
    ['reservoir-r1', 'Cuve : 12 m³ sur 20 m³, observé aujourd’hui.'],
  ]);
  assert.deepEqual(block.limits.map((gauge) => [gauge.anchor, gauge.label]), [['water-resources-title', 'Forage : 12 m³ restants aujourd’hui sur 12 m³ (0 m³ prélevés).']]);
  // Les phrases du bloc ne changent pas : chacune est le nom d'un lien.
  assert.deepEqual(block.lines, [...block.reservoirs.map((gauge) => gauge.label), ...block.limits.map((gauge) => gauge.label)]);
});

test('L2 : les lignes, cuves et ressources sont des liens ; le dessin caché, la phrase lue ; le lien d’en-tête répété en bas au téléphone', () => {
  const view = readFileSync('app/irrigation/today/today-gauges.tsx', 'utf8');
  assert.match(view, /<a className="today-bar-row" data-total=\{total \|\| undefined\} href=\{href\}>/);
  assert.match(view, /<a className="today-bar-row" data-kind="soil" href=\{href\}>/);
  assert.match(view, /<a className="today-tank-row" href=\{pageHref\('ressources', query, reservoir\.anchor\)\}/);
  assert.match(view, /<a key=\{limit\.id\} className="today-limit" href=\{pageHref\('ressources', query, limit\.anchor\)\}>/);
  assert.match(view, /<a className="today-block-more" href=\{pageHref\('ressources', query\)\}>Ressources et pompes<\/a>/);
  assert.equal(view.match(/<BlockFootLink /g)?.length, 3, 'les trois blocs à lien d’en-tête le répètent en bas');
  assert.doesNotMatch(view, /role="img"/, 'le dessin est caché, le lien porte la phrase');
  assert.doesNotMatch(view, /className="today-tanks" aria-hidden/, 'un lien ne vit jamais sous aria-hidden');
  const css = readFileSync('app/irrigation/styles/today-gauges.css', 'utf8');
  assert.match(css, /\.today-page \.today-block-foot \{\n {2}display: none;/);
  assert.match(css, /a\.today-limit \{\n {4}min-height: var\(--touch-target\);/);
  const needs = readFileSync('app/irrigation/irrigation-needs-dashboard.tsx', 'utf8');
  assert.match(needs, /<details key=\{garden\.plotId\} id=\{needsGardenAnchor\(garden\.plotId\)\}>/);
});

// L3 — les autres liens de la page (section 5). Aujourd'hui = jeudi 12 novembre 2026, 6 h 00 à la ferme.

const NOW = new Date('2026-11-12T05:00:00.000Z');
const ALL: FeatureId[] = [...FEATURE_IDS];
const forecast = (date: string, minimum: number | null = 6, maximum: number | null = 14): WeatherAlertForecastDay => ({
  date, minimumTemperatureCelsius: minimum, maximumTemperatureCelsius: maximum, precipitationMm: 0, forecastedAt: '2026-11-12T04:00:00.000Z',
});

test('L3, règle 1 : un jour en alerte mène à la page de son alerte ; un jour calme reste inerte (F761)', () => {
  const crops = (names: string[]) => names.map((name) => ({ name, alertCelsius: 0, underShelter: false, alreadyAlerted: false }));
  const heat: WeatherAlertCriterion = { id: 'c1', version: 1, field: 'maximum-temperature', direction: 'above', threshold: 30, horizonDays: 7, active: true, label: 'Chaleur' };
  const forecasts = [forecast('2026-11-12'), forecast('2026-11-13', 10, 31.5), forecast('2026-11-14', -1, 31)];
  const frost = [{ date: '2026-11-14', minimumCelsius: -1, crops: crops(['Laitue']) }];
  const block = weatherBlock({ forecasts, frost, criteria: [heat] }, ALL, NOW);
  // Calme ; chaleur seule → « Alertes météo » ; gel des cultures et chaleur le même jour → « Alertes cultures », comme « Voir les alertes ».
  assert.deepEqual(block.days.map((day) => day.alertPage), [null, 'alertes-meteo', 'alertes-cultures']);
  // Un jour sans prévision n'est pas un lien non plus.
  const unknown = weatherBlock({ forecasts: [forecast('2026-11-12')], frost: [], criteria: [] }, ALL, NOW);
  assert.deepEqual(unknown.days.map((day) => day.alertPage), [null, null, null]);
});

test('L3, règle 2 : une donnée à jour mène à la page où elle vit ; à rafraîchir, ses lignes portent leur geste', () => {
  const input: ReliabilityInputs = {
    enabled: ALL,
    now: NOW,
    reservoirs: [{ id: 'r1', name: 'Bassin', observedAt: '2026-11-01T08:00:00.000Z' }],
    actualRainMissingDates: [],
    soilGardensNeverObserved: [],
    speciesWithoutReference: [],
    planComputedAt: '2026-11-12T05:02:00.000Z',
  };
  const checks = reliabilityChecks(input, reliabilityLines(input));
  assert.deepEqual(checks.map((check) => [check.label, check.ok, check.link]), [
    ['Volume des réserves', false, null],
    ['Pluie mesurée', true, { page: 'besoins', anchor: 'manual-rain' }],
    ['Réserve du sol', true, { page: 'sol', anchor: null }],
    ['Espèces', true, { page: 'reglages', anchor: 'species-correspondence-title' }],
    ['Plan de la semaine', true, { page: 'planning', anchor: null }],
  ]);
  const fresh = { ...input, reservoirs: [{ id: 'r1', name: 'Bassin', observedAt: '2026-11-11T08:00:00.000Z' }] };
  assert.deepEqual(reliabilityChecks(fresh, reliabilityLines(fresh))[0].link, { page: 'ressources', anchor: null });
});

const todayInputs = (enabled: FeatureId[], overrides: Partial<TodayInputs> = {}): TodayInputs => ({
  enabled,
  now: NOW,
  weather: { forecasts: [forecast('2026-11-12'), forecast('2026-11-13'), forecast('2026-11-14')], frost: [], criteria: [] },
  events: [],
  lateToleranceMinutes: 30,
  plan: { computedAt: '2026-11-12T05:02:00.000Z', proposals: [] },
  shortagePlan: null,
  bedNames: new Map([['b2', 'P2']]),
  infrastructure: null,
  reliability: { actualRainMissingDates: [], soilGardensNeverObserved: [], speciesWithoutReference: [] },
  week: null,
  soil: null,
  ...overrides,
});

test('L3, règle 4 : « Rien à arroser aujourd’hui » mène au planning, sinon à « Planifier un arrosage »', () => {
  assert.deepEqual(todayView(todayInputs(ALL)).dayEmptyLink, { label: 'Voir le planning de la semaine', page: 'planning', intent: null });
  assert.deepEqual(todayView(todayInputs(['arrosages'])).dayEmptyLink, { label: 'Planifier un arrosage', page: 'arrosages', intent: 'planifier' });
  assert.equal(todayView(todayInputs(['besoins'])).dayEmptyLink, null, 'sans « Votre journée », aucun lien');
});

test('L3, règle 5, réécrite par le lot S2 : le lien d’une proposition devient « Changer l’heure ou la dose », vers la même carte ; rien n’est validé par un lien', () => {
  const proposal = {
    storedId: 'p20', status: 'proposed', startAt: '2026-11-12T17:00:00.000Z', endAt: '2026-11-12T18:00:00.000Z', durationSeconds: 3600, doseMm: 8,
    equipmentName: 'Asperseur A', settingName: 'Buse 2', applications: [{ otfBedId: 'b2' }],
  } as unknown as StoredProposal;
  const [line] = todayTodoLines({ enabled: ALL, now: NOW, events: [], lateToleranceMinutes: 30, bedNames: new Map([['b2', 'P2']]), proposals: [proposal] });
  assert.deepEqual(line.open, { page: 'planning', anchor: 'proposal-p20', label: 'Changer l’heure ou la dose' });
  // Le lien est dessiné par la carte à un bouton (S2), dans « Autres choix » ; « Valider » y est un bouton.
  const day = readFileSync('app/irrigation/today/today-day.tsx', 'utf8');
  assert.match(day, /<a className="today-action-link" href=\{pageHref\(gesture\.page, query, gesture\.anchor\)\} aria-label=\{choice\.accessibleName\}>/);
});

test('L3 : les liens dessinés — jour en alerte, donnée à jour, plan, état vide', () => {
  const weather = readFileSync('app/irrigation/today/today-weather.tsx', 'utf8');
  assert.match(weather, /<a className="today-day-link" href=\{pageHref\(day\.alertPage, query\)\}>/);
  assert.match(weather, /<span className="today-day-action">Voir l’alerte<Icon name="chevron" \/><\/span>/);
  const zone = readFileSync('app/irrigation/today/reliability-zone.tsx', 'utf8');
  assert.match(zone, /<a className="reliability-check-link" href=\{pageHref\(check\.link\.page, query, check\.link\.anchor \?\? undefined\)\}>/);
  const header = readFileSync('app/irrigation/today/today-header.tsx', 'utf8');
  assert.match(header, /<a href=\{pageHref\('planning', query\)\}>\{plan\.text\}<\/a>/);
  assert.doesNotMatch(header, /plan\.linkToPlanning \? <a/);
  const day = readFileSync('app/irrigation/today/today-day.tsx', 'utf8');
  assert.match(day, /hrefWithIntent\(pagePath\(emptyLink\.page\), query\.season, emptyLink\.intent, '1'\)/);
});

test('L4, règle 1 : chaque geste de la page a son endroit, et un seul ; le refus en rouge', () => {
  assert.equal(irrigationReply('e7'), 'irrigation:e7');
  assert.deepEqual(new Set([DAY_REPLY, PLAN_HEADER_REPLY, PLAN_RELIABILITY_REPLY, irrigationReply('e7')]).size, 4);
  assert.deepEqual(TODAY_REPLY_CLASSES, { notice: 'today-notice', warning: 'today-notice', error: 'today-error' });
  const page = readFileSync('app/irrigation/today/today-page.tsx', 'utf8');
  // Règle 3 : les deux paragraphes de tête ne sont plus ; une seule réponse à la fois.
  assert.doesNotMatch(page, /className="today-notice"|className="today-error"|setNotice|setError|setRefused/);
  assert.match(page, /const origin = irrigationReply\(eventEquipmentId\);/);
  assert.match(page, /onRecalculatePlan=\{\(\) => recalculatePlan\(PLAN_HEADER_REPLY\)\}/);
  assert.match(page, /onRecalculatePlan=\{\(\) => recalculatePlan\(PLAN_RELIABILITY_REPLY\)\}/);
  assert.match(page, /link: \{ href: pageHref\('arrosages', dayQuery\), label: 'Suivre sur « Arrosages »' \}/);
  assert.match(page, /\{ lines: refused \}/);
});

test('L4, règle 2 : sous la carte, qui la suit dans « En cours » ; la carte partie, en tête de « Votre journée »', () => {
  const day = readFileSync('app/irrigation/today/today-day.tsx', 'utf8');
  assert.match(day, /reply=\{reply\(irrigationReply\(line\.eventEquipmentId\)\)\}/, 'la carte « En cours » porte la réponse de son démarrage');
  assert.match(day, /const origin = id \? irrigationReply\(id\) : line\.proposalId \? proposalReply\(line\.proposalId\) : null;/, 'chaque carte du jour porte la sienne');
  assert.match(day, /onAllDone\(\[id\], irrigationReply\(id\)\)/, '« Fait comme prévu » répond sous sa carte');
  assert.match(day, /onConfirm=\{\(ids\) => onAllDone\(ids, DAY_REPLY\)\}/, '« Tout est fait » répond en tête du bloc');
  assert.match(day, /!cards\.has\(reply\.origin\) \? \{ \.\.\.reply, origin: DAY_REPLY \}/, 'une carte partie : la réponse en tête du bloc, jamais perdue');
  assert.equal((day.match(/\{reply\}\n {4}<\/li>/g) ?? []).length, 2, 'sous les boutons, dans la carte, pour les deux sortes de carte');
  assert.match(day, /reply=\{origin \? reply\(origin\) : null\}/, 'une proposition porte la sienne (lot S2)');
  const header = readFileSync('app/irrigation/today/today-header.tsx', 'utf8');
  assert.match(header, /<ActionReply messages=\{replies\} origin=\{PLAN_HEADER_REPLY\}/);
  const zone = readFileSync('app/irrigation/today/reliability-zone.tsx', 'utf8');
  assert.match(zone, /check\.kind === 'plan' \? <ActionReply messages=\{replies\} origin=\{PLAN_RELIABILITY_REPLY\}/, 'sous la ligne du plan, qui reste une fois le plan à jour');
  const reply = readFileSync('app/irrigation/shell/action-reply.tsx', 'utf8');
  assert.match(reply, /scrollIntoView\?\.\(\{ block: 'nearest'/, 'la réponse entre dans l’écran');
});

test('L5 : un bloc étiré garde son contenu en haut ; l’heure prend sa place ; le nom d’un jardin se lit en entier au téléphone', () => {
  const page = readFileSync('app/irrigation/styles/today.css', 'utf8');
  assert.match(page, /\.today-block \{\n  display: grid;\n[^}]*align-content: start;/, 'règle 1 : le contenu en haut du bloc');
  const day = readFileSync('app/irrigation/styles/today-day.css', 'utf8');
  assert.match(day, /grid-template-columns: minmax\(56px, max-content\) minmax\(0, 1fr\);/, 'règle 2 : la colonne de l’heure à sa mesure');
  assert.doesNotMatch(day, /grid-template-columns: 56px minmax\(0, 1fr\);/);
  const gauges = readFileSync('app/irrigation/styles/today-gauges.css', 'utf8');
  const phone = gauges.slice(gauges.indexOf('@container (max-width: 620px)'));
  assert.match(phone, /\.today-bar-row \.today-bar-name \{\n    overflow: visible;\n    overflow-wrap: anywhere;\n    white-space: normal;/, 'règle 3 : le nom en entier, au besoin sur deux lignes');
});

test('L6 : au téléphone, « Votre journée » avant les tuiles, dans le DOM et au dessin ; à l’ordinateur, l’ordre de toujours', () => {
  const page = readFileSync('app/irrigation/today/today-page.tsx', 'utf8');
  assert.match(page, /const TODAY_PHONE_MAX_PX = 620;/, 'la borne des requêtes de conteneur');
  assert.match(page, /\{phone \? \[dayRow, tiles\] : \[tiles, dayRow\]\}/, 'le DOM suit l’ordre affiché');
  assert.match(page, /key="semaine"/);
  assert.match(page, /key="journee"/);
  const css = readFileSync('app/irrigation/styles/today.css', 'utf8');
  const phone = css.slice(css.indexOf('@container (max-width: 620px)'));
  assert.match(phone, /\.today-head \{\n    order: -2;\n  \}/);
  assert.match(phone, /\.today-row:has\(> #today-day\) \{\n    order: -1;\n  \}/, 'le premier dessin, avant la lecture de la largeur');
});
