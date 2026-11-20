import assert from 'node:assert/strict';
import test from 'node:test';
import {
  assertAllowedReadRoute,
  OTF_MINIMUM_REQUEST_INTERVAL_MS,
  OtfReadClient,
  resetOtfRatePacer,
} from '../lib/adapters/otf/read-client.ts';
import { OtfApiError } from '../lib/domain/otf/api-contract.ts';

const baseUrl = 'https://api.ouvretaferme.org/0.1beta';

// Les régulateurs de débit vivent pour tout le module, un par ferme : sans
// remise à zéro, chaque test attendrait le créneau laissé par le précédent.
test.beforeEach(() => resetOtfRatePacer());

/** Une horloge qui avance d'elle-même quand le régulateur attend : une minute se parcourt sans l'attendre. */
function fakeClock(start = 1_000_000) {
  let current = start;
  return {
    now: () => current,
    sleep: async (durationMs: number) => { current += Math.max(0, durationMs); },
    advance: (durationMs: number) => { current += durationMs; },
  };
}

function configurationResponse() {
  return Response.json({ seasonFirst: 2026, seasonLast: 2027 });
}

test('le connecteur utilise GET et garde le jeton dans l’en-tête serveur', async () => {
  let capturedUrl = '';
  let capturedInit: RequestInit | undefined;
  const client = new OtfReadClient({
    baseUrl,
    token: 'server-secret',
    fetchImpl: async (input, init) => {
      capturedUrl = String(input);
      capturedInit = init;
      return Response.json([{ seasonFirst: 2025, seasonLast: 2027 }]);
    },
  });

  await client.getConfiguration();

  assert.equal(capturedInit?.method, 'GET');
  assert.equal(
    new Headers(capturedInit?.headers).get('Authorization'),
    'Bearer server-secret',
  );
  assert.equal(new URL(capturedUrl).pathname, '/0.1beta/configuration');
  assert.equal(new URL(capturedUrl).search, '');
});

test('le connecteur espace les départs de requêtes d’au moins 250 ms, soit quatre appels par seconde au plus', async () => {
  const starts: number[] = [];
  const client = new OtfReadClient({
    baseUrl,
    token: 'server-secret',
    fetchImpl: async (input) => {
      starts.push(Date.now());
      const url = new URL(input);
      return url.pathname.endsWith('/configuration')
        ? Response.json({ seasonFirst: 2026, seasonLast: 2027 })
        : Response.json({ count: 0, list: [] });
    },
  });

  await client.getConfiguration();
  await client.listZones(2026);

  assert.equal(OTF_MINIMUM_REQUEST_INTERVAL_MS, 250);
  assert.ok(
    starts[1] - starts[0] >= OTF_MINIMUM_REQUEST_INTERVAL_MS,
    `Intervalle observé : ${starts[1] - starts[0]} ms`,
  );
});

test('les lectures simultanées restent espacées les unes des autres', async () => {
  const starts: number[] = [];
  const client = new OtfReadClient({
    baseUrl,
    token: 'server-secret',
    fetchImpl: async (input) => {
      starts.push(Date.now());
      const url = new URL(input);
      return url.pathname.endsWith('/configuration')
        ? Response.json({ seasonFirst: 2026, seasonLast: 2027 })
        : Response.json({ count: 0, list: [] });
    },
  });

  await Promise.all([
    client.getConfiguration(),
    client.listZones(2026),
    client.listPlots(2026),
  ]);

  assert.equal(starts.length, 3);
  for (let index = 1; index < starts.length; index += 1) {
    assert.ok(
      starts[index] - starts[index - 1] >= OTF_MINIMUM_REQUEST_INTERVAL_MS,
      `Intervalle observé : ${starts[index] - starts[index - 1]} ms`,
    );
  }
});

test('un envoi parti en retard sur son tour ne rapproche pas le suivant : 250 ms au moins entre deux envois réels (F385)', async () => {
  // Le processus peut être interrompu entre le tour d'un appel et son envoi
  // réel : la CI a mesuré une fois 249 ms entre deux envois. Ici, chaque envoi
  // part en retard sur son tour, de 10 ms puis de 3 ms ; l'appel suivant
  // compte son attente à partir de l'envoi réel, pas du tour.
  const clock = fakeClock();
  const lateness = [10, 3, 0];
  const starts: number[] = [];
  const client = new OtfReadClient({
    baseUrl,
    token: 'server-secret',
    clock,
    fetchImpl: async (input) => {
      clock.advance(lateness[starts.length] ?? 0);
      starts.push(clock.now());
      return new URL(input).pathname.endsWith('/configuration')
        ? configurationResponse()
        : Response.json({ count: 0, list: [] });
    },
  });

  await Promise.all([
    client.getConfiguration(),
    client.listZones(2026),
    client.listPlots(2026),
  ]);

  assert.equal(starts.length, 3);
  for (let index = 1; index < starts.length; index += 1) {
    assert.ok(
      starts[index] - starts[index - 1] >= OTF_MINIMUM_REQUEST_INTERVAL_MS,
      `Intervalle observé : ${starts[index] - starts[index - 1]} ms`,
    );
  }
});

