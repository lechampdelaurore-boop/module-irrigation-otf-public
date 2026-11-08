import assert from 'node:assert/strict';
import test, { afterEach, beforeEach, mock } from 'node:test';
import {
  ResourceMeterReadingError,
  ResourceNotFoundError,
  applyResourceFlowForUser,
  deleteResourceMeterReadingForUser,
  listResourceFlowRevisionsForUser,
  listResourceMeterReadingsForUser,
  saveResourceMeterReadingForUser,
} from '../../db/water-resource-flow-repository';
import { listWaterInfrastructureForUser, saveWaterResourceForUser } from '../../db/water-resource-repository';
import type { WaterResourceDraft } from '../../lib/domain/water-resources';
import { installTestDatabase, type TestDatabase } from '../support/d1-sqlite';

const ALICE = 'alice';
const BOB = 'bob';
const HEURE = 60 * 60;

let database: TestDatabase;
beforeEach(() => {
  database = installTestDatabase();
  // L'horloge est figée après le mardi de l'exemple : les relevés ne sont donc
  // pas dans le futur, ce que le domaine refuserait.
  mock.timers.enable({ apis: ['Date'], now: new Date('2026-09-23T06:00:00.000Z') });
});
afterEach(() => {
  mock.timers.reset();
  database.dispose();
});

const forage = (overrides: Partial<WaterResourceDraft> = {}): WaterResourceDraft => ({
  name: 'Forage', type: 'borehole', nominalFlowCubicMetersPerHour: 2, status: 'active',
  availableFrom: null, availableUntil: null, notes: null, ...overrides,
});

async function createForage(owner = ALICE, overrides: Partial<WaterResourceDraft> = {}) {
  return saveWaterResourceForUser(owner, owner, null, forage(overrides));
}

const lundi = { takenAt: '2026-09-21T06:00:00.000Z', meterIndexCubicMeters: 1_240, stoppedSeconds: 0, meterReplaced: false, note: null };
const mardi = { takenAt: '2026-09-22T06:00:00.000Z', meterIndexCubicMeters: 1_249, stoppedSeconds: 16 * HEURE, meterReplaced: false, note: null };

test('les relevés d’un propriétaire restent invisibles aux autres', async () => {
  const chezAlice = await createForage(ALICE);
  const chezBob = await createForage(BOB);
  await saveResourceMeterReadingForUser(ALICE, ALICE, chezAlice, lundi);
  await saveResourceMeterReadingForUser(BOB, BOB, chezBob, lundi);

  const relevesAlice = await listResourceMeterReadingsForUser(ALICE);
  assert.equal(relevesAlice.length, 1);
  assert.equal(relevesAlice[0].resourceId, chezAlice);

  // Et une ressource d'un autre propriétaire est introuvable, pas seulement vide.
  await assert.rejects(
    () => saveResourceMeterReadingForUser(ALICE, ALICE, chezBob, mardi),
    ResourceNotFoundError,
  );
});

test('un relevé est relu tel qu’il a été écrit', async () => {
  const resourceId = await createForage();
  const id = await saveResourceMeterReadingForUser(ALICE, ALICE, resourceId, { ...mardi, note: 'après la pluie' });

  const [releve] = await listResourceMeterReadingsForUser(ALICE, resourceId);
  assert.equal(releve.id, id);
  assert.equal(releve.meterIndexCubicMeters, 1_249);
  assert.equal(releve.stoppedSeconds, 16 * HEURE);
  assert.equal(releve.meterReplaced, false);
  assert.equal(releve.note, 'après la pluie');
});

