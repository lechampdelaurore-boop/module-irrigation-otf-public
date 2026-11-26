import assert from 'node:assert/strict';
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { dirname, join, normalize } from 'node:path';
import test from 'node:test';
import { automaticObjectiveWeekRecord } from '../lib/domain/automatic-objective.ts';
import { evaluateFrost, frostSubjects } from '../lib/domain/crop-alerts/frost.ts';
import { farmObjective, farmObjectivePartial, farmObjectiveScopeText, farmObjectiveText } from '../lib/domain/farm-objective.ts';
import type { GoalRevisionLike } from '../lib/domain/irrigation-history/contract.ts';
import { objectiveForBed } from '../lib/domain/irrigation-needs.ts';
import {
  objectiveOffSeason,
  offSeasonSchedule,
  type ActiveOffSeasonScope,
  type OffSeasonRevision,
  type OffSeasonScope,
} from '../lib/domain/off-season.ts';
import { COMMON, link, MORNING as FROST_FORECAST_AT, planting, series } from './support/crop-alerts-fixtures.ts';
import {
  ABRI, at, automatic, BEFORE, dashboard, decision, FARM_BEDS, farmGoal, FRIDAY, garden, JARDIN_NORD, MONDAY, NEUVE, near,
  NORD, NORD_2, objective, offSeasonDays, ON_JUNE_FIRST, plannedOn, PLEIN_CHAMP, put, resume, row, rowsOf, SATURDAY,
  SOUS_ABRI, SUD, SUNDAY, THURSDAY, TUESDAY, untouched, VERGER, WEDNESDAY, WEEK, weekDays,
} from './support/off-season-fixtures.ts';
import { realIrrigation } from './support/planning-fixtures.ts';

/**
 * Le filtre « hors saison », PR B1 : la règle
 * (docs/objectif-automatique-saison-contract.md, sections 4, 5 et 8 ; D-337).
 * Les dix cas chiffrés du contrat, la garde de la pluie, de la réserve du sol
 * et des alertes, puis les précisions faites en codant (D-341).
 *
 * La ferme et la semaine du contrat : tests/support/off-season-fixtures.ts.
 */

test('filtre vide : l’objectif de chaque planche est celui d’avant, mot pour mot', () => {
  const goalSets: GoalRevisionLike[][] = [[], [farmGoal(20)], [farmGoal(20), farmGoal(null, at(WEDNESDAY))]];
  // Aucun geste, des portées reprises avant la semaine, une portée qui couvre une autre parcelle.
  const emptyFilters: OffSeasonRevision[][] = [
    [],
    [put(PLEIN_CHAMP, BEFORE), resume(PLEIN_CHAMP, at('2026-06-10'))],
    [put({ level: 'zone', zoneId: 'autre-parcelle' }, BEFORE)],
  ];
  for (const bed of FARM_BEDS) {
    for (const input of [undefined, automatic(bed)]) {
      for (const goals of goalSets) {
        const before = objectiveForBed(goals, bed, MONDAY, SUNDAY, input);
        assert.deepEqual(before.offSeasonDates, [], 'sans filtre, aucun jour hors saison');
        for (const gestures of emptyFilters) {
          assert.deepEqual(objectiveForBed(goals, bed, MONDAY, SUNDAY, input, offSeasonSchedule(gestures).daysOf(bed)), before, `${bed.id} : rien ne change`);
        }
      }
    }
  }
});

test('filtre vide : le tableau des besoins est celui d’avant, mot pour mot', () => {
  const events = [realIrrigation('arrosage-mardi', 'goutte-a-goutte', '2026-06-16T05:00:00.000Z', [NORD.id], 10, 10), plannedOn(SUD.id, at(FRIDAY), 6)];
  const decisions = [decision(NORD_2.id, 15)];
  const days = weekDays({ gaugeMm: { [MONDAY]: 12 } });
  const plain = dashboard({ events, decisions, days });
  assert.deepEqual(dashboard({ events, decisions, days, gestures: [] }), plain);
  assert.deepEqual(dashboard({ events, decisions, days, gestures: [put(SOUS_ABRI, BEFORE), resume(SOUS_ABRI, at('2026-06-12'))] }), plain);
  assert.ok(rowsOf(plain).every((bed) => !('offSeasonDates' in bed)), 'la ligne d’avant, sans champ de plus');
  assert.equal('offSeason' in plain.farmObjective, false, 'l’objectif de la ferme d’avant, sans champ de plus');
});

