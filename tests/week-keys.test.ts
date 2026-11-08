import assert from 'node:assert/strict';
import test from 'node:test';
import {
  compareWeekKeys,
  isWeekKey,
  weekEndDateKeyFromWeekKey,
  weekKeyFromDateKey,
  weekStartDateKeyFromWeekKey,
} from '../lib/domain/week-keys.ts';

test('la semaine ISO d’un jour suit la règle du jeudi, aux bords d’année compris', () => {
  // Semaines relevées sur la ferme le 26 septembre 2026 (docs/series-contract.md).
  assert.equal(weekKeyFromDateKey('2025-11-03'), '2025-W45', 'lundi 3 novembre 2025');
  assert.equal(weekKeyFromDateKey('2025-11-09'), '2025-W45', 'dimanche de la même semaine');
  assert.equal(weekKeyFromDateKey('2025-12-15'), '2025-W51');
  // Le 29 décembre 2025 est un lundi dont le jeudi tombe en 2026.
  assert.equal(weekKeyFromDateKey('2025-12-29'), '2026-W01');
  assert.equal(weekKeyFromDateKey('2026-01-04'), '2026-W01');
  // 2026 a 53 semaines : le 1er janvier 2027 (vendredi) est encore en 2026-W53.
  assert.equal(weekKeyFromDateKey('2026-12-28'), '2026-W53');
  assert.equal(weekKeyFromDateKey('2027-01-01'), '2026-W53');
  assert.equal(weekKeyFromDateKey('2027-01-04'), '2027-W01');
  assert.equal(weekKeyFromDateKey('2026-09-29'), '2026-W40');
});

test('le lundi et le dimanche d’une semaine ISO se retrouvent, et l’aller-retour est exact sur une année entière', () => {
  assert.equal(weekStartDateKeyFromWeekKey('2025-W45'), '2025-11-03');
  assert.equal(weekEndDateKeyFromWeekKey('2025-W45'), '2025-11-09');
  assert.equal(weekStartDateKeyFromWeekKey('2026-W01'), '2025-12-29');
  assert.equal(weekStartDateKeyFromWeekKey('2026-W53'), '2026-12-28');
  assert.equal(weekStartDateKeyFromWeekKey('2027-W01'), '2027-01-04');
  for (let day = new Date('2026-01-01T12:00:00.000Z'); day.getUTCFullYear() === 2026; day.setUTCDate(day.getUTCDate() + 1)) {
    const dateKey = day.toISOString().slice(0, 10);
    const week = weekKeyFromDateKey(dateKey);
    const monday = weekStartDateKeyFromWeekKey(week);
    const sunday = weekEndDateKeyFromWeekKey(week);
    assert.ok(monday !== null && sunday !== null && monday <= dateKey && dateKey <= sunday, `${dateKey} est dans ${week}`);
  }
});

test('une semaine qui n’existe pas est refusée', () => {
  assert.equal(weekStartDateKeyFromWeekKey('2025-W53'), null, '2025 n’a que 52 semaines');
  assert.equal(weekStartDateKeyFromWeekKey('2026-W00'), null);
  assert.equal(weekStartDateKeyFromWeekKey('2025-45'), null);
  assert.equal(isWeekKey('2026-W53'), true);
  assert.equal(isWeekKey('2025-W53'), false);
  assert.equal(isWeekKey(45), false);
});

test('les semaines ISO se comparent par leur texte, qui est chronologique', () => {
  assert.ok(compareWeekKeys('2025-W45', '2026-W01') < 0);
  assert.ok(compareWeekKeys('2026-W10', '2026-W09') > 0);
  assert.equal(compareWeekKeys('2026-W10', '2026-W10'), 0);
});
