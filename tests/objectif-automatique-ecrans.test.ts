import assert from 'node:assert/strict';
import test from 'node:test';
import type { AutomaticObjectiveInput, AutomaticObjectiveSettingRevision } from '../lib/domain/automatic-objective.ts';
import { goalsFoldLine } from '../lib/domain/besoins-phone.ts';
import type { Et0Reading } from '../lib/domain/crop-water/etm.ts';
import type { BedWaterDay } from '../lib/domain/crop-water/proposal.ts';
import type { GoalRevisionLike } from '../lib/domain/irrigation-history/contract.ts';
import { objectiveForBed } from '../lib/domain/irrigation-needs.ts';
import {
  AUTOMATIC_OBJECTIVE_SETTING_TEXT,
  automaticObjectiveMissingEt0Dates,
  automaticObjectiveOriginText,
  bedsKeepingEnteredGoal,
  groupObjectiveOriginText,
  historyObjectiveOriginText,
  objectiveFollowsCropNeed,
  objectiveOriginText,
  type ObjectiveOriginReading,
} from '../lib/domain/objective-reading.ts';
import { suggestionCauseLabel } from '../lib/domain/planning/follow-up.ts';
import { reliabilityChecks, reliabilityLines, reliabilityThresholdsText, type ReliabilityInputs } from '../lib/domain/today/reliability.ts';
import { todayWeek, type TodayWeekBed } from '../lib/domain/today/week.ts';

/**
 * L'objectif automatique, O4 : les écrans (docs/objectif-automatique-contract.md,
 * section 5 ; D-319). L'origine dite partout, la bulle et ses natures d'ET0,
 * « Adopter la proposition » retiré quand l'objectif suit déjà la culture,
 * les planches qui gardent un objectif saisi, la ligne « Objectif
 * automatique » de « Fiabilité du calcul ». Réglage éteint, rien ne change.
 * Semaine du lundi 15 au dimanche 21 juin 2026, ET0 4,0 · 4,2 · 3,8 · 4,5 ·
 * 5,0 · 4,6 · 3,9 mm, soit 30,0 mm (les cas chiffrés de la section 3).
 */

const BED = { id: 'planche-a', zoneId: 'parcelle', plotId: 'jardin' };
const WEEK = ['2026-06-15', '2026-06-16', '2026-06-17', '2026-06-18', '2026-06-19', '2026-06-20', '2026-06-21'];
const [MONDAY, , WEDNESDAY, THURSDAY, , , SUNDAY] = WEEK;
const ET0 = [4.0, 4.2, 3.8, 4.5, 5.0, 4.6, 3.9];
const NEXT_MONDAY = '2026-06-22';
const ON_BEFORE: AutomaticObjectiveSettingRevision = { enabled: true, createdAt: '2026-06-01T07:00:00.000Z' };
const reanalysis = (values: readonly (number | null)[] = ET0): Et0Reading[] => WEEK.map((date, index) => ({ date, reanalysisMm: values[index], forecastMm: null }));

function automatic(overrides: Partial<AutomaticObjectiveInput> = {}): AutomaticObjectiveInput {
  return { settings: [ON_BEFORE], today: NEXT_MONDAY, et0Readings: reanalysis(), plotMode: 'garden', shelterFactors: [], cropNeed: { status: 'off' }, ...overrides };
}

function goal(scope: GoalRevisionLike['scopeType'], amountMm: number | null, createdAt: string): GoalRevisionLike {
  return {
    id: `${scope}-${createdAt}`, weekStart: MONDAY, scopeType: scope,
    otfZoneId: scope === 'farm' ? null : BED.zoneId,
    otfPlotId: scope === 'farm' || scope === 'zone' ? null : BED.plotId,
    otfBedId: scope === 'bed' ? BED.id : null,
    amountMm, action: amountMm === null ? 'cleared' : 'set', createdAt,
  };
}

/** Ce qu'un écran lit d'une planche : l'origine et le détail de l'objectif automatique, comme le tableau des besoins les rend (F780). */
function reading(input: AutomaticObjectiveInput | undefined, revisions: readonly GoalRevisionLike[] = []): ObjectiveOriginReading & { value: number | null } {
  const objective = objectiveForBed(revisions, BED, MONDAY, SUNDAY, input);
  return { objectiveOrigin: objective.origin, automaticObjective: objective.automatic, value: objective.value };
}

function cropDay(index: number, status: BedWaterDay['status'], etmMm: number | null): BedWaterDay {
  return { date: WEEK[index], status, etmMm, et0: { mm: ET0[index], nature: 'reanalysis' }, crops: [], irrigationStop: false, problems: [] };
}

