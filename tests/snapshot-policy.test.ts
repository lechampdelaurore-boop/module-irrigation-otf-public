import assert from 'node:assert/strict';
import test from 'node:test';
import type { IrrigationSnapshot } from '../lib/domain/domain.ts';
import {
  IrrigationDataUnavailableError,
  readLiveOrLastSuccessfulSnapshot,
} from '../lib/domain/snapshot-policy.ts';
import { OtfApiError } from '../lib/domain/otf/api-contract.ts';

const completeSnapshot: IrrigationSnapshot = {
  configuration: { seasonFirst: 2026, seasonLast: 2026 },
  structure: { id: '17', name: 'Ferme', legalCity: 'Rennes', legalPostcode: '35000', legalCountry: 'FR' },
  zones: [{ id: 'z1', name: 'Parcelle', area: 100, seasons: [2026] }],
  plots: [],
  beds: [],
  source: 'live',
  lastSuccessfulReadAt: '2026-08-26T10:00:00.000Z',
};

test('une lecture complète remplace le cache', async () => {
  let written: IrrigationSnapshot | null = null;
  const result = await readLiveOrLastSuccessfulSnapshot({
    readLive: async () => completeSnapshot,
    readCache: async () => null,
    writeCache: async (snapshot) => {
      written = snapshot;
    },
  });

  assert.equal(result.source, 'live');
  assert.deepEqual(written, completeSnapshot);
});

test('un échec de lecture conserve le dernier instantané complet et sa date', async () => {
  let writeCalled = false;
  const result = await readLiveOrLastSuccessfulSnapshot({
    readLive: async () => {
      throw new Error('échec partiel');
    },
    readCache: async () => completeSnapshot,
    writeCache: async () => {
      writeCalled = true;
    },
  });

  assert.equal(writeCalled, false);
  assert.equal(result.source, 'cache');
  assert.equal(result.lastSuccessfulReadAt, completeSnapshot.lastSuccessfulReadAt);
  assert.match(result.warning ?? '', /dernière lecture réussie/i);
});

test('sans lecture ni cache, un état indisponible explicite est renvoyé', async () => {
  await assert.rejects(
    () =>
      readLiveOrLastSuccessfulSnapshot({
        readLive: async () => {
          throw new Error('hors ligne');
        },
        readCache: async () => null,
        writeCache: async () => undefined,
      }),
    IrrigationDataUnavailableError,
  );
});

test('une limite OTF affiche un message spécifique avec le cache', async () => {
  const result = await readLiveOrLastSuccessfulSnapshot({
    readLive: async () => {
      throw new OtfApiError('quota atteint', 429);
    },
    readCache: async () => completeSnapshot,
    writeCache: async () => undefined,
  });

  assert.equal(result.source, 'cache');
  assert.match(result.warning ?? '', /Limite de requêtes OTF atteinte/);
  assert.doesNotMatch(result.warning ?? '', /Connexion.*indisponible/i);
});

test('une limite OTF sans cache conserve le motif rate-limit', async () => {
  await assert.rejects(
    () =>
      readLiveOrLastSuccessfulSnapshot({
        readLive: async () => {
          throw new OtfApiError('quota atteint', 429);
        },
        readCache: async () => null,
        writeCache: async () => undefined,
      }),
    (error) =>
      error instanceof IrrigationDataUnavailableError &&
      error.reason === 'rate-limit',
  );
});

test('une saison indisponible reste distincte d’une panne, même avec un cache', async () => {
  const seasonError = new OtfApiError(
    'saison indisponible',
    undefined,
    'season-unavailable',
  );

  await assert.rejects(
    () =>
      readLiveOrLastSuccessfulSnapshot({
        readLive: async () => {
          throw seasonError;
        },
        readCache: async () => completeSnapshot,
        writeCache: async () => undefined,
        maxCacheAgeMs: 0,
      }),
    (error) => error === seasonError,
  );
});

test('un cache récent évite une nouvelle lecture OTF', async () => {
  let liveCalls = 0;
  const result = await readLiveOrLastSuccessfulSnapshot({
    readLive: async () => {
      liveCalls += 1;
      return completeSnapshot;
    },
    readCache: async () => ({
      ...completeSnapshot,
      source: 'cache',
      lastSuccessfulReadAt: '2026-08-26T10:00:00.000Z',
    }),
    writeCache: async () => undefined,
    maxCacheAgeMs: 4 * 60 * 60 * 1_000,
    now: () => new Date('2026-08-26T12:00:00.000Z'),
  });

  assert.equal(liveCalls, 0);
  assert.equal(result.source, 'cache');
  assert.equal(result.warning, undefined);
});

test('une actualisation manuelle ignore un cache récent', async () => {
  let liveCalls = 0;
  let written: IrrigationSnapshot | null = null;
  const refreshedSnapshot: IrrigationSnapshot = {
    ...completeSnapshot,
    lastSuccessfulReadAt: '2026-08-26T12:00:00.000Z',
  };

  const result = await readLiveOrLastSuccessfulSnapshot({
    readLive: async () => {
      liveCalls += 1;
      return refreshedSnapshot;
    },
    readCache: async () => completeSnapshot,
    writeCache: async (snapshot) => {
      written = snapshot;
    },
    maxCacheAgeMs: 0,
    now: () => new Date('2026-08-26T10:15:00.000Z'),
  });

  assert.equal(liveCalls, 1);
  assert.deepEqual(result, refreshedSnapshot);
  assert.deepEqual(written, refreshedSnapshot);
});
