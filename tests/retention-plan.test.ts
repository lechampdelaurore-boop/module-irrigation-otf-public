import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { RETENTION_PLAN, RETENTION_PURGES, SPACE_RETENTION, SPACE_RETENTION_TABLES } from '../db/retention-plan.ts';
import {
  OPERATOR_NOTICES_KEPT_DAYS,
  RETENTION_LIMITS,
  RETENTION_PURGE_BATCH_ROWS,
  RETENTION_PURGE_RUN_STATEMENTS,
  RETENTION_WORDS,
} from '../lib/domain/operations/retention.ts';
import { taskDeclaration, tasksOfTrigger } from '../lib/domain/operations/task-registry.ts';
import { createMigratedSqliteDatabase } from './support/d1-sqlite.ts';
import { dataTables } from './support/synthetic-space-rows.ts';

/**
 * La conservation, table par table (4.5, PR 5 ; docs/tranche-4-contract.md,
 * F562, et 10 bis.18, F649 à F653) : chaque table de la base migrée a une
 * durée et qui l'efface, une fois et une seule ; une table ajoutée plus tard
 * sans durée fait échouer ce test, donc la CI. Les purges elles-mêmes, sur
 * la base, sont dans `tests/db/retention-purge.test.ts`.
 */

const database = createMigratedSqliteDatabase();
const NOW_MS = Date.parse('2026-11-28T05:16:00.000Z');

test('chaque table de la base a sa durée et qui l’efface, une fois et une seule', () => {
  const ruled = [...SPACE_RETENTION_TABLES, ...Object.keys(RETENTION_PLAN)];
  assert.deepEqual(ruled.filter((table, index) => ruled.indexOf(table) !== index), [], 'une table avec deux règles');
  assert.deepEqual(
    dataTables(database).filter((table) => !ruled.includes(table)),
    [],
    'à ranger dans db/retention-plan.ts : une table d’espace par le plan d’effacement, toute autre avec sa durée et qui l’efface',
  );
  assert.deepEqual(ruled.filter((table) => !dataTables(database).includes(table)), [], 'une table du plan qui n’existe plus');
  for (const [table, rule] of [...Object.entries(RETENTION_PLAN), ['tables d’espace', SPACE_RETENTION] as const]) {
    assert.ok(rule.kept.trim().length >= 7 && rule.erasedBy.trim().length >= 20, `${table} : sa durée et qui l’efface, en clair`);
  }
});

test('chaque purge vise une colonne de sa table, avec un seul paramètre, la limite, et dit sa durée comme le contrat', () => {
  const columnsOf = (table: string) => (database.prepare(`PRAGMA table_info("${table}")`).all() as { name: string }[]).map(({ name }) => name);
  assert.deepEqual([...RETENTION_PURGES.map(({ table }) => table)].sort(), Object.keys(RETENTION_LIMITS).sort(), 'une limite par purge, une purge par limite');
  for (const { table, condition } of RETENTION_PURGES) {
    assert.equal(condition.split('?').length - 1, 1, `${table} : un seul paramètre`);
    const column = /^(\w+) <=? \?$/.exec(condition)?.[1];
    assert.ok(column && columnsOf(table).includes(column), `${table} : ${condition}`);
    assert.equal(RETENTION_PLAN[table].kept, RETENTION_WORDS[table]);
  }
});

test('les limites à 6 h 16 le 28 novembre 2026 : deux jours, huit jours à l’heure pleine, trente jours, quinze minutes, trente-cinq jours, douze mois, vingt-quatre mois', () => {
  const at = (key: keyof typeof RETENTION_LIMITS) => RETENTION_LIMITS[key](NOW_MS);
  assert.equal(new Date(at('otf_call_starts') as number).toISOString(), '2026-11-26T05:16:00.000Z');
  assert.equal(new Date(at('otf_call_outcomes') as number).toISOString(), '2026-11-20T05:00:00.000Z');
  assert.equal(at('otf_daily_calls'), '2026-10-29');
  assert.equal(at('otf_call_pauses'), NOW_MS);
  assert.equal(new Date(at('otf_authentication_failures') as number).toISOString(), '2026-11-28T05:01:00.000Z');
  assert.equal(at('irrigation_operator_notices'), '2026-10-24');
  assert.equal(at('irrigation_support_accesses'), '2025-11-28');
  assert.equal(at('irrigation_weather_forecast_archive'), '2024-11-28', 'l’archive des prévisions, 24 mois (D-297)');
  assert.equal(at('irrigation_weather_day_shapes'), '2026-11-20', 'la forme de la journée, 8 jours (D-349)');
  assert.equal(OPERATOR_NOTICES_KEPT_DAYS, 35);
  assert.deepEqual(RETENTION_WORDS, {
    otf_call_starts: '2 jours',
    otf_call_outcomes: '8 jours',
    otf_daily_calls: '30 jours',
    otf_call_pauses: 'jusqu’à la fin de la pause',
    otf_authentication_failures: '15 minutes',
    irrigation_operator_notices: '35 jours',
    irrigation_support_accesses: '12 mois',
    irrigation_weather_forecast_archive: '24 mois',
    irrigation_weather_day_shapes: '8 jours',
  });
});

test('un passage reste loin des bornes de D1, et la tâche finit le matin, aux seuils du matin', () => {
  assert.equal(RETENTION_PURGE_BATCH_ROWS, 500);
  assert.equal(RETENTION_PURGE_RUN_STATEMENTS, 50);
  assert.ok(RETENTION_PURGE_RUN_STATEMENTS + 300 < 1000, 'avec l’effacement des fermes, loin des 1 000 requêtes d’une exécution');
  assert.equal(tasksOfTrigger('weather-morning').at(-1), 'retention-purge');
  const task = taskDeclaration('retention-purge');
  assert.equal(task.label, 'Purges de conservation');
  assert.equal(task.lateAfterHours, 26);
  assert.equal(task.brokenAfterHours, 36);
  assert.match(task.successKeptIn, /task:retention-purge/);
});

test('le contrat écrit la durée de chaque table qui n’est pas d’un espace (10 bis.18)', () => {
  const contract = readFileSync('docs/tranche-4-contract.md', 'utf8');
  const start = contract.indexOf('#### 10 bis.18');
  assert.ok(start > 0, 'la section 10 bis.18 du contrat');
  const end = contract.indexOf('\n###', start + 1);
  const section = contract.slice(start, end > 0 ? end : undefined);
  for (const [table, rule] of Object.entries(RETENTION_PLAN)) {
    assert.ok(section.includes(`\`${table}\``), `${table} : absente du tableau de la section 10 bis.18`);
    if (rule.purge) assert.ok(section.includes(rule.kept), `${table} : « ${rule.kept} » dans le contrat`);
  }
});