test('cas 1 : plein champ hors saison toute la semaine, objectif de ferme saisi 20 mm : pas d’objectif dehors, 20 mm sous abri, le 20 mm reste', () => {
  const gestures = [put(PLEIN_CHAMP, BEFORE)];
  const goals = [farmGoal(20)];
  const outside = objective(NORD, { gestures, goals });
  assert.equal(outside.value, null, 'hors saison : pas d’objectif, jamais zéro (D-003)');
  assert.equal(outside.complete, false);
  assert.equal(outside.origin, null);
  assert.equal(outside.source, null, 'l’objectif saisi n’a servi aucun jour');
  assert.equal(outside.automatic, null, 'l’objectif automatique non plus');
  assert.deepEqual(outside.offSeasonDates, WEEK);
  assert.equal(objectiveOffSeason({ objectiveMm: outside.value, offSeasonDates: outside.offSeasonDates }), true, 'dite « hors saison », pas « sans objectif »');

  const sheltered = objective(ABRI, { gestures, goals });
  near(sheltered.value, 20, 'sous abri, l’objectif de ferme saisi');
  assert.equal(sheltered.origin, 'entered');
  assert.deepEqual(sheltered.offSeasonDates, []);

  // L'objectif saisi reste là, inactif : repris le mercredi, il compte de nouveau à partir de ce jour.
  const resumed = objective(NORD, { gestures: [...gestures, resume(PLEIN_CHAMP, at(WEDNESDAY))], goals });
  near(resumed.value, 20 * 5 / 7, 'mercredi à dimanche : cinq septièmes des 20 mm');
  assert.equal(resumed.origin, 'entered');
  assert.deepEqual(resumed.offSeasonDates, [MONDAY, TUESDAY]);
  assert.deepEqual(goals, [farmGoal(20)], 'aucun objectif saisi n’est effacé');

  const board = dashboard({ gestures, goals });
  assert.equal(row(board, NORD.id).objectiveMm, null);
  near(row(board, ABRI.id).objectiveMm, 20, 'au tableau des besoins aussi');
});

test('cas 2 : plein champ hors saison depuis jeudi : trois jours d’objectif, puis « hors saison depuis jeudi »', () => {
  // Mercredi 22 h 30 en temps universel : jeudi 0 h 30 à Paris ; le geste compte à partir du jeudi (D-004, D-034).
  const gestures = [put(PLEIN_CHAMP, '2026-06-17T22:30:00.000Z')];
  const result = objective(NORD, { gestures });
  near(result.value, 4.0 + 4.2 + 3.8, 'objectif automatique du lundi au mercredi');
  assert.equal(result.origin, 'automatic');
  assert.deepEqual(result.automatic?.days.map((day) => day.date), [MONDAY, TUESDAY, WEDNESDAY]);
  assert.deepEqual(result.offSeasonDates, [THURSDAY, FRIDAY, SATURDAY, SUNDAY]);
  assert.equal(objectiveOffSeason({ objectiveMm: result.value, offSeasonDates: result.offSeasonDates }), false, 'elle garde ses trois jours d’objectif');

  const schedule = offSeasonSchedule(gestures);
  assert.deepEqual(schedule.scopesCovering(NORD, SUNDAY), [{ scope: PLEIN_CHAMP, since: THURSDAY }], 'hors saison depuis jeudi');
  assert.deepEqual(schedule.scopesCovering(NORD, WEDNESDAY), [], 'mercredi, en saison');

  near(objective(NORD, { gestures, goals: [farmGoal(20)] }).value, 20 * 3 / 7, 'un objectif saisi : trois septièmes des 20 mm');
});

test('cas 3 : plein champ hors saison, 12 mm au pluviomètre lundi : la pluie reste au bilan, l’objectif n’y compte pas', () => {
  const days = weekDays({ gaugeMm: { [MONDAY]: 12 }, reanalysisMm: { [MONDAY]: 3 } });
  const plain = dashboard({ days });
  const filtered = dashboard({ days, gestures: [put(PLEIN_CHAMP, BEFORE)] });
  const before = row(plain, NORD.id);
  const after = row(filtered, NORD.id);
  assert.equal(after.actualRainMm, 12, 'la mesure du pluviomètre prime, filtre ou non');
  assert.equal(after.actualRainMm, before.actualRainMm);
  assert.equal(after.forecastRainMm, before.forecastRainMm, 'la pluie prévue aussi');
  near(before.realRemainingMm, 20 - 12, 'en saison, la pluie se déduit de l’objectif');
  assert.equal(after.objectiveMm, null);
  assert.equal(after.realRemainingMm, null, 'hors saison : aucun objectif auquel comparer la pluie');
  assert.deepEqual(after.offSeasonDates, WEEK);
  assert.deepEqual(after.completeness.missing, [], 'hors saison n’est pas un objectif manquant');
  assert.equal(row(filtered, ABRI.id).actualRainMm, 0, 'sous abri, la pluie vaut 0, comme avant');
});

