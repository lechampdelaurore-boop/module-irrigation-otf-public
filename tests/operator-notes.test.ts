import assert from 'node:assert/strict';
import test from 'node:test';
import {
  COST_ITEMS,
  costMonths,
  costReadingDecision,
  costReadingRecordedMessage,
  costView,
  estimatedBillUsd,
  expectedCostMonth,
  monthWords,
  type StoredCostReading,
} from '../lib/domain/operations/costs.ts';
import {
  oldestKeptSupportDay,
  supportAccessDecision,
  supportAccessLines,
  supportAccessRecordedMessage,
  supportReason,
} from '../lib/domain/operations/support-access.ts';

/**
 * Ce que l'exploitant note de sa main sur la page d'état (4.5, PR 5 ;
 * docs/tranche-4-contract.md, F567, F565 point 6, F568, et 10 bis.21, F660 à
 * F664) : le journal d'accès du support, gardé 12 mois, et le relevé des
 * coûts du mois, comparé à ce que l'offre de Cloudflare inclut. Ce qui
 * touche la base est dans `tests/db/operator-notes.test.ts`.
 */

const NOW = new Date('2026-11-20T15:30:00.000Z');
const REASON = 'La ferme demande pourquoi son planning est vide';

test('un accès se note pour une ferme de la page, un jour des 30 derniers, avec sa raison en une ligne', () => {
  const farms = ['4394', '5120'];
  assert.deepEqual(supportAccessDecision({ otfFarmId: '5120', day: '2026-11-20', reason: `  ${REASON}\n  par courriel ` }, NOW, farms), {
    ok: true,
    access: { otfFarmId: '5120', accessedOn: '2026-11-20', reason: `${REASON} par courriel` },
  });
  const refused = (input: Record<string, unknown>) => {
    const decision = supportAccessDecision({ otfFarmId: '4394', day: '2026-11-20', reason: REASON, ...input }, NOW, farms);
    assert.equal(decision.ok, false, JSON.stringify(input));
    return decision.ok ? '' : decision.message;
  };
  assert.match(refused({ otfFarmId: '7777' }), /Choisissez la ferme/, 'une ferme absente de la page');
  assert.match(refused({ otfFarmId: 4394 }), /Choisissez la ferme/);
  assert.match(refused({ day: '2026-02-30' }), /Choisissez le jour/);
  assert.match(refused({ day: '2026-11-21' }), /à venir/);
  assert.match(refused({ day: '2026-10-20' }), /plus de 30 jours/);
  assert.equal(supportAccessDecision({ otfFarmId: '4394', day: '2026-10-21', reason: REASON }, NOW, farms).ok, true, 'trente jours avant : encore noté');
  assert.match(refused({ reason: ' \n ' }), /raison en une ligne/);
  assert.match(refused({ reason: 'ok' }), /raison en une ligne/);
  assert.match(refused({ reason: 'x'.repeat(201) }), /200 caractères au plus/);
  assert.equal(supportAccessDecision({ otfFarmId: '4394', day: '2026-11-20', reason: 'x'.repeat(200) }, NOW, farms).ok, true);
  assert.equal(supportReason(42), '');
  assert.equal(supportAccessRecordedMessage({ otfFarmId: '4394', accessedOn: '2026-11-20', reason: REASON }), 'L’accès du 20/11/2026 aux données de la ferme 4394 est noté.');
  assert.deepEqual(supportAccessLines([{ id: 'a', otfFarmId: '4394', accessedOn: '2026-11-20', reason: REASON }]), [
    { key: 'a', day: '20/11/2026', farm: 'ferme 4394', reason: REASON },
  ]);
});

test('douze mois : le même jour un an plus tôt reste, le 29 février devient le 28', () => {
  assert.equal(oldestKeptSupportDay('2026-11-28'), '2025-11-28');
  assert.equal(oldestKeptSupportDay('2028-02-29'), '2027-02-28');
  assert.equal(oldestKeptSupportDay('2026-01-01'), '2025-01-01');
});

test('un relevé vise le mois en cours ou l’un des douze d’avant, et le mois écoulé est celui attendu', () => {
  assert.equal(costMonths(NOW).length, 13);
  assert.deepEqual(costMonths(NOW).slice(0, 3), ['2026-11', '2026-10', '2026-09']);
  assert.equal(costMonths(NOW).at(-1), '2025-11');
  assert.deepEqual(costMonths(new Date('2026-01-01T00:30:00.000Z')).slice(0, 2), ['2026-01', '2025-12'], 'minuit et demi à Paris : déjà janvier');
  assert.equal(expectedCostMonth(NOW), '2026-10');
  assert.equal(monthWords('2026-08'), 'août 2026');
});

const FIELDS = { month: '2026-10', workersRequests: '61 234', workersCpuMs: '18,400,000', d1RowsRead: '2.100.000', d1RowsWritten: '140000', d1StorageMb: '12,5', billedUsd: '5,00 $' };

