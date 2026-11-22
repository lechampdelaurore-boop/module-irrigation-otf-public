import assert from 'node:assert/strict';
import test, { afterEach } from 'node:test';
import type { IrrigationPushAlarmRequest } from '../lib/domain/irrigation-push-contract.ts';
import { phoneNoticeAlarmKeys } from '../lib/domain/today/phone-notice-alarm.ts';
import { schedulePhoneNoticeAlarm } from '../lib/services/irrigation-push-service.ts';

/**
 * L'alarme du message du matin et du rappel du soir
 * (docs/ameliorations-6-2-3-7-contract.md, section 4.4, F744, F745 ; revue
 * de l'isolation du 22 novembre 2026, constat A) : l'identifiant porte
 * l'espace et le jour, et le module lit la réponse du Worker. `scheduled` seul vaut un envoi ;
 * `stale` (une alarme plus récente gardée sous le même identifiant) n'en est
 * pas un. Le Worker lui-même est éprouvé dans `cloudflare/irrigation-push/test/`.
 */

const KEYS = ['DEMO_MODE', 'IRRIGATION_PUSH_SERVICE_URL', 'IRRIGATION_PUSH_SERVICE_TOKEN'] as const;
const savedEnv = Object.fromEntries(KEYS.map((key) => [key, process.env[key]]));
const savedFetch = globalThis.fetch;

afterEach(() => {
  for (const key of KEYS) {
    if (savedEnv[key] === undefined) delete process.env[key];
    else process.env[key] = savedEnv[key];
  }
  globalThis.fetch = savedFetch;
});

const SPACE = '0b8e6c1a-5f0e-4a43-9d64-1c2a7e9f3b10';
const keys = phoneNoticeAlarmKeys('morning', SPACE, '2026-11-22');
const request: IrrigationPushAlarmRequest = {
  eventEquipmentId: keys.alarmId,
  recipientKey: SPACE,
  revision: '1795320000000-00000000-0000-4000-8000-000000000000',
  dueAt: '2026-11-22T06:15:00.000Z',
  notification: { title: 'Votre journée', body: '1 alerte en cours.', tag: keys.tag, data: { url: '/irrigation/aujourdhui' } },
};

/** Un service de notification joué par un faux réseau, qui garde ce qu'il reçoit. */
function pushService(answer: () => Response): { url: string; body: unknown }[] {
  delete process.env.DEMO_MODE;
  process.env.IRRIGATION_PUSH_SERVICE_URL = 'https://irrigation-otf-push.exemple.workers.dev';
  process.env.IRRIGATION_PUSH_SERVICE_TOKEN = 'jeton-de-test-sans-valeur';
  const received: { url: string; body: unknown }[] = [];
  globalThis.fetch = (async (input: string | URL | Request, init?: RequestInit) => {
    received.push({ url: String(input), body: JSON.parse(String(init?.body)) });
    return answer();
  }) as typeof fetch;
  return received;
}

test('l’identifiant et l’étiquette portent le genre, l’espace et le jour (F744)', () => {
  assert.deepEqual(phoneNoticeAlarmKeys('morning', SPACE, '2026-11-22'), {
    alarmId: `morning:${SPACE}:2026-11-22`,
    tag: `morning-${SPACE}-2026-11-22`,
  });
  assert.deepEqual(phoneNoticeAlarmKeys('evening', SPACE, '2026-11-22'), {
    alarmId: `evening:${SPACE}:2026-11-22`,
    tag: `evening-${SPACE}-2026-11-22`,
  });
  assert.notEqual(phoneNoticeAlarmKeys('morning', 'f3d2a9b4-7c61-4e0a-8b5d-2a9c4e7f1d36', '2026-11-22').alarmId, keys.alarmId, 'deux espaces, deux alarmes');
  assert.notEqual(phoneNoticeAlarmKeys('evening', SPACE, '2026-11-22').alarmId, keys.alarmId, 'le matin et le soir ne se mêlent pas');
});

test('« scheduled » vaut un envoi, et la demande part telle quelle vers la route des alarmes', async () => {
  const received = pushService(() => Response.json({ status: 'scheduled', revision: request.revision }));
  assert.deepEqual(await schedulePhoneNoticeAlarm(request), { status: 'ok' });
  assert.deepEqual(received, [{ url: 'https://irrigation-otf-push.exemple.workers.dev/v1/alarms/schedule', body: request }]);
});

test('« stale » n’est jamais un envoi (F745)', async () => {
  pushService(() => Response.json({ status: 'stale', revision: '1795329999999-ffffffff-ffff-4fff-bfff-ffffffffffff' }));
  assert.deepEqual(await schedulePhoneNoticeAlarm(request), { status: 'stale' });
});

test('une réponse illisible ou en erreur est un échec ; sans service configuré, rien n’est appelé', async () => {
  pushService(() => new Response(null, { status: 204 }));
  assert.deepEqual(await schedulePhoneNoticeAlarm(request), { status: 'failed', message: 'Réponse du service d’alerte illisible.' });
  pushService(() => Response.json({ status: 'peut-être' }));
  assert.deepEqual(await schedulePhoneNoticeAlarm(request), { status: 'failed', message: 'Réponse du service d’alerte illisible.' });
  pushService(() => new Response('panne', { status: 500 }));
  assert.deepEqual(await schedulePhoneNoticeAlarm(request), { status: 'failed', message: 'Le service d’alerte a répondu 500.' });

  const received = pushService(() => Response.json({ status: 'scheduled' }));
  delete process.env.IRRIGATION_PUSH_SERVICE_URL;
  assert.deepEqual(await schedulePhoneNoticeAlarm(request), { status: 'disabled' });
  assert.deepEqual(received, [], 'aucun appel');
});
