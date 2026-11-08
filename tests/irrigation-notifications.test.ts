import assert from 'node:assert/strict';
import test from 'node:test';
import { showIrrigationCompletionNotification } from '../lib/domain/irrigation-notifications.ts';

const payload = {
  eventEquipmentId: 'event-equipment-1',
  equipmentName: 'Rampe 1',
  settingName: 'Maximum',
  url: '/irrigation?season=2026',
};

test('la fin utilise une notification persistante adaptée au mobile', async () => {
  const calls: Array<{ title: string; options?: NotificationOptions }> = [];
  const result = await showIrrigationCompletionNotification(
    {
      async showNotification(title, options) {
        calls.push({ title, options });
      },
    },
    'granted',
    payload,
  );

  assert.equal(result, 'shown');
  assert.equal(calls.length, 1);
  assert.match(calls[0].title, /Irrigation terminée/);
  assert.equal(calls[0].options?.tag, 'irrigation-finished-event-equipment-1');
  assert.deepEqual(calls[0].options?.data, {
    url: '/irrigation?season=2026',
  });
});

test('le service worker reçoit les Push serveur et sécurise la navigation', async () => {
  const { readFile } = await import('node:fs/promises');
  const source = await readFile('public/irrigation-notifications-sw.js', 'utf8');
  assert.match(source, /addEventListener\('push'/);
  assert.match(source, /registration\.showNotification/);
  // Le clic n'ouvre que /irrigation ou une de ses pages (3.8, P31) : la fonction du service worker est éprouvée telle quelle.
  const code = source.slice(source.indexOf('const IRRIGATION_PATH'), source.indexOf('function safeText'));
  const safeIrrigationUrl = new Function('self', `${code}; return safeIrrigationUrl;`)({ location: { origin: 'https://site.test' } }) as (value: unknown) => string;
  assert.equal(safeIrrigationUrl('/irrigation?season=2026#irrigation-1'), '/irrigation?season=2026#irrigation-1');
  assert.equal(safeIrrigationUrl('/irrigation/arrosages?season=2026#irrigation-1'), '/irrigation/arrosages?season=2026#irrigation-1');
  for (const refused of ['/configuration', '//ailleurs.test/irrigation', 'https://ailleurs.test/irrigation', '/irrigation/a/b', '/irrigation/', 42]) {
    assert.equal(safeIrrigationUrl(refused), '/irrigation', String(refused));
  }
});

test('une erreur de notification mobile ne remonte jamais dans l’interface', async () => {
  const result = await showIrrigationCompletionNotification(
    {
      async showNotification() {
        throw new TypeError('Illegal constructor');
      },
    },
    'granted',
    payload,
  );

  assert.equal(result, 'failed');
});

test('l’absence de service worker laisse le minuteur utilisable', async () => {
  assert.equal(
    await showIrrigationCompletionNotification(null, 'granted', payload),
    'unavailable',
  );
  assert.equal(
    await showIrrigationCompletionNotification(null, 'denied', payload),
    'not-permitted',
  );
});
