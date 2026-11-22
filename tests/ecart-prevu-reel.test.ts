import assert from 'node:assert/strict';
import test from 'node:test';
import {
  appliedWaterGapPeriod,
  appliedWaterGaps,
  appliedWaterGapSignals,
  heldProposal,
  parseGapAdoption,
  type BedObjectiveReading,
  type CurrentSetting,
  type GapBed,
  type RainDay,
} from '../lib/domain/applied-water-gap.ts';
import { flowCauseText, gapPercentText, objectiveCauseText, rainCauseText, settingRatesText } from '../lib/domain/applied-water-gap-text.ts';
import type { EquipmentSettingRecord } from '../lib/domain/equipment-record.ts';
import type { IrrigationEventRecord } from '../lib/domain/irrigation-event-record.ts';

/**
 * L'écart prévu/réel expliqué (amélioration n° 5,
 * docs/ameliorations-4-5-contract.md, section 4, F733 et F734) : les trois
 * dernières semaines complètes, le signal quand chacune s'écarte de plus de
 * 20 % dans le même sens, les causes que les données soutiennent.
 */

const TODAY = '2026-11-18'; // mercredi : la semaine en cours commence le lundi 16 novembre
const WEEK_1 = '2026-10-27T06:00:00.000Z'; // mardi 27 octobre, 7 h à la ferme
const WEEK_2 = '2026-11-03T06:00:00.000Z';
const WEEK_3 = '2026-11-10T06:00:00.000Z';
const HOUR = 3600;

const DRIP: EquipmentSettingRecord = { id: 'standard', name: 'Standard', position: 0, kind: 'drip', rateMmPerHour: 6 };
const SPRINKLER: EquipmentSettingRecord = {
  id: 'rampe', name: 'Rampe', position: 0, kind: 'sprinkler',
  leftProfile: [{ distanceMeters: 0, rateMmPerHour: 10 }, { distanceMeters: 2, rateMmPerHour: 6 }, { distanceMeters: 4, rateMmPerHour: 0 }],
  rightProfile: [{ distanceMeters: 3, rateMmPerHour: 4 }, { distanceMeters: 0, rateMmPerHour: 10 }],
};

type Options = {
  bed?: string;
  status?: 'planned' | 'completed' | 'partially_completed' | 'canceled';
  plannedSeconds?: number;
  actualSeconds?: number;
  setting?: EquipmentSettingRecord;
  /** Saisie après coup : pas de début prévu, une quantité prévue nulle. */
  afterTheFact?: boolean;
  running?: boolean;
};

let sequence = 0;

/** Une irrigation d'une planche ; les quantités suivent le débit du réglage et les durées, comme en base. */
function irrigation(startAt: string, options: Options = {}): IrrigationEventRecord {
  const status = options.status ?? 'completed';
  const setting = options.setting ?? DRIP;
  const rate = setting.kind === 'drip' ? setting.rateMmPerHour : 6;
  const plannedSeconds = options.afterTheFact ? 0 : options.plannedSeconds ?? HOUR;
  const actualSeconds = status === 'planned' || status === 'canceled' ? 0 : options.actualSeconds ?? plannedSeconds;
  const id = `irrigation-${sequence += 1}`;
  return {
    id, season: 2026, status, note: null, remainingCanceledAt: null,
    canceledAt: status === 'canceled' ? '2026-11-01T00:00:00.000Z' : null,
    createdAt: '2026-10-20T00:00:00.000Z', updatedAt: '2026-10-20T00:00:00.000Z',
    equipment: {
      id: `ee-${id}`, equipmentId: 'goutte-nord', settingId: setting.id, placementId: 'pose', status,
      plannedStartAt: options.afterTheFact ? null : startAt,
      plannedEndAt: options.afterTheFact ? null : new Date(Date.parse(startAt) + plannedSeconds * 1000).toISOString(),
      actualStartAt: actualSeconds > 0 || options.running ? startAt : null,
      actualEndAt: actualSeconds > 0 ? new Date(Date.parse(startAt) + actualSeconds * 1000).toISOString() : null,
      plannedDurationSeconds: plannedSeconds,
      actualDurationSeconds: actualSeconds,
      equipmentSnapshot: { id: 'goutte-nord', name: 'Goutte-à-goutte nord', kind: setting.kind, mobility: 'fixed' },
      settingSnapshot: setting,
      timerState: options.running ? 'running' : null,
      remainingCanceledAt: null,
      canceledAt: status === 'canceled' ? '2026-11-01T00:00:00.000Z' : null,
      applications: [{
        otfZoneId: 'zone', otfPlotId: 'verger', otfBedId: options.bed ?? 'v01',
        rateMmPerHour: rate, bedAreaSquareMeters: 30, wettedAreaSquareMeters: 30,
        plannedAmountMm: rate * plannedSeconds / HOUR,
        actualAmountMm: rate * actualSeconds / HOUR,
      }],
    },
  } as unknown as IrrigationEventRecord;
}

