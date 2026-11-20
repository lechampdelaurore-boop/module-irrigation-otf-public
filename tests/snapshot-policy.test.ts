import assert from 'node:assert/strict';
import test from 'node:test';
import type { IrrigationSnapshot } from '../lib/domain/domain.ts';
import {
  DAY_LIMIT_MESSAGE,
  FARM_CHANGED_MESSAGE,
  IrrigationDataUnavailableError,
  READ_TOO_LONG_MESSAGE,
  SHAPE_CHANGED_MESSAGE,
  readLiveOrLastSuccessfulSnapshot,
} from '../lib/domain/snapshot-policy.ts';
import { OtfApiError, OtfShapeError } from '../lib/domain/otf/api-contract.ts';
import { OtfFarmMismatchError } from '../lib/domain/otf/farm-identity.ts';
import { OtfReadDeferredError, type OtfReadDeferralReason } from '../lib/domain/otf/shared-call-pace.ts';

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

test('une clé qui mène à une autre ferme : rien n’est rangé, le dernier instantané s’affiche avec le message de F332', async () => {
  let writeCalled = false;
  const result = await readLiveOrLastSuccessfulSnapshot({
    readLive: async () => {
      throw new OtfFarmMismatchError('18');
    },
    readCache: async () => completeSnapshot,
    writeCache: async () => {
      writeCalled = true;
    },
  });
  assert.equal(writeCalled, false);
  assert.equal(result.source, 'cache');
  assert.equal(result.warning, FARM_CHANGED_MESSAGE);
});

