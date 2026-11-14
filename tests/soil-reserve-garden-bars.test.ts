import assert from 'node:assert/strict';
import test from 'node:test';
import { SOIL_BAR_MARKS, soilBarPosition, soilGardenBars } from '../lib/domain/soil-reserve/garden-bars.ts';
import type { SoilReserveDay } from '../lib/domain/soil-reserve/gauge.ts';
import type { SoilGaugeBed, SoilGaugePlot } from '../lib/domain/soil-reserve/gauge-view.ts';
import type { SoilReserveSummary } from '../lib/domain/soil-reserve/signals.ts';

/**
 * Le graphique des réserves du sol, variante B (docs/soil-reserve-contract.md,
 * « La vue d'ensemble par jardin », S2, D-109) : un test par règle
 * d'affichage. Aucun calcul : le module range ce que la jauge a déjà calculé,
 * et ces tests lui donnent des jardins et des planches tout faits.
 */

const SUNDAY = '2026-11-15';

function bed(name: string, options: {
  percent: number | null;
  mode?: SoilReserveDay['mode'];
  surfaceState?: SoilReserveDay['surfaceState'];
  advisedDoseMm?: number | null;
  irrigationStop?: boolean;
}): SoilGaugeBed {
  const capacityMm = 40;
  const summary = {
    current: options.percent === null ? null : { mm: capacityMm * options.percent / 100, percent: options.percent, capacityMm, thresholdMm: 10, observedAt: null },
    advisedDoseMm: options.advisedDoseMm ?? null,
    irrigationStop: options.irrigationStop ?? false,
  } as SoilReserveSummary;
  const today = { mode: options.mode === undefined ? 'crop' : options.mode, surfaceState: options.surfaceState ?? null } as SoilReserveDay;
  return { bedId: `bed-${name}`, name, summary, today, week: [] };
}

function plot(name: string, options: {
  percent: number | null;
  sheltered?: boolean;
  sunday?: number | null;
  beds?: SoilGaugeBed[];
  countedBeds?: number;
  unknownBeds?: number;
}): SoilGaugePlot {
  const beds = options.beds ?? [];
  return {
    plotId: `plot-${name}`,
    name,
    sheltered: options.sheltered ?? false,
    garden: {
      percent: options.percent,
      lowest: null,
      countedBeds: options.countedBeds ?? (options.percent === null ? 0 : beds.length),
      unknownBeds: options.unknownBeds ?? 0,
      withoutCrop: [],
    },
    week: options.sunday === undefined ? [] : [{ date: '2026-11-14', percent: 60 }, { date: SUNDAY, percent: options.sunday }],
    observation: null,
    beds,
  };
}

test('une barre par jardin ou abri, dans l’ordre de la page, remplie au % du plein du jardin maintenant', () => {
  const bars = soilGardenBars({
    plots: [
      plot('Jardin 2', { percent: 47.4, sunday: 27.2, beds: [bed('P1', { percent: 55 }), bed('P2', { percent: 40 })] }),
      plot('Jardin 1', { percent: 68, sunday: 43, beds: [bed('Q1', { percent: 68 })] }),
    ],
  });
  assert.deepEqual(bars.map((bar) => bar.name), ['Jardin 2', 'Jardin 1']);
  assert.equal(bars[0].kind, 'known');
  assert.equal(bars[0].percent, 47.4);
  assert.equal(bars[0].sundayPercent, 27.2);
  assert.deepEqual(bars[0].beds.map((point) => [point.name, point.percent, point.low]), [['P1', 55, false], ['P2', 40, false]]);
  assert.equal(bars[0].label, 'Jardin 2 : 47 % du plein maintenant, 27 % prévu dimanche');
});

test('inconnue : des planches cultivées, aucune connue, une barre vide sans chiffre ni point, jamais zéro (D-003)', () => {
  const [bar] = soilGardenBars({ plots: [plot('Tunnel 2', { percent: null, sheltered: true, sunday: 12, unknownBeds: 3, beds: [bed('T1', { percent: null })] })] });
  assert.equal(bar.kind, 'unknown');
  assert.equal(bar.percent, null);
  assert.equal(bar.sundayPercent, null, 'pas de trait du prévu sur une barre inconnue');
  assert.deepEqual(bar.beds, []);
  assert.equal(bar.lowCount, 0);
  assert.equal(bar.label, 'Tunnel 2, abri : réserve inconnue');
  assert.doesNotMatch(bar.label, /0 %/);
});

