import assert from 'node:assert/strict';
import { AsyncLocalStorage } from 'node:async_hooks';
import test, { afterEach, beforeEach } from 'node:test';
import { createRequestContext, runWithRequestContext, runWithUnifiedStateMutation } from 'vinext/shims/unified-request-context';
import { requestMemoOfRequest } from '../../app/request-memo';
import { db, overrideDatabase } from '../../db/binding';
import { archiveDemoWorkspace } from '../../db/demo-space-repository';
import { saveFeatureSelectionForUser } from '../../db/feature-selection-repository';
import {
  createRequestMemo,
  provideRequestMemo,
  rememberedRead,
  workspaceMemoKey,
  type RequestMemo,
} from '../../db/request-memo';
import { attachPendingWorkspace, ensureWorkspaceForUser, findWorkspaceIdForUser } from '../../db/workspace-repository';
import { spaceParams } from '../../db/workspace-scope';
import { farmSpaceKey } from '../../lib/domain/farm-space';
import { getFeatureSelectionForUser } from '../../lib/services/feature-selection-service';
import { installTestDatabase, type TestDatabase } from '../support/d1-sqlite';
import { ALICE, BOB } from '../support/spaces';

/**
 * La mémoire d'une requête (docs/tranche-4-contract.md, section 5 sexies) :
 * une lecture ne va qu'une fois à la base pendant une requête, jamais d'une
 * requête à l'autre, jamais d'une ferme à l'autre, et jamais au travers d'une
 * écriture. Rejoué dans les quatre passages d'isolation (F336, F379) : Alice
 * et Bob y sont deux personnes, deux fermes d'une même personne, ou l'espace
 * sans ferme et l'espace de ferme d'une même personne.
 *
 * Ici, une requête est simulée par un contexte asynchrone, comme vinext le
 * fait pour chaque requête ; le dernier test le vérifie avec vinext lui-même
 * (`app/request-memo.ts`), premier passage d'un changement de page compris.
 */

const WORKSPACE_LOOKUP = 'SELECT id FROM irrigation_workspaces';

type Execution = { sql: string; params: unknown[] };

/**
 * La base de test, observée : chaque exécution est notée avec ses paramètres.
 * Une lecture de l'espace peut être retenue après avoir lu la base, jusqu'à un
 * signal, ou échouer une fois.
 */
function observe(d1: D1Database) {
  const executions: Execution[] = [];
  const inner = new WeakMap<D1PreparedStatement, D1PreparedStatement>();
  let held: { reached: () => void; release: Promise<void> } | null = null;
  let failNextLookup = false;

  const statement = (real: D1PreparedStatement, sql: string, params: unknown[]): D1PreparedStatement => {
    const observed = new Proxy(real, {
      get(target, property) {
        const value = Reflect.get(target, property) as unknown;
        if (typeof value !== 'function') return value;
        const method = value as (...args: unknown[]) => unknown;
        if (property === 'bind') return (...values: unknown[]) => statement(method.apply(target, values) as D1PreparedStatement, sql, values);
        if (property === 'first' || property === 'all' || property === 'run' || property === 'raw') {
          return async (...args: unknown[]) => {
            executions.push({ sql, params });
            const lookup = sql.includes(WORKSPACE_LOOKUP);
            if (lookup && failNextLookup) {
              failNextLookup = false;
              throw new Error('D1_ERROR: panne simulée');
            }
            const result = await (method.apply(target, args) as Promise<unknown>);
            if (lookup && held) {
              const current = held;
              held = null;
              current.reached();
              await current.release;
            }
            return result;
          };
        }
        return method.bind(target);
      },
    });
    inner.set(observed, real);
    return observed;
  };

  const database = new Proxy(d1, {
    get(target, property) {
      if (property === 'prepare') return (sql: string) => statement(target.prepare(sql), sql, []);
      if (property === 'batch') {
        return (statements: D1PreparedStatement[]) => target.batch(statements.map((item) => inner.get(item) ?? item));
      }
      const value = Reflect.get(target, property) as unknown;
      return typeof value === 'function' ? (value as (...args: unknown[]) => unknown).bind(target) : value;
    },
  });

  return {
    database,
    executions,
    /** Les lectures de l'espace faites jusqu'ici, avec la clé lue (la personne, puis la ferme). */
    lookups: () => executions.filter((item) => item.sql.includes(WORKSPACE_LOOKUP)).map((item) => item.params),
    /** La prochaine lecture de l'espace lit la base, puis attend `release()` pour rendre sa réponse. */
    holdNextLookup: () => {
      let reached!: () => void;
      let release!: () => void;
      const started = new Promise<void>((resolve) => { reached = resolve; });
      held = { reached, release: new Promise<void>((resolve) => { release = resolve; }) };
      return { started, release };
    },
    failNextLookup: () => {
      failNextLookup = true;
    },
  };
}

