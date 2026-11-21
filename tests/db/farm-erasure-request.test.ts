import assert from 'node:assert/strict';
import test, { afterEach, beforeEach } from 'node:test';
import { advanceFarmErasure, listOpenFarmErasures, readOpenFarmErasure } from '../../db/farm-erasure-repository';
import { ensureWorkspaceForUser, findWorkspaceIdForUser } from '../../db/workspace-repository';
import {
  assertSpaceNotFrozen,
  cancelErasureOfSpace,
  eraseNowOnWrittenRequest,
  FarmFrozenError,
  requestErasureOfSpace,
} from '../../lib/services/farm-erasure-request';
import { runDueFarmErasures } from '../../lib/services/farm-erasure';
import { readOperatorStatus } from '../../lib/services/operator-status';
import { installTestDatabase, type TestDatabase } from '../support/d1-sqlite';
import { ALICE, BOB } from '../support/spaces';

/**
 * La demande d'effacement d'une ferme, sur la base de test (4.5, PR 3,
 * troisième partie ; docs/tranche-4-contract.md, F563, et 10 bis.22, F665 à
 * F669) : la demande après le nom tapé, l'espace figé, l'annulation, et
 * l'effacement sans attendre par l'exploitant. ALICE demande ; BOB, dans
 * chacun des quatre passages de l'isolation, n'est jamais figé ni touché.
 * Le nom de la ferme se lit dans l'instantané de la source d'essai
 * (« Ferme de démonstration », saisons 2024 à 2027).
 */

const FARM_NAME = 'Ferme de démonstration';
const SEASON = 2026;
/** Vendredi 20 novembre 2026, 11 h à Paris. */
const NOW = new Date('2026-11-20T10:00:00.000Z');

let database: TestDatabase;

beforeEach(async () => {
  database = installTestDatabase();
  await ensureWorkspaceForUser(ALICE);
  await ensureWorkspaceForUser(BOB);
});
afterEach(() => {
  database.dispose();
});

function journal() {
  const lines: Record<string, unknown>[] = [];
  return { lines, log: (_level: string, entry: Record<string, unknown>) => { lines.push(entry); } };
}

async function frozenView(spaceKey: string) {
  try {
    await assertSpaceNotFrozen(spaceKey, 'Alice');
    return null;
  } catch (error) {
    if (error instanceof FarmFrozenError) return error.view;
    throw error;
  }
}

function erasureRows(): number {
  return Number((database.sqlite.prepare('SELECT COUNT(*) AS n FROM irrigation_farm_erasures').get() as { n: number }).n);
}

test('la demande ne part qu’avec le nom de la ferme tapé ; le journal ne dit que le fait', async () => {
  const { lines, log } = journal();
  assert.deepEqual(await requestErasureOfSpace(ALICE, { typedName: 'Ferme', season: SEASON }, NOW, log), {
    ok: false,
    message: `Tapez le nom de la ferme tel qu’il est écrit : « ${FARM_NAME} ».`,
  });
  assert.deepEqual(await requestErasureOfSpace(ALICE, { typedName: FARM_NAME, season: 'deux mille' }, NOW, log), {
    ok: false,
    message: 'Le nom de la ferme n’est pas lu : rechargez la page, puis recommencez.',
  }, 'sans saison lisible, pas de nom à comparer');
  assert.equal(erasureRows(), 0, 'aucune demande n’est née');

  assert.deepEqual(await requestErasureOfSpace(ALICE, { typedName: ' ferme DE démonstration ', season: SEASON }, NOW, log), {
    ok: true,
    message: 'La demande est enregistrée : la ferme sera effacée du module le 28/11/2026 vers 6 h 15.',
  });
  const erasure = await readOpenFarmErasure(ALICE);
  assert.equal(erasure?.state, 'pending');
  assert.deepEqual(lines, [{ event: 'farm_erasure_requested', erasure: erasure?.id }]);
  assert.ok(!JSON.stringify(lines).includes('démonstration'), 'jamais le nom tapé');
  assert.ok(!JSON.stringify(lines).includes(ALICE), 'jamais la personne ni la ferme');

  assert.equal((await requestErasureOfSpace(ALICE, { typedName: FARM_NAME, season: SEASON }, NOW, log)).ok, true);
  assert.equal(erasureRows(), 1, 'une seconde demande ne double pas la première');
});

test('l’espace qui a une demande ouverte est figé ; l’autre ne l’est jamais', async () => {
  assert.equal(await frozenView(ALICE), null);
  await requestErasureOfSpace(ALICE, { typedName: FARM_NAME, season: SEASON }, NOW, () => undefined);
  const view = await frozenView(ALICE);
  assert.equal(view?.title, 'Votre ferme sera effacée du module le 28/11/2026 vers 6 h 15');
  assert.equal(view?.cancellable, true);
  assert.equal(await frozenView(BOB), null, 'BOB ouvre son espace comme avant');
});

