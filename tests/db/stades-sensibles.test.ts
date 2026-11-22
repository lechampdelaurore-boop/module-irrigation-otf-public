import assert from 'node:assert/strict';
import test, { afterEach, beforeEach } from 'node:test';
import { listChangeJournalForUser } from '../../db/change-journal/read';
import { listReferenceCropsForWorkspace } from '../../db/crop-water/references';
import { listSensitiveStageChoicesForWorkspace, listSensitiveStageReferences, saveSensitiveStagesForUser } from '../../db/crop-water/sensitive-stages';
import { ensureWorkspaceForUser, findWorkspaceIdForUser } from '../../db/workspace-repository';
import type { IrrigationSnapshot } from '../../lib/domain/domain';
import { farmDurationsOf } from '../../lib/domain/crop-water/farm-durations';
import { curveStages } from '../../lib/domain/crop-water/reference';
import { getCropCoefficientsViewForUser } from '../../lib/services/crop-water-coefficients';
import { saveFarmDurationsForUser } from '../../lib/services/crop-water-durations';
import { installTestDatabase, type TestDatabase } from '../support/d1-sqlite';
import { ALICE, BOB } from '../support/spaces';

/**
 * Amélioration n° 4 : les stades sensibles au manque d'eau, enregistrés
 * (docs/ameliorations-4-5-contract.md, §3.1, F730 ; migration 0045). La
 * liste préremplie validée par le porteur le 21 novembre 2026 est en base,
 * ligne pour ligne ; le choix d'une ferme ne vaut que pour elle. `pnpm test`
 * rejoue ce fichier dans les quatre passages de l'isolation.
 */

let database: TestDatabase;
beforeEach(() => {
  database = installTestDatabase();
});
afterEach(() => {
  database.dispose();
});

const snapshot: IrrigationSnapshot = {
  configuration: { seasonFirst: 2025, seasonLast: 2027 },
  structure: { id: '17', name: 'Ferme', legalCity: 'Rennes', legalPostcode: '35000', legalCountry: 'FR' },
  zones: [],
  plots: [],
  beds: [],
  cropPlan: {
    series: [],
    places: [],
    implantationTasks: [],
    readSummary: { seriesRead: 0, placesRead: 0, tasksRead: 0, tasksRetained: 0, placesWithoutSeries: 0, placesOfUnknownSeries: 0, placesWithUnknownBed: 0 },
  },
  source: 'cache',
  lastSuccessfulReadAt: '2026-11-06T00:00:00.000Z',
};

const DIRECT_SOURCE = ['criiam-haricot', 'criiam-oignon', 'criiam-poivron', 'criiam-pomme-de-terre', 'criiam-tomate', 'fao-cruciferes', 'fao-pasteque', 'fao-petit-pois'];