const requests = new AsyncLocalStorage<RequestMemo>();

/** Une requête simulée : sa propre mémoire, le temps de `work`. */
function inRequest<T>(work: (memo: RequestMemo) => Promise<T>): Promise<T> {
  const memo = createRequestMemo();
  return requests.run(memo, () => work(memo));
}

/** Rend la main au reste de la file, pour que deux requêtes s'entrelacent vraiment. */
function interleave(): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, 1));
}

let database: TestDatabase;
let observed: ReturnType<typeof observe>;
beforeEach(() => {
  database = installTestDatabase();
  observed = observe(database.d1);
  overrideDatabase(observed.database);
  provideRequestMemo(() => requests.getStore() ?? null);
});
afterEach(() => {
  provideRequestMemo(null);
  database.dispose();
});

test('dans une requête, l’espace d’une clé ne se lit qu’une fois, même demandé en parallèle', async () => {
  const alice = await ensureWorkspaceForUser(ALICE);
  observed.executions.length = 0;

  const ids = await inRequest(async () => {
    const parallel = await Promise.all([findWorkspaceIdForUser(ALICE), findWorkspaceIdForUser(ALICE), findWorkspaceIdForUser(ALICE)]);
    return [...parallel, await findWorkspaceIdForUser(ALICE), await ensureWorkspaceForUser(ALICE)];
  });

  assert.deepEqual(ids, [alice, alice, alice, alice, alice]);
  assert.deepEqual(observed.lookups(), [spaceParams(ALICE)], 'une seule lecture de la base');
});

test('deux fermes dans une même requête : chacune son espace et sa lecture, jamais l’une pour l’autre', async () => {
  const alice = await ensureWorkspaceForUser(ALICE);
  const bob = await ensureWorkspaceForUser(BOB);
  assert.notEqual(alice, bob);
  observed.executions.length = 0;

  const { ids, keys } = await inRequest(async (memo) => {
    const found = await Promise.all([findWorkspaceIdForUser(ALICE), findWorkspaceIdForUser(BOB), findWorkspaceIdForUser(ALICE), findWorkspaceIdForUser(BOB)]);
    return { ids: found, keys: [...memo.workspaceIds.keys()].sort() };
  });

  assert.deepEqual(ids, [alice, bob, alice, bob]);
  assert.deepEqual(keys, [workspaceMemoKey(...spaceParams(ALICE)), workspaceMemoKey(...spaceParams(BOB))].sort(), 'rangés sous la personne et la ferme ensemble');
  assert.deepEqual(observed.lookups().map((params) => JSON.stringify(params)).sort(), [JSON.stringify(spaceParams(ALICE)), JSON.stringify(spaceParams(BOB))].sort());
});

test('deux requêtes en même temps ne partagent rien : chacune lit son espace, pour elle seule', async () => {
  const alice = await ensureWorkspaceForUser(ALICE);
  const bob = await ensureWorkspaceForUser(BOB);
  observed.executions.length = 0;

  const read = (spaceKey: string) => inRequest(async (memo) => {
    const first = await findWorkspaceIdForUser(spaceKey);
    await interleave();
    const second = await findWorkspaceIdForUser(spaceKey);
    await interleave();
    return { memo, ids: [first, second, await findWorkspaceIdForUser(spaceKey)], keys: [...memo.workspaceIds.keys()] };
  });
  const [ofAlice, ofBob, ofAliceAgain] = await Promise.all([read(ALICE), read(BOB), read(ALICE)]);

  assert.deepEqual(ofAlice.ids, [alice, alice, alice]);
  assert.deepEqual(ofBob.ids, [bob, bob, bob]);
  assert.deepEqual(ofAliceAgain.ids, [alice, alice, alice]);
  assert.deepEqual(ofAlice.keys, [workspaceMemoKey(...spaceParams(ALICE))], 'la mémoire d’Alice ne contient qu’Alice');
  assert.deepEqual(ofBob.keys, [workspaceMemoKey(...spaceParams(BOB))], 'la mémoire de Bob ne contient que Bob');
  assert.notEqual(ofAlice.memo, ofAliceAgain.memo, 'deux requêtes de la même ferme ont deux mémoires');
  const lookups = observed.lookups().map((params) => JSON.stringify(params));
  assert.equal(lookups.filter((params) => params === JSON.stringify(spaceParams(ALICE))).length, 2, 'une lecture par requête d’Alice, jamais partagée');
  assert.equal(lookups.filter((params) => params === JSON.stringify(spaceParams(BOB))).length, 1);
});

