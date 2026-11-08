import assert from 'node:assert/strict';
import test from 'node:test';
import type { IrrigationEventRecord } from '../lib/domain/irrigation-event-record.ts';
import { lateAlarmDueAt, plannedIrrigationLateness, remainingPlannedApplications } from '../lib/domain/planned-irrigation.ts';
import { validatedIrrigation } from './support/planning-fixtures.ts';

/**
 * Le retard d'une irrigation planifiée (docs/replanning-contract.md, règles
 * 18 à 20 ; D-051, décision 4) : « en retard » une tolérance R14 après son
 * heure sans démarrage, « non faite » tout son créneau passé ; son eau compte
 * pour la part du créneau qui reste à venir, puis plus rien (règle 19).
 * Le logiciel ne l'annule jamais.
 */

const START = '2026-09-29T19:00:00.000Z'; // mardi 21 h à la ferme
const END = '2026-09-29T21:15:00.000Z';
const DURATION_SECONDS = 8100; // 135 minutes
const TOLERANCE = 30;

function at(minutesAfterStart: number): Date {
  return new Date(Date.parse(START) + minutesAfterStart * 60_000);
}

function planned(overrides: Partial<IrrigationEventRecord['equipment']> = {}, status: IrrigationEventRecord['status'] = 'planned'): IrrigationEventRecord {
  const event = validatedIrrigation('irrigation-1', 'rampe-bloc-2', START, DURATION_SECONDS, ['B2-1'], { kind: 'sprinkler' });
  return { ...event, status, equipment: { ...event.equipment, ...overrides } };
}

test('à venir avant la tolérance, en retard dès qu’elle est atteinte, non faite dès la fin du créneau', () => {
  const event = planned();
  assert.equal(plannedIrrigationLateness(event, TOLERANCE, at(-60)), null, 'une heure avant');
  assert.equal(plannedIrrigationLateness(event, TOLERANCE, at(0)), null, 'à l’heure');
  assert.equal(plannedIrrigationLateness(event, TOLERANCE, at(29)), null, 'une minute avant la tolérance');
  assert.equal(plannedIrrigationLateness(event, TOLERANCE, at(30)), 'late', 'la tolérance atteinte');
  assert.equal(plannedIrrigationLateness(event, TOLERANCE, at(134)), 'late', 'une minute avant la fin');
  assert.equal(plannedIrrigationLateness(event, TOLERANCE, at(135)), 'missed', 'la fin du créneau');
  assert.equal(plannedIrrigationLateness(event, TOLERANCE, at(24 * 60)), 'missed', 'le lendemain');
});

test('la tolérance est le réglage R14 : à 0 le retard commence à l’heure, à 120 il attend deux heures ; un créneau plus court que la tolérance passe à « non faite » sans retard', () => {
  const event = planned();
  assert.equal(plannedIrrigationLateness(event, 0, at(0)), 'late');
  assert.equal(plannedIrrigationLateness(event, 120, at(119)), null);
  assert.equal(plannedIrrigationLateness(event, 120, at(120)), 'late');
  assert.equal(plannedIrrigationLateness(event, 180, at(134)), null, 'créneau de 135 min : la tolérance de 180 n’est jamais atteinte');
  assert.equal(plannedIrrigationLateness(event, 180, at(135)), 'missed');
});

test('démarrée, en pause, terminée, annulée, reliquat annulé ou sans heure : pas de retard', () => {
  const late = at(60);
  assert.equal(plannedIrrigationLateness(planned({ timerState: 'running', timerStartedAt: at(40).toISOString() }), TOLERANCE, late), null, 'démarrée en retard : elle compte au réel');
  assert.equal(plannedIrrigationLateness(planned({ timerState: 'paused', timerStartedAt: at(40).toISOString() }), TOLERANCE, late), null);
  assert.equal(plannedIrrigationLateness(planned({ status: 'completed', actualStartAt: START, actualEndAt: END }, 'completed'), TOLERANCE, at(200)), null);
  assert.equal(plannedIrrigationLateness(planned({ status: 'canceled', canceledAt: at(10).toISOString() }, 'canceled'), TOLERANCE, late), null);
  assert.equal(plannedIrrigationLateness(planned({ remainingCanceledAt: at(10).toISOString() }), TOLERANCE, late), null);
  assert.equal(plannedIrrigationLateness(planned({ plannedStartAt: null, plannedEndAt: null }), TOLERANCE, late), null);
});

test('règle 19 : l’eau d’une irrigation en retard compte pour la part de son créneau à venir, et plus rien une fois le créneau passé', () => {
  const event = planned();
  const horizonEnd = new Date('2026-10-04T22:00:00.000Z');
  const whole = remainingPlannedApplications([event], at(-60), horizonEnd);
  const late = remainingPlannedApplications([event], at(45), horizonEnd);
  const missed = remainingPlannedApplications([event], at(135), horizonEnd);
  assert.equal(whole.length, 1);
  assert.equal(late.length, 1);
  assert.ok(Math.abs(late[0]!.amountMm / whole[0]!.amountMm - 90 / 135) < 1e-9, 'quarante-cinq minutes passées sur cent trente-cinq : deux tiers restent');
  assert.deepEqual(missed, []);
});

test('l’échéance de l’alerte « en retard » (règle 24) : le début plus R14 ; nulle quand le créneau est passé ou que la tolérance l’atteint', () => {
  assert.equal(lateAlarmDueAt(START, END, TOLERANCE, at(-120)), at(30).toISOString(), 'programmée deux heures avant : le début plus 30 minutes');
  assert.equal(lateAlarmDueAt(START, END, TOLERANCE, at(60)), at(30).toISOString(), 'planifiée après coup, dans le créneau : l’échéance passée reste, l’irrigation est déjà en retard');
  assert.equal(lateAlarmDueAt(START, END, 0, at(-1)), START, 'tolérance nulle : à l’heure prévue');
  assert.equal(lateAlarmDueAt(START, END, 135, at(-120)), null, 'une tolérance qui atteint la fin du créneau : « non faite » avant « en retard », pas d’alerte');
  assert.equal(lateAlarmDueAt(START, END, TOLERANCE, at(135)), null, 'créneau passé : rien');
  assert.equal(lateAlarmDueAt('', END, TOLERANCE, at(0)), null, 'sans heure : rien');
});