const BEDS: GapBed[] = [{ id: 'v01', name: 'V01', plotName: 'Jardin du verger', outdoors: true }];

function current(setting: EquipmentSettingRecord = DRIP, rates?: Partial<EquipmentSettingRecord>): Map<string, CurrentSetting> {
  const record = { ...setting, ...rates } as EquipmentSettingRecord;
  return new Map([[record.id, {
    equipmentId: 'goutte-nord', equipmentName: 'Goutte-à-goutte nord', settingId: record.id, settingName: record.name,
    rates: record.kind === 'drip'
      ? { kind: 'drip', rateMmPerHour: record.rateMmPerHour }
      : { kind: 'sprinkler', leftProfile: [...record.leftProfile].sort((a, b) => a.distanceMeters - b.distanceMeters), rightProfile: [...record.rightProfile].sort((a, b) => a.distanceMeters - b.distanceMeters) },
  }]]);
}

function gaps(events: IrrigationEventRecord[], options: {
  beds?: GapBed[];
  settings?: Map<string, CurrentSetting>;
  rain?: RainDay[];
  objectives?: Map<string, BedObjectiveReading> | null;
} = {}) {
  return appliedWaterGaps({
    today: TODAY, events, beds: options.beds ?? BEDS, currentSettings: options.settings ?? current(),
    rain: options.rain ?? [], objectives: options.objectives === undefined ? null : options.objectives,
  });
}

/** Trois semaines plus longues que prévu, de 50 % : 6 mm prévus, 9 mm apportés chaque semaine. */
const LONGER = [WEEK_1, WEEK_2, WEEK_3].map((start) => irrigation(start, { actualSeconds: 1.5 * HOUR }));
/** Trois semaines arrêtées en route : 6 mm prévus, 4,2 mm apportés (−30 %). */
const SHORTER = [WEEK_1, WEEK_2, WEEK_3].map((start) => irrigation(start, { status: 'partially_completed', actualSeconds: 0.7 * HOUR }));

test('la période : les trois dernières semaines complètes, lundi à dimanche, avant la semaine en cours', () => {
  assert.deepEqual(appliedWaterGapPeriod(TODAY), {
    currentWeekStart: '2026-11-16',
    weeks: [
      { weekStart: '2026-10-26', weekEnd: '2026-11-01' },
      { weekStart: '2026-11-02', weekEnd: '2026-11-08' },
      { weekStart: '2026-11-09', weekEnd: '2026-11-15' },
    ],
    start: '2026-10-26',
    end: '2026-11-15',
  });
  assert.equal(appliedWaterGapPeriod('2026-11-16').currentWeekStart, '2026-11-16', 'le lundi est déjà la semaine en cours');
  assert.equal(appliedWaterGapPeriod('2026-11-22').start, '2026-10-26', 'le dimanche aussi');
});