test('une requête finie ne laisse rien : la suivante relit la base', async () => {
  const alice = await ensureWorkspaceForUser(ALICE);
  observed.executions.length = 0;

  assert.equal(await inRequest(() => findWorkspaceIdForUser(ALICE)), alice);
  assert.equal(await inRequest(() => findWorkspaceIdForUser(ALICE)), alice);

  assert.equal(observed.lookups().length, 2);
});

test('hors d’une requête, rien n’est gardé : chaque lecture va à la base, comme avant', async () => {
  const alice = await ensureWorkspaceForUser(ALICE);
  observed.executions.length = 0;

  assert.equal(await findWorkspaceIdForUser(ALICE), alice);
  assert.equal(await findWorkspaceIdForUser(ALICE), alice);
  assert.equal((await Promise.all([findWorkspaceIdForUser(ALICE), findWorkspaceIdForUser(ALICE)])).length, 2);

  assert.equal(observed.lookups().length, 4);
});

test('l’absence d’un espace ne reste pas : un espace créé pendant la requête, par elle ou par une autre, se lit aussitôt', async () => {
  await inRequest(async () => {
    assert.equal(await findWorkspaceIdForUser(ALICE), null);
    const created = await ensureWorkspaceForUser(ALICE);
    assert.equal(await findWorkspaceIdForUser(ALICE), created);

    assert.equal(await findWorkspaceIdForUser(BOB), null);
    // Une autre requête crée l'espace de Bob, sans passer par cette mémoire.
    database.sqlite.prepare("INSERT INTO irrigation_workspaces (id, owner_user_id, otf_farm_id) VALUES ('espace-de-bob', ?, ?)").run(...spaceParams(BOB));
    assert.equal(await findWorkspaceIdForUser(BOB), 'espace-de-bob');
  });
});

test('un espace rattaché à sa ferme pendant la requête ne se lit plus sous la clé sans ferme', async () => {
  const person = 'carole';
  const farmKey = farmSpaceKey(person, '9');
  const pending = await ensureWorkspaceForUser(person);

  await inRequest(async () => {
    assert.equal(await findWorkspaceIdForUser(person), pending);
    assert.equal(await findWorkspaceIdForUser(farmKey), null);
    assert.equal(await attachPendingWorkspace(person, '9'), true);
    assert.equal(await findWorkspaceIdForUser(person), null, 'l’espace sans ferme n’existe plus');
    assert.equal(await findWorkspaceIdForUser(farmKey), pending, 'il est l’espace de la ferme');
  });
});

test('un espace de démonstration mis de côté pendant la requête n’est plus celui de l’invité', async () => {
  const guest = 'invite·demo·essai';
  const archived = await ensureWorkspaceForUser(guest);

  await inRequest(async () => {
    assert.equal(await findWorkspaceIdForUser(guest), archived);
    assert.equal(await archiveDemoWorkspace(guest, '2026-11-24T22:00:00.000Z'), true);
    assert.equal(await findWorkspaceIdForUser(guest), null);
    const fresh = await ensureWorkspaceForUser(guest);
    assert.notEqual(fresh, archived, 'l’invité écrit dans un espace neuf, jamais dans celui mis de côté');
    assert.equal(await findWorkspaceIdForUser(guest), fresh);
  });
});

test('un espace effacé pendant la requête, par une instruction ou par un lot, ne se lit plus', async () => {
  const alice = await ensureWorkspaceForUser(ALICE);
  const bob = await ensureWorkspaceForUser(BOB);

  await inRequest(async () => {
    assert.equal(await findWorkspaceIdForUser(ALICE), alice);
    assert.equal(await findWorkspaceIdForUser(BOB), bob);
    await db.prepare('DELETE FROM irrigation_workspaces WHERE id = ?').bind(alice).run();
    assert.equal(await findWorkspaceIdForUser(ALICE), null);
    await db.batch([db.prepare('DELETE FROM irrigation_workspaces WHERE id = ?').bind(bob)]);
    assert.equal(await findWorkspaceIdForUser(BOB), null);
  });
});