test('la phrase du réglage est celle du contrat (section 5, point 1)', () => {
  assert.equal(AUTOMATIC_OBJECTIVE_SETTING_TEXT, 'Sans objectif saisi, l’objectif d’une planche suit chaque matin le besoin de sa culture, ou l’ET0 quand ce besoin n’est pas connu.');
});

test('l’origine dite : saisi, automatique d’après la culture, d’après l’ET0, d’après l’ET0 sous abri, ou les deux (section 5, point 3)', () => {
  assert.equal(objectiveOriginText(reading(automatic())), 'automatique, d’après l’ET0', 'cas 1');
  assert.equal(objectiveOriginText(reading(automatic({ plotMode: 'greenhouse' }))), 'automatique, d’après l’ET0 sous abri', 'cas 2');
  const crop = WEEK.map((_, index) => cropDay(index, 'computed', 0.7 * ET0[index]));
  assert.equal(objectiveOriginText(reading(automatic({ cropNeed: { status: 'read', days: crop } }))), 'automatique, d’après le besoin de la culture', 'cas 3');
  const half = WEEK.map((_, index) => (index < 3 ? cropDay(index, 'computed', 0.7 * ET0[index]) : cropDay(index, 'no-etm', null)));
  assert.equal(objectiveOriginText(reading(automatic({ cropNeed: { status: 'read', days: half } }))), 'automatique, d’après la culture et l’ET0', 'la culture puis l’ET0 faute de besoin connu');
  // Cas 6 : un objectif de planche vidé le jeudi : les deux.
  const both = reading(automatic(), [goal('bed', 20, '2026-06-15T07:00:00.000Z'), goal('bed', null, '2026-06-18T07:00:00.000Z')]);
  assert.equal(objectiveOriginText(both), 'saisi et automatique, d’après l’ET0', 'cas 6');
  // Cas 5 : un objectif de ferme toute la semaine : l'automatique ne s'applique à aucun jour, l'écran d'avant.
  assert.equal(objectiveOriginText(reading(automatic(), [goal('farm', 20, '2026-06-01T07:00:00.000Z')])), null, 'cas 5');
  // Cas 11 : réglage éteint, rien de plus à dire.
  assert.equal(objectiveOriginText(reading(undefined)), null, 'cas 11');
  assert.equal(objectiveOriginText(reading(automatic({ settings: [] }))), null, 'jamais allumé');
});

test('une semaine sans valeur ou sans culture le dit, jamais un zéro silencieux (D-003)', () => {
  const noCrop = WEEK.map((_, index) => cropDay(index, 'no-crop', 0));
  const empty = reading(automatic({ cropNeed: { status: 'read', days: noCrop } }));
  assert.equal(empty.value, null);
  assert.equal(objectiveOriginText(empty), 'automatique : pas de culture cette semaine', 'cas 9');
  assert.match(automaticObjectiveOriginText(empty) ?? '', /aucune culture de la semaine/);
  const unknown = reading(automatic({ et0Readings: reanalysis(ET0.map(() => null)) }));
  assert.equal(objectiveOriginText(unknown), 'automatique, sans valeur : aucun jour n’est connu');
  assert.match(automaticObjectiveOriginText(unknown) ?? '', /aucun n’a de valeur/);
});

