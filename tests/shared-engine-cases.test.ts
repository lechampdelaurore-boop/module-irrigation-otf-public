import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { compareValue, DEFAULT_CASES_PATH, EDGE_CASE_IDS, measureCases, readCases } from '../scripts/shared-engine-cases.ts';

/**
 * Le script des cas de test du moteur commun (docs/shared-engine-cases-contract.md,
 * « Les verdicts », « La preuve », D-114) : la règle des verdicts, l'arrêt sur
 * un fichier de cas incomplet, et un verdict pour chaque valeur de chaque cas.
 * Ce test ne fige pas les résultats de la mesure : un écart est un résultat.
 */

test('un nombre est conforme à 0,01 près, au-delà il est en écart', () => {
  assert.equal(compareValue(3.825, 3.83, 0.01).verdict, 'conforme');
  assert.equal(compareValue(3.6, 3.6000001, 0.01).verdict, 'conforme');
  assert.equal(compareValue(15.3, 15.32, 0.01).verdict, 'écart');
});

test('null n’est conforme qu’à null : inconnu n’est jamais zéro', () => {
  assert.equal(compareValue(null, null, 0.01).verdict, 'conforme');
  assert.equal(compareValue(null, 0, 0.01).verdict, 'écart');
  assert.equal(compareValue(0, null, 0.01).verdict, 'écart');
});

test('un texte ou un booléen se compare à l’égalité', () => {
  assert.equal(compareValue('inflow', 'inflow', 0.01).verdict, 'conforme');
  assert.equal(compareValue('inflow', 'observation', 0.01).verdict, 'écart');
  assert.equal(compareValue(true, true, 0.01).verdict, 'conforme');
  assert.equal(compareValue(true, false, 0.01).verdict, 'écart');
});

test('un fichier de cas sans O01 à O10 arrête le script', () => {
  const folder = mkdtempSync(path.join(tmpdir(), 'cas-'));
  const file = path.join(folder, 'cas.json');
  writeFileSync(file, JSON.stringify({ tolerance: 0.01, cas: [{ id: 'O01', attendu: {} }] }));
  assert.throws(() => readCases(file), /O02/);
  assert.throws(() => readCases(path.join(folder, 'absent.json')));
});

test('chaque valeur attendue de O01 à O10 et de chaque cas limite reçoit un verdict', () => {
  const report = measureCases(readCases(DEFAULT_CASES_PATH));
  const ids = report.cases.map((item) => item.id);
  for (let index = 1; index <= 10; index += 1) assert.ok(ids.includes(`O${String(index).padStart(2, '0')}`), `O${index}`);
  for (const id of EDGE_CASE_IDS) assert.ok(ids.includes(id), id);
  for (const item of report.cases) {
    assert.ok(item.values.length > 0, `${item.id} : aucune valeur`);
    for (const value of item.values) {
      assert.ok(['conforme', 'conforme, déduit', 'écart', 'non joué'].includes(value.verdict), `${item.id}.${value.key} : ${value.verdict}`);
      if (value.verdict === 'non joué') assert.ok(value.reason, `${item.id}.${value.key} : raison`);
    }
  }
});
