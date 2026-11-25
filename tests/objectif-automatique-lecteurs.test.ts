import assert from 'node:assert/strict';
import test from 'node:test';
import {
  automaticObjectiveDayValues as dayValuesOver,
  automaticObjectivePeriod,
  type AutomaticObjectiveInput,
  type AutomaticObjectiveSettingRevision,
} from '../lib/domain/automatic-objective.ts';
import type { Et0Reading } from '../lib/domain/crop-water/etm.ts';
import type { BedWaterDay } from '../lib/domain/crop-water/proposal.ts';
import type { GoalRevisionLike } from '../lib/domain/irrigation-history/contract.ts';
import { aggregateHydricObjective } from '../lib/domain/irrigation-history/summary.ts';
import { objectiveForBed } from '../lib/domain/irrigation-needs.ts';

/**
 * L'objectif automatique, O2 : ce que lisent l'historique et les séries
 * (docs/objectif-automatique-contract.md, règle 7 ; D-309, D-317). Ils
 * composent l'objectif sur leur période, jour par jour : la valeur d'un jour
 * est celle qu'`objectiveForBed` lui donne, aucun ne recalcule la règle ; un
 * objectif saisi passe avant ; un jour sans valeur n'est jamais compté pour
 * zéro en silence (D-003). Semaine du lundi 15 au dimanche 21 juin 2026, ET0
 * 4,0 · 4,2 · 3,8 · 4,5 · 5,0 · 4,6 · 3,9 mm, soit 30,0 mm ; la suivante
 * 3,0 · 3,1 · 3,2 · 3,3 · 3,4 · 3,5 · 3,6 mm.
 */

const BED = { id: 'planche-a', zoneId: 'parcelle', plotId: 'jardin', area: 8 };
const SHELTERED_BED = { id: 'planche-s', zoneId: 'parcelle', plotId: 'serre', area: 24 };
const WEEK = ['2026-06-15', '2026-06-16', '2026-06-17', '2026-06-18', '2026-06-19', '2026-06-20', '2026-06-21'];
const NEXT_WEEK = ['2026-06-22', '2026-06-23', '2026-06-24', '2026-06-25', '2026-06-26', '2026-06-27', '2026-06-28'];
const [MONDAY, , , , , , SUNDAY] = WEEK;
const ET0 = [4.0, 4.2, 3.8, 4.5, 5.0, 4.6, 3.9];
const NEXT_ET0 = [3.0, 3.1, 3.2, 3.3, 3.4, 3.5, 3.6];
const ON_BEFORE: AutomaticObjectiveSettingRevision = { enabled: true, createdAt: '2026-06-01T07:00:00.000Z' };
const PERIOD = { startDate: MONDAY, endDate: SUNDAY };

const reanalysis = (values: readonly (number | null)[] = ET0, dates = WEEK): Et0Reading[] => dates.map((date, index) => ({ date, reanalysisMm: values[index], forecastMm: null }));

function automatic(overrides: Partial<AutomaticObjectiveInput> = {}): AutomaticObjectiveInput {
  return {
    settings: [ON_BEFORE],
    today: '2026-06-29',
    et0Readings: [...reanalysis(), ...reanalysis(NEXT_ET0, NEXT_WEEK)],
    plotMode: 'garden',
    shelterFactors: [],
    cropNeed: { status: 'off' },
    ...overrides,
  };
}

/** Un jour de la planche d'après sa culture, tel que `bedWaterDays` le rend. */
function cropDay(index: number, status: BedWaterDay['status'], etmMm: number | null): BedWaterDay {
  return { date: WEEK[index], status, etmMm, et0: { mm: ET0[index], nature: 'reanalysis' }, crops: [], irrigationStop: false, problems: [] };
}

/** Une culture au Kc `kc` du jour `from` au jour `until` de la semaine (inclus) ; aucune culture les autres jours. */
const cropBetween = (kc: number, from: number, until = 6): BedWaterDay[] => WEEK.map((_, index) => (
  index < from || index > until ? cropDay(index, 'no-crop', 0) : cropDay(index, 'computed', kc * ET0[index])
));

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

function near(actual: number | null | undefined, expected: number, message = '') {
  assert.ok(typeof actual === 'number' && Math.abs(actual - expected) < 1e-9, `${message} : attendu ${expected}, obtenu ${actual}`);
}

