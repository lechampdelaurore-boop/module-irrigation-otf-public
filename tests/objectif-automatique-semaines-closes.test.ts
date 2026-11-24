import assert from 'node:assert/strict';
import test from 'node:test';
import {
  automaticObjectiveClosedPeriod,
  automaticObjectiveDayValues,
  automaticObjectivePeriod,
  automaticObjectiveRecordSeasons,
  automaticObjectiveWeekRecord,
  type AutomaticObjectiveInput,
  type AutomaticObjectiveSettingRevision,
  type RecordedAutomaticObjectiveWeek,
} from '../lib/domain/automatic-objective.ts';
import type { Et0Reading } from '../lib/domain/crop-water/etm.ts';
import type { BedWaterDay } from '../lib/domain/crop-water/proposal.ts';
import type { GoalRevisionLike } from '../lib/domain/irrigation-history/contract.ts';
import { aggregateHydricObjective } from '../lib/domain/irrigation-history/summary.ts';
import { objectiveForBed } from '../lib/domain/irrigation-needs.ts';

/**
 * L'objectif automatique, O3 : une semaine finie ne bouge plus
 * (docs/objectif-automatique-contract.md, section 3, règle 6, et section 6 ;
 * D-318). La tâche du matin enregistre l'objectif automatique d'une semaine
 * close, par planche ; ses lecteurs le lisent dans cet enregistrement : ni la
 * météo relue, ni un Kc corrigé ne le changent. D'ici là, la semaine se relit
 * et se dit provisoire.
 *
 * Semaine du lundi 15 au dimanche 21 juin 2026, ET0 4,0 · 4,2 · 3,8 · 4,5 ·
 * 5,0 · 4,6 · 3,9 mm, soit 30,0 mm ; réglage allumé le 1er juin.
 */

const BED = { id: 'planche-a', zoneId: 'parcelle', plotId: 'jardin' };
const WEEK = ['2026-06-15', '2026-06-16', '2026-06-17', '2026-06-18', '2026-06-19', '2026-06-20', '2026-06-21'];
const [MONDAY, , , THURSDAY, , , SUNDAY] = WEEK;
const ET0 = [4.0, 4.2, 3.8, 4.5, 5.0, 4.6, 3.9];
/** Le lundi qui suit, matin de l'enregistrement. */
const NEXT_MONDAY = '2026-06-22';
/** Deux jours plus tard : la réanalyse est relue, un Kc a été corrigé. */
const NEXT_WEDNESDAY = '2026-06-24';
const ON_JUNE_FIRST: AutomaticObjectiveSettingRevision = { enabled: true, createdAt: '2026-06-01T07:00:00.000Z' };
const WHOLE_WEEK = { weekDates: WEEK, days: WEEK };

const reanalysis = (values: readonly number[]): Et0Reading[] => WEEK.map((date, index) => ({ date, reanalysisMm: values[index], forecastMm: null }));

function automatic(overrides: Partial<AutomaticObjectiveInput> = {}): AutomaticObjectiveInput {
  return {
    settings: [ON_JUNE_FIRST],
    today: NEXT_MONDAY,
    et0Readings: reanalysis(ET0),
    plotMode: 'garden',
    shelterFactors: [],
    cropNeed: { status: 'off' },
    ...overrides,
  };
}

/** Le besoin d'une culture au Kc `kc` toute la semaine, sur l'ET0 `et0`. */
const cropNeed = (kc: number, et0: readonly number[] = ET0): AutomaticObjectiveInput['cropNeed'] => ({
  status: 'read',
  days: WEEK.map((date, index): BedWaterDay => ({
    date, status: 'computed', etmMm: kc * et0[index], et0: { mm: et0[index], nature: 'reanalysis' }, crops: [], irrigationStop: false, problems: [],
  })),
});

const noCrop: AutomaticObjectiveInput['cropNeed'] = {
  status: 'read',
  days: WEEK.map((date, index): BedWaterDay => ({
    date, status: 'no-crop', etmMm: 0, et0: { mm: ET0[index], nature: 'reanalysis' }, crops: [], irrigationStop: false, problems: [],
  })),
};

function objective(input: AutomaticObjectiveInput, revisions: readonly GoalRevisionLike[] = []) {
  return objectiveForBed(revisions, BED, MONDAY, SUNDAY, input);
}

function near(actual: number | null | undefined, expected: number, message = '') {
  assert.ok(typeof actual === 'number' && Math.abs(actual - expected) < 1e-9, `${message} : attendu ${expected}, obtenu ${actual}`);
}

function goal(scope: GoalRevisionLike['scopeType'], amountMm: number | null, createdAt: string): GoalRevisionLike {
  return {
    id: `${scope}-${createdAt}`,
    weekStart: MONDAY,
    scopeType: scope,
    otfZoneId: scope === 'farm' ? null : BED.zoneId,
    otfPlotId: scope === 'farm' || scope === 'zone' ? null : BED.plotId,
    otfBedId: scope === 'bed' ? BED.id : null,
    amountMm,
    action: amountMm === null ? 'cleared' : 'set',
    createdAt,
  };
}

