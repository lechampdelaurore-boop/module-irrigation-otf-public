import assert from 'node:assert/strict';
import test, { afterEach, beforeEach } from 'node:test';
import {
  correctWaterReservoirVolumeForUser,
  listWaterInfrastructureForUser,
  saveDefaultWaterSupplyForUser,
  saveReservoirLinkForUser,
  saveResourceReservoirLinkForUser,
  saveWaterReservoirForUser,
  saveWaterResourceForUser,
  saveWaterResourceLimitForUser,
} from '../../db/water-resource-repository';
import { ensureWorkspaceForUser, findWorkspaceIdForUser } from '../../db/workspace-repository';
import type { WaterReservoirDraft, WaterResourceDraft } from '../../lib/domain/water-resources';
import { installTestDatabase, type TestDatabase } from '../support/d1-sqlite';

const ALICE = 'alice';
const BOB = 'bob';

let database: TestDatabase;
beforeEach(() => {
  database = installTestDatabase();
});
afterEach(() => {
  database.dispose();
});

const resourceDraft = (name: string, overrides: Partial<WaterResourceDraft> = {}): WaterResourceDraft => ({
  name, type: 'borehole', nominalFlowCubicMetersPerHour: 1.125, status: 'active', availableFrom: null, availableUntil: null, notes: null, ...overrides,
});
const reservoirDraft = (name: string, overrides: Partial<WaterReservoirDraft> = {}): WaterReservoirDraft => ({
  name, type: 'buffer', capacityCubicMeters: 60, currentVolumeCubicMeters: 45, minimumSafetyCubicMeters: 5,
  exposedSurfaceSquareMeters: 30, receivesRain: true, evaporationEnabled: true, evaporationCoefficient: 0.8, status: 'active', notes: null, ...overrides,
});

function auditActions(): string[] {
  return (database.sqlite.prepare("SELECT entity_type || ':' || action AS a FROM irrigation_water_infrastructure_log ORDER BY created_at, rowid").all() as { a: string }[]).map((row) => row.a);
}