test('un index qui recule est refusé, et accepté quand le compteur est déclaré remplacé', async () => {
  const resourceId = await createForage();
  await saveResourceMeterReadingForUser(ALICE, ALICE, resourceId, mardi);

  const recule = { takenAt: '2026-09-23T06:00:00.000Z', meterIndexCubicMeters: 12, stoppedSeconds: 0, meterReplaced: false, note: null };
  await assert.rejects(
    () => saveResourceMeterReadingForUser(ALICE, ALICE, resourceId, recule),
    (error: unknown) => error instanceof ResourceMeterReadingError && error.rejection === 'index_went_backwards',
  );

  const id = await saveResourceMeterReadingForUser(ALICE, ALICE, resourceId, { ...recule, meterReplaced: true });
  const releves = await listResourceMeterReadingsForUser(ALICE, resourceId);
  const neuf = releves.find((item) => item.id === id);
  assert.equal(neuf?.meterReplaced, true);
  // La durée d'arrêt n'a pas de sens sur un compteur neuf : elle n'est pas rangée.
  assert.equal(neuf?.stoppedSeconds, null);
});

test('deux relevés au même instant sont refusés', async () => {
  const resourceId = await createForage();
  await saveResourceMeterReadingForUser(ALICE, ALICE, resourceId, lundi);

  await assert.rejects(
    () => saveResourceMeterReadingForUser(ALICE, ALICE, resourceId, { ...lundi, meterIndexCubicMeters: 1_241 }),
    (error: unknown) => error instanceof ResourceMeterReadingError && error.rejection === 'duplicate_instant',
  );
});

test('un relevé rattrapé est vérifié contre le relevé suivant, pas seulement le précédent', async () => {
  const resourceId = await createForage();
  await saveResourceMeterReadingForUser(ALICE, ALICE, resourceId, lundi);
  await saveResourceMeterReadingForUser(ALICE, ALICE, resourceId, mardi);

  // Intercalé six heures après le lundi : il reste dix-huit heures avant le
  // mardi, ses seize heures d'arrêt y tiennent encore.
  const possible = { takenAt: '2026-09-21T12:00:00.000Z', meterIndexCubicMeters: 1_245, stoppedSeconds: 2 * HEURE, meterReplaced: false, note: null };
  await saveResourceMeterReadingForUser(ALICE, ALICE, resourceId, possible);

  // Intercalé six heures avant le mardi : les seize heures n'y tiennent plus.
  await assert.rejects(
    () => saveResourceMeterReadingForUser(ALICE, ALICE, resourceId, { ...possible, takenAt: '2026-09-22T00:00:00.000Z', meterIndexCubicMeters: 1_247 }),
    (error: unknown) => error instanceof ResourceMeterReadingError && error.rejection === 'stopped_exceeds_elapsed',
  );
});

test('un relevé se corrige sans se heurter à lui-même', async () => {
  const resourceId = await createForage();
  await saveResourceMeterReadingForUser(ALICE, ALICE, resourceId, lundi);
  const id = await saveResourceMeterReadingForUser(ALICE, ALICE, resourceId, mardi);

  await saveResourceMeterReadingForUser(ALICE, ALICE, resourceId, { ...mardi, meterIndexCubicMeters: 1_252 }, id);

  const releves = await listResourceMeterReadingsForUser(ALICE, resourceId);
  assert.equal(releves.length, 2, 'la correction ne crée pas un second relevé');
  assert.equal(releves[1].meterIndexCubicMeters, 1_252);
});

test('un relevé se supprime', async () => {
  const resourceId = await createForage();
  const id = await saveResourceMeterReadingForUser(ALICE, ALICE, resourceId, lundi);

  await deleteResourceMeterReadingForUser(ALICE, id);
  assert.deepEqual(await listResourceMeterReadingsForUser(ALICE, resourceId), []);
});

test('appliquer un débit remplace la référence de la ressource et historise la décision', async () => {
  const resourceId = await createForage();
  const depart = await saveResourceMeterReadingForUser(ALICE, ALICE, resourceId, lundi);
  const arrivee = await saveResourceMeterReadingForUser(ALICE, ALICE, resourceId, mardi);

  await applyResourceFlowForUser(ALICE, ALICE, {
    resourceId, flowCubicMetersPerHour: 1.125, fromReadingId: depart, toReadingId: arrivee, referenceNote: 'premier relevé',
  });

  const { resources } = await listWaterInfrastructureForUser(ALICE);
  assert.equal(resources[0].nominalFlowCubicMetersPerHour, 1.125, 'le débit de la ressource est remplacé');

  const [revision] = await listResourceFlowRevisionsForUser(ALICE, resourceId);
  assert.equal(revision.flowCubicMetersPerHour, 1.125);
  assert.equal(revision.fromReadingId, depart);
  assert.equal(revision.toReadingId, arrivee);
  assert.equal(revision.validUntil, null, 'la révision en vigueur reste ouverte');
});