test('une route hors liste blanche est rejetée avant le réseau', () => {
  assert.throws(
    () => assertAllowedReadRoute('/bed'),
    (error) => error instanceof OtfApiError && /non autorisée/.test(error.message),
  );
});

test('la pagination assemble toutes les pages avec une taille bornée', async () => {
  const requestedStarts: string[] = [];
  const client = new OtfReadClient({
    baseUrl,
    token: 'server-secret',
    pageSize: 2,
    fetchImpl: async (input) => {
      const url = new URL(input);
      requestedStarts.push(url.searchParams.get('start') ?? '');
      assert.equal(url.searchParams.get('limit'), '2');
      assert.equal(url.searchParams.get('season'), '2026');
      const start = url.searchParams.get('start');
      return Response.json(
        start === '1'
          ? { count: 3, list: [{ id: 1 }, { id: 2 }] }
          : { count: 3, list: [{ id: 3 }] },
      );
    },
  });

  const zones = await client.listZones(2026);

  assert.deepEqual(zones, [{ id: 1 }, { id: 2 }, { id: 3 }]);
  assert.deepEqual(requestedStarts, ['1', '3']);
});

test("l'adresse de l'API est limitée au serveur officiel", () => {
  assert.throws(
    () =>
      new OtfReadClient({
        baseUrl: 'https://example.test/0.1beta',
        token: 'server-secret',
      }),
    (error) => error instanceof OtfApiError && /pas autorisée/.test(error.message),
  );
});

test('une erreur 403 ne déclenche pas de nouvel essai', async () => {
  let calls = 0;
  const client = new OtfReadClient({
    baseUrl,
    token: 'server-secret',
    fetchImpl: async () => {
      calls += 1;
      return new Response(null, { status: 403 });
    },
  });

  await assert.rejects(() => client.listBeds(2026), OtfApiError);
  assert.equal(calls, 1);
});

test('une erreur 401 ne déclenche pas de nouvel essai', async () => {
  let calls = 0;
  const client = new OtfReadClient({
    baseUrl,
    token: 'server-secret',
    fetchImpl: async () => {
      calls += 1;
      return new Response(null, { status: 401 });
    },
  });

  await assert.rejects(
    () => client.getConfiguration(),
    (error) => error instanceof OtfApiError && error.status === 401,
  );
  assert.equal(calls, 1);
});

test('une limite 429 est conservée et ne déclenche pas de nouvel essai', async () => {
  let calls = 0;
  const client = new OtfReadClient({
    baseUrl,
    token: 'server-secret',
    fetchImpl: async () => {
      calls += 1;
      return new Response(null, { status: 429 });
    },
  });

  await assert.rejects(
    () => client.listBeds(2026),
    (error) => error instanceof OtfApiError && error.status === 429,
  );
  assert.equal(calls, 1);
});

test('une erreur transitoire est retentée puis réussit', async () => {
  let calls = 0;
  const client = new OtfReadClient({
    baseUrl,
    token: 'server-secret',
    fetchImpl: async () => {
      calls += 1;
      return calls < 3 ? new Response(null, { status: 500 }) : Response.json([]);
    },
  });

  assert.deepEqual(await client.listPlots(2026), []);
  assert.equal(calls, 3);
});

test('une adresse DNS absente produit immédiatement un diagnostic explicite', async () => {
  let calls = 0;
  const client = new OtfReadClient({
    baseUrl,
    token: 'server-secret',
    fetchImpl: async () => {
      calls += 1;
      const error = new TypeError('fetch failed');
      Object.defineProperty(error, 'cause', { value: { code: 'ENOTFOUND' } });
      throw error;
    },
  });

  await assert.rejects(
    () => client.getConfiguration(),
    (error) =>
      error instanceof OtfApiError && /introuvable \(DNS\)/.test(error.message),
  );
  assert.equal(calls, 1);
});

