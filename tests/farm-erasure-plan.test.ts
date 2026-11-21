import assert from 'node:assert/strict';
import test from 'node:test';
import { FARM_TABLES, KEPT_TABLES, SPACE_ROOT_TABLE, SPACE_TABLES, spaceRowsCondition } from '../db/farm-erasure-plan.ts';
import { createMigratedSqliteDatabase } from './support/d1-sqlite.ts';
import { dataTables, spaceTables } from './support/synthetic-space-rows.ts';

/**
 * La preuve 1 de l'effacement d'une ferme (4.5, PR 3 ;
 * docs/tranche-4-contract.md, F563, et 10 bis.17, F641 et F642) : le plan
 * couvre chaque table de la base migrée, une fois et une seule. Une table qui
 * porte une clé d'espace (la liste du contrôle de cohérence, F380) est
 * effacée, ou rangée parmi celles qui restent avec sa raison ; une table
 * ajoutée plus tard sans règle d'effacement fait échouer ce test, donc la CI.
 */

const database = createMigratedSqliteDatabase();
const planned = [
  ...SPACE_TABLES.map(({ table }) => table),
  SPACE_ROOT_TABLE,
  ...Object.keys(FARM_TABLES),
  ...Object.keys(KEPT_TABLES),
];

test('chaque table de la base est dans le plan d’effacement, une fois et une seule', () => {
  const twice = planned.filter((table, index) => planned.indexOf(table) !== index);
  assert.deepEqual(twice, [], 'une table rangée deux fois');
  assert.deepEqual(
    dataTables(database).filter((table) => !planned.includes(table)),
    [],
    'à ranger dans db/farm-erasure-plan.ts : effacée avec l’espace (SPACE_TABLES), gardée par une table commune (FARM_TABLES) ou gardée avec sa raison (KEPT_TABLES)',
  );
  assert.deepEqual(planned.filter((table) => !dataTables(database).includes(table)), [], 'une table du plan qui n’existe plus');
});

test('chaque table qui porte une clé d’espace est effacée avec l’espace, sauf la note de la demande', () => {
  const erased = new Set([...SPACE_TABLES.map(({ table }) => table), SPACE_ROOT_TABLE]);
  assert.deepEqual(
    spaceTables(database).filter((table) => !erased.has(table)),
    ['irrigation_farm_erasures'],
    'seule la note de la demande reste : la preuve qu’elle a été traitée',
  );
  for (const table of [...Object.keys(FARM_TABLES), ...Object.keys(KEPT_TABLES)].filter((name) => name !== 'irrigation_farm_erasures')) {
    assert.ok(!spaceTables(database).includes(table), `${table} : une table commune, d’aucun espace`);
  }
  for (const [table, reason] of Object.entries(KEPT_TABLES)) assert.ok(reason.trim().length > 40, `${table} : gardée avec sa raison`);
});

/**
 * La colonne désigne une ligne de `parent` par son identifiant : directement,
 * ou par la même colonne d'une table qui la désigne elle-même (les débuts de
 * stade désignent le stade, qui désigne la culture).
 */
function designates(table: string, column: string, parent: string): boolean {
  const keys = database.prepare(`PRAGMA foreign_key_list("${table}")`).all() as { table: string; from: string; to: string }[];
  return keys.some((key) => key.from === column && (
    (key.table === parent && key.to === 'id')
    || SPACE_TABLES.some((step) => step.table === key.table && step.via?.column === key.to && step.via.parent === parent && designates(key.table, key.to, parent))
  ));
}

test('une table sans workspace_id passe par la ligne qu’elle complète, une table qui en a un s’efface par lui', () => {
  const columnsOf = (table: string) => (database.prepare(`PRAGMA table_info("${table}")`).all() as { name: string }[]).map(({ name }) => name);
  for (const { table, via } of SPACE_TABLES) {
    if (via) {
      assert.ok(!columnsOf(table).includes('workspace_id'), `${table} : a son propre workspace_id`);
      assert.ok(columnsOf(table).includes(via.column), `${table}.${via.column}`);
      assert.ok(designates(table, via.column, via.parent), `${table}.${via.column} → ${via.parent}.id`);
    } else {
      assert.ok(columnsOf(table).includes('workspace_id'), `${table} : sans workspace_id`);
    }
    assert.equal(spaceRowsCondition(table).split('?').length - 1, 1, `${table} : un seul paramètre, l’espace`);
  }
  for (const [table, { column }] of Object.entries(FARM_TABLES)) assert.ok(columnsOf(table).includes(column), `${table}.${column}`);
});

test('les tables filles s’effacent avant leurs mères, et l’espace en dernier', () => {
  const order = SPACE_TABLES.map(({ table }) => table);
  const misplaced: string[] = [];
  for (const [index, table] of order.entries()) {
    const parents = (database.prepare(`PRAGMA foreign_key_list("${table}")`).all() as { table: string }[]).map((key) => key.table);
    for (const parent of parents) {
      if (parent === table || parent === SPACE_ROOT_TABLE) continue;
      const parentIndex = order.indexOf(parent);
      if (parentIndex >= 0 && parentIndex < index) misplaced.push(`${table} après sa mère ${parent}`);
    }
  }
  assert.deepEqual(misplaced, []);
  assert.throws(() => spaceRowsCondition('irrigation_farm_erasures'), /absente du plan/);
});