test('trois semaines plus longues que prévu : le signal, semaine par semaine, et la cause du débit', () => {
  const [gap] = gaps(LONGER);
  assert.equal(gap.bedId, 'v01');
  assert.equal(gap.direction, 'more');
  assert.equal(gap.doneIrrigations, 3);
  assert.deepEqual(gap.weeks.map((week) => [week.weekStart, week.plannedMm, week.appliedMm, Math.round(week.gapPercent)]), [
    ['2026-10-26', 6, 9, 50], ['2026-11-02', 6, 9, 50], ['2026-11-09', 6, 9, 50],
  ]);
  assert.deepEqual(gap.causes, [{
    kind: 'flow', equipmentId: 'goutte-nord', equipmentName: 'Goutte-à-goutte nord', settingId: 'standard', settingName: 'Standard',
    irrigations: 3, durationRatio: 1 / 1.5, current: { kind: 'drip', rateMmPerHour: 6 }, proposed: { kind: 'drip', rateMmPerHour: 4 },
  }]);
});

test('moins de trois irrigations, ou une semaine non jugée : le silence, ni ligne ni « 0 »', () => {
  assert.deepEqual(gaps(LONGER.slice(0, 2)), [], 'deux irrigations seulement');
  const waiting = irrigation(WEEK_2, { status: 'planned' });
  assert.deepEqual(gaps([...LONGER, waiting]), [], 'une irrigation de la semaine attend encore d’être confirmée');
  const running = irrigation(WEEK_2, { status: 'partially_completed', actualSeconds: 0.5 * HOUR, running: true });
  assert.deepEqual(gaps([...LONGER, running]), [], 'une irrigation dont le minuteur tourne encore');
  const afterTheFact = irrigation(WEEK_2, { afterTheFact: true, actualSeconds: HOUR });
  assert.deepEqual(gaps([LONGER[0], afterTheFact, LONGER[2]]), [], 'rien de prévu la deuxième semaine : elle n’est pas jugée');
  assert.deepEqual(appliedWaterGapSignals({ today: TODAY, events: LONGER, bedIds: ['autre-planche'], currentSettings: current() }), [], 'une autre planche ne lit rien');
});

test('un écart de 20 % tout juste ne compte pas ; au-delà, oui ; des sens mêlés, non', () => {
  // 6 mm/h : 1 h prévue, 1 h 12 réelle, 7,2 mm apportés pour 6 prévus, exactement 20 %.
  const justTwenty = [WEEK_1, WEEK_2, WEEK_3].map((start) => irrigation(start, { actualSeconds: 1.2 * HOUR }));
  assert.deepEqual(gaps(justTwenty), []);
  const beyond = [WEEK_1, WEEK_2, WEEK_3].map((start) => irrigation(start, { actualSeconds: 1.2 * HOUR + 10 }));
  assert.equal(gaps(beyond)[0]?.direction, 'more');
  // −20 % tout juste : 4,8 mm pour 6 ; au-delà, −20,3 %.
  const justLess = [WEEK_1, WEEK_2, WEEK_3].map((start) => irrigation(start, { status: 'partially_completed', actualSeconds: 0.8 * HOUR }));
  assert.deepEqual(gaps(justLess), []);
  assert.equal(gaps(SHORTER)[0]?.direction, 'less');
  assert.deepEqual(gaps([LONGER[0], SHORTER[1], LONGER[2]]), [], 'plus, moins, plus : pas de signal');
});