test('la bulle donne les jours, la base, les natures d’ET0, les jours sans valeur nommés et la clôture (section 5, point 3)', () => {
  // Cas 8 : ET0 du dimanche inconnue, semaine close relue (provisoire faute d'enregistrement).
  const values = [...ET0.slice(0, 6), null];
  const incomplete = reading(automatic({ et0Readings: reanalysis(values) }));
  const text = automaticObjectiveOriginText(incomplete) ?? '';
  assert.match(text, /^Objectif automatique sur 7 jours : 26,1 mm d’après l’ET0\./);
  assert.match(text, /Dont 26,1 mm sur réanalyse\./);
  assert.match(text, /Sans valeur, non comptés : dim\. 21 juin \(ET0 manquante\)\./);
  assert.match(text, /Semaine close, provisoire : la tâche du matin l’enregistrera\./);
  // Cas 2 : sous abri, le K_abri est dit.
  const sheltered = automaticObjectiveOriginText(reading(automatic({ plotMode: 'greenhouse' }))) ?? '';
  assert.match(sheltered, /24 mm d’après l’ET0 sous abri\./);
  assert.match(sheltered, /multipliée par le K_abri, 0,8\./);
  // La semaine en cours : la prévision et la réanalyse distinguées, mise à jour chaque matin.
  const open = reading(automatic({ today: THURSDAY, et0Readings: WEEK.map((date, index) => ({ date, reanalysisMm: index < 3 ? ET0[index] : null, forecastMm: ET0[index] })) }));
  const openText = automaticObjectiveOriginText(open) ?? '';
  assert.match(openText, /Dont 12 mm sur réanalyse, 18 mm sur prévision\./);
  assert.match(openText, /Mis à jour chaque matin avec la météo\./);
  // Une semaine close enregistrée ne bouge plus.
  const recorded = reading(automatic({ closedWeeks: new Map([[MONDAY, { noCropWeek: false, days: WEEK.map((date, index) => ({ date, status: 'et0' as const, mm: ET0[index], nature: 'reanalysis' as const, shelterFactor: null, cropNeedUnknown: false })) }]]) }));
  assert.match(automaticObjectiveOriginText(recorded) ?? '', /Semaine close, enregistrée : elle ne bouge plus\./);
  // Les deux : les autres jours, l'objectif saisi passe avant.
  const both = reading(automatic(), [goal('bed', 20, '2026-06-15T07:00:00.000Z'), goal('bed', null, '2026-06-18T07:00:00.000Z')]);
  assert.match(automaticObjectiveOriginText(both) ?? '', /^Objectif automatique sur 4 jours : 18 mm d’après l’ET0\. .*Les autres jours, l’objectif saisi passe avant\./);
  assert.equal(automaticObjectiveOriginText(reading(undefined)), null, 'réglage éteint : pas de bulle');
});

test('une planche dont l’objectif automatique est déjà le besoin de la culture n’a rien à adopter (section 5, point 4)', () => {
  const crop = WEEK.map((_, index) => cropDay(index, 'computed', 0.7 * ET0[index]));
  const follows = objectiveForBed([], BED, MONDAY, SUNDAY, automatic({ cropNeed: { status: 'read', days: crop } }));
  assert.equal(objectiveFollowsCropNeed(follows), true);
  assert.equal(objectiveFollowsCropNeed(objectiveForBed([], BED, MONDAY, SUNDAY, automatic())), false, 'd’après l’ET0 : la proposition reste à adopter');
  const half = WEEK.map((_, index) => (index < 3 ? cropDay(index, 'computed', 0.7 * ET0[index]) : cropDay(index, 'no-etm', null)));
  assert.equal(objectiveFollowsCropNeed(objectiveForBed([], BED, MONDAY, SUNDAY, automatic({ cropNeed: { status: 'read', days: half } }))), false, 'en partie d’après l’ET0');
  const both = objectiveForBed([goal('bed', 20, '2026-06-15T07:00:00.000Z'), goal('bed', null, '2026-06-18T07:00:00.000Z')], BED, MONDAY, SUNDAY, automatic({ cropNeed: { status: 'read', days: crop } }));
  assert.equal(objectiveFollowsCropNeed(both), false, 'un objectif saisi une partie de la semaine');
  assert.equal(objectiveFollowsCropNeed(objectiveForBed([], BED, MONDAY, SUNDAY)), false, 'réglage éteint');
});

test('en allumant, l’écran compte les planches de la saison qui gardent un objectif saisi (section 5, point 2)', () => {
  const beds = [
    { id: 'a1', zoneId: 'z1', plotId: 'p1', seasons: [2026] },
    { id: 'a2', zoneId: 'z1', plotId: 'p1', seasons: [2026] },
    { id: 'b1', zoneId: 'z1', plotId: 'p2', seasons: [2026] },
    { id: 'c1', zoneId: 'z2', plotId: 'p3', seasons: [2026] },
    { id: 'old', zoneId: 'z2', plotId: 'p3', seasons: [2025] },
  ];
  const farm = { otfZoneId: null, otfPlotId: null, otfBedId: null };
  assert.equal(bedsKeepingEnteredGoal([farm], beds, 2026), 4, 'un objectif de ferme les couvre toutes (cas 5)');
  assert.equal(bedsKeepingEnteredGoal([{ otfZoneId: 'z1', otfPlotId: 'p1', otfBedId: null }], beds, 2026), 2, 'un jardin');
  assert.equal(bedsKeepingEnteredGoal([{ otfZoneId: 'z1', otfPlotId: null, otfBedId: null }, { otfZoneId: 'z2', otfPlotId: 'p3', otfBedId: 'c1' }], beds, 2026), 4, 'une parcelle et une planche');
  assert.equal(bedsKeepingEnteredGoal([], beds, 2026), 0);
});