test('les nombres se recopient tels que le tableau de bord les montre, sans lettre ni signe', () => {
  assert.deepEqual(costReadingDecision(FIELDS, NOW), {
    ok: true,
    reading: { month: '2026-10', workersRequests: 61_234, workersCpuMs: 18_400_000, d1RowsRead: 2_100_000, d1RowsWritten: 140_000, d1StorageMb: 12.5, billedUsd: 5 },
  });
  const decision = costReadingDecision({ ...FIELDS, billedUsd: '  ' }, NOW);
  assert.equal(decision.ok && decision.reading.billedUsd, null, 'la facture pas encore là');
  const refused = (input: Record<string, unknown>) => {
    const result = costReadingDecision({ ...FIELDS, ...input }, NOW);
    assert.equal(result.ok, false, JSON.stringify(input));
    return result.ok ? '' : result.message;
  };
  assert.match(refused({ month: '2026-12' }), /Choisissez le mois/, 'un mois à venir');
  assert.match(refused({ month: '2025-10' }), /Choisissez le mois/, 'plus de douze mois avant');
  assert.match(refused({ workersRequests: '1.5M' }), /^Requêtes des Workers : recopiez le nombre/);
  assert.match(refused({ workersCpuMs: '-3' }), /^Calcul des Workers/);
  assert.match(refused({ d1RowsWritten: '12,5' }), /^Lignes écrites dans D1 : .*sans virgule ni lettre/);
  assert.match(refused({ d1RowsRead: '12 34' }), /^Lignes lues dans D1/, 'des espaces mal placés');
  assert.match(refused({ d1StorageMb: 'douze' }), /^Stockage de D1 \(Mo\)/);
  assert.match(refused({ billedUsd: '5 euros' }), /^Facture du mois/);
  assert.match(refused({ workersRequests: undefined }), /^Requêtes des Workers/);
});

const reading = (values: Partial<StoredCostReading> = {}): StoredCostReading => ({
  month: '2026-10', workersRequests: 61_234, workersCpuMs: 18_400_000, d1RowsRead: 2_100_000, d1RowsWritten: 140_000, d1StorageMb: 12.5,
  billedUsd: 5, recordedAt: '2026-11-02T18:00:00.000Z', ...values,
});

/** Les nombres français s'écrivent avec une espace fine insécable : on la lit comme une espace. */
const plain = (text: string | null) => (text ?? '').replace(/[\u00a0\u202f]/g, ' ');

test('chaque poste comparé à ce que l’offre inclut : dans l’offre, à surveiller dès 80 %, au-delà, ce qu’il coûterait', () => {
  assert.equal(COST_ITEMS.workersRequests.included, 10_000_000);
  assert.equal(COST_ITEMS.workersCpuMs.included, 30_000_000);
  assert.equal(COST_ITEMS.d1RowsRead.included, 25_000_000_000);
  assert.equal(COST_ITEMS.d1RowsWritten.included, 50_000_000);
  assert.equal(COST_ITEMS.d1StorageMb.included, 5_000);

  const calm = costView([reading()], NOW);
  assert.equal(calm.tone, 'ok');
  assert.equal(calm.missing, null);
  assert.equal(calm.headline, 'Relevé d’octobre 2026, noté le 02/11/2026.');
  assert.deepEqual(calm.items.map(({ tone }) => tone), ['ok', 'ok', 'ok', 'ok', 'ok']);
  assert.equal(plain(calm.items[0].text), '61 234 requêtes sur 10 000 000 inclus (moins de 1 %)');
  assert.equal(plain(calm.items[1].text), '18 400 000 ms sur 30 000 000 inclus (61 %)');
  assert.equal(plain(calm.items[4].text), '12,5 Mo sur 5 000 inclus (moins de 1 %)');
  assert.equal(plain(calm.bill), 'Facture : 5,00 $ ; d’après ce relevé : 5,00 $ ; estimation : ≈ 5 $ par mois jusqu’à 30 fermes (contrat, section 10).');

  const busy = costView([reading({ workersCpuMs: 25_000_000 })], NOW);
  assert.equal(busy.tone, 'warn');
  assert.equal(busy.items[1].tone, 'warn', '83 % du calcul inclus');

  const over = costView([reading({ d1RowsWritten: 60_000_000, billedUsd: null })], NOW);
  assert.equal(over.tone, 'danger');
  assert.equal(plain(over.items[3].text), '60 000 000 lignes sur 50 000 000 inclus (120 %) : dépasse, ≈ 10,00 $ en plus');
  assert.equal(estimatedBillUsd(reading({ d1RowsWritten: 60_000_000 })), 15);
  assert.match(plain(over.bill), /^Facture pas encore notée ; d’après ce relevé : 15,00 \$/);
});

test('un relevé qui manque se dit, jamais un vert : aucun relevé, ou pas celui du mois écoulé', () => {
  const none = costView([], NOW);
  assert.deepEqual({ tone: none.tone, headline: none.headline, items: none.items, bill: none.bill }, { tone: 'warn', headline: 'Aucun relevé noté.', items: [], bill: null });
  assert.equal(none.missing, 'Le relevé d’octobre 2026 n’est pas noté : copiez-le depuis le tableau de bord de Cloudflare.');

  const late = costView([reading({ month: '2026-09' }), reading({ month: '2026-08', billedUsd: null })], NOW);
  assert.equal(late.tone, 'warn', 'tout est dans l’offre, mais le mois écoulé manque');
  assert.match(late.missing ?? '', /^Le relevé d’octobre 2026 n’est pas noté/);
  assert.equal(late.headline, 'Relevé de septembre 2026, noté le 02/11/2026.');
  assert.deepEqual(late.history.map(plain), ['août 2026 : ≈ 5,00 $ d’après le relevé']);
  assert.equal(costView([reading({ month: '2026-11' })], NOW).missing, null, 'un relevé du mois en cours suffit');

  assert.equal(costReadingRecordedMessage(reading(), false), 'Le relevé d’octobre 2026 est noté.');
  assert.equal(costReadingRecordedMessage(reading({ month: '2026-11' }), true), 'Le relevé de novembre 2026 est remplacé.');
});