/** Enregistrée le lundi 22 juin au matin : la culture au Kc 0,7 sur l'ET0 du contrat, 21,0 mm. */
const RECORDED = automaticObjectiveWeekRecord(automatic({ cropNeed: cropNeed(0.7) }), BED, WHOLE_WEEK);
/** Le mercredi d'après : la réanalyse relue donne 1 mm de plus chaque jour, le Kc corrigé passe à 0,9. */
const AFTERWARDS = automatic({ today: NEXT_WEDNESDAY, et0Readings: reanalysis(ET0.map((mm) => mm + 1)), cropNeed: cropNeed(0.9, ET0.map((mm) => mm + 1)) });
const closed = (week: RecordedAutomaticObjectiveWeek, input = AFTERWARDS): AutomaticObjectiveInput => ({ ...input, closedWeeks: new Map([[MONDAY, week]]) });

test('preuve d’O3 : une semaine close enregistrée ne bouge plus quand la météo est relue ou qu’un Kc est corrigé (règle 6)', () => {
  assert.equal(RECORDED.noCropWeek, false);
  assert.deepEqual(RECORDED.days.map((day) => day.date), WEEK, 'les sept jours allumés, chacun avec sa valeur');
  near(RECORDED.days.reduce((sum, day) => sum + ('mm' in day ? day.mm : 0), 0), 21, 'Kc 0,7 × 30,0 mm');

  const reread = objective(AFTERWARDS);
  near(reread.value, 0.9 * 37, 'sans enregistrement, la semaine se relit : elle suit la météo et le Kc');
  assert.equal(reread.automatic?.closure, 'provisional', 'close, pas encore enregistrée : provisoire');

  const kept = objective(closed(RECORDED));
  near(kept.value, 21, 'enregistrée : la valeur du lundi matin');
  assert.equal(kept.origin, 'automatic');
  assert.equal(kept.automatic?.closure, 'recorded');
  assert.equal(kept.automatic?.basis, 'crop');
  near(kept.automatic?.byNature.reanalysis, 21);

  // L'enregistrement passe par la base en JSON : relu, il dit la même chose.
  const stored = JSON.parse(JSON.stringify(RECORDED)) as RecordedAutomaticObjectiveWeek;
  near(objective(closed(stored)).value, 21, 'relu depuis son JSON');

  // L'historique et les séries lisent les mêmes jours enregistrés.
  const values = automaticObjectiveDayValues(closed(RECORDED), BED, automaticObjectivePeriod([ON_JUNE_FIRST], WEEK));
  near(values.get(MONDAY), 0.7 * 4.0, 'le lundi enregistré');
  near(values.get(SUNDAY), 0.7 * 3.9, 'le dimanche enregistré');
});

test('la semaine en cours n’est jamais lue dans un enregistrement : elle suit chaque matin la météo (règle 5)', () => {
  const current = automatic({ today: THURSDAY, et0Readings: WEEK.map((date, index) => ({ date, reanalysisMm: null, forecastMm: ET0[index] })) });
  const result = objective(current);
  near(result.value, 30);
  assert.equal(result.automatic?.closure, 'open');
});

test('les natures de l’ET0 connues le matin de l’enregistrement restent celles de la semaine close (section 6)', () => {
  // Le lundi matin, la réanalyse du dimanche n'est pas arrivée : le dimanche est estimé sur sa prévision.
  const mondayReadings = reanalysis(ET0).map((reading) => (reading.date === SUNDAY ? { date: SUNDAY, reanalysisMm: null, forecastMm: 3.5 } : reading));
  const record = automaticObjectiveWeekRecord(automatic({ et0Readings: mondayReadings }), BED, WHOLE_WEEK);
  const result = objective(closed(record, automatic({ today: NEXT_WEDNESDAY })));
  near(result.value, 30 - 3.9 + 3.5, 'le dimanche garde sa valeur estimée');
  near(result.automatic?.byNature.estimated, 3.5, 'et sa nature, dite dans la bulle (O4)');
  near(result.automatic?.byNature.reanalysis, 30 - 3.9);
});

test('un jour sans valeur à l’enregistrement le reste, nommé, jamais compté pour zéro (D-003)', () => {
  const withoutSunday = reanalysis(ET0).filter((reading) => reading.date !== SUNDAY);
  const record = automaticObjectiveWeekRecord(automatic({ et0Readings: withoutSunday }), BED, WHOLE_WEEK);
  const result = objective(closed(record));
  near(result.value, 26.1);
  assert.deepEqual(result.automatic?.missingDates, [SUNDAY], 'la réanalyse arrivée après ne la complète pas');
});