test('ressources et réserves : créées, modifiées, listées par nom, noms uniques par liste et par espace, journal d’audit', async () => {
  const empty = await listWaterInfrastructureForUser(ALICE);
  assert.deepEqual(empty, { resources: [], resourceLimits: [], reservoirs: [], resourceReservoirLinks: [], reservoirLinks: [], defaultSupply: null, movements: [] });
  assert.equal(await findWorkspaceIdForUser(ALICE), null, 'lister ne crée pas d’espace');

  const forage = await saveWaterResourceForUser(ALICE, ALICE, null, resourceDraft('Forage'));
  const reseau = await saveWaterResourceForUser(ALICE, ALICE, null, resourceDraft('Réseau', { type: 'network', nominalFlowCubicMetersPerHour: 3, availableFrom: '2026-05-01', availableUntil: '2026-09-30', notes: 'compteur' }));
  await assert.rejects(saveWaterResourceForUser(ALICE, ALICE, null, resourceDraft('forage')), /déjà utilisé/);
  assert.equal(await saveWaterResourceForUser(ALICE, ALICE, forage, resourceDraft('Forage principal', { nominalFlowCubicMetersPerHour: 1.5 })), forage, 'modifier garde l’identifiant');
  await assert.rejects(saveWaterResourceForUser(ALICE, ALICE, 'inconnu', resourceDraft('X')), /Ressource introuvable/);
  await assert.rejects(saveWaterResourceForUser(ALICE, ALICE, null, resourceDraft('Négatif', { nominalFlowCubicMetersPerHour: -1 })), /CHECK constraint failed/);
  await assert.rejects(saveWaterResourceForUser(ALICE, ALICE, null, resourceDraft('Période', { availableFrom: '2026-09-30', availableUntil: '2026-05-01' })), /CHECK constraint failed/);

  const tampon = await saveWaterReservoirForUser(ALICE, ALICE, null, reservoirDraft('Tampon'), '2026-06-15T08:00:00.000Z');
  const citerne = await saveWaterReservoirForUser(ALICE, ALICE, null, reservoirDraft('Citerne', { type: 'cistern', capacityCubicMeters: 10, currentVolumeCubicMeters: null, minimumSafetyCubicMeters: 0 }), '2026-06-15T08:00:00.000Z');
  await assert.rejects(saveWaterReservoirForUser(ALICE, ALICE, null, reservoirDraft('TAMPON'), '2026-06-15T08:00:00.000Z'), /déjà utilisé/);
  assert.equal(await saveWaterReservoirForUser(ALICE, ALICE, tampon, reservoirDraft('Tampon 60', { currentVolumeCubicMeters: 12, minimumSafetyCubicMeters: 6 }), '2026-06-16T08:00:00.000Z'), tampon);
  await assert.rejects(saveWaterReservoirForUser(ALICE, ALICE, null, reservoirDraft('Trop plein', { currentVolumeCubicMeters: 100 }), '2026-06-15T08:00:00.000Z'), /CHECK constraint failed/);
  await assert.rejects(saveWaterReservoirForUser(ALICE, ALICE, null, reservoirDraft('Sécurité', { minimumSafetyCubicMeters: 70 }), '2026-06-15T08:00:00.000Z'), /CHECK constraint failed/);

  const infrastructure = await listWaterInfrastructureForUser(ALICE);
  assert.deepEqual(infrastructure.resources.map((resource) => [resource.id, resource.name, resource.type, resource.nominalFlowCubicMetersPerHour, resource.availableFrom, resource.notes]), [
    [forage, 'Forage principal', 'borehole', 1.5, null, null],
    [reseau, 'Réseau', 'network', 3, '2026-05-01', 'compteur'],
  ]);
  assert.deepEqual(infrastructure.reservoirs.map((reservoir) => [reservoir.id, reservoir.name, reservoir.capacityCubicMeters, reservoir.currentVolumeCubicMeters, reservoir.currentVolumeObservedAt, reservoir.minimumSafetyCubicMeters, reservoir.receivesRain]), [
    [citerne, 'Citerne', 10, null, null, 0, true],
    [tampon, 'Tampon 60', 60, 45, '2026-06-15T08:00:00.000Z', 6, true],
  ], 'modifier une réserve ne touche pas au volume observé : celui-ci passe par une correction');
  assert.deepEqual(auditActions(), ['resource:created', 'resource:created', 'resource:updated', 'reservoir:created', 'reservoir:created', 'reservoir:updated']);

  await saveWaterResourceForUser(BOB, BOB, null, resourceDraft('Forage principal'));
  assert.equal((await listWaterInfrastructureForUser(BOB)).resources.length, 1, 'le même nom est libre dans un autre espace');
  assert.equal((await listWaterInfrastructureForUser(ALICE)).resources.length, 2);
});