test('le résumé du volet dit le réglage allumé ; éteint, il est celui d’avant', () => {
  assert.equal(goalsFoldLine(0, null), 'Aucun objectif pour cette semaine.');
  assert.equal(goalsFoldLine(3, 25), 'Toute la ferme : 25 mm · 3 objectifs');
  assert.equal(goalsFoldLine(0, null, true), 'Objectif automatique allumé, aucun objectif saisi.');
  assert.equal(goalsFoldLine(3, 25, true), 'Objectif automatique allumé · Toute la ferme : 25 mm · 3 objectifs');
});

/** Une planche de « Aujourd'hui », lue du tableau des besoins. */
function todayBed(plotId: string, objectiveMm: number | null, origin: ObjectiveOriginReading): TodayWeekBed {
  return {
    plotId, plotName: plotId === 'j1' ? 'Jardin Nord' : 'Jardin Sud', sheltered: false, areaSquareMeters: 10,
    objectiveMm, actualRainMm: 2, actualIrrigationMm: 5, realRemainingMm: objectiveMm === null ? null : Math.max(0, objectiveMm - 7),
    ...origin,
  };
}

test('« Aujourd’hui » dit l’origine sur la tuile et sur les lignes ; réglage éteint, rien ne change', () => {
  const et0 = reading(automatic());
  const entered = { objectiveOrigin: 'entered', automaticObjective: null } as const;
  const week = (beds: TodayWeekBed[]) => todayWeek({ weekStart: MONDAY, weekEnd: SUNDAY, beds, water: null });
  const allAuto = week([todayBed('j1', 30, et0), todayBed('j1', 30, et0)]);
  assert.equal(allAuto?.tiles.objectiveDetail, 'ferme entière, du lun. 15 juin au dim. 21 juin · objectif automatique, d’après l’ET0');
  assert.equal(allAuto?.farm.text, '7 / 30 mm, objectif automatique');
  const mixed = week([todayBed('j1', 30, et0), todayBed('j2', 20, entered)]);
  assert.match(mixed?.tiles.objectiveDetail ?? '', / · objectif saisi et automatique$/);
  assert.equal(mixed?.shown.find((row) => row.name === 'Jardin Sud')?.text, '7 / 20 mm', 'un jardin tout saisi : la ligne d’avant');
  assert.equal(mixed?.shown.find((row) => row.name === 'Jardin Nord')?.text, '7 / 30 mm, objectif automatique');
  // Réglage éteint (aucune origine automatique), ou planches lues sans origine : la phrase d'avant.
  const before = week([todayBed('j1', 30, entered), { ...todayBed('j2', 20, entered), objectiveOrigin: undefined, automaticObjective: undefined }]);
  assert.equal(before?.tiles.objectiveDetail, 'ferme entière, du lun. 15 juin au dim. 21 juin');
  assert.equal(before?.farm.text, '7 / 25 mm');
  assert.equal(groupObjectiveOriginText([et0, reading(automatic({ plotMode: 'greenhouse' }))]), 'automatique', 'deux bases : un mot');
});

test('l’historique dit la part de l’objectif automatique dans l’objectif de la période', () => {
  assert.equal(historyObjectiveOriginText(70, undefined), null, 'réglage jamais allumé');
  assert.equal(historyObjectiveOriginText(70, { bedDays: 0 }), null, 'il n’a rempli aucun jour');
  assert.equal(historyObjectiveOriginText(70, { bedDays: 70 }), 'Objectif automatique');
  assert.equal(historyObjectiveOriginText(70, { bedDays: 21 }), 'Objectif saisi et automatique : 21 journées-planche automatiques sur 70');
});

test('le planning dit quand l’objectif d’une suggestion est automatique', () => {
  const format = { dateTime: (iso: string) => iso, time: (iso: string) => iso, day: (key: string) => key };
  const cause = {
    kind: 'useful-dose' as const, bedId: 'a', bedName: 'A', objectiveMm: 21, manual: false, actualRainMm: 0, forecastRainMm: 0,
    actualIrrigationMm: 0, earlierPlannedMm: 0, needBeforeMm: 21, usefulMm: 2, plannedMm: 10, minimumMm: 3, lastDay: false,
  };
  assert.match(suggestionCauseLabel(cause, format), /^A : objectif 21 mm/);
  assert.match(suggestionCauseLabel({ ...cause, objectiveOrigin: 'automatic' }, format), /^A : objectif automatique 21 mm/);
  assert.match(suggestionCauseLabel({ ...cause, objectiveOrigin: 'both' }, format), /^A : objectif saisi et automatique 21 mm/);
});

