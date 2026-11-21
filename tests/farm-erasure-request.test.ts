import assert from 'node:assert/strict';
import test from 'node:test';
import {
  erasureMorningDay,
  FARM_ERASURE_EXPLANATION,
  farmErasureRequestDecision,
  farmErasureRequestedMessage,
  frozenFarmView,
  immediateErasureDecision,
  operatorErasureLines,
  sameFarmName,
  type OperatorErasureRequest,
} from '../lib/domain/operations/farm-erasure-request.ts';

/**
 * Ce que la personne et l'exploitant voient de l'effacement d'une ferme,
 * sans la base (4.5, PR 3, troisième partie ; docs/tranche-4-contract.md,
 * F563, et 10 bis.22, F665 à F669) : le nom à taper, le jour de
 * l'effacement, l'écran de l'espace figé, la section de Réglages, et
 * l'effacement sans attendre. Les preuves sur la base sont dans
 * `tests/db/farm-erasure-request.test.ts`.
 */

test('le nom tapé : les espaces en trop et les majuscules ne comptent pas, une lettre de plus ou de moins si', () => {
  assert.equal(sameFarmName('  la ferme   DE l’Aurore ', 'La ferme de l’Aurore'), true);
  assert.equal(sameFarmName('Ferme de l’Aurore', 'La ferme de l’Aurore'), false);
  assert.equal(sameFarmName('Écurie', 'Écurie'), true, 'un accent tapé autrement est le même');
  assert.equal(sameFarmName('', '  '), false, 'une ferme sans nom ne se confirme jamais');
  assert.equal(sameFarmName(42, '42'), false);
  assert.equal(sameFarmName(undefined, 'La ferme'), false);
});

test('la demande refuse un nom faux ou illisible, et dit le nom à taper', () => {
  assert.deepEqual(farmErasureRequestDecision('La ferme', null), {
    ok: false,
    message: 'Le nom de la ferme n’est pas lu : rechargez la page, puis recommencez.',
  });
  assert.deepEqual(farmErasureRequestDecision('Ferme', 'La ferme de l’Aurore'), {
    ok: false,
    message: 'Tapez le nom de la ferme tel qu’il est écrit : « La ferme de l’Aurore ».',
  });
  assert.deepEqual(farmErasureRequestDecision('la ferme de l’aurore', 'La ferme de l’Aurore'), { ok: true });
});

test('le jour de l’effacement : le premier passage de 6 h 15, heure de Paris, qui trouve la demande échue', () => {
  assert.equal(erasureMorningDay('2026-11-27T10:00:00.000Z'), '2026-11-28', 'échue à 11 h : le lendemain matin');
  assert.equal(erasureMorningDay('2026-11-27T05:00:00.000Z'), '2026-11-27', 'échue à 6 h : le matin même');
  assert.equal(erasureMorningDay('2026-11-27T05:15:00.000Z'), '2026-11-27', 'échue à 6 h 15 pile : le passage la trouve');
  assert.equal(erasureMorningDay('2026-11-27T05:15:00.001Z'), '2026-11-28', 'une milliseconde après : le lendemain');
  assert.equal(erasureMorningDay('2027-04-01T04:15:00.000Z'), '2027-04-01', 'en été, 6 h 15 de Paris est 4 h 15 UTC');
  assert.equal(erasureMorningDay('2027-04-01T04:30:00.000Z'), '2027-04-02');
  assert.equal(erasureMorningDay('2026-11-27T23:30:00.000Z'), '2026-11-28', 'après minuit à Paris : le matin de ce jour-là');
});

test('le message de la demande dit le jour et l’heure de l’effacement', () => {
  assert.equal(farmErasureRequestedMessage('2026-11-27T10:00:00.000Z'), 'La demande est enregistrée : la ferme sera effacée du module le 28/11/2026 vers 6 h 15.');
});