test('cas 4 : tout le plein champ et le jardin Nord hors saison ; reprendre tout le plein champ laisse le jardin Nord hors saison, et le dit', () => {
  const gestures = [put(PLEIN_CHAMP, BEFORE), put(JARDIN_NORD, at('2026-06-09')), resume(PLEIN_CHAMP, at(WEDNESDAY))];
  const schedule = offSeasonSchedule(gestures);
  assert.deepEqual(schedule.scopesCovering(NORD, TUESDAY), [{ scope: PLEIN_CHAMP, since: '2026-06-08' }, { scope: JARDIN_NORD, since: '2026-06-09' }]);
  const remaining: ActiveOffSeasonScope[] = [{ scope: JARDIN_NORD, since: '2026-06-09' }];
  assert.deepEqual(schedule.scopesCovering(NORD, WEDNESDAY), remaining, 'la portée qui reste, nommée avec son jour');
  assert.deepEqual(schedule.activeScopes(WEDNESDAY), remaining);
  assert.deepEqual(offSeasonDays(gestures, NORD), WEEK, 'le jardin Nord reste hors saison toute la semaine');
  assert.deepEqual(offSeasonDays(gestures, SUD), [MONDAY, TUESDAY], 'le jardin Sud reprend le mercredi');
  assert.equal(objective(NORD, { gestures }).value, null);
  near(objective(SUD, { gestures }).value, 3.8 + 4.5 + 5.0 + 4.6 + 3.9, 'jardin Sud : 21,8 mm à partir du mercredi');
});

test('cas 5 : tout le sous-abri ne couvre pas un jardin à classer, tout le plein champ non plus : le module ne devine pas', () => {
  const gestures = [put(SOUS_ABRI, BEFORE), put(PLEIN_CHAMP, BEFORE)];
  assert.deepEqual(offSeasonDays(gestures, NEUVE), [], 'ni plein champ ni sous abri (D-003)');
  assert.deepEqual(offSeasonSchedule(gestures).scopesCovering(NEUVE, MONDAY), []);
  assert.deepEqual(offSeasonDays(gestures, ABRI), WEEK);
  assert.deepEqual(offSeasonDays(gestures, NORD), WEEK);
  near(objective(NEUVE, { gestures, goals: [farmGoal(20)] }).value, 20, 'le jardin à classer garde son objectif');
  // Mis hors saison par son nom, ou par sa parcelle, il l'est.
  assert.deepEqual(offSeasonDays([put({ level: 'plot', plotId: 'jardin-neuf' }, BEFORE)], NEUVE), WEEK);
  assert.deepEqual(offSeasonDays([put({ level: 'zone', zoneId: 'parcelle' }, BEFORE)], NEUVE), WEEK);
});

test('cas 6 : une irrigation réelle mardi sur une planche hors saison est comptée, sans objectif auquel la comparer', () => {
  const events = [realIrrigation('arrosage-mardi', 'goutte-a-goutte', '2026-06-16T05:00:00.000Z', [NORD.id], 10, 10)];
  const before = row(dashboard({ events }), NORD.id);
  const after = row(dashboard({ events, gestures: [put(PLEIN_CHAMP, BEFORE)] }), NORD.id);
  assert.equal(after.actualIrrigationMm, 10, 'l’irrigation réelle reste comptée');
  assert.equal(after.actualIrrigationMm, before.actualIrrigationMm);
  assert.equal(after.objectiveMm, null);
  assert.equal(after.realRemainingMm, null, 'rien à comparer : aucun dépassement inventé');
  assert.equal(after.relativeDeficitPercent, null);
  assert.equal(after.effectiveNeedMm, null, 'aucun besoin, aucune proposition');
  assert.equal(after.effectiveVolumeCubicMeters, null);
  assert.equal(objectiveOffSeason(after), true, '« hors saison »');
});

test('cas 7 : une semaine close avant la pause garde l’objectif d’avant, enregistré ou saisi', () => {
  const recorded = automaticObjectiveWeekRecord(automatic(NORD), NORD, { weekDates: WEEK, days: WEEK });
  const closed = automatic(NORD, { today: '2026-06-24', closedWeeks: new Map([[MONDAY, recorded]]) });
  // Mis hors saison le mercredi qui suit la semaine close.
  const daysOf = offSeasonSchedule([put(PLEIN_CHAMP, at('2026-06-24'))]).daysOf(NORD);
  const before = objectiveForBed([], NORD, MONDAY, SUNDAY, closed);
  const after = objectiveForBed([], NORD, MONDAY, SUNDAY, closed, daysOf);
  assert.deepEqual(after, before, 'la semaine close ne bouge pas (D-318)');
  near(after.value, 30, 'les 30,0 mm enregistrés');
  assert.equal(after.automatic?.closure, 'recorded');
  const goals = [farmGoal(20)];
  assert.deepEqual(objectiveForBed(goals, NORD, MONDAY, SUNDAY, undefined, daysOf), objectiveForBed(goals, NORD, MONDAY, SUNDAY), 'l’objectif saisi de la semaine close non plus');
  // La semaine du geste, elle, compte ses jours hors saison à partir du mercredi.
  const next = objectiveForBed([], NORD, '2026-06-22', '2026-06-28', undefined, daysOf);
  assert.deepEqual(next.offSeasonDates, ['2026-06-24', '2026-06-25', '2026-06-26', '2026-06-27', '2026-06-28']);
});