test('les jours sans ET0 de la semaine, réglage allumé ; éteint aujourd’hui, rien n’est suivi (section 5, point 5)', () => {
  const readings: Et0Reading[] = WEEK.map((date, index) => ({ date, reanalysisMm: index < 2 ? ET0[index] : null, forecastMm: index === 4 || index === 6 ? null : ET0[index] }));
  // Le mercredi, les jours passés sans réanalyse prennent la prévision (estimé) ; le vendredi et le dimanche n'ont rien.
  assert.deepEqual(automaticObjectiveMissingEt0Dates([ON_BEFORE], readings, WEEK, WEDNESDAY), ['2026-06-19', '2026-06-21']);
  assert.equal(automaticObjectiveMissingEt0Dates([], readings, WEEK, WEDNESDAY), null, 'jamais allumé');
  const offToday: AutomaticObjectiveSettingRevision[] = [ON_BEFORE, { enabled: false, createdAt: '2026-06-17T07:00:00.000Z' }];
  assert.equal(automaticObjectiveMissingEt0Dates(offToday, readings, WEEK, WEDNESDAY), null, 'éteint ce matin');
  // Allumé le jeudi : seuls les jours à partir du jeudi comptent.
  const onThursday: AutomaticObjectiveSettingRevision[] = [{ enabled: true, createdAt: '2026-06-18T07:00:00.000Z' }];
  assert.deepEqual(automaticObjectiveMissingEt0Dates(onThursday, readings, WEEK, THURSDAY), ['2026-06-19', '2026-06-21']);
  assert.deepEqual(automaticObjectiveMissingEt0Dates(onThursday, WEEK.map((date) => ({ date, reanalysisMm: null, forecastMm: null })), WEEK, THURSDAY), WEEK.slice(3));
});

const RELIABILITY: ReliabilityInputs = {
  enabled: ['besoins'],
  now: new Date('2026-06-17T10:00:00.000Z'),
  reservoirs: [],
  actualRainMissingDates: [],
  soilGardensNeverObserved: [],
  speciesWithoutReference: [],
  planComputedAt: null,
};

test('« Fiabilité du calcul » : la ligne « Objectif automatique » dit les jours sans ET0 et mène à la météo, réglage allumé seulement', () => {
  const off = reliabilityChecks(RELIABILITY, reliabilityLines(RELIABILITY));
  assert.deepEqual(off.map((check) => check.kind), ['actual-rain'], 'réglage éteint : la donnée n’est pas suivie');
  const okInput = { ...RELIABILITY, automaticObjectiveMissingEt0Dates: [] };
  const ok = reliabilityChecks(okInput, reliabilityLines(okInput));
  assert.deepEqual(ok.map((check) => [check.kind, check.ok, check.summary]), [
    ['actual-rain', true, 'Notée les 7 derniers jours'],
    ['automatic-objective', true, 'ET0 connue chaque jour de la semaine'],
  ]);
  assert.deepEqual(ok[1].link, { page: 'semaine', anchor: 'meteo-de-reference' });
  const todo = { ...RELIABILITY, automaticObjectiveMissingEt0Dates: ['2026-06-21', '2026-06-19'] };
  const lines = reliabilityLines(todo);
  assert.deepEqual(lines, [{
    kind: 'automatic-objective',
    key: 'automatic-objective',
    text: 'Objectif automatique incomplet : 2 jours sans ET0 cette semaine (ven. 19 juin, dim. 21 juin). Ces jours ne comptent pas dans l’objectif automatique.',
    action: { kind: 'link', label: 'Voir la météo de référence', page: 'semaine', anchor: 'meteo-de-reference' },
  }]);
  const check = reliabilityChecks(todo, lines).find((item) => item.kind === 'automatic-objective');
  assert.equal(check?.summary, '2 jours sans ET0 : non comptés');
  assert.equal(check?.link, null);
  // « Objectifs et besoins » décochée : rien n'est suivi, même réglage allumé (R1).
  assert.deepEqual(reliabilityLines({ ...todo, enabled: ['planning'] }).filter((line) => line.kind === 'automatic-objective'), []);
  assert.match(reliabilityThresholdsText(), /quand l’ET0 manque un jour de la semaine où l’objectif automatique est allumé/);
});
