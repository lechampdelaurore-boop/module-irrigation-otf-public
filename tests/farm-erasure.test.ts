import assert from 'node:assert/strict';
import test from 'node:test';
import { FARM_ERASURE_BATCH_ROWS, FARM_ERASURE_DELAY_DAYS, FARM_ERASURE_RUN_BUDGET, farmErasureDueAt, farmErasureLine } from '../lib/domain/operations/farm-erasure.ts';
import { taskDeclaration, tasksOfTrigger } from '../lib/domain/operations/task-registry.ts';
import { legacySnapshotKey, seasonSnapshotKey, seasonSnapshotPrefix } from '../lib/domain/otf/snapshot-keys.ts';

/**
 * L'effacement d'une ferme, sans la base (4.5, PR 3 ; docs/tranche-4-contract.md,
 * F563, et 10 bis.17, F640 à F648) : le délai, les bornes d'un passage, la
 * tâche du matin et la ligne de la page d'état. Les preuves sur la base sont
 * dans `tests/db/farm-erasure.test.ts` et `tests/farm-erasure-plan.test.ts`.
 */

test('sept jours entre la demande et l’effacement, à l’heure près', () => {
  assert.equal(FARM_ERASURE_DELAY_DAYS, 7);
  assert.equal(farmErasureDueAt(new Date('2026-11-20T10:00:00.000Z')).toISOString(), '2026-11-27T10:00:00.000Z');
  assert.equal(farmErasureDueAt(new Date('2027-03-25T10:00:00.000Z')).toISOString(), '2027-04-01T10:00:00.000Z', 'le changement d’heure ne décale rien : sept fois 24 heures');
});

test('un passage reste loin des bornes de D1 : lots de 200 lignes, 300 requêtes, 20 secondes', () => {
  assert.equal(FARM_ERASURE_BATCH_ROWS, 200);
  assert.deepEqual(FARM_ERASURE_RUN_BUDGET, { statements: 300, milliseconds: 20_000 });
  assert.ok(FARM_ERASURE_RUN_BUDGET.statements < 1000, 'les 1 000 requêtes d’une exécution, avec le reste du matin');
  assert.ok(FARM_ERASURE_RUN_BUDGET.milliseconds < 30_000, 'les 30 secondes d’une requête à D1');
});

test('la tâche du matin : la dernière du déclencheur, aux seuils du matin', () => {
  assert.equal(tasksOfTrigger('weather-morning').at(-1), 'farm-erasure');
  const task = taskDeclaration('farm-erasure');
  assert.equal(task.label, 'Effacement des fermes qui l\'ont demandé');
  assert.equal(task.lateAfterHours, 26);
  assert.equal(task.brokenAfterHours, 36);
  assert.match(task.ifMissing, /7 jours/);
  assert.match(task.successKeptIn, /task:farm-erasure/);
});

test('la ligne de la page d’état : jamais un zéro qui cache un manque', () => {
  assert.deepEqual(farmErasureLine({ waiting: 0, due: 0, erased: 0, lastErasedAt: null }), { tone: 'ok', text: 'Aucune demande d’effacement.' });
  assert.deepEqual(farmErasureLine({ waiting: 1, due: 0, erased: 0, lastErasedAt: null }), { tone: 'ok', text: 'Demandes d’effacement : 1 en attente, aucune faite.' });
  assert.deepEqual(farmErasureLine({ waiting: 0, due: 1, erased: 1, lastErasedAt: '2026-11-28T05:16:00.000Z' }), {
    tone: 'warn',
    text: 'Demandes d’effacement : 0 en attente, 1 à effacer, 1 faite ; dernière faite le 28/11 à 6 h 16.',
  });
  assert.deepEqual(farmErasureLine({ waiting: 0, due: 0, erased: 3, lastErasedAt: '2026-07-01T04:16:00.000Z' }).text, 'Demandes d’effacement : 0 en attente, 3 faites ; dernière faite le 01/07 à 6 h 16.');
});

test('les clés des instantanés d’un espace : une par saison sous un début commun, et celle d’avant le plan de culture', () => {
  const space = 'personne·ferme·4394';
  assert.equal(seasonSnapshotKey(space, 2026), '["v6-plan-de-culture","personne·ferme·4394",2026]');
  assert.ok(seasonSnapshotKey(space, 2026).startsWith(seasonSnapshotPrefix(space)));
  assert.ok(!seasonSnapshotKey(`${space}0`, 2026).startsWith(seasonSnapshotPrefix(space)), 'la ferme 43940 n’est pas la ferme 4394');
  assert.ok(!seasonSnapshotKey(space, 2026).startsWith(seasonSnapshotPrefix('personne')), 'la personne seule n’est pas son espace de ferme');
  assert.equal(legacySnapshotKey(space), 'v3-zone-fill-area:personne·ferme·4394');
});