test('deux clients de la même ferme partagent le quota : quatre appels par seconde au plus au total', async () => {
  // Défaut du 20 septembre 2026 : le régulateur vivait dans chaque client, or le
  // client est reconstruit à chaque lecture. Deux lectures simultanées lancées
  // par des composants différents cumulaient donc leurs quotas, d’où un 429.
  const starts: number[] = [];
  const fetchImpl = async (input: string | URL) => {
    starts.push(Date.now());
    return new URL(input).pathname.endsWith('/configuration')
      ? Response.json({ seasonFirst: 2026, seasonLast: 2027 })
      : Response.json({ count: 0, list: [] });
  };
  const premier = new OtfReadClient({ baseUrl, token: 'server-secret', fetchImpl });
  const second = new OtfReadClient({ baseUrl, token: 'server-secret', fetchImpl });

  await Promise.all([
    premier.getConfiguration(),
    second.listZones(2026),
    premier.listPlots(2026),
    second.listBeds(2026),
  ]);

  assert.equal(starts.length, 4);
  const ordonnes = [...starts].sort((a, b) => a - b);
  for (let index = 1; index < ordonnes.length; index += 1) {
    assert.ok(
      ordonnes[index] - ordonnes[index - 1] >= OTF_MINIMUM_REQUEST_INTERVAL_MS,
      `Départs ${index - 1} et ${index} espacés de ${ordonnes[index] - ordonnes[index - 1]} ms`,
    );
  }
  assert.ok(ordonnes[3] - ordonnes[0] >= 3 * OTF_MINIMUM_REQUEST_INTERVAL_MS, 'quatre départs tiennent au moins trois intervalles');
});

test('après une limite 429, plus rien ne part vers cette ferme pendant une seconde', async () => {
  const starts: number[] = [];
  let limiter = true;
  const fetchImpl = async () => {
    starts.push(Date.now());
    if (limiter) { limiter = false; return new Response(null, { status: 429 }); }
    return Response.json({ count: 0, list: [] });
  };
  const client = new OtfReadClient({ baseUrl, token: 'server-secret', fetchImpl });

  await assert.rejects(() => client.listBeds(2026), (error) => error instanceof OtfApiError && error.status === 429);
  const suivant = new OtfReadClient({ baseUrl, token: 'server-secret', fetchImpl });
  await suivant.listZones(2026);

  assert.equal(starts.length, 2, 'le 429 n’est pas retenté');
  assert.ok(starts[1] - starts[0] >= 1_000, `Attente observée après le 429 : ${starts[1] - starts[0]} ms`);
});

test('trente appels par minute au plus : le trente et unième, qui attendrait plus de cinq secondes, est refusé sans rien envoyer (F334)', async () => {
  const clock = fakeClock();
  const starts: number[] = [];
  const client = new OtfReadClient({
    baseUrl,
    token: 'server-secret',
    farmKey: 'ferme-a',
    clock,
    fetchImpl: async () => { starts.push(clock.now()); return configurationResponse(); },
  });

  for (let call = 0; call < 30; call += 1) await client.getConfiguration();
  assert.equal(starts.length, 30);
  for (let index = 1; index < starts.length; index += 1) {
    assert.ok(starts[index] - starts[index - 1] >= OTF_MINIMUM_REQUEST_INTERVAL_MS);
  }

  // Comme sur une limite atteinte : le statut 429 fait afficher le dernier
  // instantané et le message existant (lib/domain/snapshot-policy.ts).
  await assert.rejects(
    () => client.getConfiguration(),
    (error) => error instanceof OtfApiError && error.status === 429 && /30 appels par minute/.test(error.message),
  );
  assert.equal(starts.length, 30, 'rien n’est envoyé à OTF');

  // Le refus ne compte pas : quand le premier des trente départs a passé la
  // minute (et sa marge), une place est libre et l'appel part sans attendre.
  clock.advance(starts[0] + 61_000 - clock.now());
  const askedAt = clock.now();
  await client.getConfiguration();
  assert.equal(starts.length, 31);
  assert.equal(starts[30], askedAt);
});

test('quand une place se libère dans cinq secondes au plus, l’appel l’attend puis part', async () => {
  const clock = fakeClock();
  const starts: number[] = [];
  const client = new OtfReadClient({
    baseUrl,
    token: 'server-secret',
    farmKey: 'ferme-a',
    clock,
    fetchImpl: async () => { starts.push(clock.now()); return configurationResponse(); },
  });
  for (let call = 0; call < 30; call += 1) await client.getConfiguration();

  // 57 secondes après le premier départ, la place se libère dans moins de cinq secondes.
  clock.advance(starts[0] + 57_000 - clock.now());
  const askedAt = clock.now();
  await client.getConfiguration();

  assert.equal(starts.length, 31);
  assert.ok(starts[30] - starts[0] > 60_000, `trente et un départs en ${starts[30] - starts[0]} ms`);
  assert.ok(starts[30] - askedAt <= 5_000, `attente : ${starts[30] - askedAt} ms`);
});

