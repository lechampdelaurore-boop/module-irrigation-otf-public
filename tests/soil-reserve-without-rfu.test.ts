import assert from 'node:assert/strict';
import test from 'node:test';
import { bedSoilReserve } from '../lib/domain/soil-reserve/gauge.ts';
import type { SoilGaugeBed, SoilGaugePlot } from '../lib/domain/soil-reserve/gauge-view.ts';
import { plotWithoutSoil, soilBedRows, soilGardenLines, zoneFieldWithoutSoil } from '../lib/domain/soil-reserve/garden-lines.ts';
import { soilReserveSummary } from '../lib/domain/soil-reserve/signals.ts';
import { neverObservedSoilGardens, reliabilityChecks, reliabilityLines, soilParcelAnchor, type ReliabilityInputs } from '../lib/domain/today/reliability.ts';
import { crop, cropDay, dates, observation, soilInput, soilRecord } from './support/soil-reserve-fixtures.ts';

/**
 * Audit ergonomique final, lot D, J4 : « Réserve du sol », la RFU d'abord
 * (docs/audit-ergonomie-final-lot-d-contract.md, section 6, F308 à F312,
 * D-150). Le porteur l'a tranché le 15 novembre 2026 : sans réserve utile
 * (RFU) pour la parcelle, une observation ne remplit pas la jauge, et le
 * premier geste est de la renseigner. Les parcours P18, P19, P29, P31b et
 * P33 le montrent à l'écran.
 */

const MONDAY = '2026-06-01';
const MONDAY_MIDNIGHT = '2026-05-31T22:00:00.000Z';
const TODAY = '2026-11-08';

test('une observation ne remplit pas une jauge sans RFU : chaque jour reste inconnu, faute de sol', () => {
  const days = bedSoilReserve(soilInput({
    waterDays: dates(MONDAY, 3).map((date) => cropDay(date, [crop({ etmMm: 2 })])),
    observations: [observation(100, MONDAY_MIDNIGHT), observation(50, '2026-06-02T08:00:00.000Z')],
    soilRecords: [],
  }));
  assert.equal(days.length, 3);
  for (const day of days) {
    assert.deepEqual(day.unknown, { kind: 'no-soil' });
    assert.equal(day.stateMm, null, 'jamais un zéro à la place de l’inconnue (D-003)');
    assert.equal(day.capacityMm, null, 'sans RFU, la capacité ne se calcule pas');
  }
  // La même observation, une fois la RFU saisie, fait partir la jauge.
  const withSoil = bedSoilReserve(soilInput({
    waterDays: dates(MONDAY, 3).map((date) => cropDay(date, [crop({ etmMm: 2 })])),
    observations: [observation(100, MONDAY_MIDNIGHT)],
    soilRecords: [soilRecord()],
  }));
  assert.equal(withSoil[0].unknown, null);
  assert.ok((withSoil[0].stateMm ?? 0) > 0);
});

function bed(bedId: string, reason: 'no-soil' | 'not-started' | null): SoilGaugeBed {
  const days = reason === null
    ? bedSoilReserve(soilInput({ waterDays: [cropDay(TODAY, [crop({ etmMm: 0 })])], observations: [observation(80, '2026-11-07T23:00:00.000Z')], today: TODAY }))
    : bedSoilReserve(soilInput({ waterDays: [cropDay(TODAY, [crop({ etmMm: 0 })])], soilRecords: reason === 'no-soil' ? [] : [soilRecord()], today: TODAY }));
  return { bedId, name: bedId, summary: soilReserveSummary(days, TODAY), today: days[0] ?? null, week: [] };
}

function plot(plotId: string, beds: SoilGaugeBed[], options: { sheltered?: boolean; observed?: boolean } = {}): SoilGaugePlot {
  const known = beds.filter((item) => item.summary.current !== null).length;
  return {
    plotId,
    name: plotId,
    sheltered: options.sheltered ?? false,
    garden: { percent: known > 0 ? 80 : null, lowest: null, countedBeds: known, unknownBeds: beds.length - known, withoutCrop: [] },
    week: [],
    observation: options.observed ? observation(50, '2026-11-07T08:00:00.000Z', plotId, 'z1') : null,
    beds,
  };
}

const twelve = (reason: 'no-soil' | 'not-started') => Array.from({ length: 12 }, (_, index) => bed(`P${index + 1}`, reason));