/** Les valeurs d'une planche aux jours `dates`, la période découpée avec les gestes de sa ferme. */
const automaticObjectiveDayValues = (input: AutomaticObjectiveInput, bed: { plotId: string }, dates: readonly string[]) => (
  dayValuesOver(input, bed, automaticObjectivePeriod(input.settings, dates))
);

/** Les valeurs d'une planche, prêtes pour l'historique ou les séries. */
const valuesOf = (entries: [string, Map<string, number | null>][]) => new Map(entries);

test('les valeurs jour par jour sont celles qu’objectiveForBed compose : leur somme est l’objectif de la semaine (règle 7)', () => {
  const scenarios: [string, AutomaticObjectiveInput][] = [
    ['plein champ, d’après l’ET0', automatic()],
    ['sous abri, ET0 × 0,8', automatic({ plotMode: 'greenhouse' })],
    ['d’après la culture, Kc 0,7', automatic({ cropNeed: { status: 'read', days: cropBetween(0.7, 0) } })],
    ['culture plantée le jeudi, Kc 0,5', automatic({ cropNeed: { status: 'read', days: cropBetween(0.5, 3) } })],
    ['ET0 du dimanche inconnue', automatic({ et0Readings: reanalysis([...ET0.slice(0, 6), null]) })],
    ['réglage allumé le mercredi', automatic({ settings: [{ enabled: true, createdAt: '2026-06-17T06:00:00.000Z' }] })],
    ['jardin à classer', automatic({ plotMode: 'unclassified' })],
    ['plan de culture non lu', automatic({ cropNeed: { status: 'unread' } })],
  ];
  for (const [name, input] of scenarios) {
    const values = automaticObjectiveDayValues(input, BED, WEEK);
    const week = objectiveForBed([], BED, MONDAY, SUNDAY, input);
    const valued = [...values.values()].filter((mm): mm is number => mm !== null);
    if (week.value === null) assert.equal(valued.length, 0, name);
    else near(valued.reduce((sum, mm) => sum + mm, 0), week.value, name);
    assert.deepEqual([...values.keys()], week.automatic?.days.map((day) => day.date) ?? [], `${name} : les mêmes jours`);
    assert.deepEqual([...values].filter(([, mm]) => mm === null).map(([date]) => date), week.automatic?.missingDates ?? [], `${name} : les mêmes jours sans valeur`);
  }
});

test('« sans culture de toute la semaine » se lit sur la semaine entière, même pour une période qui commence le jeudi (F772)', () => {
  // Une culture récoltée le mardi soir : la planche a porté une culture cette semaine, les jours suivants valent 0.
  const harvested = automaticObjectiveDayValues(automatic({ cropNeed: { status: 'read', days: cropBetween(0.7, 0, 1) } }), BED, WEEK.slice(3));
  assert.deepEqual([...harvested], WEEK.slice(3).map((date) => [date, 0]), '0, pas « pas d’objectif »');
  // Aucune culture de la semaine : pas d'objectif automatique, aucun jour ; ni zéro ni valeur manquante.
  const empty = automaticObjectiveDayValues(automatic({ cropNeed: { status: 'read', days: cropBetween(0.7, 7) } }), BED, WEEK.slice(3));
  assert.equal(empty.size, 0);
});

test('une période à cheval sur deux semaines : chaque jour prend la valeur de sa semaine ; éteint le lundi, plus rien ensuite', () => {
  const dates = [...WEEK.slice(3), ...NEXT_WEEK.slice(0, 3)];
  const both = automaticObjectiveDayValues(automatic(), BED, dates);
  assert.deepEqual([...both], dates.map((date, index) => [date, [...ET0.slice(3), ...NEXT_ET0.slice(0, 3)][index]]));

  const switchedOff = automaticObjectiveDayValues(
    automatic({ settings: [ON_BEFORE, { enabled: false, createdAt: '2026-06-22T05:00:00.000Z' }] }),
    BED, dates,
  );
  assert.deepEqual([...switchedOff.keys()], WEEK.slice(3), 'les jours d’avant le geste gardent leur valeur (règle 1)');
});