test('limite de prélèvement d’une ressource : historique du plus récent au plus ancien, bornes de la base', async () => {
  const forage = await saveWaterResourceForUser(ALICE, ALICE, null, resourceDraft('Forage'));
  await saveWaterResourceLimitForUser(ALICE, ALICE, forage, { enabled: true, maxCubicMetersPerDay: 20, validFrom: '2026-06-01', validUntil: '2026-08-31', referenceNote: 'arrêté 2026' });
  // À created_at égal, l'ordre d'insertion départage : le test dédié, plus bas,
  // le prouve (docs/revision-order-contract.md).
  await saveWaterResourceLimitForUser(ALICE, ALICE, forage, { enabled: false, maxCubicMetersPerDay: null, validFrom: '2026-09-01', validUntil: null, referenceNote: null });
  const { resourceLimits } = await listWaterInfrastructureForUser(ALICE);
  assert.deepEqual(resourceLimits.map((limit) => [limit.resourceId, limit.enabled, limit.maxCubicMetersPerDay, limit.validFrom, limit.validUntil, limit.referenceNote]), [
    [forage, false, null, '2026-09-01', null, null],
    [forage, true, 20, '2026-06-01', '2026-08-31', 'arrêté 2026'],
  ]);
  await assert.rejects(saveWaterResourceLimitForUser(ALICE, ALICE, 'inconnue', { enabled: true, maxCubicMetersPerDay: 1, validFrom: '2026-01-01', validUntil: null, referenceNote: null }), /Ressource introuvable/);
  await assert.rejects(saveWaterResourceLimitForUser(ALICE, ALICE, forage, { enabled: true, maxCubicMetersPerDay: null, validFrom: '2026-01-01', validUntil: null, referenceNote: null }), /CHECK constraint failed/);
  await assert.rejects(saveWaterResourceLimitForUser(ALICE, ALICE, forage, { enabled: true, maxCubicMetersPerDay: 5, validFrom: '2026-02-01', validUntil: '2026-01-01', referenceNote: null }), /CHECK constraint failed/);
  assert.equal((await listWaterInfrastructureForUser(ALICE)).resourceLimits.length, 2);
  await ensureWorkspaceForUser(BOB);
  await assert.rejects(saveWaterResourceLimitForUser(BOB, BOB, forage, { enabled: false, maxCubicMetersPerDay: null, validFrom: '2026-01-01', validUntil: null, referenceNote: null }), /Ressource introuvable/, 'la ressource d’un autre propriétaire est introuvable');
});

test('limite de prélèvement : deux révisions dans la même milliseconde gardent leur ordre, la plus récente d’abord', async () => {
  // L'identifiant est un UUID tiré au sort : à created_at égal, il ne classe
  // rien (point ouvert 27, docs/revision-order-contract.md). L'égalité est
  // posée ici, le test ne dépend d'aucune horloge.
  const forage = await saveWaterResourceForUser(ALICE, ALICE, null, resourceDraft('Forage'));
  const workspaceId = await findWorkspaceIdForUser(ALICE);
  const insert = database.sqlite.prepare(`INSERT INTO irrigation_water_resource_limit_revisions
    (id, workspace_id, resource_id, enabled, max_cubic_meters_per_day, valid_from, valid_until, reference_note, actor_user_id, created_at)
    VALUES (?, ?, ?, 1, ?, '2026-06-01', NULL, NULL, ?, ?)`);
  const sameMillisecond = '2026-06-01T06:00:00.500Z';
  insert.run('ffffffff-0000-4000-8000-000000000001', workspaceId, forage, 20, ALICE, sameMillisecond);
  insert.run('00000000-0000-4000-8000-000000000002', workspaceId, forage, 15, ALICE, sameMillisecond);
  const { resourceLimits } = await listWaterInfrastructureForUser(ALICE);
  assert.deepEqual(resourceLimits.map((limit) => limit.maxCubicMetersPerDay), [15, 20], 'l’ordre d’insertion départage, jamais l’identifiant');
});

