import assert from 'node:assert/strict';
import test, { afterEach, beforeEach } from 'node:test';
import { saveFarmReferenceCropForUser } from '../../db/crop-water/references';
import { createIrrigationEventForUser } from '../../db/irrigation-event/create';
import { saveWaterResourceForUser } from '../../db/water-resource-repository';
import { ensureWorkspaceForUser, findWorkspaceIdForUser } from '../../db/workspace-repository';
import { createMigratedSqliteDatabase, installTestDatabase, type TestDatabase } from '../support/d1-sqlite';
import { TOMATO } from '../support/crop-water-references';
import { completedDraft, createDripFixture } from '../support/irrigation-fixtures';
import { crossSpaceReferences, UnclassifiedSchemaError } from '../support/space-coherence';
import { ALICE, BOB } from '../support/spaces';

/**
 * Le contrôle de cohérence des espaces (docs/tranche-4-contract.md, F380 ;
 * constat C1 de la revue de l'isolation du 18 novembre 2026) trouve bien ce
 * qu'il doit trouver : sans ces tests, un contrôle muet passerait pour un
 * contrôle satisfait. Il tourne aussi après chaque test de `tests/db/`
 * (`installTestDatabase`, `dispose`).
 */

let database: TestDatabase;

beforeEach(() => {
  database = installTestDatabase();
});

afterEach(() => {
  database.dispose();
});

const period = { startAt: '2026-06-15T06:00:00.000Z', endAt: '2026-06-15T07:00:00.000Z', durationSeconds: 3_600 };

async function eventOf(ownerUserId: string) {
  const fixture = await createDripFixture(ownerUserId);
  const { eventId } = await createIrrigationEventForUser(ownerUserId, completedDraft(fixture, period));
  return { fixture, eventId };
}

test('une base écrite par le module, pour deux espaces, est cohérente', async () => {
  await eventOf(ALICE);
  await eventOf(BOB);
  assert.deepEqual(crossSpaceReferences(database.sqlite), []);
});

test('une irrigation de Bob qui désigne le matériel, le réglage et la pose d’Alice est relevée, ligne par ligne', async () => {
  const alice = await eventOf(ALICE);
  const bob = await eventOf(BOB);
  const corrupt = database.sqlite.prepare(`UPDATE irrigation_event_equipment
    SET equipment_id = ?, setting_id = ?, placement_id = ? WHERE event_id = ?`);
  corrupt.run(alice.fixture.equipment.id, alice.fixture.setting.id, alice.fixture.placement.id, bob.eventId);

  const found = crossSpaceReferences(database.sqlite);
  assert.deepEqual(
    found.map((line) => line.split(' : ')[0]).sort(),
    [
      'irrigation_event_equipment.equipment_id → irrigation_equipment',
      'irrigation_event_equipment.placement_id → irrigation_equipment_placements',
      'irrigation_event_equipment.setting_id → irrigation_equipment_settings',
    ],
  );
  const aliceSpace = await findWorkspaceIdForUser(ALICE);
  const bobSpace = await findWorkspaceIdForUser(BOB);
  assert.ok(found.every((line) => line.includes(`l’espace ${bobSpace} désigne une ligne de l’espace ${aliceSpace}`)), found.join('\n'));

  corrupt.run(bob.fixture.equipment.id, bob.fixture.setting.id, bob.fixture.placement.id, bob.eventId);
  assert.deepEqual(crossSpaceReferences(database.sqlite), []);
});

test('le journal des ouvrages d’eau qui nomme la ressource d’un autre espace est relevé', async () => {
  await saveWaterResourceForUser(ALICE, ALICE, null, {
    name: 'Forage',
    type: 'borehole',
    nominalFlowCubicMetersPerHour: 0.511,
    status: 'active',
    availableFrom: null,
    availableUntil: null,
    notes: null,
  });
  const bobSpace = await ensureWorkspaceForUser(BOB);
  const move = database.sqlite.prepare(`UPDATE irrigation_water_infrastructure_log SET workspace_id = ? WHERE entity_type = 'resource'`);
  move.run(bobSpace);
  assert.match(crossSpaceReferences(database.sqlite).join('\n'), /^irrigation_water_infrastructure_log\.entity_id → irrigation_water_resources : /);

  move.run(await findWorkspaceIdForUser(ALICE));
  assert.deepEqual(crossSpaceReferences(database.sqlite), []);
});

test('une correspondance de Bob vers la culture saisie par la ferme d’Alice est relevée ; vers une culture commune, non', async () => {
  const aliceCrop = { ...TOMATO, id: 'tomate-de-la-ferme-d-alice', name: 'Tomate de la ferme d’Alice', source: 'local' as const };
  assert.equal((await saveFarmReferenceCropForUser(ALICE, aliceCrop, { sourceUrl: null, datesSource: 'Ferme' })).ok, true);
  const bobSpace = await ensureWorkspaceForUser(BOB);
  const link = database.sqlite.prepare(`INSERT INTO irrigation_crop_species_links
    (id, workspace_id, plant_id, series_id, target_kind, crop_key, analogy, actor_user_id, updated_at)
    VALUES (?, ?, ?, NULL, 'reference', ?, 0, 'bob', '2026-06-15T06:00:00.000Z')`);
  link.run('lien-commun', bobSpace, 'plant-tomate', TOMATO.id);
  assert.deepEqual(crossSpaceReferences(database.sqlite), [], 'la culture commune est à tous');

  link.run('lien-alice', bobSpace, 'plant-tomate-cerise', aliceCrop.id);
  assert.match(
    crossSpaceReferences(database.sqlite).join('\n'),
    /^irrigation_crop_species_links\.crop_key → irrigation_crop_reference_crops : .*« tomate-de-la-ferme-d-alice », une culture propre à un autre espace$/,
  );
  database.sqlite.prepare(`DELETE FROM irrigation_crop_species_links WHERE id = 'lien-alice'`).run();
  assert.deepEqual(crossSpaceReferences(database.sqlite), []);
});

test('une table ou une colonne nouvelle, non rangée, arrête le contrôle au lieu de lui échapper', () => {
  const withColumn = createMigratedSqliteDatabase();
  withColumn.exec('ALTER TABLE irrigation_pumps ADD COLUMN backup_pump_id text');
  assert.throws(() => crossSpaceReferences(withColumn), (error: unknown) =>
    error instanceof UnclassifiedSchemaError && error.message.includes('colonne irrigation_pumps.backup_pump_id'));
  withColumn.close();

  const withTable = createMigratedSqliteDatabase();
  withTable.exec('CREATE TABLE irrigation_notes (id text PRIMARY KEY NOT NULL, body text NOT NULL)');
  assert.throws(() => crossSpaceReferences(withTable), (error: unknown) =>
    error instanceof UnclassifiedSchemaError && error.message.includes('table irrigation_notes'));
  withTable.close();
});
