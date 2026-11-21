import assert from 'node:assert/strict';
import test from 'node:test';
import { JOURNAL_OBJECT_TABLES } from '../db/change-journal/objects.ts';
import { JOURNAL_TABLES, JOURNAL_WRITE_SITES, OUTSIDE_JOURNAL } from '../db/change-journal/inventory.ts';
import { CHANGE_SUBJECT_CODES } from '../lib/domain/change-journal/subjects.ts';
import { createMigratedSqliteDatabase } from './support/d1-sqlite.ts';
import { dataTables } from './support/synthetic-space-rows.ts';
import { siteKey, writeSites } from './support/write-sites.ts';

/**
 * L'inventaire du journal des modifications (amélioration n° 7, §5.4,
 * premier garde-fou ; D-285, F717) : chaque table de la base est rangée, et
 * chaque endroit du code qui écrit dans une table d'objectifs, de réglages
 * ou de matériel est connu, avec ce qu'il fait au journal. Une table ou un
 * écrivain ajouté plus tard sans être rangé fait échouer ce test, donc la CI.
 */

const database = createMigratedSqliteDatabase();
const tables = dataTables(database);
const sites = writeSites();

test('chaque table de la base est rangée une fois : au journal ou hors du journal, avec sa raison', () => {
  const journal = Object.keys(JOURNAL_TABLES);
  const outside = Object.keys(OUTSIDE_JOURNAL);
  assert.deepEqual(journal.filter((table) => outside.includes(table)), [], 'une table rangée deux fois');
  assert.deepEqual(
    tables.filter((table) => !journal.includes(table) && !outside.includes(table)),
    [],
    'à ranger dans db/change-journal/inventory.ts : JOURNAL_TABLES (objectifs, réglages, matériel) ou OUTSIDE_JOURNAL, avec sa raison',
  );
  assert.deepEqual([...journal, ...outside].filter((table) => !tables.includes(table)), [], 'une table de l’inventaire qui n’existe plus');
  for (const [table, reason] of Object.entries(OUTSIDE_JOURNAL)) assert.ok(reason.trim().length > 40, `${table} : hors du journal avec sa raison`);
});

test('chaque sujet du journal a sa table, et chaque table du journal a un sujet', () => {
  const covered = new Set(Object.values(JOURNAL_TABLES).flat());
  assert.deepEqual(CHANGE_SUBJECT_CODES.filter((subject) => !covered.has(subject)), [], 'un sujet sans table');
  for (const [table, subjects] of Object.entries(JOURNAL_TABLES)) assert.ok(subjects.length > 0, `${table} : au moins un sujet`);
  for (const [subject, table] of Object.entries(JOURNAL_OBJECT_TABLES)) {
    if (table !== null) assert.ok(tables.includes(table), `${subject} : la table de l’objet, ${table}, existe`);
  }
});

test('chaque écrivain d’une table du journal est dans l’inventaire, et l’inventaire ne nomme que des écrivains réels', () => {
  const found = sites.filter(({ table }) => Object.hasOwn(JOURNAL_TABLES, table)).map(({ file, fn, table }) => siteKey(file, fn, table)).sort();
  const listed = Object.keys(JOURNAL_WRITE_SITES).sort();
  assert.deepEqual(found.filter((key) => !listed.includes(key)), [], 'un écrivain absent de JOURNAL_WRITE_SITES : le brancher au journal, ou dire pourquoi il est sans objet');
  assert.deepEqual(listed.filter((key) => !found.includes(key)), [], 'un écrivain de l’inventaire qui n’existe plus');
});

test('un écrivain sans objet dit pourquoi', () => {
  for (const [key, site] of Object.entries(JOURNAL_WRITE_SITES)) {
    if (site.status === 'sans-objet') assert.ok(site.reason.trim().length > 40, `${key} : sans objet avec sa raison`);
  }
});

test('le relevé des écrivains voit les écritures de toutes les formes', () => {
  const keys = new Set(sites.map(({ file, fn, table }) => siteKey(file, fn, table)));
  // Une insertion simple, une mise à jour, un effacement, une insertion « ou ignorer » et une écriture dans une fonction d'aide.
  for (const key of [
    'db/protected-slots-repository.ts › createProtectedSlotForUser › irrigation_protected_slots',
    'db/protected-slots-repository.ts › updateProtectedSlotForUser › irrigation_protected_slots',
    'db/equipment/equipment.ts › deleteEquipmentForUser › irrigation_equipment',
    'db/weather-alert-repository.ts › recordWeatherAlertDelivery › irrigation_weather_alerts',
    'db/weather-alert-repository.ts › versionStatement › irrigation_weather_alert_criterion_versions',
  ]) assert.ok(keys.has(key), key);
});