test('cas 8 : un gel prévu vendredi sur des poireaux dehors, plein champ hors saison : l’alerte part comme avant', () => {
  // Les données du contrat des alertes par culture : lundi 9 novembre 2026, poireaux plantés en semaine 36, alerte à −6 °C.
  const monday = '2026-11-09';
  const friday = '2026-11-13';
  const { subjects } = frostSubjects({
    series: [series({ id: 'poireaux', plantId: 'p-poireau', plantName: 'Poireau', harvestWeeksExpected: ['2027-W05'] })],
    tasks: [planting('poireaux', '2026-W36')],
    revisions: [link('p-poireau', 'poireau')],
    common: COMMON,
    shelteredSeriesIds: new Set(),
    today: monday,
  });
  const evaluation = evaluateFrost({
    subjects,
    forecasts: [{ date: friday, minimumTemperatureCelsius: -7, forecastedAt: FROST_FORECAST_AT }],
    today: monday,
    horizonDays: 5,
    offsetCelsius: 0,
    alertedKeys: new Set(),
  });
  assert.deepEqual(evaluation.days.map((day) => [day.date, day.crossings.map((crossing) => crossing.name)]), [[friday, ['Poireau']]], 'l’alerte de gel du vendredi');
  assert.equal(offSeasonSchedule([put(PLEIN_CHAMP, '2026-11-02T09:00:00.000Z')]).daysOf(NORD)(friday), true, 'la planche des poireaux est bien hors saison ce vendredi');
  // L'alerte ne reçoit rien du filtre et son module n'y mène pas : la garde ci-dessous le vérifie.
});

test('cas 9 : la pause levée mercredi : l’objectif à partir du mercredi, 21,8 mm ; lundi et mardi hors saison', () => {
  const result = objective(NORD, { gestures: [put(PLEIN_CHAMP, BEFORE), resume(PLEIN_CHAMP, at(WEDNESDAY))] });
  near(result.value, 21.8, '3,8 + 4,5 + 5,0 + 4,6 + 3,9');
  assert.equal(result.origin, 'automatic');
  assert.deepEqual(result.automatic?.days.map((day) => day.date), [WEDNESDAY, THURSDAY, FRIDAY, SATURDAY, SUNDAY]);
  assert.deepEqual(result.offSeasonDates, [MONDAY, TUESDAY]);
});

test('cas 10 : objectif automatique éteint, plein champ hors saison : l’objectif saisi n’y compte pas non plus', () => {
  const gestures = [put(PLEIN_CHAMP, BEFORE)];
  const goals = [farmGoal(20)];
  const absent = objective(NORD, { gestures, goals, automatic: null });
  assert.equal(absent.value, null, 'le filtre ne dépend pas de l’objectif automatique');
  assert.deepEqual(absent.offSeasonDates, WEEK);
  const switchedOff = objective(NORD, { gestures, goals, automatic: automatic(NORD, { settings: [ON_JUNE_FIRST, { enabled: false, createdAt: '2026-06-02T07:00:00.000Z' }] }) });
  assert.equal(switchedOff.value, null, 'réglage éteint : pareil');
  near(objective(ABRI, { gestures, goals, automatic: null }).value, 20, 'sous abri, l’objectif saisi');
});

test('garde : la pluie, l’ET0 et l’irrigation de chaque planche sont les mêmes, filtre actif ou non, sur deux fermes', () => {
  const everything = [put({ level: 'zone', zoneId: 'parcelle' }, BEFORE), put({ level: 'zone', zoneId: 'verger' }, BEFORE), put(PLEIN_CHAMP, BEFORE), put(SOUS_ABRI, BEFORE)];
  const events = [realIrrigation('arrosage-mardi', 'goutte-a-goutte', '2026-06-16T05:00:00.000Z', [NORD.id, ABRI.id], 10, 10), plannedOn(SUD.id, at(FRIDAY), 6)];
  // Deux fermes : la ferme complète, avec un pluviomètre ; une ferme de plein champ seul, à la pluie et à la prévision incomplètes.
  const farms = [
    { beds: FARM_BEDS, days: weekDays({ gaugeMm: { [MONDAY]: 12 }, reanalysisMm: { [TUESDAY]: 4 } }) },
    { beds: [SUD, VERGER], days: weekDays({ reanalysisMm: { [TUESDAY]: null }, forecastMm: { [SUNDAY]: null } }) },
  ];
  for (const farm of farms) {
    const plain = dashboard({ ...farm, events, decisions: [decision(SUD.id, 15)] });
    const filtered = dashboard({ ...farm, events, decisions: [decision(SUD.id, 15)], gestures: everything });
    assert.ok(rowsOf(filtered).every((bed) => objectiveOffSeason(bed)), 'toutes les planches sont hors saison');
    assert.deepEqual(rowsOf(filtered).map(untouched), rowsOf(plain).map(untouched));
    assert.deepEqual(filtered.completeness.missingDates, plain.completeness.missingDates, 'les jours de pluie, de prévision et d’ET0 manquants');
    assert.deepEqual(filtered.completeness.estimatedDates, plain.completeness.estimatedDates, 'les jours de pluie repris de la prévision');
  }
});