test('une clé qui ne mène à aucune ferme lisible : le dernier instantané s’affiche, avec un message à part (F341)', async () => {
  const result = await readLiveOrLastSuccessfulSnapshot({
    readLive: async () => {
      throw new OtfFarmMismatchError(null);
    },
    readCache: async () => completeSnapshot,
    writeCache: async () => undefined,
  });
  assert.equal(result.source, 'cache');
  assert.match(result.warning ?? '', /n'a pas dit à quelle ferme mène la clé/);
});

test('sans cache, la ferme changée ou inconnue garde son motif, jamais « indisponible »', async () => {
  for (const [observed, reason] of [['18', 'farm-changed'], [null, 'farm-unidentified']] as const) {
    await assert.rejects(
      () => readLiveOrLastSuccessfulSnapshot({
        readLive: async () => {
          throw new OtfFarmMismatchError(observed);
        },
        readCache: async () => null,
        writeCache: async () => undefined,
      }),
      (error) => error instanceof IrrigationDataUnavailableError && error.reason === reason,
    );
  }
});

// --- Ouvre ta ferme a changé la forme de ses données (4.3, PR 5 ; T4-15, F370 point 5, F394) ---

test('un écart de forme : rien n’est rangé, le dernier instantané s’affiche avec le message de F370 ; sans cache, son motif à part', async () => {
  let writeCalled = false;
  const result = await readLiveOrLastSuccessfulSnapshot({
    readLive: async () => {
      throw new OtfShapeError('/bedList', 'width', 'missing-everywhere');
    },
    readCache: async () => completeSnapshot,
    writeCache: async () => {
      writeCalled = true;
    },
  });
  assert.equal(writeCalled, false);
  assert.equal(result.source, 'cache');
  assert.equal(result.lastSuccessfulReadAt, completeSnapshot.lastSuccessfulReadAt);
  assert.equal(result.warning, SHAPE_CHANGED_MESSAGE);
  assert.equal(SHAPE_CHANGED_MESSAGE, 'Ouvre ta ferme a changé la forme de ses données : la dernière lecture réussie est affichée.');

  await assert.rejects(
    () => readLiveOrLastSuccessfulSnapshot({
      readLive: async () => {
        throw new OtfShapeError('/me', 'structure', 'several-structures');
      },
      readCache: async () => null,
      writeCache: async () => undefined,
    }),
    (error) => error instanceof IrrigationDataUnavailableError && error.reason === 'shape-changed',
  );
});

// --- Les lectures reportées par le compteur partagé (4.3, F362, F363, F386, F388) ---

const deferred = (reason: OtfReadDeferralReason, retryAtMs: number | null = null) => async (): Promise<IrrigationSnapshot> => {
  throw new OtfReadDeferredError(reason, retryAtMs);
};

test('une minute pleine : le dernier instantané s’affiche avec l’heure de la prochaine lecture possible, si elle est aujourd’hui (F362, F386)', async () => {
  const now = new Date('2026-11-18T10:00:00.000Z'); // 11 h à Paris
  const withTime = await readLiveOrLastSuccessfulSnapshot({
    readLive: deferred('minute', now.getTime() + 61_000),
    readCache: async () => completeSnapshot,
    writeCache: async () => undefined,
    now: () => now,
  });
  assert.equal(withTime.warning, 'Limite de requêtes OTF atteinte. La dernière lecture réussie est affichée ; nouvelle lecture possible à 11 h 01.');

  const lateEvening = new Date('2026-11-18T22:59:30.000Z'); // 23 h 59 à Paris : la place se libère demain
  const tomorrow = await readLiveOrLastSuccessfulSnapshot({
    readLive: deferred('rate-limit', lateEvening.getTime() + 61_000),
    readCache: async () => completeSnapshot,
    writeCache: async () => undefined,
    now: () => lateEvening,
  });
  assert.match(tomorrow.warning ?? '', /^Limite de requêtes OTF atteinte\. La dernière lecture réussie est affichée\. Patientez/);
});

test('la limite du jour, une lecture trop longue, le frein : chacun son message avec le cache, et son motif sans cache (F359, F362, F363)', async () => {
  const cases = [
    { reason: 'day-limit', warning: DAY_LIMIT_MESSAGE, motive: 'day-limit' },
    { reason: 'too-many-calls', warning: READ_TOO_LONG_MESSAGE, motive: 'read-too-long' },
    { reason: 'authentication-brake', warning: "Connexion à Ouvre ta ferme indisponible. La dernière lecture réussie est affichée.", motive: 'unavailable' },
    { reason: 'authentication-limit', warning: "Connexion à Ouvre ta ferme indisponible. La dernière lecture réussie est affichée.", motive: 'unavailable' },
  ] as const;
  for (const { reason, warning, motive } of cases) {
    const shown = await readLiveOrLastSuccessfulSnapshot({ readLive: deferred(reason), readCache: async () => completeSnapshot, writeCache: async () => undefined });
    assert.equal(shown.source, 'cache');
    assert.equal(shown.warning, warning, reason);
    await assert.rejects(
      readLiveOrLastSuccessfulSnapshot({ readLive: deferred(reason), readCache: async () => null, writeCache: async () => undefined }),
      (error) => error instanceof IrrigationDataUnavailableError && error.reason === motive,
    );
  }
});

test('une autre lecture de la ferme était en cours : ce qu’elle a rangé s’affiche tel quel, sinon le dernier instantané avec la raison (F362, F388)', async () => {
  const stored: IrrigationSnapshot = { ...completeSnapshot, source: 'cache', lastSuccessfulReadAt: '2026-08-26T10:05:00.000Z' };
  const reads = [completeSnapshot, stored];
  const fresh = await readLiveOrLastSuccessfulSnapshot({
    readLive: deferred('read-in-progress'),
    readCache: async () => reads.shift() ?? null,
    writeCache: async () => undefined,
  });
  assert.deepEqual(fresh, stored);

  const unchanged = await readLiveOrLastSuccessfulSnapshot({
    readLive: deferred('read-in-progress'),
    readCache: async () => completeSnapshot,
    writeCache: async () => undefined,
  });
  assert.equal(unchanged.source, 'cache');
  assert.match(unchanged.warning ?? '', /déjà en cours pour cette ferme/);

  await assert.rejects(
    readLiveOrLastSuccessfulSnapshot({ readLive: deferred('read-in-progress'), readCache: async () => null, writeCache: async () => undefined }),
    (error) => error instanceof IrrigationDataUnavailableError && error.reason === 'read-in-progress',
  );
});
