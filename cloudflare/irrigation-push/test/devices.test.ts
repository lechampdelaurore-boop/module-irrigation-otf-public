import assert from 'node:assert/strict';
import test from 'node:test';
import {
  decideDelivery,
  decideRegistration,
  holderAfterUnregistration,
  MAX_RECIPIENTS_PER_DEVICE,
  type DeviceHolder,
} from '../src/devices.ts';

/**
 * Les décisions d'un appareil, sans stockage (docs/tranche-4-contract.md,
 * F371 à F376). Le parcours complet, avec les vraies classes du Worker, est
 * dans `device-isolation.test.ts`.
 */

const alice = (...recipientKeys: string[]): DeviceHolder => ({ personKey: 'alice', recipientKeys });

test('un appareil jamais vu devient à la personne qui l’inscrit, dans ce seul espace', () => {
  assert.deepEqual(decideRegistration(null, { personKey: 'alice', recipientKey: 'a1', intent: 'refresh' }), {
    status: 'registered',
    holder: alice('a1'),
    detachFrom: [],
  });
});

test('la même personne ajoute un espace sans perdre les autres ; le dernier inscrit passe en fin de liste', () => {
  assert.deepEqual(decideRegistration(alice('a1', 'a2'), { personKey: 'alice', recipientKey: 'a1', intent: 'refresh' }), {
    status: 'registered',
    holder: alice('a2', 'a1'),
    detachFrom: [],
  });
});

test('au-delà de vingt espaces d’une même personne, le plus ancien est détaché', () => {
  const full = alice(...Array.from({ length: MAX_RECIPIENTS_PER_DEVICE }, (_, index) => `a${index + 1}`));
  const decision = decideRegistration(full, { personKey: 'alice', recipientKey: 'a21', intent: 'refresh' });
  assert.equal(decision.status, 'registered');
  assert.ok(decision.status === 'registered');
  assert.equal(decision.holder.recipientKeys.length, MAX_RECIPIENTS_PER_DEVICE);
  assert.equal(decision.holder.recipientKeys.at(-1), 'a21');
  assert.deepEqual(decision.detachFrom, ['a1']);
});

test('l’appareil d’une autre personne : la page le laisse, « Activer » le prend et le détache de tous ses espaces', () => {
  assert.deepEqual(
    decideRegistration(alice('a1', 'a2'), { personKey: 'bob', recipientKey: 'b1', intent: 'refresh' }),
    { status: 'other-person' },
  );
  assert.deepEqual(decideRegistration(alice('a1', 'a2'), { personKey: 'bob', recipientKey: 'b1', intent: 'activate' }), {
    status: 'registered',
    holder: { personKey: 'bob', recipientKeys: ['b1'] },
    detachFrom: ['a1', 'a2'],
  });
});

test('un appareil d’avant le correctif, sans personne, est pris à la première inscription, même par la page', () => {
  assert.deepEqual(
    decideRegistration({ personKey: null, recipientKeys: ['a1'] }, { personKey: 'bob', recipientKey: 'b1', intent: 'refresh' }),
    { status: 'registered', holder: { personKey: 'bob', recipientKeys: ['b1'] }, detachFrom: ['a1'] },
  );
});

test('« Désactiver » retire l’espace et garde la personne, même sans espace', () => {
  assert.deepEqual(holderAfterUnregistration(alice('a1', 'a2'), 'a1'), alice('a2'));
  assert.deepEqual(holderAfterUnregistration(alice('a1'), 'a1'), alice());
  assert.deepEqual(holderAfterUnregistration(null, 'a1'), { personKey: null, recipientKeys: [] });
});

test('à l’envoi, seul un espace de la liste est admis ; un appareil jamais vu est réservé au premier espace', () => {
  assert.deepEqual(decideDelivery(alice('a1'), 'a1'), { admitted: true, claim: null });
  assert.deepEqual(decideDelivery(alice('a1'), 'b1'), { admitted: false });
  assert.deepEqual(decideDelivery(alice(), 'a1'), { admitted: false });
  assert.deepEqual(decideDelivery(null, 'b1'), { admitted: true, claim: { personKey: null, recipientKeys: ['b1'] } });
});