/*
 * La garde du contrat (section 8) : la pluie, la réserve du sol, l'ET0, la
 * météo et ses alertes, les cultures et l'archivage des prévisions ne passent
 * jamais par le filtre. Leurs modules de calcul n'y mènent par aucun import,
 * même de proche en proche ; les services de la météo, de la réserve du sol
 * et des alertes ne le nomment pas. Les imports de type seuls ne portent
 * aucun calcul et ne sont pas suivis.
 */
const FILTER_MODULES = ['lib/domain/off-season.ts', 'lib/domain/irrigation-needs.ts', 'lib/domain/farm-objective.ts'];
const FILTER_NAMES = /off-season|offSeason|OffSeason/;
const VALUE_IMPORT = /^\s*(?:import|export)\s+(?!type\b)[^;]*?\sfrom\s+'([^']+)'/gm;

function sourceFiles(path: string): string[] {
  if (statSync(path).isDirectory()) return readdirSync(path).flatMap((name) => sourceFiles(join(path, name)));
  return /\.(ts|js)$/.test(path) && !path.endsWith('.d.ts') ? [path] : [];
}

function resolveImport(from: string, specifier: string): string | null {
  if (!specifier.startsWith('.') && !specifier.startsWith('@/')) return null;
  const base = specifier.startsWith('@/') ? specifier.slice(2) : normalize(join(dirname(from), specifier));
  for (const candidate of [base, base.replace(/\.js$/, '.ts'), `${base}.ts`, join(base, 'index.ts')]) {
    if (existsSync(candidate) && statSync(candidate).isFile()) return candidate;
  }
  return null;
}

/** Les modules qu'atteignent les imports de valeur des fichiers donnés, de proche en proche, chacun avec celui qui l'importe. */
function reachedFrom(starts: readonly string[]): Map<string, string | null> {
  const reached = new Map<string, string | null>();
  const queue: [string, string | null][] = starts.flatMap(sourceFiles).map((file) => [file, null]);
  while (queue.length > 0) {
    const [file, importer] = queue.shift()!;
    if (reached.has(file)) continue;
    reached.set(file, importer);
    for (const match of readFileSync(file, 'utf8').matchAll(VALUE_IMPORT)) {
      const target = resolveImport(file, match[1]);
      if (target !== null && !reached.has(target)) queue.push([target, file]);
    }
  }
  return reached;
}

function chainTo(reached: Map<string, string | null>, file: string): string {
  const chain: string[] = [];
  for (let at: string | null | undefined = file; at; at = reached.get(at)) chain.unshift(at);
  return chain.join(' → ');
}

test('garde : les calculs de la pluie, de l’ET0, de la réserve du sol, des alertes et des cultures n’atteignent jamais le filtre', () => {
  const reached = reachedFrom([
    'lib/domain/water-management.ts',
    'lib/domain/weather',
    'lib/domain/crop-alerts',
    'lib/domain/soil-reserve',
    'lib/domain/crop-water',
  ]);
  assert.ok(reached.size > 50, `les modules de la garde sont bien lus (${reached.size})`);
  for (const filterModule of FILTER_MODULES) {
    assert.equal(reached.has(filterModule), false, `la règle s’y appellerait : ${reached.has(filterModule) ? chainTo(reached, filterModule) : filterModule}`);
  }
  for (const file of reached.keys()) assert.doesNotMatch(readFileSync(file, 'utf8'), FILTER_NAMES, `${file} nomme le filtre`);
});

test('garde : les services de la météo, de la réserve du sol et des alertes ne nomment pas le filtre', () => {
  const services = [
    ...sourceFiles('lib/services/weather'),
    'lib/services/soil-reserve-record.ts',
    'lib/services/crop-alerts-service.ts',
    'lib/services/weather-alerts-service.ts',
    'lib/services/intraday-weather-alerts.ts',
    ...sourceFiles('cloudflare/irrigation-weather-scheduler/src'),
  ];
  for (const file of services) assert.doesNotMatch(readFileSync(file, 'utf8'), FILTER_NAMES, `${file} nomme le filtre`);
});

