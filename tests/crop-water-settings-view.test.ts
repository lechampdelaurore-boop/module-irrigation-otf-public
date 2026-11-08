import assert from 'node:assert/strict';
import test from 'node:test';
import type { Bed, Plot } from '../lib/domain/domain.ts';
import type { KcOverride } from '../lib/domain/crop-water/kc.ts';
import type { ReferenceCrop } from '../lib/domain/crop-water/reference.ts';
import { cropWaterSettingsView, kcOverrideRows, overrideTargetKey, overrideTargetOfKey } from '../lib/domain/crop-water/settings-view.ts';

/**
 * Les surcharges de Kc et les réglages tels que la page « Coefficients
 * culturaux » les montre (5 quater, PR 3c) : la valeur de la source reste
 * lisible ; la valeur qui compte aujourd'hui suit la même règle que le
 * calcul (le jour le plus tardif, puis l'enregistrement le plus récent) ; une
 * révision à venir est montrée sans compter.
 */

const steps: ReferenceCrop = {
  id: 'criiam-tomate',
  name: 'Tomate',
  source: 'criiam',
  curve: {
    shape: 'steps',
    stages: [
      { rank: 1, label: 'Plantation → Reprise', kc: 0.2 },
      { rank: 2, label: 'Reprise → Floraison', kc: 0.5 },
    ],
    sets: [],
  },
} as unknown as ReferenceCrop;

const trapezoid: ReferenceCrop = {
  id: 'fao-cruciferes',
  name: 'Crucifères (choux)',
  source: 'fao56',
  curve: { shape: 'trapezoid', kcInitial: 0.7, kcMid: 1.05, kcEnd: 0.95, sets: [], abatement: 1 },
} as unknown as ReferenceCrop;

const override = (target: KcOverride['target'], kc: number | null, effectiveFrom: string, recordedAt: string, referenceCropId = 'criiam-tomate'): KcOverride =>
  ({ referenceCropId, target, kc, effectiveFrom, recordedAt });

test('une clé de valeur surchargeable se lit dans les deux sens, et une clé inconnue est refusée', () => {
  assert.equal(overrideTargetKey({ rank: 2 }), 'rank:2');
  assert.equal(overrideTargetKey({ fao: 'mid' }), 'fao:mid');
  assert.deepEqual(overrideTargetOfKey('rank:2'), { rank: 2 });
  assert.deepEqual(overrideTargetOfKey('fao:end'), { fao: 'end' });
  assert.equal(overrideTargetOfKey('fao:debut'), null);
  assert.equal(overrideTargetOfKey('rank:'), null);
  assert.equal(overrideTargetOfKey(''), null);
});

test('chaque stade d’un escalier se surcharge ; la valeur du jour suit la règle du calcul, une révision à venir ne compte pas encore', () => {
  const overrides = [
    override({ rank: 2 }, 0.6, '2026-06-01', '2026-06-01T08:00:00.000Z'),
    override({ rank: 2 }, 0.65, '2026-06-01', '2026-06-02T08:00:00.000Z'),
    override({ rank: 2 }, 0.7, '2026-12-01', '2026-11-06T08:00:00.000Z'),
    // Une autre culture n'entre pas dans les lignes de la tomate.
    override({ rank: 2 }, 0.9, '2026-01-01', '2026-01-01T08:00:00.000Z', 'criiam-melon'),
  ];
  const rows = kcOverrideRows(steps, overrides, '2026-11-06');
  assert.deepEqual(rows.map((row) => [row.key, row.label, row.sourceKc, row.inForce?.kc ?? null, row.history.length]), [
    ['rank:1', 'Plantation → Reprise', 0.2, null, 0],
    ['rank:2', 'Reprise → Floraison', 0.5, 0.65, 3],
  ]);
  assert.deepEqual(rows[1]!.history.map((item) => item.kc), [0.7, 0.65, 0.6]);
});

