import assert from 'node:assert/strict';
import test from 'node:test';
import type { StoredProposal, StoredWeeklyPlan } from '../lib/domain/planning/contract.ts';
import { refusalMessage, refusalReplacement } from '../lib/domain/planning/refusal-replacement.ts';

// Audit ergonomique du 19 novembre 2026, lot G, n° 7 (F412) : où le besoin d'un créneau refusé est allé.

function proposal(storedId: string, calculationId: string, startAt: string, beds: string[], status: StoredProposal['status'] = 'proposed', equipmentName = 'Goutte-à-goutte du champ du bas'): StoredProposal {
  return { storedId, calculationId, startAt, status, equipmentName, bedApplications: beds.map((bedId) => ({ bedId })) } as unknown as StoredProposal;
}
const plan = (calculationId: string, proposals: StoredProposal[]) => ({ calculation: { id: calculationId }, proposals }) as unknown as StoredWeeklyPlan;

// Mardi 17 novembre 2026, 6 h à la ferme (UTC+1).
const refused = proposal('r', 'c1', '2026-11-17T05:00:00.000Z', ['N01', 'N02'], 'refused');

test('tant que le plan lu n’est pas le recalcul d’après le refus, rien ne se dit', () => {
  assert.equal(refusalReplacement(refused, plan('c1', [refused])), undefined);
});

test('la proposition nouvelle qui sert une planche du créneau refusé, la plus proche de son heure', () => {
  const recalculated = plan('c2', [
    refused,
    proposal('a', 'c2', '2026-11-19T11:26:00.000Z', ['N02']),
    proposal('b', 'c2', '2026-11-20T05:00:00.000Z', ['N01']),
    proposal('c', 'c2', '2026-11-17T06:00:00.000Z', ['T01']),
    proposal('d', 'c2', '2026-11-17T07:00:00.000Z', ['N01'], 'validated'),
  ]);
  const replacement = refusalReplacement(refused, recalculated);
  assert.equal(replacement?.storedId, 'a');
  assert.equal(refusalMessage(replacement ?? null), 'Créneau refusé. Le besoin est replacé jeudi à 12 h 26 (Goutte-à-goutte du champ du bas).');
});

test('aucun autre créneau : le besoin reste affiché, non placé', () => {
  const replacement = refusalReplacement(refused, plan('c2', [refused, proposal('c', 'c2', '2026-11-17T06:00:00.000Z', ['T01'])]));
  assert.equal(replacement, null);
  assert.equal(refusalMessage(replacement ?? null), 'Créneau refusé. Aucun autre créneau cette semaine : le besoin reste affiché, non placé.');
});
