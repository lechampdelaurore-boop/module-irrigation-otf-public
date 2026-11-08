import assert from 'node:assert/strict';
import test from 'node:test';
import { DONE_AS_PLANNED_REFUSAL_TEXT, doneAsPlanned } from '../lib/domain/done-as-planned';
import { FEATURE_IDS, type FeatureId } from '../lib/domain/features/catalogue';
import type { IrrigationEventRecord } from '../lib/domain/irrigation-event-record';
import type { StoredProposal } from '../lib/domain/planning/contract';
import { ALL_DONE_TEXT, allDone } from '../lib/domain/today/all-done';
import { lateIrrigationLines, todayTodoLines } from '../lib/domain/today/today-irrigations';
import { todayView, type TodayInputs } from '../lib/domain/today/today-view';

/**
 * « Tout est fait » (docs/aujourdhui-tableau-de-bord-contract.md,
 * section 3.4, précisions T15 et T16) : ce que le bouton couvre, ce qu'il
 * enregistre, et la confirmation rangée par jour. Aujourd'hui = jeudi
 * 12 novembre 2026, 18 h 00 à la ferme.
 */

const ALL: FeatureId[] = [...FEATURE_IDS];
const NOW = new Date('2026-11-12T17:00:00.000Z');
const BEDS = new Map([['b1', 'P1'], ['b2', 'P2'], ['b3', 'P3']]);

type EventOptions = {
  beds?: string[];
  mm?: number;
  /** `null` : le passe-pied d'un asperseur inconnu, le volume l'est aussi. */
  wetted?: number | null;
  started?: boolean;
  status?: 'planned' | 'completed' | 'canceled';
};

function event(id: string, startAt: string, minutes: number, options: EventOptions = {}): IrrigationEventRecord {
  const endAt = new Date(Date.parse(startAt) + minutes * 60_000).toISOString();
  const status = options.status ?? 'planned';
  return {
    id: `event-${id}`,
    season: 2026,
    status,
    note: null,
    remainingCanceledAt: null,
    canceledAt: status === 'canceled' ? '2026-11-01T00:00:00.000Z' : null,
    createdAt: '2026-11-01T00:00:00.000Z',
    updatedAt: '2026-11-01T00:00:00.000Z',
    equipment: {
      id,
      status,
      plannedStartAt: startAt,
      plannedEndAt: endAt,
      actualStartAt: null,
      actualEndAt: null,
      plannedDurationSeconds: minutes * 60,
      actualDurationSeconds: 0,
      timerState: options.started ? 'running' : null,
      timerStartedAt: options.started ? startAt : null,
      remainingCanceledAt: null,
      canceledAt: status === 'canceled' ? '2026-11-01T00:00:00.000Z' : null,
      equipmentSnapshot: { id: 'eq', name: `Goutte-à-goutte ${id}`, kind: 'drip', mobility: 'fixed' },
      settingSnapshot: { name: 'Réglage 1' },
      applications: (options.beds ?? ['b1']).map((otfBedId) => ({
        otfBedId,
        plannedAmountMm: options.mm ?? 10,
        actualAmountMm: 0,
        bedAreaSquareMeters: 30,
        wettedAreaSquareMeters: options.wetted === undefined ? 30 : options.wetted,
      })),
    },
  } as unknown as IrrigationEventRecord;
}

function proposal(storedId: string, startAt: string): StoredProposal {
  return {
    storedId, status: 'proposed', startAt, endAt: new Date(Date.parse(startAt) + 3600_000).toISOString(), durationSeconds: 3600,
    doseMm: 8, equipmentName: 'Asperseur A', settingName: 'Buse 2', applications: [{ otfBedId: 'b2' }],
  } as unknown as StoredProposal;
}

function dayLines(events: IrrigationEventRecord[], proposals: StoredProposal[] = [], now = NOW) {
  const base = { enabled: ALL, now, events, lateToleranceMinutes: 30, bedNames: BEDS };
  return [...lateIrrigationLines(base), ...todayTodoLines({ ...base, proposals })];
}

function inputs(events: IrrigationEventRecord[], overrides: Partial<TodayInputs> = {}): TodayInputs {
  return {
    enabled: ALL, now: NOW, weather: { forecasts: [], frost: [], criteria: [] }, events, lateToleranceMinutes: 30,
    plan: { computedAt: '2026-11-12T05:02:00.000Z', proposals: [] }, bedNames: BEDS, infrastructure: null,
    reliability: { actualRainMissingDates: [], soilGardensNeverObserved: [], speciesWithoutReference: [] }, week: null, soil: null,
    ...overrides,
  };
}

test('fait comme prévu : à l’heure de début, à la fin et à la durée prévues, ce que la base devra encore trouver', () => {
  const result = doneAsPlanned(event('e1', '2026-11-12T05:00:00.000Z', 90), NOW);
  assert.deepEqual(result, {
    ok: true,
    record: {
      eventEquipmentId: 'e1',
      actualStartAt: '2026-11-12T05:00:00.000Z',
      actualEndAt: '2026-11-12T06:30:00.000Z',
      actualDurationSeconds: 5400,
      expected: { plannedStartAt: '2026-11-12T05:00:00.000Z', plannedEndAt: '2026-11-12T06:30:00.000Z', plannedDurationSeconds: 5400 },
    },
  });
});

