import assert from 'node:assert/strict';
import test from 'node:test';
import type { IrrigationEventRecord } from '../lib/domain/irrigation-event-record.ts';
import type { StoredPlanSuggestion } from '../lib/domain/planning/contract.ts';
import { morningSuggestions } from '../lib/domain/planning/notifications.ts';
import { MORNING_MESSAGE_DEFAULT, morningMessage, type MorningMessageInputs } from '../lib/domain/today/morning-message.ts';

/**
 * Le message unique du matin (amélioration n° 3,
 * docs/ameliorations-6-2-3-7-contract.md, section 4.2, F703, F712, F713) :
 * une phrase pour les arrosages planifiés d'aujourd'hui, une pour la pluie
 * prévue, une pour les alertes en cours, une pour les suggestions ; rien
 * quand il n'y a rien à dire ; un identifiant par jour de Paris ; un clic
 * ouvre « Aujourd'hui ». Les suggestions gardent leur règle (docs/replanning-contract.md,
 * règles 21 et 22).
 */

const NOW = new Date('2026-09-30T04:15:00.000Z'); // mercredi 30 septembre, 6 h 15 à la ferme
const HOUR_MS = 3_600_000;

function hoursFromNow(hours: number): string {
  return new Date(NOW.getTime() + hours * HOUR_MS).toISOString();
}

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

type EventOptions = { status?: 'planned' | 'completed' | 'canceled'; started?: boolean };

function irrigation(name: string, startAt: string, options: EventOptions = {}): IrrigationEventRecord {
  const status = options.status ?? 'planned';
  return {
    id: `event-${name}`,
    season: 2026,
    status,
    note: null,
    remainingCanceledAt: null,
    canceledAt: status === 'canceled' ? '2026-09-29T00:00:00.000Z' : null,
    createdAt: '2026-09-29T00:00:00.000Z',
    updatedAt: '2026-09-29T00:00:00.000Z',
    equipment: {
      id: `ee-${name}`,
      status,
      plannedStartAt: startAt,
      plannedEndAt: new Date(Date.parse(startAt) + HOUR_MS).toISOString(),
      plannedDurationSeconds: 3600,
      timerState: options.started ? 'running' : null,
      timerStartedAt: options.started ? startAt : null,
      remainingCanceledAt: null,
      canceledAt: status === 'canceled' ? '2026-09-29T00:00:00.000Z' : null,
      equipmentSnapshot: { id: 'eq', name, kind: 'drip', mobility: 'fixed' },
      settingSnapshot: { name: 'Réglage 1' },
      applications: [{ otfBedId: 'b1', plannedAmountMm: 10 }],
    },
  } as unknown as IrrigationEventRecord;
}

function inputs(overrides: Partial<MorningMessageInputs> = {}): MorningMessageInputs {
  return { now: NOW, events: [], forecastRainMm: null, alerts: 0, suggestions: [], ...overrides };
}

test('les quatre phrases, dans l’ordre : arrosages, pluie, alertes, suggestions ; un identifiant du jour ; un clic ouvre « Aujourd’hui »', () => {
  const message = morningMessage(inputs({
    events: [
      irrigation('Goutte-à-goutte nord', '2026-09-30T06:00:00.000Z'),
      irrigation('Rampe 1', '2026-09-30T04:30:00.000Z'),
    ],
    forecastRainMm: 4.46,
    alerts: 2,
    suggestions: [suggestion({ eventEquipmentId: 'ee-1', plannedStartAt: hoursFromNow(2) })],
  }));
  assert.deepEqual(message, {
    parisDay: '2026-09-30',
    title: 'Votre journée',
    body: [
      '2 arrosages prévus aujourd’hui : Rampe 1 (6 h 30), Goutte-à-goutte nord (8 h).',
      'Pluie prévue aujourd’hui : 4,5 mm.',
      '2 alertes en cours.',
      '1 suggestion sur un arrosage des prochaines 24 heures : Annuler Rampe bloc 2.',
    ].join(' '),
    alarmId: 'morning:2026-09-30',
    tag: 'morning-2026-09-30',
    url: '/irrigation/aujourdhui',
    counts: { irrigations: 2, alerts: 2, suggestions: 1 },
  });
});

test('au plus trois arrosages nommés, puis « et n autres » ; seuls comptent ceux d’aujourd’hui qui attendent un geste', () => {
  const message = morningMessage(inputs({
    events: [
      irrigation('B9-10', '2026-09-30T08:00:00.000Z'),
      irrigation('B9-9', '2026-09-30T08:00:00.000Z'),
      irrigation('Tunnel 1', '2026-09-30T05:00:00.000Z'),
      irrigation('Tunnel 2', '2026-09-30T15:45:00.000Z'),
      irrigation('Tunnel 3', '2026-09-30T16:00:00.000Z'),
      irrigation('Demain', '2026-09-30T22:30:00.000Z'), // jeudi 0 h 30 à la ferme
      irrigation('Hier', '2026-09-29T21:30:00.000Z'), // mardi 23 h 30 à la ferme
      irrigation('Commencée', '2026-09-30T04:00:00.000Z', { started: true }),
      irrigation('Faite', '2026-09-30T03:00:00.000Z', { status: 'completed' }),
      irrigation('Annulée', '2026-09-30T07:00:00.000Z', { status: 'canceled' }),
    ],
  }));
  assert.equal(message?.body, '5 arrosages prévus aujourd’hui : Tunnel 1 (7 h), B9-9 (10 h), B9-10 (10 h) et 2 autres.');
  assert.equal(message?.counts.irrigations, 5);

  const one = morningMessage(inputs({ events: [irrigation('Rampe 1', '2026-09-30T03:00:00.000Z')] }));
  assert.equal(one?.body, '1 arrosage prévu aujourd’hui : Rampe 1 (5 h).', 'un arrosage déjà en retard attend encore son geste : il compte');
});

