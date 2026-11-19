import assert from 'node:assert/strict';
import test from 'node:test';
import { dayDosesFromProposals, objectiveExcess, proposedDoseFor } from '../lib/domain/irrigation-form-hints.ts';

// Audit ergonomique du 19 novembre 2026, lot G, n° 9 (F409, F410).

const doses = dayDosesFromProposals([
  { equipmentId: 'g1', startAt: '2026-11-19T15:00:00.000Z', doseMm: 6, status: 'proposed' },
  { equipmentId: 'g1', startAt: '2026-11-19T05:30:00.000Z', doseMm: 8.14, status: 'validated' },
  { equipmentId: 'g1', startAt: '2026-11-20T05:30:00.000Z', doseMm: 12, status: 'proposed' },
  { equipmentId: 'g2', startAt: '2026-11-19T05:30:00.000Z', doseMm: 9, status: 'refused' },
  { equipmentId: 'g3', startAt: '2026-11-19T05:30:00.000Z', doseMm: 9, status: 'expired' },
]);

test('la quantité proposée est la dose du jour pour ce matériel, la première du jour (F409)', () => {
  assert.equal(proposedDoseFor(doses, 'g1', '2026-11-19'), 8.1);
  assert.equal(proposedDoseFor(doses, 'g1', '2026-11-20'), 12);
});

test('sans proposition valable ce jour-là, aucune quantité : le champ reste vide (F409)', () => {
  assert.equal(proposedDoseFor(doses, 'g1', '2026-11-21'), null);
  assert.equal(proposedDoseFor(doses, 'g2', '2026-11-19'), null, 'une proposition refusée ne compte pas');
  assert.equal(proposedDoseFor(doses, 'g3', '2026-11-19'), null, 'une proposition expirée ne compte pas');
  assert.equal(proposedDoseFor([], 'g1', '2026-11-19'), null, 'planning décoché : rien');
});

test('le jour se lit à l’heure de la ferme : 23 h 30 à Paris reste le même jour', () => {
  const late = dayDosesFromProposals([{ equipmentId: 'g1', startAt: '2026-11-19T22:30:00.000Z', doseMm: 5, status: 'proposed' }]);
  assert.equal(proposedDoseFor(late, 'g1', '2026-11-19'), 5);
  assert.equal(proposedDoseFor(late, 'g1', '2026-11-20'), null);
});

const weeks = [{ weekStart: '2026-11-16', objectiveMmByBed: { p1: 20, p2: 25 } }];
const bed = (id: string, name: string, amountMm: number | null) => ({ bed: { id, name }, amountMm });

test('au-delà de l’objectif de la semaine, la planche la plus au-delà se nomme (F410)', () => {
  assert.deepEqual(
    objectiveExcess([bed('p1', 'Planche 1', 30), bed('p2', 'Planche 2', 30), bed('p3', 'Planche 3', 90)], weeks, '2026-11-19T10:00:00.000Z'),
    { bedName: 'Planche 1', amountMm: 30, objectiveMm: 20, otherBeds: 1 },
  );
});

test('sans objectif adopté, ou dans l’objectif, aucune confirmation (F410)', () => {
  assert.equal(objectiveExcess([bed('p3', 'Planche 3', 90)], weeks, '2026-11-19T10:00:00.000Z'), null);
  assert.equal(objectiveExcess([bed('p1', 'Planche 1', 20)], weeks, '2026-11-19T10:00:00.000Z'), null);
  assert.equal(objectiveExcess([bed('p1', 'Planche 1', null)], weeks, '2026-11-19T10:00:00.000Z'), null);
  assert.equal(objectiveExcess([bed('p1', 'Planche 1', 30)], weeks, '2026-11-24T10:00:00.000Z'), null, 'une autre semaine, sans objectif connu');
});