test('l’historique : sans objectif automatique, le résultat d’avant ; allumé, il remplit les jours sans objectif saisi', () => {
  const before = aggregateHydricObjective([], [BED], PERIOD);
  assert.deepEqual(before, {
    objectiveMm: null,
    objectiveAvailability: { availableBedDays: 0, totalBedDays: 7, complete: false },
    // Les planches de l'objectif (D-329) : aucune n'en a un.
    objectiveBeds: { withObjective: 0, total: 1, bedDays: 0 },
  });
  assert.equal('objectiveAutomatic' in before, false, 'réglage éteint, rien ne change (D-309)');

  const values = valuesOf([[BED.id, automaticObjectiveDayValues(automatic(), BED, WEEK)]]);
  const automaticOnly = aggregateHydricObjective([], [BED], PERIOD, values);
  near(automaticOnly.objectiveMm, 30, 'la semaine du contrat, cas 1');
  assert.deepEqual(automaticOnly.objectiveAvailability, { availableBedDays: 7, totalBedDays: 7, complete: true });
  assert.deepEqual(automaticOnly.objectiveAutomatic, { bedDays: 7, missingBedDays: 0, provisionalWeeks: 0 });

  // Un objectif de planche de 14 mm posé le lundi, vidé le jeudi : 3 × 2 + (4,5 + 5,0 + 4,6 + 3,9) = 24,0 mm (cas 6).
  const cleared = aggregateHydricObjective(
    [goal('bed', 14, '2026-06-15T05:00:00.000Z'), goal('bed', null, '2026-06-18T06:00:00.000Z')],
    [BED], PERIOD, values,
  );
  near(cleared.objectiveMm, 24, 'saisi d’abord, l’automatique ensuite');
  assert.deepEqual(cleared.objectiveAutomatic, { bedDays: 4, missingBedDays: 0, provisionalWeeks: 0 });
  assert.equal(cleared.objectiveAvailability.complete, true);

  // Un objectif de ferme saisi à 0 mm passe avant, comme tout objectif saisi (cas 5).
  const zero = aggregateHydricObjective([goal('farm', 0, '2026-06-01T07:00:00.000Z')], [BED], PERIOD, values);
  assert.equal(zero.objectiveMm, 0);
  assert.deepEqual(zero.objectiveAutomatic, { bedDays: 0, missingBedDays: 0, provisionalWeeks: 0 });
});

test('l’historique : un jour sans valeur n’est pas compté pour zéro en silence, il est compté à part (cas 8, D-003)', () => {
  const values = valuesOf([[BED.id, automaticObjectiveDayValues(automatic({ et0Readings: reanalysis([...ET0.slice(0, 6), null]) }), BED, WEEK)]]);
  const result = aggregateHydricObjective([], [BED], PERIOD, values);
  near(result.objectiveMm, 26.1, 'les six jours connus');
  assert.deepEqual(result.objectiveAvailability, { availableBedDays: 6, totalBedDays: 7, complete: false });
  assert.deepEqual(result.objectiveAutomatic, { bedDays: 6, missingBedDays: 1, provisionalWeeks: 0 });

  // Le même jour couvert par un objectif saisi : il compte, rien ne manque.
  const covered = aggregateHydricObjective([goal('bed', 7, '2026-06-21T06:00:00.000Z')], [BED], PERIOD, values);
  near(covered.objectiveMm, 26.1 + 1, 'le dimanche prend le septième de l’objectif saisi');
  assert.deepEqual(covered.objectiveAutomatic, { bedDays: 6, missingBedDays: 0, provisionalWeeks: 0 });
});

test('l’historique : plusieurs planches, chacune son objectif automatique, pondéré par sa surface', () => {
  const values = valuesOf([
    [BED.id, automaticObjectiveDayValues(automatic(), BED, WEEK)],
    [SHELTERED_BED.id, automaticObjectiveDayValues(automatic({ plotMode: 'greenhouse' }), SHELTERED_BED, WEEK)],
  ]);
  const result = aggregateHydricObjective([], [BED, SHELTERED_BED], PERIOD, values);
  near(result.objectiveMm, (30 * 8 + 24 * 24) / 32, '30 mm sur 8 m², 24 mm sous abri sur 24 m²');
  assert.deepEqual(result.objectiveAutomatic, { bedDays: 14, missingBedDays: 0, provisionalWeeks: 0 });
});