test('une irrigation annulée ne compte ni au prévu ni à l’apporté ; une irrigation saisie après coup compte à l’apporté', () => {
  // Annulée, elle aurait porté le prévu de la semaine 2 à 12 mm pour 9 apportés : −25 %, et le signal tombait.
  const canceled = irrigation(WEEK_2, { status: 'canceled' });
  assert.equal(gaps([...LONGER, canceled])[0]?.weeks[1].plannedMm, 6);
  // Faite comme prévu, plus 3 mm saisis après coup le même jour : 9 mm pour 6, +50 %, au jour de son début réel.
  const asPlanned = irrigation(WEEK_3);
  const recorded = irrigation('2026-11-12T16:00:00.000Z', { afterTheFact: true, actualSeconds: 0.5 * HOUR });
  const [gap] = gaps([LONGER[0], LONGER[1], asPlanned, recorded]);
  assert.deepEqual([gap.weeks[2].plannedMm, gap.weeks[2].appliedMm, gap.doneIrrigations], [6, 9, 4]);
  // Deux irrigations seulement sont prévues puis plus longues : la cause du débit n'est pas soutenue.
  assert.deepEqual(gap.causes, [], 'cause non déterminée');
  // Hors période : la semaine en cours et la quatrième semaine passée ne comptent pas.
  const outside = [irrigation('2026-11-17T06:00:00.000Z', { status: 'planned' }), irrigation('2026-10-20T06:00:00.000Z', { status: 'planned' })];
  assert.equal(gaps([...LONGER, ...outside]).length, 1);
});

test('le débit : la médiane, qu’une minuterie oubliée une fois ne fait pas ; le même réglage, aux mêmes débits qu’aujourd’hui', () => {
  // Trois irrigations 25 % plus longues, et une minuterie oubliée (dix fois la durée) : la médiane reste 0,8.
  const forgotten = irrigation('2026-11-05T06:00:00.000Z', { actualSeconds: 10 * HOUR });
  const longer = [WEEK_1, WEEK_2, WEEK_3].map((start) => irrigation(start, { actualSeconds: 1.25 * HOUR }));
  const [cause] = gaps([...longer, forgotten])[0].causes;
  assert.equal(cause.kind, 'flow');
  assert.equal(cause.kind === 'flow' && cause.irrigations, 4);
  assert.deepEqual(cause.kind === 'flow' && cause.proposed, { kind: 'drip', rateMmPerHour: 4.8 });
  // Une seule irrigation plus longue, la minuterie oubliée ; les autres semaines s'écartent par des arrosages saisis après coup.
  const once = gaps([
    irrigation(WEEK_1), irrigation('2026-10-28T16:00:00.000Z', { afterTheFact: true, actualSeconds: HOUR }),
    irrigation(WEEK_2, { actualSeconds: 10 * HOUR }),
    irrigation(WEEK_3), irrigation('2026-11-11T16:00:00.000Z', { afterTheFact: true, actualSeconds: HOUR }),
  ]);
  assert.equal(once[0]?.direction, 'more');
  assert.deepEqual(once[0]?.causes, [], 'une minuterie oubliée une fois ne fait pas la proposition');
  // Des irrigations faites en partie ne disent rien du débit.
  const partial = [WEEK_1, WEEK_2, WEEK_3].map((start) => irrigation(start, { status: 'partially_completed', actualSeconds: 1.5 * HOUR }));
  assert.deepEqual(gaps(partial)[0]?.causes, []);
});

test('le débit d’une aspersion : chaque point du profil, au dixième de mm/h', () => {
  const longer = [WEEK_1, WEEK_2, WEEK_3].map((start) => irrigation(start, { setting: SPRINKLER, actualSeconds: 1.5 * HOUR }));
  const [cause] = gaps(longer, { settings: current(SPRINKLER) })[0].causes;
  assert.deepEqual(cause.kind === 'flow' && cause.proposed, {
    kind: 'sprinkler',
    leftProfile: [{ distanceMeters: 0, rateMmPerHour: 6.7 }, { distanceMeters: 2, rateMmPerHour: 4 }, { distanceMeters: 4, rateMmPerHour: 0 }],
    rightProfile: [{ distanceMeters: 0, rateMmPerHour: 6.7 }, { distanceMeters: 3, rateMmPerHour: 2.7 }],
  });
});

/** L'objectif et sa proposition de la semaine en cours ; rien d'adopté cette semaine, 25 mm la dernière semaine de la période. */
function reading(values: Partial<BedObjectiveReading>): BedObjectiveReading {
  return { objectiveMm: 25, proposedMm: 14, adoptable: true, lastWeekObjectiveMm: 25, adoptedThisWeekMm: [], ...values };
}