test('contre-épreuve : la garde voit un calcul qui passerait par le filtre', () => {
  // Le tableau des besoins passe par le filtre : la garde le trouve, avec le chemin.
  const needs = reachedFrom(['lib/domain/irrigation-needs.ts']);
  assert.equal(needs.has('lib/domain/off-season.ts'), true);
  assert.equal(chainTo(needs, 'lib/domain/off-season.ts'), 'lib/domain/irrigation-needs.ts → lib/domain/off-season.ts');
  // L'objectif de la ferme aussi, et « Aujourd'hui » à travers lui.
  assert.equal(reachedFrom(['lib/domain/today/essential.ts']).has('lib/domain/off-season.ts'), true);
  // Un import de valeur est suivi ; un import de type seul ne l'est pas.
  assert.ok([..."import { offSeasonSchedule } from '../off-season.ts';".matchAll(VALUE_IMPORT)].length === 1);
  assert.ok([..."import type { OffSeasonDays } from '../off-season.ts';".matchAll(VALUE_IMPORT)].length === 0);
  assert.match("const days = schedule.daysOf(bed); // offSeason", FILTER_NAMES);
});

/**
 * Le stockage du filtre (B2, D-352) : la table et son lecteur, la lecture d'une
 * requête, les deux gestes. Les services gardés atteignent parfois la règle du
 * domaine par un module commun (le dépôt du planning, « Aujourd'hui ») ; sans
 * les portées, elle répond « en saison » : c'est le stockage qu'ils ne
 * doivent jamais atteindre.
 */
const FILTER_STORAGE = ['db/off-season-repository.ts', 'lib/services/off-season-source.ts', 'lib/services/off-season-service.ts'];

test('garde B2 : la météo, la pluie, la réserve du sol, l’archive des prévisions et les alertes ne lisent jamais les portées « hors saison »', () => {
  const reached = reachedFrom([
    'lib/services/water-dashboard.ts',
    'lib/services/today-weather.ts',
    'lib/services/soil-reserve-view.ts',
    'lib/services/soil-reserve-record.ts',
    'lib/services/crop-water-etm-record.ts',
    'lib/services/crop-alerts-view.ts',
    'lib/services/crop-alerts-service.ts',
    'lib/services/weather-alerts-view.ts',
    'lib/services/weather-alerts-service.ts',
    'lib/services/intraday-weather-alerts.ts',
    'lib/services/weather',
    'db/forecast-archive-repository.ts',
    'lib/services/automatic-objective-record.ts',
    'cloudflare/irrigation-weather-scheduler/src',
  ]);
  assert.ok(reached.size > 100, `les modules de la garde sont bien lus (${reached.size})`);
  for (const file of FILTER_STORAGE) {
    assert.equal(reached.has(file), false, `les portées s’y liraient : ${reached.has(file) ? chainTo(reached, file) : file}`);
  }
});

test('contre-épreuve B2 : la garde voit un service qui lit les portées, avec le chemin', () => {
  const needs = reachedFrom(['lib/services/irrigation-needs-service.ts']);
  assert.equal(chainTo(needs, 'lib/services/off-season-source.ts'), 'lib/services/irrigation-needs-service.ts → lib/services/off-season-source.ts');
  assert.equal(needs.has('db/off-season-repository.ts'), true, 'et la table à travers lui');
  // Le planning et l'historique aussi, par les besoins ou directement.
  assert.equal(reachedFrom(['lib/services/planning-service.ts']).has('lib/services/off-season-source.ts'), true);
  assert.equal(reachedFrom(['lib/services/irrigation-history-service.ts']).has('lib/services/off-season-source.ts'), true);
});

test('les cinq portées : une planche, un jardin ou un abri, une parcelle, tout le plein champ, tout le sous-abri', () => {
  const covered = (scope: OffSeasonScope) => FARM_BEDS.filter((bed) => offSeasonSchedule([put(scope, BEFORE)]).daysOf(bed)(MONDAY)).map((bed) => bed.id);
  assert.deepEqual(covered({ level: 'bed', bedId: NORD.id }), [NORD.id]);
  assert.deepEqual(covered(JARDIN_NORD), [NORD.id, NORD_2.id]);
  assert.deepEqual(covered({ level: 'plot', plotId: 'abri' }), [ABRI.id]);
  assert.deepEqual(covered({ level: 'zone', zoneId: 'parcelle' }), [NORD.id, NORD_2.id, SUD.id, ABRI.id, NEUVE.id]);
  assert.deepEqual(covered(PLEIN_CHAMP), [NORD.id, NORD_2.id, SUD.id, VERGER.id], 'tous les jardins de plein champ de la ferme, toutes parcelles');
  assert.deepEqual(covered(SOUS_ABRI), [ABRI.id]);
  // Évaluées à la lecture : un jardin reclassé suit la portée qui le couvre alors (section 4.3).
  const gestures = [put(PLEIN_CHAMP, BEFORE)];
  assert.deepEqual(offSeasonDays(gestures, { ...NORD, plotMode: 'greenhouse' }), [], 'reclassé sous abri : tout le plein champ ne le couvre plus');
  assert.deepEqual(offSeasonDays(gestures, { ...NEUVE, plotMode: 'garden' }), WEEK, 'classé plein champ : couvert');
});