test('chaque ferme a son régulateur : une ferme n’attend jamais le quota d’une autre (T4-07)', async () => {
  const clock = fakeClock();
  const starts: Record<string, number[]> = { 'ferme-a': [], 'ferme-b': [] };
  const clientOf = (farmKey: string) => new OtfReadClient({
    baseUrl,
    token: `jeton-${farmKey}`,
    farmKey,
    clock,
    fetchImpl: async () => { starts[farmKey].push(clock.now()); return configurationResponse(); },
  });
  const fermeA = clientOf('ferme-a');
  const fermeB = clientOf('ferme-b');

  for (let call = 0; call < 30; call += 1) await fermeA.getConfiguration();
  await assert.rejects(() => fermeA.getConfiguration(), (error) => error instanceof OtfApiError && error.status === 429);

  // La ferme B part à l'instant même : ni l'espacement ni la minute de la ferme A ne la retiennent.
  const askedAt = clock.now();
  await fermeB.getConfiguration();
  assert.deepEqual(starts['ferme-b'], [askedAt]);

  // Un second client de la ferme A partage sa minute pleine.
  const autreClientA = clientOf('ferme-a');
  await assert.rejects(() => autreClientA.getConfiguration(), (error) => error instanceof OtfApiError && error.status === 429);
  assert.equal(starts['ferme-a'].length, 30);
});

test('une limite atteinte chez OTF fait patienter sa ferme, pas les autres', async () => {
  const clock = fakeClock();
  const starts: Record<string, number[]> = { 'ferme-a': [], 'ferme-b': [] };
  let limiter = true;
  const clientOf = (farmKey: string) => new OtfReadClient({
    baseUrl,
    token: `jeton-${farmKey}`,
    farmKey,
    clock,
    fetchImpl: async () => {
      starts[farmKey].push(clock.now());
      if (farmKey === 'ferme-a' && limiter) { limiter = false; return new Response(null, { status: 429 }); }
      return configurationResponse();
    },
  });

  await assert.rejects(() => clientOf('ferme-a').getConfiguration(), (error) => error instanceof OtfApiError && error.status === 429);
  const limitedAt = starts['ferme-a'][0];
  await clientOf('ferme-b').getConfiguration();
  await clientOf('ferme-a').getConfiguration();

  assert.equal(starts['ferme-b'][0], limitedAt, 'la ferme B ne patiente pas');
  assert.ok(starts['ferme-a'][1] - limitedAt >= 1_000, `la ferme A patiente : ${starts['ferme-a'][1] - limitedAt} ms`);
});

test('l’attente d’une place ne compte pas dans le délai de l’appel', async () => {
  // Le délai d'un appel (ici 500 ms) part de son envoi : une seconde
  // d'attente après une limite atteinte ne l'épuise pas avant l'envoi.
  const aborted: boolean[] = [];
  let calls = 0;
  const client = new OtfReadClient({
    baseUrl,
    token: 'server-secret',
    timeoutMs: 500,
    fetchImpl: async (_input, init) => {
      calls += 1;
      aborted.push(init?.signal?.aborted ?? false);
      return calls === 1 ? new Response(null, { status: 429 }) : configurationResponse();
    },
  });

  await assert.rejects(() => client.getConfiguration(), (error) => error instanceof OtfApiError && error.status === 429);
  await client.getConfiguration();

  assert.deepEqual(aborted, [false, false]);
});

test('les routes du plan de culture envoient seulement les paramètres écrits dans le code', async () => {
  const requests: string[] = [];
  const client = new OtfReadClient({
    baseUrl,
    token: 'server-secret',
    fetchImpl: async (input) => {
      const url = new URL(input);
      requests.push(`${url.pathname.replace('/0.1beta', '')}?${[...url.searchParams.keys()].sort().join(',')}=${url.searchParams.get('season') ?? '-'}/${url.searchParams.get('withCultivations') ?? '-'}`);
      return Response.json({ count: 0, list: [] });
    },
  });

  await client.listActions();
  await client.listPlants();
  await client.listSeries(2026);
  await client.listPlaces(2026);
  await client.listTasks();

  assert.deepEqual(requests, [
    '/actionList?limit,start=-/-',
    '/plantList?limit,start=-/-',
    '/seriesList?limit,season,start,withCultivations=2026/true',
    '/placeList?limit,season,start=2026/-',
    // OTF ignore le filtre `season` des tâches : il n'est pas envoyé (docs/series-contract.md).
    '/taskList?limit,start=-/-',
  ]);
});

test('une lecture qui dépasse le plafond de pages est refusée, pas tronquée', async () => {
  const client = new OtfReadClient({
    baseUrl,
    token: 'server-secret',
    pageSize: 2,
    maxPages: 2,
    fetchImpl: async () => Response.json({ count: 6, list: [{ id: 1 }, { id: 2 }] }),
  });

  await assert.rejects(
    () => client.listTasks(),
    (error) => error instanceof OtfApiError && /limite de 2 pages/.test(error.message),
  );
});

test('les routes voisines du plan de culture restent hors liste blanche', () => {
  for (const route of ['/harvestList', '/seriesCultivationList', '/plantVarietyList', '/sequenceList']) {
    assert.throws(() => assertAllowedReadRoute(route), OtfApiError);
  }
});