test('l’objectif : l’objectif proposé de la semaine en cours, adoptable et plus bas de plus de 20 %', () => {
  const objective = (values: Partial<BedObjectiveReading>) => gaps(SHORTER, { objectives: new Map([['v01', reading(values)]]) })[0].causes;
  assert.deepEqual(objective({ proposedMm: 14.04 }), [{ kind: 'objective', objectiveMm: 25, proposedMm: 14 }]);
  assert.deepEqual(objective({ proposedMm: 20 }), [], '20 % tout juste');
  assert.deepEqual(objective({ adoptable: false }), [], 'une proposition partielle ne s’adopte pas');
  assert.deepEqual(objective({ objectiveMm: null }), [], 'aucun objectif');
  assert.deepEqual(gaps(SHORTER, { objectives: null })[0].causes, [], 'sans « Besoin par culture », la cause ne se cherche pas');
  assert.deepEqual(gaps(LONGER, { objectives: new Map([['v01', reading({})]]) })[0].causes.map((cause) => cause.kind), ['flow'],
    'quand plus d’eau a été apportée, l’objectif n’est pas une cause');
});

test('la pluie : la mesure s’écarte de la réanalyse dans le sens de l’écart, et un jour sans mesure a compté la réanalyse', () => {
  const days = (measured: number, reanalysis: number, withoutMeasure = true): RainDay[] => [
    { date: '2026-10-28', measuredMm: measured, reanalysisMm: reanalysis },
    { date: '2026-11-04', measuredMm: 0, reanalysisMm: 0 },
    ...(withoutMeasure ? [{ date: '2026-11-11', measuredMm: null, reanalysisMm: 3 }] : []),
    { date: '2026-11-17', measuredMm: null, reanalysisMm: 40 }, // la semaine en cours ne compte pas
  ];
  assert.deepEqual(gaps(SHORTER, { rain: days(30, 20) })[0].causes, [{ kind: 'rain', measuredMm: 30, reanalysisMm: 20, measuredDays: 2, daysWithoutMeasure: 1 }]);
  assert.deepEqual(gaps(SHORTER, { rain: days(24, 20) })[0].causes, [], 'moins de 5 mm d’écart');
  assert.deepEqual(gaps(SHORTER, { rain: days(105, 100) })[0].causes, [], '5 mm, mais 5 % seulement');
  assert.deepEqual(gaps(SHORTER, { rain: days(30, 20, false) })[0].causes, [], 'chaque jour a sa mesure : le plan n’a pas compté la réanalyse');
  assert.deepEqual(gaps(SHORTER, { rain: days(10, 20) })[0].causes, [], 'moins d’eau apportée et moins de pluie mesurée : l’autre sens');
  assert.deepEqual(gaps(LONGER, { rain: days(10, 20) })[0].causes.map((cause) => cause.kind), ['flow', 'rain'], 'plusieurs causes se disent toutes');
  const sheltered = [{ ...BEDS[0], outdoors: false }];
  assert.deepEqual(gaps(SHORTER, { beds: sheltered, rain: days(30, 20) })[0].causes, [], 'sous abri, la pluie n’est pas une cause');
});