test('l’ordre des gestes : le dernier du jour fait foi pour toute la journée ; à la même milliseconde, le second reçu', () => {
  assert.deepEqual(offSeasonDays([put(PLEIN_CHAMP, at(WEDNESDAY, '06:00')), resume(PLEIN_CHAMP, at(WEDNESDAY, '15:00'))], NORD), [], 'mis puis repris le même jour : en saison toute la journée');
  assert.deepEqual(offSeasonDays([resume(PLEIN_CHAMP, at(WEDNESDAY, '06:00')), put(PLEIN_CHAMP, at(WEDNESDAY, '15:00'))], NORD), [WEDNESDAY, THURSDAY, FRIDAY, SATURDAY, SUNDAY]);
  const instant = at(WEDNESDAY);
  assert.deepEqual(offSeasonDays([put(PLEIN_CHAMP, instant), resume(PLEIN_CHAMP, instant)], NORD), [], 'même milliseconde : le second reçu fait foi (docs/revision-order-contract.md)');
  assert.deepEqual(offSeasonDays([resume(PLEIN_CHAMP, instant), put(PLEIN_CHAMP, instant)], NORD), [WEDNESDAY, THURSDAY, FRIDAY, SATURDAY, SUNDAY]);
  assert.deepEqual(offSeasonDays([resume(PLEIN_CHAMP, at(THURSDAY)), put(PLEIN_CHAMP, at(MONDAY))], NORD), [MONDAY, TUESDAY, WEDNESDAY], 'reçus dans le désordre : l’instant fait foi');
  const twice = offSeasonSchedule([put(PLEIN_CHAMP, at(MONDAY)), put(PLEIN_CHAMP, at(THURSDAY))]);
  assert.deepEqual(twice.scopesCovering(NORD, SUNDAY), [{ scope: PLEIN_CHAMP, since: MONDAY }], 'un second « Mettre hors saison » ne change pas le jour de départ');
  assert.deepEqual(offSeasonDays([resume(PLEIN_CHAMP, BEFORE)], NORD), [], '« Reprendre » seul ne fait rien');
  assert.equal(offSeasonSchedule([put(PLEIN_CHAMP, BEFORE)]).daysOf(NORD)('2027-03-01'), true, 'ni date ni calendrier : le filtre ne se lève qu’à la main');
});

test('au tableau des besoins, une planche hors saison reste dans son jardin et sort de ses comptes', () => {
  const plain = dashboard();
  // Une planche du jardin Nord hors saison : le jardin se compte sur l'autre.
  const one = dashboard({ gestures: [put({ level: 'bed', bedId: NORD.id }, BEFORE)] });
  const north = garden(one, 'jardin-nord');
  assert.equal(north.bedCount, 2, 'la planche hors saison reste dans les lignes du jardin');
  assert.deepEqual(north.beds.map((bed) => bed.bedId), [NORD.id, NORD_2.id]);
  near(north.realRemainingMm, row(one, NORD_2.id).realRemainingMm!, 'le reste du jardin est celui de la planche en saison');
  near(north.effectiveNeedMm, row(one, NORD_2.id).effectiveNeedMm!);
  near(north.effectiveVolumeCubicMeters, row(one, NORD_2.id).effectiveVolumeCubicMeters!);
  assert.equal(north.areaSquareMeters, garden(plain, 'jardin-nord').areaSquareMeters, 'la surface du jardin ne change pas');
  // Tout le jardin Nord hors saison : ni reste, ni besoin, ni volume, jamais un zéro.
  const all = garden(dashboard({ gestures: [put(JARDIN_NORD, BEFORE)] }), 'jardin-nord');
  assert.equal(all.realRemainingMm, null);
  assert.equal(all.effectiveNeedMm, null);
  assert.equal(all.effectiveVolumeCubicMeters, null);
  assert.equal(all.bedCount, 2);
  // Les autres jardins ne bougent pas.
  assert.deepEqual(garden(one, 'abri'), garden(plain, 'abri'));
});

