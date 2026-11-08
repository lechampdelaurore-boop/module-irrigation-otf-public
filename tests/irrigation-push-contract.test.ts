import assert from 'node:assert/strict';
import test from 'node:test';
import {
  safeIrrigationNotificationUrl,
  validateIrrigationPushAlarmRequest,
  validateIrrigationPushSubscription,
} from '../lib/domain/irrigation-push-contract.ts';

test('un abonnement Web Push valide est normalisé', () => {
  assert.deepEqual(
    validateIrrigationPushSubscription({
      endpoint: 'https://fcm.googleapis.com/fcm/send/device-1',
      expirationTime: null,
      keys: { p256dh: 'abcdefgh_12345678', auth: 'abcdefgh-12345678' },
    }),
    {
      endpoint: 'https://fcm.googleapis.com/fcm/send/device-1',
      expirationTime: null,
      keys: { p256dh: 'abcdefgh_12345678', auth: 'abcdefgh-12345678' },
    },
  );
});

test('un endpoint arbitraire et une navigation externe sont refusés', () => {
  assert.equal(
    validateIrrigationPushSubscription({
      endpoint: 'https://example.com/collect',
      expirationTime: null,
      keys: { p256dh: 'abcdefgh_12345678', auth: 'abcdefgh-12345678' },
    }),
    null,
  );
  assert.equal(safeIrrigationNotificationUrl('//example.com'), null);
  assert.equal(safeIrrigationNotificationUrl('/configuration'), null);
});

test('une notification ouvre /irrigation ou une de ses pages, rien d’autre (3.8)', () => {
  assert.equal(safeIrrigationNotificationUrl('/irrigation?season=2026#irrigation-1'), '/irrigation?season=2026#irrigation-1');
  assert.equal(safeIrrigationNotificationUrl('/irrigation/arrosages?season=2026#irrigation-1'), '/irrigation/arrosages?season=2026#irrigation-1');
  assert.equal(safeIrrigationNotificationUrl('/irrigation/alertes-cultures?season=2026&week=2026-11-02'), '/irrigation/alertes-cultures?season=2026&week=2026-11-02');
  assert.equal(safeIrrigationNotificationUrl('/irrigation/'), null);
  assert.equal(safeIrrigationNotificationUrl('/irrigation/a/b'), null);
  assert.equal(safeIrrigationNotificationUrl('/irrigation/../configuration'), null);
  assert.equal(safeIrrigationNotificationUrl('/irrigationx'), null);
  assert.equal(safeIrrigationNotificationUrl('/irrigation/Planning'), null);
});

test('une alarme lie une révision, un destinataire et une URL irrigation', () => {
  const alarm = validateIrrigationPushAlarmRequest({
    eventEquipmentId: 'event-equipment-1',
    recipientKey: 'workspace-1',
    revision: '1788271200000-a1b2',
    dueAt: '2026-09-01T18:00:00.000Z',
    notification: {
      title: 'Irrigation terminée',
      body: 'Rampe 1 · maximum',
      tag: 'irrigation-finished-event-equipment-1',
      data: {
        url: '/irrigation?season=2026#irrigation-event-equipment-1',
      },
    },
  });
  assert.equal(alarm?.recipientKey, 'workspace-1');
  assert.equal(alarm?.dueAt, '2026-09-01T18:00:00.000Z');
});