test('après un ajustement, la planche se juge sur les semaines qui suivent', () => {
  // Le réglage a changé depuis, à la main ou par « Adopter » : 8 mm/h aujourd'hui, les irrigations ont copié 6 mm/h.
  assert.deepEqual(gaps(LONGER, { settings: current(DRIP, { rateMmPerHour: 8 } as Partial<EquipmentSettingRecord>) }), []);
  // Le réglage n'est plus celui d'un matériel en service.
  assert.deepEqual(gaps(LONGER, { settings: new Map() }), []);
  // Un nouveau nom ne change pas les débits : la planche reste jugée.
  assert.equal(gaps(LONGER, { settings: current(DRIP, { name: 'Nouveau nom' }) }).length, 1);
  // L'objectif proposé adopté cette semaine, plus bas de plus de 20 % que celui de la dernière semaine : la cause est traitée.
  const objectives = (values: Partial<BedObjectiveReading>) => new Map([['v01', reading(values)]]);
  assert.deepEqual(gaps(SHORTER, { objectives: objectives({ objectiveMm: 14, adoptedThisWeekMm: [14] }) }), []);
  // Adopté, mais à peine plus bas : la planche reste, sans la cause de l'objectif.
  assert.deepEqual(gaps(SHORTER, { objectives: objectives({ objectiveMm: 22, proposedMm: 22, adoptedThisWeekMm: [22] }) })[0].causes, []);
  // Sans objectif la dernière semaine, rien n'est traité.
  assert.equal(gaps(SHORTER, { objectives: objectives({ lastWeekObjectiveMm: null, adoptedThisWeekMm: [14] }) }).length, 1);
});

test('plusieurs planches, dans l’ordre naturel de leur jardin puis de leur nom', () => {
  const beds: GapBed[] = [
    { id: 'v10', name: 'V10', plotName: 'Jardin du verger', outdoors: true },
    { id: 'v02', name: 'V02', plotName: 'Jardin du verger', outdoors: true },
    { id: 'n01', name: 'N01', plotName: 'Jardin Nord', outdoors: true },
  ];
  const events = beds.flatMap((bed) => [WEEK_1, WEEK_2, WEEK_3].map((start) => irrigation(start, { bed: bed.id, actualSeconds: 1.5 * HOUR })));
  // « Jardin du verger » avant « Jardin Nord » : l'ordre naturel ne distingue pas les majuscules.
  assert.deepEqual(gaps(events, { beds }).map((gap) => gap.bedName), ['V02', 'V10', 'N01']);
});

test('« Adopter » : la proposition montrée tient encore, sinon rien ne s’écrit', () => {
  const longer = gaps(LONGER);
  const flow = { kind: 'flow', bedId: 'v01', settingId: 'standard', proposed: { kind: 'drip', rateMmPerHour: 4 } } as const;
  assert.equal(heldProposal(longer, flow)?.kind, 'flow', 'la même planche, le même réglage, le même débit proposé');
  assert.equal(heldProposal(longer, { ...flow, proposed: { kind: 'drip', rateMmPerHour: 4.1 } }), null, 'un autre débit que celui recalculé');
  assert.equal(heldProposal(longer, { ...flow, settingId: 'autre' }), null, 'un autre réglage');
  assert.equal(heldProposal(longer, { ...flow, bedId: 'v02' }), null, 'une planche sans signal');
  assert.equal(heldProposal(gaps(LONGER.slice(1)), flow), null, 'le signal a disparu');
  const objective = { kind: 'objective', bedId: 'v01', proposedMm: 14 } as const;
  const shorter = gaps(SHORTER, { objectives: new Map([['v01', reading({})]]) });
  assert.equal(heldProposal(shorter, objective)?.kind, 'objective');
  assert.equal(heldProposal(shorter, { ...objective, proposedMm: 14.5 }), null, 'la proposition a changé');
  assert.equal(heldProposal(gaps(SHORTER), objective), null, 'sans « Besoin par culture », pas de cause de l’objectif');
  assert.equal(heldProposal(shorter, flow), null, 'pas de cause du débit quand moins d’eau est apportée');
});