test('l’annulation rouvre l’espace aussitôt ; une fois l’effacement commencé, elle est refusée', async () => {
  const { lines, log } = journal();
  assert.deepEqual(await cancelErasureOfSpace(ALICE, NOW, log), { ok: true, message: 'Aucune demande en cours : la ferme est ouverte.' });
  await requestErasureOfSpace(ALICE, { typedName: FARM_NAME, season: SEASON }, NOW, () => undefined);
  const id = (await readOpenFarmErasure(ALICE))?.id;
  assert.deepEqual(await cancelErasureOfSpace(ALICE, new Date('2026-11-21T09:00:00.000Z'), log), {
    ok: true,
    message: 'La demande est annulée : la ferme reprend dès maintenant, et les calculs du matin demain.',
  });
  assert.deepEqual(lines, [{ event: 'farm_erasure_cancelled', erasure: id }]);
  assert.equal(await frozenView(ALICE), null, 'la ferme est rouverte');

  await requestErasureOfSpace(ALICE, { typedName: FARM_NAME, season: SEASON }, NOW, () => undefined);
  database.sqlite.prepare(`UPDATE irrigation_farm_erasures SET state = 'erasing', started_at = ? WHERE state = 'pending'`).run('2026-11-28T05:15:00.000Z');
  assert.deepEqual(await cancelErasureOfSpace(ALICE, NOW, () => undefined), { ok: false, message: 'L’effacement a commencé : il ne peut plus être annulé.' });
  const view = await frozenView(ALICE);
  assert.equal(view?.title, 'L’effacement de votre ferme est en cours');
  assert.equal(view?.cancellable, false);
});

test('l’effacement sans attendre, sur demande écrite : le numéro de la ferme retapé, puis tout de suite ; BOB intact', async () => {
  await requestErasureOfSpace(ALICE, { typedName: FARM_NAME, season: SEASON }, NOW, () => undefined);
  const [request] = await listOpenFarmErasures();
  const farm = request.otfFarmId ?? 'sans ferme';
  const status = await readOperatorStatus(NOW, async () => null);
  assert.deepEqual(status.erasureRequests?.map(({ text, immediate }) => ({ text, immediate })), [{
    text: `${request.otfFarmId === null ? 'espace sans ferme' : `ferme ${request.otfFarmId}`} : demandée le 20/11/2026, effacement prévu le 28/11/2026`,
    immediate: true,
  }], 'la page d’état montre la demande, sans la personne');

  const { lines, log } = journal();
  const later = new Date('2026-11-21T14:00:00.000Z');
  assert.deepEqual(await eraseNowOnWrittenRequest({ requestId: request.id, typedFarm: 'autre' }, later, log), {
    ok: false,
    message: `Retapez le numéro de la ferme de la demande (« ${farm} ») pour confirmer.`,
  });
  assert.ok(await findWorkspaceIdForUser(ALICE), 'rien n’est effacé');

  assert.deepEqual(await eraseNowOnWrittenRequest({ requestId: request.id, typedFarm: farm }, later, log), {
    ok: true,
    message: `L’effacement de la ${request.otfFarmId === null ? 'demande' : `ferme ${request.otfFarmId}`} est fait.`,
  });
  assert.equal(await findWorkspaceIdForUser(ALICE), null, 'l’espace d’ALICE est effacé');
  assert.ok(await findWorkspaceIdForUser(BOB), 'celui de BOB reste');
  assert.equal(await frozenView(BOB), null);
  assert.deepEqual(lines.map(({ event }) => event).filter((event) => String(event).startsWith('farm_erasure_')).slice(0, 1), ['farm_erasure_advanced']);
  assert.deepEqual(
    (database.sqlite.prepare('SELECT state, erase_after, erased_at FROM irrigation_farm_erasures').all() as Record<string, unknown>[])
      .map(({ state, erase_after }) => ({ state, erase_after })),
    [{ state: 'erased', erase_after: later.toISOString() }],
    'la note de la demande garde l’heure où le délai s’est arrêté',
  );

  assert.deepEqual(await eraseNowOnWrittenRequest({ requestId: request.id, typedFarm: farm }, later, log), {
    ok: false,
    message: 'Choisissez une demande en attente : celle-ci n’y est plus.',
  }, 'une demande faite ne s’efface pas deux fois');
});

test('une demande annulée pendant que l’exploitant tape le numéro n’avance pas', async () => {
  await requestErasureOfSpace(ALICE, { typedName: FARM_NAME, season: SEASON }, NOW, () => undefined);
  const [request] = await listOpenFarmErasures();
  await cancelErasureOfSpace(ALICE, NOW, () => undefined);
  let ran = false;
  const run: typeof runDueFarmErasures = async () => {
    ran = true;
    return { due: 0, erased: 0, unfinished: 0, failures: [] };
  };
  assert.deepEqual(await eraseNowOnWrittenRequest({ requestId: request.id, typedFarm: request.otfFarmId ?? 'sans ferme' }, NOW, () => undefined, run), {
    ok: false,
    message: 'Choisissez une demande en attente : celle-ci n’y est plus.',
  });
  assert.equal(await advanceFarmErasure(request.id, NOW.toISOString()), false, 'la base refuse aussi : seulement une demande en attente');
  assert.equal(ran, false, 'aucun passage d’effacement');
  assert.ok(await findWorkspaceIdForUser(ALICE));
});
