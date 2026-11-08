import assert from 'node:assert/strict';
import test from 'node:test';
import type { StoredPlanSuggestion } from '../lib/domain/planning/contract.ts';
import { morningSuggestionNotification } from '../lib/domain/planning/notifications.ts';

/**
 * La notification du matin (docs/replanning-contract.md, règles 21 et 22) :
 * une seule, qui regroupe les suggestions sur les arrosages validés des
 * prochaines 24 heures ; les suggestions gardées se taisent ; un clic ouvre
 * le planning.
 */

const NOW = new Date('2026-09-30T04:15:00.000Z'); // mercredi 6 h 15 à la ferme
const CALCULATION = { id: 'calc-1', season: 2026 };
const HOUR_MS = 3_600_000;

function suggestion(
  overrides: Partial<StoredPlanSuggestion> & Pick<StoredPlanSuggestion, 'eventEquipmentId' | 'plannedStartAt'>,
): StoredPlanSuggestion {
  const start = Date.parse(overrides.plannedStartAt);
  return {
    eventId: `event-${overrides.eventEquipmentId}`,
    equipmentId: 'asp1',
    equipmentName: 'Rampe bloc 2',
    kind: 'sprinkler',
    priority: 'normal',
    plannedEndAt: new Date(start + 2 * HOUR_MS).toISOString(),
    plannedDurationSeconds: 7200,
    plannedDoseMm: 12,
    suggestion: 'cancel',
    doseMm: null,
    durationSeconds: null,
    endAt: null,
    causes: [],
    kept: false,
    ...overrides,
  };
}

function hoursFromNow(hours: number): string {
  return new Date(NOW.getTime() + hours * HOUR_MS).toISOString();
}

test('une notification regroupe les suggestions des prochaines 24 heures, dans l’ordre du temps, et ouvre le planning', () => {
  const notification = morningSuggestionNotification({
    calculation: CALCULATION,
    suggestions: [
      suggestion({ eventEquipmentId: 'ee-3', plannedStartAt: hoursFromNow(10), suggestion: 'reduce', doseMm: 7.5, durationSeconds: 4500, equipmentName: 'Goutte-à-goutte' }),
      suggestion({ eventEquipmentId: 'ee-1', plannedStartAt: hoursFromNow(2) }),
    ],
  }, NOW);
  assert.deepEqual(notification, {
    count: 2,
    title: 'Suggestions du planning',
    body: '2 suggestions sur vos arrosages des prochaines 24 heures · Annuler Rampe bloc 2 · Réduire Goutte-à-goutte à 7,5 mm',
    alarmId: 'plan:calc-1',
    tag: 'planning-suggestions-calc-1',
    url: '/irrigation/planning?season=2026',
  });
});

test('une seule suggestion se dit au singulier ; la dose entière s’écrit sans décimale', () => {
  const notification = morningSuggestionNotification({
    calculation: CALCULATION,
    suggestions: [suggestion({ eventEquipmentId: 'ee-1', plannedStartAt: hoursFromNow(1), suggestion: 'reduce', doseMm: 8, durationSeconds: 4800 })],
  }, NOW);
  assert.equal(notification?.count, 1);
  assert.equal(notification?.body, '1 suggestion sur un arrosage des prochaines 24 heures · Réduire Rampe bloc 2 à 8 mm');
});

test('se taisent : une suggestion gardée, un arrosage qui commence dans plus de 24 heures, un créneau déjà passé ; un arrosage en cours compte encore', () => {
  const quiet = morningSuggestionNotification({
    calculation: CALCULATION,
    suggestions: [
      suggestion({ eventEquipmentId: 'kept', plannedStartAt: hoursFromNow(1), kept: true }),
      suggestion({ eventEquipmentId: 'later', plannedStartAt: hoursFromNow(24) }),
      suggestion({ eventEquipmentId: 'passed', plannedStartAt: hoursFromNow(-3) }),
    ],
  }, NOW);
  assert.equal(quiet, null, 'rien à dire : pas de notification');

  const running = morningSuggestionNotification({
    calculation: CALCULATION,
    suggestions: [
      suggestion({ eventEquipmentId: 'running', plannedStartAt: hoursFromNow(-1) }),
      suggestion({ eventEquipmentId: 'edge', plannedStartAt: hoursFromNow(23.99) }),
    ],
  }, NOW);
  assert.equal(running?.count, 2, 'commencé il y a une heure, il finit dans une heure ; et le dernier dans la fenêtre');
});