test('ce que le navigateur envoie se relit sans rien croire', () => {
  assert.deepEqual(
    parseGapAdoption({ kind: 'flow', bedId: 'v01', settingId: 'rampe', proposed: { kind: 'sprinkler', leftProfile: [{ distanceMeters: 2, rateMmPerHour: 4 }, { distanceMeters: 0, rateMmPerHour: 6.7 }], rightProfile: [{ distanceMeters: 0, rateMmPerHour: 6.7 }] } }),
    { kind: 'flow', bedId: 'v01', settingId: 'rampe', proposed: { kind: 'sprinkler', leftProfile: [{ distanceMeters: 0, rateMmPerHour: 6.7 }, { distanceMeters: 2, rateMmPerHour: 4 }], rightProfile: [{ distanceMeters: 0, rateMmPerHour: 6.7 }] } },
    'les points du profil rangés par distance, comme ceux du serveur',
  );
  assert.deepEqual(parseGapAdoption({ kind: 'objective', bedId: 'v01', proposedMm: 14 }), { kind: 'objective', bedId: 'v01', proposedMm: 14 });
  for (const refused of [
    null, 'flow', {}, { kind: 'flow', bedId: 'v01', settingId: 'standard' },
    { kind: 'flow', bedId: '', settingId: 'standard', proposed: { kind: 'drip', rateMmPerHour: 4 } },
    { kind: 'flow', bedId: 'v01', settingId: 'standard', proposed: { kind: 'drip', rateMmPerHour: Number.NaN } },
    { kind: 'flow', bedId: 'v01', settingId: 'standard', proposed: { kind: 'drip', rateMmPerHour: '4' } },
    { kind: 'flow', bedId: 'v01', settingId: 'rampe', proposed: { kind: 'sprinkler', leftProfile: [], rightProfile: [] } },
    { kind: 'flow', bedId: 'v01', settingId: 'rampe', proposed: { kind: 'sprinkler', leftProfile: [{ distanceMeters: 0 }], rightProfile: [{ distanceMeters: 0, rateMmPerHour: 1 }] } },
    { kind: 'objective', bedId: 'v01', proposedMm: 0 },
    { kind: 'objective', bedId: 'x'.repeat(201), proposedMm: 14 },
    { kind: 'autre', bedId: 'v01' },
  ]) assert.equal(parseGapAdoption(refused), null, JSON.stringify(refused));
});

test('les mots du bloc', () => {
  assert.equal(gapPercentText(50), '+50 %');
  assert.equal(gapPercentText(-30.4), '−30 %');
  assert.equal(gapPercentText(0.2), '0 %');
  assert.equal(settingRatesText({ kind: 'drip', rateMmPerHour: 4 }), '4 mm/h');
  assert.equal(
    settingRatesText({ kind: 'sprinkler', leftProfile: [{ distanceMeters: 0, rateMmPerHour: 6.7 }, { distanceMeters: 2.5, rateMmPerHour: 4 }], rightProfile: [{ distanceMeters: 0, rateMmPerHour: 6.7 }] }),
    'à gauche 6,7 mm/h à 0 m, 4 mm/h à 2,5 m ; à droite 6,7 mm/h à 0 m',
  );
  const [flow] = gaps(LONGER)[0].causes;
  assert.ok(flow.kind === 'flow');
  assert.equal(flowCauseText(flow), '3 irrigations de Goutte-à-goutte nord, prévues puis faites en entier avec le réglage « Standard », ont duré plus longtemps que prévu : 50 % de plus en médiane.');
  assert.equal(objectiveCauseText({ kind: 'objective', objectiveMm: 25, proposedMm: 14 }), 'Objectif de la semaine : 25 mm ; objectif proposé d’après les cultures : 14 mm.');
  assert.equal(
    rainCauseText({ kind: 'rain', measuredMm: 30, reanalysisMm: 20, measuredDays: 3, daysWithoutMeasure: 18 }),
    'Sur les 3 jours mesurés de ces trois semaines : 30 mm au pluviomètre contre 20 mm de réanalyse. 18 jours sans mesure, où le plan a compté la réanalyse.',
  );
  assert.equal(
    rainCauseText({ kind: 'rain', measuredMm: 12.5, reanalysisMm: 4, measuredDays: 1, daysWithoutMeasure: 1 }),
    'Sur le jour mesuré de ces trois semaines : 12,5 mm au pluviomètre contre 4 mm de réanalyse. 1 jour sans mesure, où le plan a compté la réanalyse.',
  );
});