test('abri : la barre le dit, et son texte aussi', () => {
  const [field, shelter] = soilGardenBars({
    plots: [
      plot('Jardin Nord', { percent: 50, beds: [bed('N01', { percent: 50 })] }),
      plot('Tunnel 1', { percent: 39, sheltered: true, sunday: 14, beds: [bed('T01', { percent: 39 })] }),
    ],
  });
  assert.equal(field.sheltered, false);
  assert.equal(shelter.sheltered, true);
  assert.equal(shelter.label, 'Tunnel 1, abri : 39 % du plein maintenant, 14 % prévu dimanche');
});

test('sous le seuil : le point est orange quand la dose conseillée s’affiche, et la barre compte ses points orange', () => {
  const [bar] = soilGardenBars({
    plots: [plot('Jardin 2', {
      percent: 47,
      sunday: 27,
      beds: [
        bed('P1', { percent: 55 }),
        bed('P2', { percent: 22, advisedDoseMm: 31.2 }),
        bed('P3', { percent: 24, advisedDoseMm: 30.4 }),
      ],
    })],
  });
  assert.deepEqual(bar.beds.map((point) => point.low), [false, true, true]);
  assert.equal(bar.lowCount, 2);
  assert.equal(bar.label, 'Jardin 2 : 47 % du plein maintenant, 27 % prévu dimanche, 2 planches sous le seuil');
  const [single] = soilGardenBars({ plots: [plot('Jardin 3', { percent: 30, beds: [bed('R1', { percent: 20, advisedDoseMm: 32 })] })] });
  assert.equal(single.label, 'Jardin 3 : 30 % du plein maintenant, 1 planche sous le seuil');
});

test('arrêt avant récolte : la planche garde un point bleu, même sous son seuil, pour ne pas inviter à l’arroser', () => {
  const [bar] = soilGardenBars({
    plots: [plot('Jardin 4', { percent: 20, beds: [bed('A1', { percent: 15, irrigationStop: true, advisedDoseMm: null }), bed('A2', { percent: 15, irrigationStop: true, advisedDoseMm: 34 })] })],
  });
  assert.deepEqual(bar.beds.map((point) => point.low), [false, false]);
  assert.equal(bar.lowCount, 0);
  assert.doesNotMatch(bar.label, /sous le seuil/);
});

test('sans planche cultivée : pas de barre, « aucune planche cultivée »', () => {
  const [bar] = soilGardenBars({ plots: [plot('Jardin du verger', { percent: null, countedBeds: 0, unknownBeds: 0, beds: [bed('V01', { percent: 60, mode: 'bare', surfaceState: 'bare' })] })] });
  assert.equal(bar.kind, 'no-crop');
  assert.equal(bar.percent, null);
  assert.deepEqual(bar.beds, []);
  assert.equal(bar.label, 'Jardin du verger : aucune planche cultivée');
});

test('les points sont les planches comptées dans le % du jardin : ni les planches sans culture, ni les inconnues ; l’engrais vert, oui', () => {
  const [bar] = soilGardenBars({
    plots: [plot('Jardin 5', {
      percent: 50,
      beds: [
        bed('B1', { percent: 50 }),
        bed('B2', { percent: 70, mode: 'bare', surfaceState: 'bare' }),
        bed('B3', { percent: 80, mode: 'bare', surfaceState: 'impermeable-tarp' }),
        bed('B4', { percent: 45, mode: 'cover', surfaceState: 'green-manure-full' }),
        bed('B5', { percent: 90, mode: 'cover', surfaceState: 'grass' }),
        bed('B6', { percent: null }),
        bed('B7', { percent: 40, mode: null }),
      ],
    })],
  });
  assert.deepEqual(bar.beds.map((point) => point.name), ['B1', 'B4']);
});

test('prévu absent : sans prévu de dimanche connu, le texte n’en parle pas et rien ne se dessine', () => {
  const [unknownSunday, noWeek] = soilGardenBars({
    plots: [
      plot('Jardin 6', { percent: 50, sunday: null, beds: [bed('C1', { percent: 50 })] }),
      plot('Jardin 7', { percent: 50, beds: [bed('D1', { percent: 50 })] }),
    ],
  });
  for (const bar of [unknownSunday, noWeek]) {
    assert.equal(bar.sundayPercent, null);
    assert.equal(bar.label, `${bar.name} : 50 % du plein maintenant`);
  }
});

test('la place sur la barre reste entre 0 et 100 ; les repères sont les crans du curseur', () => {
  assert.equal(soilBarPosition(-3), 0);
  assert.equal(soilBarPosition(47.5), 47.5);
  assert.equal(soilBarPosition(104), 100);
  assert.deepEqual(SOIL_BAR_MARKS.map((mark) => (mark.word ? `${mark.word} ${mark.value}` : mark.value)), ['0 %', 'sec 25', 'frais 50', 'humide 75', '100 %']);
  assert.deepEqual(SOIL_BAR_MARKS.map((mark) => mark.percent), [0, 25, 50, 75, 100]);
});