test('l’objectif de la ferme au tableau des besoins : « 2 planches sur 2 ont un objectif, 4 hors saison »', () => {
  const board = dashboard({ gestures: [put(PLEIN_CHAMP, BEFORE)] });
  assert.deepEqual(board.farmObjective, { objectiveMm: 20, withObjective: 2, total: 6, offSeason: 4 });
  assert.equal(farmObjectiveText(board.farmObjective), '20 mm visés, 2 planches sur 2 ont un objectif, 4 hors saison');
  assert.equal(board.completeness.missing.includes('objective'), false, 'aucun objectif manquant à l’échelle de la ferme');
  assert.deepEqual(dashboard().farmObjective, { objectiveMm: 20, withObjective: 6, total: 6 });
});

test('les comptes de l’objectif de la ferme : la moyenne sur les planches en saison, les planches hors saison dites à part', () => {
  const inSeason = Array.from({ length: 7 }, () => ({ areaSquareMeters: 100, objectiveMm: 20 }));
  const offSeason = Array.from({ length: 3 }, () => ({ areaSquareMeters: 100, objectiveMm: null, offSeasonDates: WEEK }));
  const objectiveOfFarm = farmObjective([...inSeason, ...offSeason]);
  assert.deepEqual(objectiveOfFarm, { objectiveMm: 20, withObjective: 7, total: 10, offSeason: 3 });
  assert.equal(farmObjectiveScopeText(objectiveOfFarm), '7 planches sur 7 ont un objectif, 3 hors saison', 'la phrase du contrat (section 4.1)');
  assert.equal(farmObjectiveText(objectiveOfFarm), '20 mm visés, 7 planches sur 7 ont un objectif, 3 hors saison');
  assert.equal(farmObjectivePartial(objectiveOfFarm), true, 'l’eau reçue se compare sur les seules planches qui ont un objectif');

  const withoutObjective = { areaSquareMeters: 100, objectiveMm: null };
  assert.equal(farmObjectiveScopeText(farmObjective([...inSeason.slice(0, 5), withoutObjective, withoutObjective, ...offSeason])), '5 planches sur 7 ont un objectif, 3 hors saison', 'une planche en saison sans objectif reste « sans objectif »');
  assert.equal(farmObjectiveText(farmObjective(offSeason)), 'aucune eau visée, 3 planches hors saison');
  assert.equal(farmObjectiveScopeText(farmObjective(offSeason)), 'aucune planche en saison, 3 hors saison');
  assert.equal(farmObjectiveText(farmObjective([withoutObjective, offSeason[0]])), 'aucune eau visée, 1 planche hors saison');
  assert.equal(farmObjectiveScopeText(farmObjective([withoutObjective, ...offSeason])), 'aucune planche sur 1 n’a d’objectif, 3 hors saison');
  assert.equal(farmObjectiveScopeText(farmObjective([{ areaSquareMeters: 100, objectiveMm: 20 }, offSeason[0]])), '1 planche sur 1 a un objectif, 1 hors saison');

  // Hors saison une partie de la période seulement, avec un objectif les autres jours : comptée avec son objectif.
  assert.deepEqual(farmObjective([{ areaSquareMeters: 100, objectiveMm: 12, offSeasonDates: [THURSDAY, FRIDAY, SATURDAY, SUNDAY] }]), { objectiveMm: 12, withObjective: 1, total: 1 });
  // Sans planche hors saison, le résultat et la phrase d'avant.
  assert.deepEqual(farmObjective(inSeason), { objectiveMm: 20, withObjective: 7, total: 7 });
  assert.equal(farmObjectiveText(farmObjective(inSeason)), '20 mm visés, ferme entière');
  assert.equal(farmObjectiveText(farmObjective([...inSeason, withoutObjective])), '20 mm visés, 7 planches sur 8 ont un objectif');
});

test('un besoin remplacé à la main reste enregistré, inactif, tant que la planche est hors saison sans objectif', () => {
  const decisions = [decision(NORD.id, 15)];
  near(row(dashboard({ decisions }), NORD.id).effectiveNeedMm, 15, 'en saison, le remplacement fait le besoin');
  const after = row(dashboard({ decisions, gestures: [put(PLEIN_CHAMP, BEFORE)] }), NORD.id);
  assert.equal(after.manualOverrideMm, 15, 'le remplacement reste là, rien n’est effacé');
  assert.equal(after.overrideReason, 'repiquage');
  assert.equal(after.effectiveNeedMm, null, 'aucun besoin, aucune proposition (section 4.1)');
  assert.equal(after.effectiveVolumeCubicMeters, null);
  // Hors saison depuis jeudi, avec trois jours d'objectif : la planche garde son besoin de la semaine.
  const partial = row(dashboard({ decisions, gestures: [put(PLEIN_CHAMP, at(THURSDAY))] }), NORD.id);
  assert.deepEqual(partial.offSeasonDates, [THURSDAY, FRIDAY, SATURDAY, SUNDAY]);
  near(partial.objectiveMm, 20 * 3 / 7, 'trois septièmes des 20 mm');
  near(partial.effectiveNeedMm, 15);
});