test('la liste préremplie validée : 41 stades de 28 cultures, chacun désignant un stade de la table de sa culture commune', async () => {
  const references = await listSensitiveStageReferences();
  const crops = await listReferenceCropsForWorkspace(null);
  assert.equal(references.length, 41);
  assert.equal(new Set(references.map((line) => line.cropKey)).size, 28);
  for (const line of references) {
    const crop = crops.find((stored) => stored.crop.id === line.cropKey)?.crop;
    assert.ok(crop, line.cropKey);
    assert.ok(curveStages(crop.curve).some((stage) => stage.rank === line.rank && stage.label === line.label), `${line.cropKey} : ${line.rank} « ${line.label} »`);
    assert.match(line.source, /https:\/\/www\.fao\.org\//, `${line.cropKey} : sa source`);
  }
  assert.deepEqual([...new Set(references.filter((line) => line.confidence === 'source-directe').map((line) => line.cropKey))].sort(), DIRECT_SOURCE);
  for (const key of ['criiam-poireau', 'fao-oignon-vert', 'fao-patate-douce', 'criiam-asperge']) {
    assert.equal(references.some((line) => line.cropKey === key), false, `${key} : aucune proposition`);
  }
  // La reprise après plantation n'est cochée nulle part (choix validé avec la liste).
  assert.equal(references.some((line) => /^Plantation(?:-reprise)? → /.test(line.label) && /[Rr]eprise|2 mois après/.test(line.label)), false);
});

test('le choix d’une ferme ne vaut que pour elle, et l’autre ferme garde la liste préremplie', async () => {
  const saved = await saveSensitiveStagesForUser(ALICE, { cropKey: 'criiam-tomate', sensitiveRanks: [1, 2] });
  assert.deepEqual(saved, {
    ok: true,
    value: {
      cropName: 'Tomate',
      choices: [
        { cropKey: 'criiam-tomate', rank: 1, label: 'Plantation → Reprise', sensitive: true },
        { cropKey: 'criiam-tomate', rank: 3, label: 'Floraison 3e bouquet → Mi-récolte', sensitive: false },
      ],
    },
  });
  await ensureWorkspaceForUser(BOB);
  assert.deepEqual(await listSensitiveStageChoicesForWorkspace(await findWorkspaceIdForUser(BOB)), []);

  const rowsOf = async (owner: string) => {
    const view = await getCropCoefficientsViewForUser({ ownerUserId: owner, season: 2026, snapshot });
    assert.ok(view.available);
    return view.sensitiveStages['criiam-tomate']?.map((row) => [row.rank, row.sensitive, row.origin]);
  };
  assert.deepEqual(await rowsOf(ALICE), [[1, true, 'farm'], [2, true, 'reference'], [3, false, 'farm'], [4, false, 'none']]);
  assert.deepEqual(await rowsOf(BOB), [[1, false, 'none'], [2, true, 'reference'], [3, true, 'reference'], [4, false, 'none']]);
});

test('un choix inchangé garde sa personne et sa date ; cocher comme la liste y revient', async () => {
  await saveSensitiveStagesForUser(ALICE, { cropKey: 'criiam-tomate', sensitiveRanks: [1, 2] }, new Date('2026-07-01T08:00:00.000Z'));
  await saveSensitiveStagesForUser(ALICE, { cropKey: 'criiam-tomate', sensitiveRanks: [1, 2, 3] }, new Date('2026-07-02T08:00:00.000Z'));
  const workspaceId = await findWorkspaceIdForUser(ALICE);
  const rows = () => database.sqlite.prepare('SELECT stage_rank, sensitive, actor_user_id, updated_at FROM irrigation_crop_sensitive_stages WHERE workspace_id = ? ORDER BY stage_rank')
    .all(workspaceId).map((row) => [row.stage_rank, row.sensitive, row.actor_user_id, row.updated_at]);
  assert.deepEqual(rows(), [[1, 1, ALICE, '2026-07-01T08:00:00.000Z']]);
  // « Reprendre la liste préremplie » : les stades de la liste, cochés tels quels.
  await saveSensitiveStagesForUser(ALICE, { cropKey: 'criiam-tomate', sensitiveRanks: [2, 3] });
  assert.deepEqual(rows(), []);
});

test('chaque stade dont la valeur change entre au journal des modifications, dans le même lot ; rien quand rien ne change', async () => {
  // La tomate : la liste préremplie coche les stades 2 et 3.
  await saveSensitiveStagesForUser(ALICE, { cropKey: 'criiam-tomate', sensitiveRanks: [1, 2] }, new Date('2026-07-01T08:00:00.000Z'));
  await saveSensitiveStagesForUser(ALICE, { cropKey: 'criiam-tomate', sensitiveRanks: [1, 2] }, new Date('2026-07-01T09:00:00.000Z'));
  // « Reprendre la liste préremplie » : les deux stades reviennent à la liste.
  await saveSensitiveStagesForUser(ALICE, { cropKey: 'criiam-tomate', sensitiveRanks: [2, 3] }, new Date('2026-07-02T08:00:00.000Z'));
  const lines = (await listChangeJournalForUser(ALICE, { limit: 50 })).reverse().map((entry) => ({
    family: entry.family, subject: entry.subject, objectId: entry.objectId, context: entry.context, action: entry.action,
    before: entry.before, after: entry.after, actor: entry.actorUserId, at: entry.createdAt,
  }));
  const line = (rank: number, label: string, from: number, to: number, at: string) => ({
    family: 'reglage', subject: 'stade-sensible', objectId: 'criiam-tomate', context: { name: 'Tomate', stageRank: rank, stage: label },
    action: 'modifie', before: { sensitive: from }, after: { sensitive: to }, actor: ALICE, at,
  });
  assert.deepEqual(lines, [
    line(1, 'Plantation → Reprise', 0, 1, '2026-07-01T08:00:00.000Z'),
    line(3, 'Floraison 3e bouquet → Mi-récolte', 1, 0, '2026-07-01T08:00:00.000Z'),
    line(1, 'Plantation → Reprise', 1, 0, '2026-07-02T08:00:00.000Z'),
    line(3, 'Floraison 3e bouquet → Mi-récolte', 0, 1, '2026-07-02T08:00:00.000Z'),
  ]);
  // Une autre ferme ne lit rien du journal de la première.
  await saveSensitiveStagesForUser(BOB, { cropKey: 'criiam-tomate', sensitiveRanks: [2, 3] });
  assert.deepEqual(await listChangeJournalForUser(BOB), []);
});

test('un choix fait pour un autre stade au même rang ne compte pas au journal : l’avant est la liste préremplie', async () => {
  await saveSensitiveStagesForUser(ALICE, { cropKey: 'criiam-tomate', sensitiveRanks: [2] }, new Date('2026-07-01T08:00:00.000Z'));
  const workspaceId = await findWorkspaceIdForUser(ALICE);
  // La table de la culture a changé depuis : le choix du stade 3 désigne un nom qui n'est plus le sien.
  database.sqlite.prepare("UPDATE irrigation_crop_sensitive_stages SET stage_label = 'Ancien stade' WHERE workspace_id = ? AND stage_rank = 3").run(workspaceId);
  await saveSensitiveStagesForUser(ALICE, { cropKey: 'criiam-tomate', sensitiveRanks: [2] }, new Date('2026-07-02T08:00:00.000Z'));
  const second = (await listChangeJournalForUser(ALICE, { limit: 50 })).filter((entry) => entry.createdAt === '2026-07-02T08:00:00.000Z');
  // En vigueur avant : le stade 3 suit la liste (sensible) ; le choix d'« Ancien stade » ne vaut rien.
  assert.deepEqual(second.map((entry) => [entry.context.stageRank, entry.before, entry.after]), [[3, { sensitive: 1 }, { sensitive: 0 }]]);
  assert.deepEqual(database.sqlite.prepare('SELECT stage_rank, stage_label, sensitive FROM irrigation_crop_sensitive_stages WHERE workspace_id = ?').all(workspaceId)
    .map((row) => [row.stage_rank, row.stage_label, row.sensitive]), [[3, 'Floraison 3e bouquet → Mi-récolte', 0]]);
});

test('la version de la ferme d’une culture commune garde ses stades sensibles, qui la désignent par sa clé', async () => {
  const crops = await listReferenceCropsForWorkspace(await ensureWorkspaceForUser(ALICE));
  const cruciferes = crops.find((stored) => stored.crop.id === 'fao-cruciferes');
  assert.ok(cruciferes);
  const durations = farmDurationsOf(cruciferes.crop);
  assert.equal((await saveFarmDurationsForUser(ALICE, 'fao-cruciferes', { ...durations, abatement: 0.8 })).ok, true);
  assert.deepEqual(await saveSensitiveStagesForUser(ALICE, { cropKey: 'fao-cruciferes', sensitiveRanks: [2, 3, 4] }), {
    ok: true, value: { cropName: cruciferes.crop.name, choices: [{ cropKey: 'fao-cruciferes', rank: 2, label: 'Développement', sensitive: true }] },
  });
  const view = await getCropCoefficientsViewForUser({ ownerUserId: ALICE, season: 2026, snapshot });
  assert.ok(view.available);
  assert.deepEqual(view.sensitiveStages['fao-cruciferes']?.map((row) => [row.label, row.sensitive, row.origin]), [
    ['Début', false, 'none'], ['Développement', true, 'farm'], ['Pleine saison', true, 'reference'], ['Fin', true, 'reference'],
  ]);
});

test('un rang absent de la table est refusé, et rien n’est écrit', async () => {
  assert.deepEqual(await saveSensitiveStagesForUser(ALICE, { cropKey: 'criiam-poireau', sensitiveRanks: [1, 4] }), {
    ok: false, problems: ['Poireau : le stade 4 n’existe pas dans sa table.'],
  });
  assert.equal(database.sqlite.prepare('SELECT count(*) AS count FROM irrigation_crop_sensitive_stages').get()?.count, 0);
  assert.equal(database.sqlite.prepare('SELECT count(*) AS count FROM irrigation_change_journal').get()?.count, 0);
});