test('l’écran de l’espace figé : le jour, ce qui est figé, l’autorisation, et l’annulation tant que l’effacement n’a pas commencé', () => {
  const pending = frozenFarmView({ state: 'pending', requestedAt: '2026-11-20T10:00:00.000Z', eraseAfter: '2026-11-27T10:00:00.000Z' });
  assert.equal(pending.title, 'Votre ferme sera effacée du module le 28/11/2026 vers 6 h 15');
  assert.equal(pending.cancellable, true);
  assert.match(pending.lines[0], /^Vous avez demandé le 20\/11\/2026 la suppression de votre ferme/);
  assert.match(pending.lines[0], /aucun calcul, aucune notification, aucune lecture d’Ouvre ta ferme, aucune saisie/);
  assert.match(pending.lines.join(' '), /Vous pouvez annuler jusqu’à l’effacement/);
  assert.match(pending.lines.join(' '), /administrateur de la ferme, dans Ouvre ta ferme/);

  const erasing = frozenFarmView({ state: 'erasing', requestedAt: '2026-11-20T10:00:00.000Z', eraseAfter: '2026-11-27T10:00:00.000Z' });
  assert.equal(erasing.title, 'L’effacement de votre ferme est en cours');
  assert.equal(erasing.cancellable, false);
  assert.match(erasing.lines[0], /il ne peut plus être annulé/);
});

test('la section de Réglages dit ce qui disparaît, ce qui reste, le délai et l’autorisation à retirer (F563)', () => {
  const text = FARM_ERASURE_EXPLANATION.join(' ');
  for (const words of ['réglages, matériel, ressources en eau, planches, arrosages, pluie, observations', '7 jours après la demande', 'vous pouvez annuler', '30 jours', 'cinq semaines', 'sans nom, sans ferme et sans contenu', 'un administrateur de la ferme, dans Ouvre ta ferme', 'écrivez-le au responsable du module']) {
    assert.ok(text.includes(words), words);
  }
  assert.ok(text.includes('Vos données dans Ouvre ta ferme ne changent pas'), 'le module ne fait que lire Ouvre ta ferme');
});

const REQUESTS: OperatorErasureRequest[] = [
  { id: 'a', otfFarmId: '4394', state: 'pending', requestedAt: '2026-11-20T10:00:00.000Z', eraseAfter: '2026-11-27T10:00:00.000Z' },
  { id: 'b', otfFarmId: null, state: 'pending', requestedAt: '2026-11-21T08:00:00.000Z', eraseAfter: '2026-11-28T08:00:00.000Z' },
  { id: 'c', otfFarmId: '5120', state: 'erasing', requestedAt: '2026-11-12T10:00:00.000Z', eraseAfter: '2026-11-19T10:00:00.000Z' },
];

test('la page d’état dit chaque demande ouverte : la ferme, le jour de la demande, le jour prévu ; jamais la personne', () => {
  assert.deepEqual(operatorErasureLines(REQUESTS), [
    { id: 'a', farm: 'ferme 4394', text: 'ferme 4394 : demandée le 20/11/2026, effacement prévu le 28/11/2026', immediate: true },
    { id: 'b', farm: 'espace sans ferme', text: 'espace sans ferme : demandée le 21/11/2026, effacement prévu le 29/11/2026', immediate: true },
    { id: 'c', farm: 'ferme 5120', text: 'ferme 5120 : demandée le 12/11/2026, effacement en cours', immediate: false },
  ]);
});

test('l’effacement sans attendre : une demande en attente, et le numéro de sa ferme retapé', () => {
  assert.deepEqual(immediateErasureDecision({ requestId: 'c', typedFarm: '5120' }, REQUESTS), {
    ok: false,
    message: 'Choisissez une demande en attente : celle-ci n’y est plus.',
  }, 'commencée : le matin la finit');
  assert.deepEqual(immediateErasureDecision({ requestId: 'z', typedFarm: '4394' }, REQUESTS).ok, false);
  assert.deepEqual(immediateErasureDecision({ requestId: 'a', typedFarm: '5120' }, REQUESTS), {
    ok: false,
    message: 'Retapez le numéro de la ferme de la demande (« 4394 ») pour confirmer.',
  });
  assert.deepEqual(immediateErasureDecision({ requestId: 'a', typedFarm: ' 4394 ' }, REQUESTS), { ok: true, request: REQUESTS[0] });
  assert.deepEqual(immediateErasureDecision({ requestId: 'b', typedFarm: 'sans ferme' }, REQUESTS), { ok: true, request: REQUESTS[1] });
});
