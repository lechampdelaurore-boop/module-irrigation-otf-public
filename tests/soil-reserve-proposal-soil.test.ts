import assert from 'node:assert/strict';
import test from 'node:test';
import { bedSoilReserve } from '../lib/domain/soil-reserve/gauge.ts';
import { proposalSoilNotes } from '../lib/domain/soil-reserve/proposal-soil.ts';
import { BED, crop, cropDay, irrigation, observation, soilInput } from './support/soil-reserve-fixtures.ts';

/**
 * La dose au-delà de ce que le sol retient sur les propositions du plan
 * (5 ter, PR 3d, scénario 7 du contrat) : seulement sur une proposition encore
 * proposée, seulement quand la jauge de la planche est connue et que la dose
 * dépasse ce qui peut encore entrer dans le sol au début de l'arrosage.
 */

const MONDAY = '2026-06-01';
const MONDAY_MIDNIGHT = '2026-05-31T22:00:00.000Z';
const SLOT_END = '2026-06-01T00:00:00.000Z';
const NOW = new Date('2026-05-31T20:00:00.000Z');

const proposal = (storedId: string, appliedMm: number, status: 'proposed' | 'refused' = 'proposed', bedId = BED.id) => ({
  storedId,
  status,
  startAt: MONDAY_MIDNIGHT,
  endAt: SLOT_END,
  bedApplications: [{ bedId, bedName: 'A', appliedMm }] as never,
});

/** Une planche à 20 mm sur 31 au début du lundi, sans consommation, et les apports proposés que la jauge compte. */
function gauge(...mm: number[]) {
  const intervals = mm.map((value) => irrigation(MONDAY_MIDNIGHT, SLOT_END, value, 'proposed'));
  const days = bedSoilReserve(soilInput({
    today: MONDAY,
    waterDays: [cropDay(MONDAY, [crop({ etmMm: 0 })])],
    observations: [observation(Math.round(20 / 31 * 1e6) / 1e4, MONDAY_MIDNIGHT)],
    irrigations: intervals,
  }));
  return { daysByBed: new Map([[BED.id, days]]), intervalsByBed: new Map([[BED.id, intervals]]) };
}

test('une proposition de 15 mm sur une planche qui ne peut plus en recevoir que 11 : 4 mm au-delà, perdus en drainage', () => {
  const notes = proposalSoilNotes({ proposals: [proposal('p1', 15)], now: NOW, ...gauge(15) });
  assert.deepEqual(Object.keys(notes), ['p1']);
  assert.equal(notes.p1[0].bedName, 'A');
  assert.equal(Number(notes.p1[0].beyondMm.toFixed(2)), 4);
});

test('rien quand la dose tient dans le sol, quand la proposition n’est plus proposée ou que la jauge ne l’a pas comptée', () => {
  assert.deepEqual(proposalSoilNotes({ proposals: [proposal('p1', 5)], now: NOW, ...gauge(5) }), {});
  assert.deepEqual(proposalSoilNotes({ proposals: [proposal('p1', 15, 'refused')], now: NOW, ...gauge(15) }), {});
  assert.deepEqual(proposalSoilNotes({ proposals: [proposal('p1', 15)], now: new Date('2026-06-01T01:00:00.000Z'), ...gauge(15) }), {}, 'une proposition échue');
  assert.deepEqual(proposalSoilNotes({ proposals: [proposal('p1', 15)], now: NOW, ...gauge() }), {});
  assert.deepEqual(proposalSoilNotes({ proposals: [proposal('p1', 15, 'proposed', 'ailleurs')], now: NOW, ...gauge(15) }), {});
});

test('une jauge inconnue ne dit rien', () => {
  const intervals = [irrigation(MONDAY_MIDNIGHT, SLOT_END, 15, 'proposed')];
  const days = bedSoilReserve(soilInput({ today: MONDAY, waterDays: [cropDay(MONDAY, [crop({ etmMm: 0 })])], irrigations: intervals }));
  assert.equal(days[0].startMm, null);
  assert.deepEqual(proposalSoilNotes({
    proposals: [proposal('p1', 15)],
    now: NOW,
    daysByBed: new Map([[BED.id, days]]),
    intervalsByBed: new Map([[BED.id, intervals]]),
  }), {});
});