test('une semaine enregistrée sans culture reste sans objectif automatique (règle 4)', () => {
  const record = automaticObjectiveWeekRecord(automatic({ cropNeed: noCrop }), BED, WHOLE_WEEK);
  assert.equal(record.noCropWeek, true);
  const result = objective(closed(record, automatic({ today: NEXT_WEDNESDAY, cropNeed: cropNeed(0.7) })));
  assert.equal(result.value, null, 'une culture ajoutée après coup au plan ne change pas la semaine close');
  assert.equal(result.automatic?.noCropWeek, true);
});

test('F784 : une planche absente d’une semaine enregistrée n’y a pas d’objectif automatique', () => {
  const result = objective(closed({ noCropWeek: false, days: [] }));
  assert.equal(result.value, null);
  assert.equal(result.origin, null);
  assert.deepEqual(result.automatic?.days, []);
  assert.equal(result.automatic?.closure, 'recorded');
});

test('l’enregistrement porte tous les jours allumés ; un objectif saisi passe toujours avant (cas 6 sur une semaine close)', () => {
  // Objectif de planche de 20 mm posé avant la semaine, vidé le jeudi : l'automatique remplit jeudi à dimanche.
  const revisions = [goal('bed', 20, '2026-06-08T08:00:00.000Z'), goal('bed', null, '2026-06-18T06:00:00.000Z')];
  const result = objective(closed(automaticObjectiveWeekRecord(automatic(), BED, WHOLE_WEEK)), revisions);
  near(result.value, 3 * 20 / 7 + 4.5 + 5.0 + 4.6 + 3.9, 'la valeur enregistrée de jeudi à dimanche, pas la réanalyse relue');
  assert.equal(result.origin, 'both');
  assert.deepEqual(result.automatic?.days.map((day) => day.date), WEEK.slice(3));
});

test('les semaines closes d’une saison : du 1er janvier au dernier dimanche passé, jours allumés seulement', () => {
  const mondays = (today: string, settings = [ON_JUNE_FIRST], season = 2026) => automaticObjectiveClosedPeriod(settings, season, today).map((week) => week.weekDates[0]);
  assert.equal(mondays(SUNDAY).at(-1), '2026-06-08', 'le dimanche, la semaine n’est pas close');
  assert.deepEqual(mondays(NEXT_MONDAY), ['2026-06-01', '2026-06-08', MONDAY], 'le lundi, elle l’est ; rien avant le geste');
  const fromThursday = automaticObjectiveClosedPeriod([{ enabled: true, createdAt: '2026-06-18T06:00:00.000Z' }], 2026, NEXT_MONDAY);
  assert.deepEqual(fromThursday.map((week) => week.days), [WEEK.slice(3)], 'allumé le jeudi : ses quatre jours');
  assert.deepEqual(mondays(NEXT_MONDAY, []), [], 'jamais allumé : rien à enregistrer');
});

test('F783 : une semaine à cheval sur deux années se ferme pour chacune de ses saisons ; la tâche du matin regarde aussi la saison d’avant', () => {
  const since = [{ enabled: true, createdAt: '2026-12-01T07:00:00.000Z' }];
  const lastOf2026 = automaticObjectiveClosedPeriod(since, 2026, '2027-01-04').at(-1);
  assert.deepEqual(lastOf2026, {
    weekDates: ['2026-12-28', '2026-12-29', '2026-12-30', '2026-12-31', '2027-01-01', '2027-01-02', '2027-01-03'],
    days: ['2026-12-28', '2026-12-29', '2026-12-30', '2026-12-31'],
  });
  assert.deepEqual(automaticObjectiveClosedPeriod(since, 2027, '2027-01-04').map((week) => week.days), [['2027-01-01', '2027-01-02', '2027-01-03']]);
  assert.equal(automaticObjectiveClosedPeriod(since, 2026, '2027-01-02').at(-1)?.weekDates[0], '2026-12-21', 'pas avant son dimanche');
  assert.deepEqual(automaticObjectiveRecordSeasons('2027-01-04'), [2026, 2027]);
  assert.deepEqual(automaticObjectiveRecordSeasons('2027-06-01'), [2026, 2027], 'passé janvier, une semaine de la saison d’avant se rattrape encore (F785)');
});

test('l’historique compte les semaines provisoires où l’objectif automatique s’est appliqué, pas celles qu’un objectif saisi couvre', () => {
  const bed = { ...BED, area: 8 };
  const values = new Map([[BED.id, new Map(WEEK.map((date, index) => [date, ET0[index]]))]]);
  const period = { startDate: MONDAY, endDate: SUNDAY };
  const provisional = new Set([MONDAY]);
  assert.equal(aggregateHydricObjective([], [bed], period, values, provisional).objectiveAutomatic?.provisionalWeeks, 1);
  assert.equal(aggregateHydricObjective([], [bed], period, values, new Set()).objectiveAutomatic?.provisionalWeeks, 0, 'enregistrée : rien de provisoire');
  const covered = [goal('farm', 20, '2026-06-08T08:00:00.000Z')];
  assert.equal(aggregateHydricObjective(covered, [bed], period, values, provisional).objectiveAutomatic?.provisionalWeeks, 0, 'l’objectif saisi couvre la semaine');
});