test('correction du volume observé : mouvement de stock avec écart, bornes 0 et capacité, période de lecture des mouvements', async () => {
  const tampon = await saveWaterReservoirForUser(ALICE, ALICE, null, reservoirDraft('Tampon', { currentVolumeCubicMeters: 40 }), '2026-06-15T08:00:00.000Z');
  const citerne = await saveWaterReservoirForUser(ALICE, ALICE, null, reservoirDraft('Citerne', { capacityCubicMeters: 10, currentVolumeCubicMeters: null, minimumSafetyCubicMeters: 0 }), '2026-06-15T08:00:00.000Z');

  const first = await correctWaterReservoirVolumeForUser(ALICE, ALICE, tampon, 30, '2026-06-16T07:00:00.000Z', 'relevé du matin');
  const second = await correctWaterReservoirVolumeForUser(ALICE, ALICE, citerne, 8, '2026-06-17T07:00:00.000Z', null);
  await assert.rejects(correctWaterReservoirVolumeForUser(ALICE, ALICE, tampon, 61, '2026-06-18T07:00:00.000Z', null), /entre 0 et la capacité/);
  await assert.rejects(correctWaterReservoirVolumeForUser(ALICE, ALICE, tampon, -1, '2026-06-18T07:00:00.000Z', null), /entre 0 et la capacité/);
  await assert.rejects(correctWaterReservoirVolumeForUser(ALICE, ALICE, 'inconnue', 1, '2026-06-18T07:00:00.000Z', null), /Réserve introuvable/);

  const infrastructure = await listWaterInfrastructureForUser(ALICE);
  assert.deepEqual(infrastructure.reservoirs.map((reservoir) => [reservoir.name, reservoir.currentVolumeCubicMeters, reservoir.currentVolumeObservedAt]), [
    ['Citerne', 8, '2026-06-17T07:00:00.000Z'],
    ['Tampon', 30, '2026-06-16T07:00:00.000Z'],
  ]);
  assert.deepEqual(infrastructure.movements.map((movement) => [movement.id, movement.reservoirId, movement.kind, movement.volumeDeltaCubicMeters, movement.previousVolumeCubicMeters, movement.resultingVolumeCubicMeters, movement.reason]), [
    [second, citerne, 'manual_correction', 0, null, 8, null],
    [first, tampon, 'manual_correction', -10, 40, 30, 'relevé du matin'],
  ], 'du plus récent au plus ancien ; sans volume connu, l’écart vaut zéro');

  const june16 = await listWaterInfrastructureForUser(ALICE, { startAt: '2026-06-16T00:00:00.000Z', endAt: '2026-06-17T00:00:00.000Z' });
  assert.deepEqual(june16.movements.map((movement) => movement.id), [first]);
  assert.deepEqual((await listWaterInfrastructureForUser(BOB)).movements, []);
});