test('fait comme prévu : refusé à une irrigation démarrée, enregistrée, annulée, pas finie ou sans créneau', () => {
  const refusal = (record: IrrigationEventRecord) => {
    const result = doneAsPlanned(record, NOW);
    return result.ok ? null : result.refusal;
  };
  assert.equal(refusal(event('started', '2026-11-12T05:00:00.000Z', 60, { started: true })), 'not-waiting');
  assert.equal(refusal(event('completed', '2026-11-12T05:00:00.000Z', 60, { status: 'completed' })), 'not-waiting');
  assert.equal(refusal(event('canceled', '2026-11-12T05:00:00.000Z', 60, { status: 'canceled' })), 'not-waiting');
  // Commencée à 17 h 30, finie à 18 h 30 : à 18 h, sa fin prévue est encore à venir (T15).
  assert.equal(refusal(event('running-slot', '2026-11-12T16:30:00.000Z', 60)), 'not-over');
  assert.equal(refusal(event('future', '2026-11-12T18:00:00.000Z', 60)), 'not-over');
  const noEnd = event('no-end', '2026-11-12T05:00:00.000Z', 60);
  noEnd.equipment.plannedEndAt = null;
  assert.equal(refusal(noEnd), 'no-slot');
  // Fin exactement maintenant : finie.
  assert.equal(refusal(event('just-over', '2026-11-12T16:00:00.000Z', 60)), null);
  assert.equal(DONE_AS_PLANNED_REFUSAL_TEXT['not-over'], 'Son heure de fin prévue n’est pas encore passée.');
});

test('tout est fait : les retards et les irrigations finies du jour, par jour ; jamais l’à-venir, une proposition, une démarrée', () => {
  const events = [
    event('a', '2026-11-10T06:00:00.000Z', 60, { beds: ['b1', 'b2'] }),
    event('b', '2026-11-11T16:00:00.000Z', 30, { beds: ['b3'], mm: 6 }),
    event('c', '2026-11-11T06:00:00.000Z', 90, { beds: ['b1'] }),
    event('d', '2026-11-12T05:00:00.000Z', 60, { beds: ['b2'], mm: 8 }),
    event('in-slot', '2026-11-12T16:30:00.000Z', 60),
    event('future', '2026-11-12T18:00:00.000Z', 60),
    event('started', '2026-11-12T15:00:00.000Z', 60, { started: true }),
  ];
  const list = allDone({ lines: dayLines(events, [proposal('p1', '2026-11-12T10:00:00.000Z')]), events, now: NOW });
  assert.ok(list);
  assert.equal(list.count, 4);
  assert.deepEqual(list.days.map((day) => [day.title, day.items.map((item) => item.eventEquipmentId)]), [
    ['Mar. 10 nov.', ['a']],
    ['Hier', ['c', 'b']],
    ['Aujourd’hui', ['d']],
  ]);
  const yesterday = list.days[1];
  assert.equal(yesterday.summary, '2 irrigations, de 7 h à 17 h, sur 2 planches · 2 h · 0,48 m³');
  assert.deepEqual(yesterday.items.map((item) => [item.hours, item.title, item.detail]), [
    ['7 h à 8 h 30', 'Goutte-à-goutte c · Réglage 1', 'planche P1 · 1 h 30 · 10 mm · 0,30 m³'],
    ['17 h à 17 h 30', 'Goutte-à-goutte b · Réglage 1', 'planche P3 · 30 min · 6 mm · 0,18 m³'],
  ]);
  assert.equal(list.days[0].summary, '1 irrigation, à 7 h, sur 2 planches · 1 h · 0,60 m³');
  // Commencée sans être finie : dite, pas enregistrable (T15).
  assert.deepEqual(list.notOver, [{ title: 'Goutte-à-goutte in-slot · Réglage 1', endHour: '18 h 30' }]);
});

test('tout est fait : un volume inconnu reste inconnu, le jour dit alors la plus forte dose', () => {
  const events = [
    event('a', '2026-11-12T05:00:00.000Z', 60, { wetted: null, mm: 12 }),
    event('b', '2026-11-12T07:00:00.000Z', 60, { mm: 9 }),
  ];
  const list = allDone({ lines: dayLines(events), events, now: NOW });
  assert.ok(list);
  assert.equal(list.days[0].summary, '2 irrigations, de 6 h à 8 h, sur 1 planche · 2 h · jusqu’à 12 mm');
  assert.deepEqual(list.days[0].items.map((item) => item.cubicMeters), [null, 0.27]);
  assert.equal(list.days[0].items[0].detail, 'planche P1 · 1 h · 12 mm');
});

test('tout est fait : rien à couvrir, pas de bouton, même avec une irrigation pas encore finie', () => {
  const events = [event('in-slot', '2026-11-12T16:30:00.000Z', 60), event('future', '2026-11-12T18:00:00.000Z', 60)];
  assert.equal(allDone({ lines: dayLines(events), events, now: NOW }), null);
  assert.equal(allDone({ lines: [], events: [], now: NOW }), null);
});

test('le modèle de la page porte « Tout est fait » seulement si le planning ou les arrosages sont cochés', () => {
  const events = [event('a', '2026-11-11T06:00:00.000Z', 60)];
  assert.equal(todayView(inputs(events)).allDone?.count, 1);
  assert.equal(todayView(inputs(events, { enabled: ['besoins'] })).allDone, null);
  assert.equal(todayView(inputs([])).allDone, null);
});

test('la confirmation dit ce qui est enregistré, que rien ne se modifie ensuite, et pourquoi l’à-venir n’y est pas', () => {
  assert.match(ALL_DONE_TEXT.recordedAs, /telle que prévue : à son heure de début, avec sa durée, son matériel, son réglage et sa dose prévus\.$/);
  assert.match(ALL_DONE_TEXT.final, /ne se modifie plus/);
  assert.match(ALL_DONE_TEXT.notHere, /à venir/);
  assert.match(ALL_DONE_TEXT.notHere, /propositions à valider/);
});