test('une seconde application ferme la précédente sans l’effacer', async () => {
  const resourceId = await createForage();
  await applyResourceFlowForUser(ALICE, ALICE, { resourceId, flowCubicMetersPerHour: 1.125, fromReadingId: null, toReadingId: null, referenceNote: null });
  mock.timers.tick(1_000);
  await applyResourceFlowForUser(ALICE, ALICE, { resourceId, flowCubicMetersPerHour: 0.82, fromReadingId: null, toReadingId: null, referenceNote: 'étiage' });

  const revisions = await listResourceFlowRevisionsForUser(ALICE, resourceId);
  assert.equal(revisions.length, 2, 'l’ancienne décision reste consultable');
  assert.equal(revisions[0].flowCubicMetersPerHour, 1.125);
  assert.equal(revisions[0].validUntil, revisions[1].validFrom, 'l’ancienne se ferme quand la nouvelle commence');
  assert.equal(revisions[1].validUntil, null);

  const { resources } = await listWaterInfrastructureForUser(ALICE);
  assert.equal(resources[0].nominalFlowCubicMetersPerHour, 0.82);
});

test('corriger un relevé ne réécrit pas la décision de débit déjà prise', async () => {
  const resourceId = await createForage();
  const depart = await saveResourceMeterReadingForUser(ALICE, ALICE, resourceId, lundi);
  const arrivee = await saveResourceMeterReadingForUser(ALICE, ALICE, resourceId, mardi);
  await applyResourceFlowForUser(ALICE, ALICE, { resourceId, flowCubicMetersPerHour: 1.125, fromReadingId: depart, toReadingId: arrivee, referenceNote: null });

  await saveResourceMeterReadingForUser(ALICE, ALICE, resourceId, { ...mardi, meterIndexCubicMeters: 1_252 }, arrivee);

  const [revision] = await listResourceFlowRevisionsForUser(ALICE, resourceId);
  assert.equal(revision.flowCubicMetersPerHour, 1.125, 'la décision passée ne bouge pas');
  const { resources } = await listWaterInfrastructureForUser(ALICE);
  assert.equal(resources[0].nominalFlowCubicMetersPerHour, 1.125);
});

test('appliquer un débit sur la ressource d’un autre propriétaire est refusé', async () => {
  const chezBob = await createForage(BOB);

  await assert.rejects(
    () => applyResourceFlowForUser(ALICE, ALICE, { resourceId: chezBob, flowCubicMetersPerHour: 1, fromReadingId: null, toReadingId: null, referenceNote: null }),
    ResourceNotFoundError,
  );
  assert.deepEqual(await listResourceFlowRevisionsForUser(BOB, chezBob), []);
});

test('un débit négatif ou absurde est refusé', async () => {
  const resourceId = await createForage();

  await assert.rejects(
    () => applyResourceFlowForUser(ALICE, ALICE, { resourceId, flowCubicMetersPerHour: -1, fromReadingId: null, toReadingId: null, referenceNote: null }),
    /Débit mesuré invalide/,
  );
  await assert.rejects(
    () => applyResourceFlowForUser(ALICE, ALICE, { resourceId, flowCubicMetersPerHour: Number.NaN, fromReadingId: null, toReadingId: null, referenceNote: null }),
    /Débit mesuré invalide/,
  );
});

test('sans espace de travail, la lecture ne rend rien plutôt que d’échouer', async () => {
  assert.deepEqual(await listResourceMeterReadingsForUser('inconnu'), []);
  assert.deepEqual(await listResourceFlowRevisionsForUser('inconnu'), []);
});