test('un retour à la valeur de la source compte comme une révision : la valeur de la ferme cesse de compter', () => {
  const rows = kcOverrideRows(steps, [
    override({ rank: 1 }, 0.3, '2026-05-01', '2026-05-01T08:00:00.000Z'),
    override({ rank: 1 }, null, '2026-07-01', '2026-07-01T08:00:00.000Z'),
  ], '2026-11-06');
  assert.equal(rows[0]!.inForce?.kc, null);
  assert.equal(rows[0]!.history.length, 2);
});

test('une culture de la FAO se surcharge par ses trois Kc, la valeur de la source avant abattement', () => {
  const rows = kcOverrideRows(trapezoid, [override({ fao: 'mid' }, 0.95, '2026-04-01', '2026-04-01T08:00:00.000Z', 'fao-cruciferes')], '2026-11-06');
  assert.deepEqual(rows.map((row) => [row.key, row.label, row.sourceKc, row.inForce?.kc ?? null]), [
    ['fao:initial', 'Kc début', 0.7, null],
    ['fao:mid', 'Kc pleine saison', 1.05, 0.95],
    ['fao:end', 'Kc fin', 0.95, null],
  ]);
});

const plot = (id: string, name: string, mode: Plot['mode'], seasons = [2026]): Plot =>
  ({ id, zoneId: 'z', name, mode, length: 10, width: 5, area: 50, seasons });
const bed = (id: string, plotId: string, name: string, seasons = [2026]): Bed =>
  ({ id, zoneId: 'z', plotId, name, length: 10, width: 1, alleyWidth: null, area: 10, seasons });

test('les réglages d’une saison : un abri par jardin sous abri, à 0,8 tant que rien n’est réglé, et les planches avec paillage et filets', () => {
  const view = cropWaterSettingsView({
    plots: [plot('tunnel', 'Tunnel 1', 'greenhouse'), plot('nord', 'Jardin Nord', 'garden'), plot('vieux', 'Vieux tunnel', 'greenhouse', [2025])],
    beds: [bed('t1', 'tunnel', 'T01'), bed('n1', 'nord', 'N01'), bed('n9', 'nord', 'N09', [2025])],
    settings: {
      shelterFactors: [],
      mulch: [{ bedId: 'n1', season: 2026, plasticMulch: true }, { bedId: 't1', season: 2025, plasticMulch: true }],
      shadeNets: [{ id: 'f1', bedId: 'n1', rate: 0.25, from: '2026-06-01', to: null }],
      options: { smoothing: false, shading: true },
    },
    season: 2026,
    today: '2026-11-06',
  });
  assert.deepEqual(view.shelters.map((shelter) => [shelter.name, shelter.factor, shelter.isDefault]), [['Tunnel 1', 0.8, true]]);
  assert.deepEqual(view.beds.map((item) => [item.name, item.plotName, item.sheltered, item.plasticMulch, item.nets.length]), [
    ['T01', 'Tunnel 1', true, false, 0],
    ['N01', 'Jardin Nord', false, true, 1],
  ]);
  assert.deepEqual(view.options, { smoothing: false, shading: true });
});

test('le K_abri du jour est la dernière révision valable ; une révision à venir est montrée sans compter', () => {
  const view = cropWaterSettingsView({
    plots: [plot('tunnel', 'Tunnel 1', 'greenhouse')],
    beds: [],
    settings: {
      shelterFactors: [
        { shelterId: 'tunnel', value: 0.7, effectiveFrom: '2026-05-01', recordedAt: '2026-05-01T08:00:00.000Z' },
        { shelterId: 'tunnel', value: 0.9, effectiveFrom: '2027-01-01', recordedAt: '2026-11-06T08:00:00.000Z' },
      ],
      mulch: [],
      shadeNets: [],
      options: { smoothing: false, shading: false },
    },
    season: 2026,
    today: '2026-11-06',
  });
  assert.deepEqual(view.shelters.map((shelter) => [shelter.factor, shelter.isDefault, shelter.history.map((item) => item.value)]), [[0.7, false, [0.9, 0.7]]]);
});