test('se tait sans arrosage, ni alerte, ni suggestion : la pluie seule ne justifie pas un message', () => {
  assert.equal(morningMessage(inputs()), null);
  assert.equal(morningMessage(inputs({ forecastRainMm: 12 })), null, 'la pluie seule');
  assert.equal(morningMessage(inputs({
    events: [irrigation('Faite', '2026-09-30T03:00:00.000Z', { status: 'completed' })],
    suggestions: [suggestion({ eventEquipmentId: 'kept', plannedStartAt: hoursFromNow(1), kept: true })],
  })), null, 'un arrosage fait, une suggestion gardée');
  assert.equal(morningMessage(inputs({ alerts: 1 }))?.body, '1 alerte en cours.', 'une alerte suffit');
});

test('la pluie se dit seulement connue et supérieure à 0 une fois arrondie : jamais « 0 mm » inventé (D-003)', () => {
  const withRain = (forecastRainMm: number | null) => morningMessage(inputs({ alerts: 1, forecastRainMm }))?.body;
  assert.equal(withRain(null), '1 alerte en cours.', 'inconnue : rien');
  assert.equal(withRain(0), '1 alerte en cours.', '0 mm : rien');
  assert.equal(withRain(0.04), '1 alerte en cours.', 'arrondie à 0 : rien');
  assert.equal(withRain(Number.NaN), '1 alerte en cours.');
  assert.equal(withRain(12), 'Pluie prévue aujourd’hui : 12 mm. 1 alerte en cours.');
});

test('un second calcul du même jour porte le même identifiant ; le lendemain, un autre', () => {
  const alerts = { alerts: 1 };
  const morning = morningMessage(inputs(alerts));
  const again = morningMessage(inputs({ ...alerts, now: new Date(NOW.getTime() + 5 * HOUR_MS) }));
  const tomorrow = morningMessage(inputs({ ...alerts, now: new Date(NOW.getTime() + 24 * HOUR_MS) }));
  assert.equal(again?.alarmId, morning?.alarmId);
  assert.equal(tomorrow?.alarmId, 'morning:2026-10-01');
  // Le jour du passage à l'heure d'hiver : le jour de Paris reste un seul jour.
  const autumn = morningMessage(inputs({ ...alerts, now: new Date('2026-10-25T00:30:00.000Z') }));
  const autumnLater = morningMessage(inputs({ ...alerts, now: new Date('2026-10-25T22:30:00.000Z') }));
  assert.equal(autumn?.alarmId, 'morning:2026-10-25');
  assert.equal(autumnLater?.alarmId, 'morning:2026-10-25', '23 h 30 heure d’hiver, toujours le 25');
  assert.equal(MORNING_MESSAGE_DEFAULT, true, 'activé tant que la ferme ne l’a pas coupé');
});

test('les suggestions : celles des prochaines 24 heures, dans l’ordre du temps, au singulier ou au pluriel', () => {
  assert.deepEqual(morningSuggestions([
    suggestion({ eventEquipmentId: 'ee-3', plannedStartAt: hoursFromNow(10), suggestion: 'reduce', doseMm: 7.5, durationSeconds: 4500, equipmentName: 'Goutte-à-goutte' }),
    suggestion({ eventEquipmentId: 'ee-1', plannedStartAt: hoursFromNow(2) }),
  ], NOW), {
    count: 2,
    text: '2 suggestions sur vos arrosages des prochaines 24 heures : Annuler Rampe bloc 2, Réduire Goutte-à-goutte à 7,5 mm.',
  });
  assert.equal(
    morningSuggestions([suggestion({ eventEquipmentId: 'ee-1', plannedStartAt: hoursFromNow(1), suggestion: 'reduce', doseMm: 8, durationSeconds: 4800 })], NOW)?.text,
    '1 suggestion sur un arrosage des prochaines 24 heures : Réduire Rampe bloc 2 à 8 mm.',
  );
});

test('se taisent : une suggestion gardée, un arrosage qui commence dans plus de 24 heures, un créneau déjà passé ; un arrosage en cours compte encore', () => {
  assert.equal(morningSuggestions([
    suggestion({ eventEquipmentId: 'kept', plannedStartAt: hoursFromNow(1), kept: true }),
    suggestion({ eventEquipmentId: 'later', plannedStartAt: hoursFromNow(24) }),
    suggestion({ eventEquipmentId: 'passed', plannedStartAt: hoursFromNow(-3) }),
  ], NOW), null);
  assert.equal(morningSuggestions([
    suggestion({ eventEquipmentId: 'running', plannedStartAt: hoursFromNow(-1) }),
    suggestion({ eventEquipmentId: 'edge', plannedStartAt: hoursFromNow(23.99) }),
  ], NOW)?.count, 2, 'commencé il y a une heure, il finit dans une heure ; et le dernier dans la fenêtre');
});
