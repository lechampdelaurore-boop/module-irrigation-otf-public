import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import vm from 'node:vm';

/**
 * Le toucher d'une notification (recette réelle de la 5 quinquies,
 * 6 novembre 2026 : le toucher n'ouvrait rien). Le service worker tourne ici
 * pour de bon, dans un bac à sable qui imite le navigateur : fenêtres
 * ouvertes, droit de passer au premier plan, ouverture d'une fenêtre.
 */
const ORIGIN = 'https://module.exemple';
const TARGET = `${ORIGIN}/irrigation?season=2026&week=2026-11-02#weather`;

type FakeWindow = {
  url: string;
  focus: () => Promise<FakeWindow | null>;
  navigate?: (url: string) => Promise<FakeWindow | null>;
};

async function clickNotification(options: {
  windows: (calls: string[]) => FakeWindow[];
  url?: string;
  openWindow?: (url: string) => Promise<unknown>;
}) {
  const calls: string[] = [];
  const listeners = new Map<string, (event: unknown) => void>();
  const pending: Promise<unknown>[] = [];
  const self = {
    location: { origin: ORIGIN },
    addEventListener: (type: string, listener: (event: unknown) => void) => listeners.set(type, listener),
    skipWaiting: () => undefined,
    registration: { showNotification: async () => undefined },
    clients: {
      claim: async () => undefined,
      matchAll: async () => options.windows(calls),
      openWindow: async (url: string) => {
        calls.push(`openWindow ${url}`);
        return options.openWindow?.(url) ?? null;
      },
    },
  };
  const source = await readFile('public/irrigation-notifications-sw.js', 'utf8');
  vm.runInNewContext(source, { self, URL });
  listeners.get('notificationclick')?.({
    notification: {
      close: () => calls.push('close'),
      data: { url: options.url ?? '/irrigation?season=2026&week=2026-11-02#weather' },
    },
    waitUntil: (promise: Promise<unknown>) => pending.push(promise),
  });
  // Laisse passer les étapes sans attendre une page qui ne finit jamais de charger.
  for (let i = 0; i < 10; i += 1) await new Promise((resolve) => setImmediate(resolve));
  return { calls, pending };
}

function moduleWindow(calls: string[], overrides: Partial<FakeWindow> = {}): FakeWindow {
  const window: FakeWindow = {
    url: `${ORIGIN}/irrigation?season=2026`,
    focus: async () => {
      calls.push('focus');
      return window;
    },
    navigate: async (url) => {
      calls.push(`navigate ${url}`);
      return window;
    },
    ...overrides,
  };
  return window;
}

test('le toucher amène d’abord le module devant, puis ouvre la semaine annoncée', async () => {
  const { calls, pending } = await clickNotification({ windows: (calls) => [moduleWindow(calls)] });
  assert.deepEqual(calls, ['close', 'focus', `navigate ${TARGET}`]);
  await Promise.all(pending);
});

test('une page qui ne finit pas de charger n’empêche pas le module de venir devant', async () => {
  const { calls } = await clickNotification({
    windows: (calls) => [moduleWindow(calls, {
      navigate: (url) => {
        calls.push(`navigate ${url}`);
        return new Promise(() => undefined);
      },
    })],
  });
  assert.equal(calls.indexOf('focus'), 1, 'le premier plan est demandé avant tout chargement');
});

test('une fenêtre qui ne peut pas changer de page reste devant, sans erreur', async () => {
  const { calls, pending } = await clickNotification({
    windows: (calls) => [moduleWindow(calls, {
      navigate: async () => {
        calls.push('navigate refusé');
        throw new TypeError('This service worker is not the client’s active service worker.');
      },
    })],
  });
  await Promise.all(pending);
  assert.deepEqual(calls, ['close', 'focus', 'navigate refusé']);
});

test('sans fenêtre du module, une nouvelle s’ouvre sur la semaine annoncée', async () => {
  const { calls, pending } = await clickNotification({
    windows: () => [{ url: 'https://autre.exemple/', focus: async () => null }],
  });
  await Promise.all(pending);
  assert.deepEqual(calls, ['close', `openWindow ${TARGET}`]);
});

test('une fenêtre qui refuse de venir devant laisse place à une nouvelle', async () => {
  const { calls, pending } = await clickNotification({
    windows: (calls) => [moduleWindow(calls, {
      focus: async () => {
        calls.push('focus refusé');
        throw new Error('Not allowed to focus a window.');
      },
    })],
  });
  await Promise.all(pending);
  assert.deepEqual(calls, ['close', 'focus refusé', `openWindow ${TARGET}`]);
});

test('une fenêtre déjà sur la bonne page n’est pas rechargée, et une adresse étrangère ramène au module', async () => {
  const already = await clickNotification({
    windows: (calls) => [moduleWindow(calls, { url: TARGET })],
  });
  assert.deepEqual(already.calls, ['close', 'focus']);

  const foreign = await clickNotification({ windows: () => [], url: 'https://pirate.exemple/irrigation' });
  assert.deepEqual(foreign.calls, ['close', `openWindow ${ORIGIN}/irrigation`]);
});