test('liaisons ressource → réserve et réserve → réserve : propriété vérifiée, auto-liaison et cycle refusés, alimentation par défaut', async () => {
  const forage = await saveWaterResourceForUser(ALICE, ALICE, null, resourceDraft('Forage'));
  const tampon = await saveWaterReservoirForUser(ALICE, ALICE, null, reservoirDraft('Tampon'), '2026-06-15T08:00:00.000Z');
  const citerne = await saveWaterReservoirForUser(ALICE, ALICE, null, reservoirDraft('Citerne', { capacityCubicMeters: 10, currentVolumeCubicMeters: null, minimumSafetyCubicMeters: 0 }), '2026-06-15T08:00:00.000Z');
  const bassin = await saveWaterReservoirForUser(ALICE, ALICE, null, reservoirDraft('Bassin', { type: 'pond', capacityCubicMeters: 200, currentVolumeCubicMeters: null, minimumSafetyCubicMeters: 0 }), '2026-06-15T08:00:00.000Z');
  const bobReservoir = await saveWaterReservoirForUser(BOB, BOB, null, reservoirDraft('Chez Bob'), '2026-06-15T08:00:00.000Z');

  const fill = await saveResourceReservoirLinkForUser(ALICE, ALICE, { resourceId: forage, reservoirId: tampon, fillMode: 'automatic', active: true });
  assert.equal(await saveResourceReservoirLinkForUser(ALICE, ALICE, { id: fill, resourceId: forage, reservoirId: tampon, fillMode: 'manual', active: false }), fill);
  await assert.rejects(saveResourceReservoirLinkForUser(ALICE, ALICE, { resourceId: forage, reservoirId: bobReservoir, fillMode: 'automatic', active: true }), /Réserve introuvable/);
  await assert.rejects(saveResourceReservoirLinkForUser(ALICE, ALICE, { resourceId: 'inconnue', reservoirId: tampon, fillMode: 'automatic', active: true }), /Ressource introuvable/);
  await assert.rejects(saveResourceReservoirLinkForUser(ALICE, ALICE, { id: 'inconnue', resourceId: forage, reservoirId: tampon, fillMode: 'automatic', active: true }), /Liaison introuvable/);
  await assert.rejects(saveResourceReservoirLinkForUser(ALICE, ALICE, { resourceId: forage, reservoirId: tampon, fillMode: 'automatic', active: true }), /UNIQUE constraint failed/, 'une seule liaison par couple');

  const transfer = await saveReservoirLinkForUser(ALICE, ALICE, { upstreamReservoirId: tampon, downstreamReservoirId: citerne, transferMode: 'automatic', active: true });
  await saveReservoirLinkForUser(ALICE, ALICE, { upstreamReservoirId: citerne, downstreamReservoirId: bassin, transferMode: 'manual', active: true });
  await assert.rejects(saveReservoirLinkForUser(ALICE, ALICE, { upstreamReservoirId: bassin, downstreamReservoirId: tampon, transferMode: 'automatic', active: true }), /cycle/);
  await assert.rejects(saveReservoirLinkForUser(ALICE, ALICE, { upstreamReservoirId: tampon, downstreamReservoirId: tampon, transferMode: 'automatic', active: true }), /elle-même/);
  await assert.rejects(saveReservoirLinkForUser(ALICE, ALICE, { upstreamReservoirId: tampon, downstreamReservoirId: bobReservoir, transferMode: 'automatic', active: true }), /destinataire introuvable/);
  assert.equal(await saveReservoirLinkForUser(ALICE, ALICE, { id: transfer, upstreamReservoirId: tampon, downstreamReservoirId: citerne, transferMode: 'manual', active: false }), transfer);

  await saveDefaultWaterSupplyForUser(ALICE, ALICE, { sourceKind: 'reservoir', resourceId: null, reservoirId: tampon });
  let infrastructure = await listWaterInfrastructureForUser(ALICE);
  assert.deepEqual(infrastructure.resourceReservoirLinks, [{ id: fill, resourceId: forage, reservoirId: tampon, fillMode: 'manual', active: false }]);
  // Les liaisons sont listées par date de création à la milliseconde : deux liaisons
  // créées dans la même milliseconde n'ont pas d'ordre garanti, la comparaison est donc triée.
  const byPath = (a: unknown[], b: unknown[]) => String(a).localeCompare(String(b));
  assert.deepEqual(
    infrastructure.reservoirLinks.map((link) => [link.upstreamReservoirId, link.downstreamReservoirId, link.transferMode, link.active]).sort(byPath),
    [[tampon, citerne, 'manual', false], [citerne, bassin, 'manual', true]].sort(byPath),
  );
  assert.deepEqual(infrastructure.defaultSupply, { sourceKind: 'reservoir', resourceId: null, reservoirId: tampon });

  await saveDefaultWaterSupplyForUser(ALICE, ALICE, { sourceKind: 'resource', resourceId: forage, reservoirId: null });
  assert.deepEqual((await listWaterInfrastructureForUser(ALICE)).defaultSupply, { sourceKind: 'resource', resourceId: forage, reservoirId: null }, 'une seule alimentation par défaut, remplacée');
  await assert.rejects(saveDefaultWaterSupplyForUser(ALICE, ALICE, { sourceKind: 'reservoir', resourceId: null, reservoirId: bobReservoir }), /Réserve introuvable/);
  await saveDefaultWaterSupplyForUser(ALICE, ALICE, null);
  infrastructure = await listWaterInfrastructureForUser(ALICE);
  assert.equal(infrastructure.defaultSupply, null);
  assert.deepEqual((await listWaterInfrastructureForUser(BOB)).reservoirLinks, []);
  assert.ok(auditActions().includes('supply_default:configured'));
});
