import assert from 'node:assert/strict';
import test, { afterEach, beforeEach } from 'node:test';
import { listFarmsWithSelection, readEnabledFeaturesForWorkspace, saveFeatureSelectionForUser } from '../../db/feature-selection-repository';
import { createIrrigationEventForUser } from '../../db/irrigation-event/create';
import { ensureWorkspaceForUser } from '../../db/workspace-repository';
import { FEATURES_BEFORE_SELECTION, type FeatureId } from '../../lib/domain/features/catalogue';
import { withRequirements } from '../../lib/domain/features/selection';
import { usesWeather } from '../../lib/domain/features/socle';
import { listFarmsWithFeature } from '../../lib/services/feature-selection-service';
import { cancelUpcomingIrrigationAlarmsForUser } from '../../lib/services/irrigation-push-orchestration';
import { installTestDatabase, type TestDatabase } from '../support/d1-sqlite';
import { createDripFixture, plannedDraft } from '../support/irrigation-fixtures';

/**
 * La prise en compte du choix dans les traitements (3.8,
 * docs/feature-selection-contract.md, section 7 et preuve de fin, point 3) :
 * chaque traitement d'arrière-plan ne tourne que pour les fermes qui ont coché
 * sa case ; une ferme d'avant la 3.8 a tout coché (R6). Les traitements
 * eux-mêmes sont éprouvés dans leurs propres fichiers de test (alertes,
 * planning, météo).
 */

const NOW = new Date('2026-11-07T10:00:00.000Z');
const silent = () => undefined;

let database: TestDatabase;
beforeEach(() => {
  database = installTestDatabase();
});
afterEach(() => {
  database.dispose();
});

async function farm(owner: string, enabled: FeatureId[] | null): Promise<string> {
  const workspaceId = await ensureWorkspaceForUser(owner);
  if (enabled) await saveFeatureSelectionForUser(owner, withRequirements(enabled), NOW);
  return workspaceId;
}

test('chaque traitement du matin ne tourne que pour les fermes qui ont coché sa case ; une ferme d’avant la 3.8 les reçoit tous', async () => {
  await farm('alice', null);
  const bob = await farm('bob', ['arrosages']);
  await farm('carol', ['planning']);
  await farm('dave', ['sol']);
  await farm('erin', ['alertes-meteo']);
  const owners = async (feature: FeatureId) => (await listFarmsWithFeature(feature)).map((farm) => farm.ownerUserId);
  assert.deepEqual(await owners('planning'), ['alice', 'carol'], 'le plan et la notification du matin');
  assert.deepEqual(await owners('cultures'), ['alice', 'dave'], 'l’ETM du matin : la Réserve du sol a besoin du Besoin par culture');
  assert.deepEqual(await owners('sol'), ['alice', 'dave'], 'l’état du sol du jour');
  assert.deepEqual(await owners('alertes-cultures'), ['alice'], 'l’arrêt d’arrosage avant récolte');
  assert.deepEqual(await owners('alertes-meteo'), ['alice', 'erin']);
  assert.deepEqual((await listFarmsWithSelection(usesWeather)).map((farm) => farm.ownerUserId), ['alice', 'carol', 'dave', 'erin'], 'la météo n’est plus relevée pour Bob (P4)');
  assert.deepEqual(await readEnabledFeaturesForWorkspace(bob), ['arrosages', 'materiel']);
  assert.deepEqual(await readEnabledFeaturesForWorkspace(await ensureWorkspaceForUser('alice')), [...FEATURES_BEFORE_SELECTION]);
});

test('Arrosages décochée : les alarmes encore à venir de la ferme sont retirées du Worker et marquées non programmées, celles d’une autre ferme non (P29)', async () => {
  const now = new Date();
  const start = new Date(now.getTime() + 24 * 3_600_000);
  const period = { startAt: start.toISOString(), endAt: new Date(start.getTime() + 3_600_000).toISOString(), durationSeconds: 3600 };
  const alice = await createDripFixture('alice');
  const bob = await createDripFixture('bob');
  const planned = await createIrrigationEventForUser('alice', plannedDraft(alice, period), { lateToleranceMinutes: 15 });
  const bobs = await createIrrigationEventForUser('bob', plannedDraft(bob, period), { lateToleranceMinutes: 15 });
  database.sqlite.prepare("UPDATE irrigation_event_equipment SET timer_alarm_status = 'scheduled'").run();
  const status = (id: string) => (database.sqlite.prepare('SELECT timer_alarm_status FROM irrigation_event_equipment WHERE id = ?').get(id) as { timer_alarm_status: string }).timer_alarm_status;

  const canceled: { eventEquipmentId: string; revision: string }[] = [];
  const result = await cancelUpcomingIrrigationAlarmsForUser('alice', {
    now,
    cancel: async (request) => { canceled.push(request); return { status: 'ok' }; },
    log: silent,
  });
  assert.deepEqual(result, { canceled: 1, failed: 0 });
  assert.deepEqual(canceled.map((request) => request.eventEquipmentId), [planned.eventEquipmentId]);
  assert.equal(status(planned.eventEquipmentId), 'disabled');
  assert.equal(status(bobs.eventEquipmentId), 'scheduled', 'l’alarme de Bob reste programmée');

  const later = await cancelUpcomingIrrigationAlarmsForUser('bob', {
    now: new Date(start.getTime() + 2 * 3_600_000),
    cancel: async () => assert.fail('une alarme passée ne se retire pas'),
    log: silent,
  });
  assert.deepEqual(later, { canceled: 0, failed: 0 });

  const refused = await cancelUpcomingIrrigationAlarmsForUser('bob', { now, cancel: async () => ({ status: 'failed', message: 'indisponible' }), log: silent });
  assert.deepEqual(refused, { canceled: 0, failed: 1 }, 'un retrait refusé ne marque rien');
  assert.equal(status(bobs.eventEquipmentId), 'scheduled');
});