test('une lecture qui a croisé une écriture n’est pas gardée : la suivante relit la base', async () => {
  const person = 'denis';
  const pending = await ensureWorkspaceForUser(person);
  observed.executions.length = 0;

  await inRequest(async () => {
    const hold = observed.holdNextLookup();
    const crossing = findWorkspaceIdForUser(person);
    await hold.started;
    // La base a déjà répondu « pending » ; le rattachement passe avant que la réponse n'arrive.
    assert.equal(await attachPendingWorkspace(person, '3'), true);
    hold.release();
    assert.equal(await crossing, pending, 'l’appelant reçoit ce que la base a dit à son heure');
    assert.equal(await findWorkspaceIdForUser(person), null, 'mais la réponse d’avant le rattachement n’est pas gardée');
  });
  assert.equal(observed.lookups().length, 2);
});

test('une lecture qui échoue n’est pas gardée : la suivante relit la base', async () => {
  const alice = await ensureWorkspaceForUser(ALICE);
  observed.executions.length = 0;

  await inRequest(async () => {
    observed.failNextLookup();
    await assert.rejects(findWorkspaceIdForUser(ALICE), /panne simulée/);
    assert.equal(await findWorkspaceIdForUser(ALICE), alice);
    assert.equal(await findWorkspaceIdForUser(ALICE), alice);
  });
  assert.equal(observed.lookups().length, 2);
});

test('une lecture ne vide pas la mémoire ; une écriture, un lot qui en contient une et `exec` la vident, avant et après', async () => {
  const alice = await ensureWorkspaceForUser(ALICE);

  await inRequest(async (memo) => {
    await findWorkspaceIdForUser(ALICE);
    await db.prepare('SELECT 1 AS one').first();
    await db.batch([db.prepare('SELECT 1 AS one'), db.prepare('SELECT 2 AS two')]);
    assert.equal(memo.writeMarks, 0);
    assert.equal(memo.workspaceIds.size, 1, 'les lectures laissent la mémoire en place');

    await db.prepare('UPDATE irrigation_workspaces SET updated_at = updated_at WHERE id = ?').bind(alice).run();
    assert.equal(memo.writeMarks, 2, 'une marque au début, une à la fin');
    assert.equal(memo.workspaceIds.size, 0);

    await findWorkspaceIdForUser(ALICE);
    await db.batch([db.prepare('SELECT 1 AS one'), db.prepare('UPDATE irrigation_workspaces SET updated_at = updated_at WHERE id = ?').bind(alice)]);
    assert.equal(memo.writeMarks, 4);
    assert.equal(memo.workspaceIds.size, 0);

    await findWorkspaceIdForUser(ALICE);
    await db.exec('SELECT 1');
    assert.equal(memo.writeMarks, 6, '`exec` compte pour une écriture');
    assert.equal(memo.workspaceIds.size, 0);
  });
});

test('une lecture d’un service : une fois par requête et par ferme, une copie par appelant, relue après une écriture', async () => {
  const calls: string[] = [];
  const read = (spaceKey: string) => rememberedRead('essai', [spaceKey], async () => {
    calls.push(spaceKey);
    return { spaceKey, values: [1, 2] };
  });

  await inRequest(async () => {
    const first = await read(ALICE);
    first.values.push(3);
    assert.deepEqual(await read(ALICE), { spaceKey: ALICE, values: [1, 2] }, 'ce qu’un appelant change ne se voit pas chez l’autre');
    assert.deepEqual(await read(BOB), { spaceKey: BOB, values: [1, 2] });
    assert.deepEqual(calls, [ALICE, BOB]);
    await ensureWorkspaceForUser(ALICE);
    await read(ALICE);
    assert.deepEqual(calls, [ALICE, BOB, ALICE], 'relue après une écriture');
  });
  await read(ALICE);
  await read(ALICE);
  assert.deepEqual(calls, [ALICE, BOB, ALICE, ALICE, ALICE], 'hors d’une requête, lue à chaque fois');
});