test('cas 7 : une ligne sans RFU porte « Renseigner la réserve de la parcelle », jamais « Observer » (F308)', () => {
  const withoutSoil = plot('Jardin Nord', twelve('no-soil'));
  const notStarted = plot('Tunnel 1', twelve('not-started'), { sheltered: true });
  const known = plot('Jardin Sud', [bed('S1', null)]);
  assert.equal(plotWithoutSoil(withoutSoil), true);
  assert.equal(plotWithoutSoil(notStarted), false, 'avec sa RFU, une jauge pas encore partie s’observe');
  const lines = soilGardenLines({ plots: [withoutSoil, notStarted, known], fieldPlotCount: 2 }, TODAY);
  assert.deepEqual(lines.map((line) => line.kind === 'plot' && [line.plot.plotId, line.action]), [
    ['Jardin Nord', 'soil'],
    ['Tunnel 1', 'observe'],
    ['Jardin Sud', null],
  ]);
  // L'observation de la parcelle ne règle que ses jardins de plein champ : sans RFU pour eux, elle ne réglerait rien.
  assert.equal(zoneFieldWithoutSoil({ plots: [withoutSoil, notStarted] }), true);
  assert.equal(zoneFieldWithoutSoil({ plots: [withoutSoil, known] }), false);
  assert.equal(zoneFieldWithoutSoil({ plots: [notStarted] }), false, 'une parcelle sans jardin de plein champ n’a rien à dire');
});

test('cas 8 : douze planches de même état se disent en une phrase, leurs lignes dans un pli (F310)', () => {
  const rows = soilBedRows(twelve('no-soil'));
  assert.equal(rows.single.length, 0);
  assert.deepEqual(rows.groups.map((group) => [group.text, group.beds.length]), [['12 planches : inconnue, aucune RFU saisie', 12]]);
  const waiting = soilBedRows(twelve('not-started'));
  assert.match(waiting.groups[0].text, /^12 planches : inconnue, pas encore de départ\. Réglez le curseur/);
  assert.doesNotMatch(waiting.groups[0].text, /\.$/);
  // Une planche connue, ou seule de son état, garde sa ligne.
  const mixed = soilBedRows([bed('A', null), bed('B', 'not-started'), bed('C', 'no-soil'), bed('D', 'no-soil')]);
  assert.deepEqual(mixed.single.map((item) => item.bedId), ['A', 'B']);
  assert.deepEqual(mixed.groups.map((group) => group.beds.map((item) => item.bedId)), [['C', 'D']]);
});

const FRESH: ReliabilityInputs = {
  enabled: ['sol'],
  now: new Date('2026-11-08T08:00:00.000Z'),
  reservoirs: [],
  actualRainMissingDates: [],
  soilGardensNeverObserved: [],
  speciesWithoutReference: [],
  planComputedAt: '2026-11-08T07:00:00.000Z',
};

test('« Aujourd’hui » : « Observer le sol de … » seulement avec la RFU ; sinon « Renseigner la réserve de la parcelle … » (F309)', () => {
  const zones = [
    { zoneId: 'z1', name: 'Les Prés', plots: [plot('Jardin Nord', twelve('no-soil'), { observed: true }), plot('Jardin Est', twelve('no-soil')), plot('Tunnel 1', twelve('not-started'), { sheltered: true })] },
    { zoneId: 'z2', name: 'Sous le verger', plots: [plot('Verger', twelve('no-soil'))] },
  ];
  const gardens = neverObservedSoilGardens(zones);
  // Un jardin observé sans RFU compte encore : l'observation n'y a rien rempli.
  assert.deepEqual(gardens.map((garden) => [garden.name, garden.withoutRfu?.zoneName ?? null]), [
    ['Jardin Nord', 'Les Prés'],
    ['Jardin Est', 'Les Prés'],
    ['Tunnel 1', null],
    ['Verger', 'Sous le verger'],
  ]);
  const lines = reliabilityLines({ ...FRESH, soilGardensNeverObserved: gardens });
  assert.deepEqual(lines.map((line) => [line.key, line.text, line.action]), [
    ['soil', 'Le sol du jardin Tunnel 1 n’a jamais été observé.', { kind: 'link', label: 'Observer le sol de Tunnel 1', page: 'sol', anchor: 'soil-garden-Tunnel 1' }],
    [
      'soil-rfu',
      'Ce que le sol de 2 parcelles retient (leur RFU) n’est pas saisi : Les Prés, Sous le verger. La réserve du sol de leurs jardins reste inconnue.',
      { kind: 'link', label: 'Renseigner la réserve de la parcelle Les Prés', page: 'sol', anchor: 'soil-parcel-z1' },
    ],
  ]);
  const one = reliabilityLines({ ...FRESH, soilGardensNeverObserved: gardens.filter((garden) => garden.withoutRfu?.zoneId === 'z1') });
  assert.deepEqual(one.map((line) => line.text), ['Ce que le sol de la parcelle Les Prés retient (sa RFU) n’est pas saisi : la réserve du sol de ses 2 jardins reste inconnue.']);
  const [check] = reliabilityChecks({ ...FRESH, soilGardensNeverObserved: gardens }, lines);
  assert.equal(check.summary, '1 jardin jamais observé · 2 parcelles sans RFU');
  assert.equal(soilParcelAnchor('z1'), 'soil-parcel-z1');
});
