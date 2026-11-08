import assert from 'node:assert/strict';
import test, { afterEach, beforeEach } from 'node:test';
import {
  dismissFeatureBannerForUser,
  InvalidFeatureSelectionError,
  readFeatureSelectionForUser,
  saveFeatureSelectionForUser,
} from '../../db/feature-selection-repository';
import { ensureWorkspaceForUser, findWorkspaceIdForUser } from '../../db/workspace-repository';
import { FEATURE_IDS, FEATURES_BEFORE_SELECTION } from '../../lib/domain/features/catalogue';
import { resolveFeatureSelection } from '../../lib/domain/features/selection';
import { getEnabledFeaturesForUser, getFeatureSelectionForUser } from '../../lib/services/feature-selection-service';
import { installTestDatabase, type TestDatabase } from '../support/d1-sqlite';

// docs/feature-selection-contract.md, section 9, point 2 (3.8, D-067).

let database: TestDatabase;
beforeEach(() => {
  database = installTestDatabase();
});
afterEach(() => {
  database.dispose();
});

const NOW = new Date('2026-11-07T13:30:00.000Z');
const LATER = new Date('2026-11-08T07:00:00.000Z');

test('une ferme qui n’a jamais ouvert le module : première ouverture, sans que la lecture crée son espace (R5)', async () => {
  assert.deepEqual(await readFeatureSelectionForUser('alice'), { kind: 'first-visit' });
  assert.equal(await findWorkspaceIdForUser('alice'), null, 'lire le choix ne crée rien');
  assert.deepEqual(await getEnabledFeaturesForUser('alice'), [], 'aucun traitement ne tourne pour elle');
});

test('une ferme d’avant la 3.8 : un espace sans choix, tout coché et le bandeau (R6)', async () => {
  await ensureWorkspaceForUser('alice');
  assert.deepEqual(await readFeatureSelectionForUser('alice'), { kind: 'before-selection' });
  const resolved = await getFeatureSelectionForUser('alice');
  assert.deepEqual(resolved.enabled, [...FEATURES_BEFORE_SELECTION], 'les dix cases d’avant le calculateur (3.8 bis)');
  assert.deepEqual(resolved.banner, { kind: 'introduction' });
});

test('le choix s’enregistre pour la ferme, dans l’ordre de la liste, avec sa date ; la première ouverture crée l’espace', async () => {
  await saveFeatureSelectionForUser('alice', ['alertes-meteo', 'arrosages', 'materiel'], NOW);
  assert.notEqual(await findWorkspaceIdForUser('alice'), null);
  assert.deepEqual(await readFeatureSelectionForUser('alice'), {
    kind: 'stored',
    enabled: ['arrosages', 'materiel', 'alertes-meteo'],
    known: [...FEATURE_IDS],
    chosenAt: NOW.toISOString(),
    bannerDismissedAt: null,
  });
  assert.deepEqual(await getEnabledFeaturesForUser('alice'), ['arrosages', 'materiel', 'alertes-meteo']);

  await saveFeatureSelectionForUser('alice', ['alertes-cultures'], LATER);
  const stored = await readFeatureSelectionForUser('alice');
  assert.equal(stored.kind, 'stored');
  assert.deepEqual(stored.kind === 'stored' ? [stored.enabled, stored.chosenAt] : null, [['alertes-cultures'], LATER.toISOString()], 'la date du dernier choix seulement (P9)');
  const rows = database.sqlite.prepare('SELECT COUNT(*) AS n FROM irrigation_feature_selections').get() as { n: number };
  assert.equal(rows.n, 1, 'une ligne par ferme, sans historique des choix');
});

test('un choix vide, incomplet ou inconnu est refusé et rien n’est écrit (R3, P7)', async () => {
  for (const invalid of [[], ['planning'], ['materiel', 'inconnue'], ['calculateur']] as never[][]) {
    await assert.rejects(saveFeatureSelectionForUser('alice', invalid, NOW), InvalidFeatureSelectionError);
  }
  assert.equal(await findWorkspaceIdForUser('alice'), null, 'un refus ne crée pas l’espace');
});

test('fermer le bandeau d’une ferme d’avant la 3.8 garde tout coché, sans date de choix ; il ne revient pas', async () => {
  await ensureWorkspaceForUser('alice');
  await dismissFeatureBannerForUser('alice', NOW);
  const stored = await readFeatureSelectionForUser('alice');
  assert.deepEqual(stored, {
    kind: 'stored',
    enabled: [...FEATURES_BEFORE_SELECTION],
    known: [...FEATURE_IDS],
    chosenAt: null,
    bannerDismissedAt: NOW.toISOString(),
  });
  const resolved = resolveFeatureSelection(stored);
  assert.deepEqual([resolved.enabled, resolved.banner], [[...FEATURES_BEFORE_SELECTION], null]);
});

test('fermer le bandeau après un choix ne coche ni ne décoche rien', async () => {
  await saveFeatureSelectionForUser('alice', ['alertes-meteo'], NOW);
  await dismissFeatureBannerForUser('alice', LATER);
  const stored = await readFeatureSelectionForUser('alice');
  assert.deepEqual(stored.kind === 'stored' ? [stored.enabled, stored.chosenAt, stored.bannerDismissedAt] : null, [
    ['alertes-meteo'],
    NOW.toISOString(),
    LATER.toISOString(),
  ]);
});

test('le choix d’une ferme ne touche pas celui d’une autre (R4)', async () => {
  await ensureWorkspaceForUser('bob');
  await saveFeatureSelectionForUser('alice', ['alertes-cultures'], NOW);
  assert.deepEqual(await readFeatureSelectionForUser('bob'), { kind: 'before-selection' });
  assert.deepEqual(await getEnabledFeaturesForUser('bob'), [...FEATURES_BEFORE_SELECTION]);
  assert.deepEqual(await getEnabledFeaturesForUser('alice'), ['alertes-cultures']);
});

test('une liste illisible en base se lit vide et ne fait rien disparaître ; la base refuse ce qui n’est pas un tableau', async () => {
  const workspaceId = await ensureWorkspaceForUser('alice');
  assert.throws(
    () => database.sqlite.prepare("INSERT INTO irrigation_feature_selections (workspace_id, enabled_features, known_features, updated_at) VALUES (?, '{}', '[]', 'x')").run(workspaceId),
    /CHECK constraint failed/,
  );
  database.sqlite.prepare("INSERT INTO irrigation_feature_selections (workspace_id, enabled_features, known_features, updated_at) VALUES (?, '[\"inconnue\"]', '[]', 'x')").run(workspaceId);
  const resolved = await getFeatureSelectionForUser('alice');
  assert.deepEqual(resolved.enabled, [...FEATURES_BEFORE_SELECTION]);
});