test('le choix des fonctionnalités : lu une fois par requête, et relu après l’écriture d’un nouveau choix', async () => {
  await ensureWorkspaceForUser(ALICE);
  await ensureWorkspaceForUser(BOB);
  const selectionReads = () => observed.executions.filter((item) => item.sql.includes('irrigation_feature_selections')).length;

  await inRequest(async () => {
    // Un espace sans choix enregistré a tout coché (R6).
    const before = await getFeatureSelectionForUser(ALICE);
    assert.equal(before.firstVisit, false);
    assert.ok(before.enabled.length > 3);
    observed.executions.length = 0;
    assert.deepEqual((await getFeatureSelectionForUser(ALICE)).enabled, before.enabled);
    assert.equal(selectionReads(), 0, 'gardé pour la requête');

    await saveFeatureSelectionForUser(ALICE, ['alertes-meteo', 'arrosages', 'materiel'], new Date('2026-11-24T21:00:00Z'));
    const after = await getFeatureSelectionForUser(ALICE);
    assert.deepEqual([...after.enabled].sort(), ['alertes-meteo', 'arrosages', 'materiel'], 'relu après l’écriture');
    assert.deepEqual((await getFeatureSelectionForUser(BOB)).enabled, before.enabled, 'le choix d’Alice n’est jamais celui de Bob');
  });
});

test('avec vinext : une mémoire pour toute la requête, premier passage compris, jamais partagée entre deux requêtes simultanées, aucune hors d’une requête', async () => {
  provideRequestMemo(requestMemoOfRequest);
  const ids = { [ALICE]: await ensureWorkspaceForUser(ALICE), [BOB]: await ensureWorkspaceForUser(BOB) };
  observed.executions.length = 0;

  /** Une page : deux composants lisent l'espace ensemble, puis encore une fois après une pause. */
  const page = async (spaceKey: string) => {
    const component = async () => {
      const [a, b] = await Promise.all([findWorkspaceIdForUser(spaceKey), findWorkspaceIdForUser(spaceKey)]);
      await interleave();
      return [a, b, await findWorkspaceIdForUser(spaceKey)];
    };
    return (await Promise.all([component(), component()])).flat();
  };

  /**
   * Un changement de page, comme vinext le sert : la page est exécutée une
   * première fois dans un contexte dérivé de la requête, pour y chercher une
   * redirection, puis rendue.
   */
  const navigation = (spaceKey: string) => runWithRequestContext(createRequestContext(), async () => {
    const memo = requestMemoOfRequest();
    const firstPass = await runWithUnifiedStateMutation(() => {}, async () => {
      assert.equal(requestMemoOfRequest(), memo, 'le premier passage voit la mémoire de sa requête');
      return page(spaceKey);
    });
    await interleave();
    return { memo, seen: [...firstPass, ...await page(spaceKey)] };
  });

  const [alice, bob, aliceAgain] = await Promise.all([navigation(ALICE), navigation(BOB), navigation(ALICE)]);
  assert.deepEqual(new Set(alice.seen), new Set([ids[ALICE]]), 'Alice ne lit que son espace');
  assert.deepEqual(new Set(bob.seen), new Set([ids[BOB]]), 'Bob ne lit que le sien');
  assert.deepEqual(new Set(aliceAgain.seen), new Set([ids[ALICE]]));
  assert.equal(alice.seen.length, 12);
  assert.notEqual(alice.memo, bob.memo, 'une mémoire par requête');
  assert.notEqual(alice.memo, aliceAgain.memo, 'même pour la même personne');
  const aliceKey = JSON.stringify(spaceParams(ALICE));
  const bobKey = JSON.stringify(spaceParams(BOB));
  assert.deepEqual(
    observed.lookups().map((params) => JSON.stringify(params)).sort(),
    [aliceKey, aliceKey, bobKey].sort(),
    'une lecture par requête pour douze demandes, les deux passages ensemble ; deux requêtes d’Alice, deux lectures',
  );

  observed.executions.length = 0;
  assert.notEqual(requestMemoOfRequest(), requestMemoOfRequest(), 'hors d’une requête, une mémoire neuve à chaque appel');
  await findWorkspaceIdForUser(ALICE);
  await findWorkspaceIdForUser(ALICE);
  assert.deepEqual(observed.lookups().map((params) => JSON.stringify(params)), [aliceKey, aliceKey], 'hors d’une requête, chaque lecture va à la base');
});
