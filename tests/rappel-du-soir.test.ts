import assert from 'node:assert/strict';
import test from 'node:test';
import {
  EVENING_REMINDER_DEFAULT,
  EVENING_REMINDER_DEFAULT_TIME,
  EVENING_TIMES,
  eveningPassUseful,
  eveningReminder,
  eveningReminderDue,
  eveningTimeText,
  isEveningTime,
} from '../lib/domain/today/evening-reminder.ts';
import type { IrrigationEventRecord } from '../lib/domain/irrigation-event-record.ts';

/**
 * Le rappel du soir (amélioration n° 2,
 * docs/ameliorations-6-2-3-7-contract.md, section 4.3, F704, F705, F714) :
 * les arrosages validés du jour jamais confirmés, à l'heure réglée par la
 * ferme ; rien quand tout est confirmé ; jamais avant l'heure, jamais plus de
 * deux heures après ; un identifiant par jour de Paris.
 */

const HOUR_MS = 3_600_000;
const EVENING = new Date('2026-09-30T17:05:00.000Z'); // mercredi 30 septembre, 19 h 05 à la ferme (heure d'été)

type EventOptions = { status?: 'planned' | 'completed' | 'canceled'; started?: boolean; minutes?: number };

function irrigation(name: string, startAt: string, options: EventOptions = {}): IrrigationEventRecord {
  const status = options.status ?? 'planned';
  return {
    id: `event-${name}-${startAt}`,
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
      plannedEndAt: new Date(Date.parse(startAt) + (options.minutes ?? 60) * 60_000).toISOString(),
      plannedDurationSeconds: (options.minutes ?? 60) * 60,
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

test('les heures proposées : de 17 h à 22 h au quart d’heure, 19 h par défaut, activé par défaut', () => {
  assert.equal(EVENING_TIMES.length, 21);
  assert.equal(EVENING_TIMES[0], '17:00');
  assert.equal(EVENING_TIMES.at(-1), '22:00');
  assert.ok(EVENING_TIMES.includes(EVENING_REMINDER_DEFAULT_TIME));
  assert.equal(EVENING_REMINDER_DEFAULT_TIME, '19:00');
  assert.equal(EVENING_REMINDER_DEFAULT, true);
  for (const refused of ['16:45', '22:15', '19:10', '7:00', '', null, 19]) assert.equal(isEveningTime(refused), false, String(refused));
  assert.equal(eveningTimeText('19:00'), '19 h');
  assert.equal(eveningTimeText('21:45'), '21 h 45');
});

test('dû à l’heure réglée et jusqu’à deux heures après, jamais avant ; été comme hiver', () => {
  const at = (iso: string) => new Date(iso);
  assert.equal(eveningReminderDue('19:00', at('2026-09-30T17:05:00.000Z')), true, '19 h 05 en été');
  assert.equal(eveningReminderDue('19:00', at('2026-09-30T16:05:00.000Z')), false, '18 h 05 : trop tôt');
  assert.equal(eveningReminderDue('19:15', at('2026-09-30T17:05:00.000Z')), false, '19 h 05 pour 19 h 15 : jamais avant l’heure');
  assert.equal(eveningReminderDue('19:15', at('2026-09-30T18:05:00.000Z')), true, 'au passage de 20 h 05');
  assert.equal(eveningReminderDue('19:00', at('2026-09-30T18:59:00.000Z')), true, '20 h 59 : encore dans les deux heures');
  assert.equal(eveningReminderDue('19:00', at('2026-09-30T19:05:00.000Z')), false, '21 h 05 : un passage en panne ne rattrape pas');
  assert.equal(eveningReminderDue('22:00', at('2026-09-30T21:05:00.000Z')), true, '23 h 05 pour 22 h');
  assert.equal(eveningReminderDue('22:00', at('2026-09-30T22:05:00.000Z')), false, 'minuit passé : le jour est fini');
  assert.equal(eveningReminderDue('19:00', at('2026-01-15T18:05:00.000Z')), true, '19 h 05 en hiver');
  assert.equal(eveningReminderDue('19:00', at('2026-01-15T17:05:00.000Z')), false, '18 h 05 en hiver');
  assert.equal(eveningReminderDue('19:10', at('2026-09-30T17:15:00.000Z')), false, 'une heure hors de la liste ne vaut rien');
  assert.equal(eveningPassUseful(at('2026-09-30T14:59:00.000Z')), false, '16 h 59 : rien à lire');
  assert.equal(eveningPassUseful(at('2026-09-30T15:05:00.000Z')), true, '17 h 05');
});

test('le rappel nomme les arrosages validés du jour dont la fin est passée et qui attendent encore un geste', () => {
  const reminder = eveningReminder({
    now: EVENING,
    events: [
      irrigation('Goutte-à-goutte nord', '2026-09-30T06:00:00.000Z'),
      irrigation('Rampe 1', '2026-09-30T04:30:00.000Z'),
      irrigation('Tunnel 2', '2026-09-30T16:30:00.000Z'), // 18 h 30 – 19 h 30 : pas encore fini
      irrigation('Commencée', '2026-09-30T05:00:00.000Z', { started: true }),
      irrigation('Faite', '2026-09-30T05:00:00.000Z', { status: 'completed' }),
      irrigation('Annulée', '2026-09-30T05:00:00.000Z', { status: 'canceled' }),
      irrigation('Hier', '2026-09-29T05:00:00.000Z'),
    ],
  });
  assert.deepEqual(reminder, {
    parisDay: '2026-09-30',
    title: 'Arrosages à confirmer',
    body: '2 arrosages prévus aujourd’hui ne sont pas confirmés : Rampe 1, Goutte-à-goutte nord. Les avez-vous faits ?',
    alarmId: 'evening:2026-09-30',
    tag: 'evening-2026-09-30',
    url: '/irrigation/aujourdhui',
    count: 2,
  });
});

test('au singulier ; au plus trois noms puis « et n autres » ; rien quand tout est confirmé', () => {
  assert.equal(
    eveningReminder({ now: EVENING, events: [irrigation('Rampe 1', '2026-09-30T04:30:00.000Z')] })?.body,
    '1 arrosage prévu aujourd’hui n’est pas confirmé : Rampe 1. L’avez-vous fait ?',
  );
  const many = eveningReminder({
    now: EVENING,
    events: ['B9-10', 'B9-9', 'Tunnel 1', 'Tunnel 2', 'Tunnel 3'].map((name, index) => irrigation(name, `2026-09-30T0${4 + index}:00:00.000Z`)),
  });
  assert.equal(many?.body, '5 arrosages prévus aujourd’hui ne sont pas confirmés : B9-10, B9-9, Tunnel 1 et 2 autres. Les avez-vous faits ?');
  assert.equal(eveningReminder({ now: EVENING, events: [] }), null);
  assert.equal(eveningReminder({ now: EVENING, events: [irrigation('Faite', '2026-09-30T05:00:00.000Z', { status: 'completed' })] }), null);
});

test('un même matériel arrosé deux fois se nomme une fois et compte deux arrosages', () => {
  const reminder = eveningReminder({
    now: EVENING,
    events: [irrigation('Rampe 1', '2026-09-30T04:00:00.000Z'), irrigation('Rampe 1', '2026-09-30T10:00:00.000Z')],
  });
  assert.equal(reminder?.body, '2 arrosages prévus aujourd’hui ne sont pas confirmés : Rampe 1. Les avez-vous faits ?');
  assert.equal(reminder?.count, 2);
  assert.equal(
    eveningReminder({ now: new Date(EVENING.getTime() + 2 * HOUR_MS), events: [irrigation('Rampe 1', '2026-09-30T04:00:00.000Z')] })?.alarmId,
    'evening:2026-09-30',
    'le même jour, le même identifiant',
  );
});
