import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import { compareBed, COMPARED_DAYS_PER_MORNING, dayGaps, emptyGaugeComparison, otherGaugeEngine } from '../lib/domain/soil-reserve/gauge-comparison.ts';
import { GAUGE_ENGINE } from '../lib/domain/soil-reserve/gauge-switch.ts';
import { bedSoilReserve, dayBounds, type BedSoilInput, type SoilReserveDay } from '../lib/domain/soil-reserve/gauge.ts';
import { VERSION_MOTEUR } from '../lib/domain/soil-reserve/shared-engine/moteur-hydrique.mjs';
import { SHARED_ENGINE_COPY } from '../lib/domain/soil-reserve/shared-engine/version.ts';
import { bareDay, crop, cropDay, dates, declaration, dryDays, observation, soilInput, soilRecord } from './support/soil-reserve-fixtures.ts';
import { compareEnginesOnDrawnBeds } from './support/soil-reserve-draw.ts';

/**
 * Le branchement de la jauge sur le moteur hydrique commun
 * (docs/shared-engine-adapter-contract.md) : l'interrupteur, l'égalité des
 * deux calculs sur des planches tirées au hasard, les passages entre tronçons,
 * le sol qui ne retient rien, la consommation impossible d'un couvert et la
 * comparaison du matin, qui ne garde que des nombres.
 */

/** L'égalité des tests : les deux calculs ne diffèrent que d'arrondis de l'ordre de 1e-14 mm. */
const TOLERANCE = 1e-6;
const D1 = '2026-06-01';
const at = (date: string, hours: number) => new Date(dayBounds(date).from + hours * 3_600_000).toISOString();

function bothEngines(input: BedSoilInput): { module: SoilReserveDay[]; commun: SoilReserveDay[] } {
  return { module: bedSoilReserve(input, 'module'), commun: bedSoilReserve(input, 'commun') };
}

function assertSameDays(module: readonly SoilReserveDay[], commun: readonly SoilReserveDay[]): void {
  assert.equal(commun.length, module.length);
  module.forEach((day, index) => {
    const { gaps } = dayGaps(day, commun[index], TOLERANCE);
    assert.deepEqual(gaps, [], `${day.date} : ${JSON.stringify(gaps)}`);
  });
}

const ENGINE_FOLDER = new URL('../lib/domain/soil-reserve/shared-engine/', import.meta.url);

test('la copie figée du moteur commun : chaque fichier a l’empreinte du manifeste, et aucun autre fichier n’est là', () => {
  for (const [file, fingerprint] of Object.entries(SHARED_ENGINE_COPY.files)) {
    assert.equal(createHash('sha256').update(readFileSync(new URL(file, ENGINE_FOLDER))).digest('hex'), fingerprint, file);
  }
  const folder = fileURLToPath(ENGINE_FOLDER);
  const present = readdirSync(folder, { recursive: true, withFileTypes: true })
    .filter((entry) => entry.isFile())
    .map((entry) => path.relative(folder, path.join(entry.parentPath, entry.name)).split(path.sep).join('/'));
  assert.deepEqual(present.sort(), [...Object.keys(SHARED_ENGINE_COPY.files), 'version.ts'].sort());
});

test('la copie figée du moteur commun : la version du manifeste est celle du moteur et de chaque en-tête, le commit est entier', () => {
  assert.equal(VERSION_MOTEUR, SHARED_ENGINE_COPY.version);
  assert.match(SHARED_ENGINE_COPY.commit, /^[0-9a-f]{40}$/);
  for (const file of Object.keys(SHARED_ENGINE_COPY.files).filter((name) => name !== 'NOTICE')) {
    const banner = `/* Moteur hydrique commun (OTF et Tlaloc) v${SHARED_ENGINE_COPY.version}. Licence PolyForm Shield 1.0.0 (LICENSE, NOTICE).`;
    assert.ok(readFileSync(new URL(file, ENGINE_FOLDER), 'utf8').startsWith(banner), `${file} : en-tête de version et de licence`);
  }
  assert.match(readFileSync(new URL('NOTICE', ENGINE_FOLDER), 'utf8'), /^Required Notice: /m);
});

test('l’interrupteur : le moteur commun en ligne, l’ancien calcul au second passage des tests', () => {
  assert.equal(GAUGE_ENGINE, process.env.JAUGE_MOTEUR_ATTENDU ?? 'commun');
  assert.equal(otherGaugeEngine('module'), 'commun');
  assert.equal(otherGaugeEngine('commun'), 'module');
});

test('les deux calculs rendent les mêmes jours, chaque grandeur à 0,000001 mm près, sur des planches tirées au hasard', () => {
  const seen: Record<string, number> = {};
  for (const seed of [1, 2]) {
    const result = compareEnginesOnDrawnBeds(seed, 300, TOLERANCE);
    assert.deepEqual(result.gaps.slice(0, 10), [], `graine ${seed} : ${result.gaps.length} écarts`);
    assert.ok(result.maxGap < TOLERANCE);
    for (const [what, count] of Object.entries(result.seen)) seen[what] = (seen[what] ?? 0) + count;
  }
  // Chaque cas est joué : sans lui, l'égalité ne prouverait rien.
  for (const what of [
    'jours en mode crop', 'jours en mode cover', 'jours en mode bare', 'jours sans sol', 'jours connus',
    'jours inconnus : not-started', 'jours inconnus : missing-rain', 'jours inconnus : missing-et0',
    'jours inconnus : crop-without-etm', 'jours inconnus : blocked', 'jours inconnus : no-soil',
    'départs : observation', 'départs : inflow', 'jours prévus', 'planches sous abri', 'jours de changement d’heure',
    'passages du sol nu à un compartiment', 'passages d’un compartiment au sol nu', 'changements de capacité dans un tronçon',
  ]) assert.ok((seen[what] ?? 0) > 0, `jamais joué : ${what}`);
});

test('les passages culture, sol nu, engrais vert puis culture gardent le % du plein, comme avant', () => {
  const days = dates(D1, 8);
  const waterDays = days.map((date, index) => (index < 2 || index >= 6 ? cropDay(date, [crop({ etmMm: 3 })]) : bareDay(date, 4)));
  const { module, commun } = bothEngines(soilInput({
    waterDays,
    observations: [observation(80, at(D1, 6))],
    surfaceDeclarations: [declaration(days[2], 'bare'), declaration(days[4], 'green-manure-full')],
  }));
  assertSameDays(module, commun);
  assert.deepEqual(commun.map((day) => day.mode), ['crop', 'crop', 'bare', 'bare', 'cover', 'cover', 'crop', 'crop']);
  assert.ok(commun.every((day) => day.stateMm !== null), 'la jauge reste connue d’un bout à l’autre');
  // Du sol nu à l'engrais vert, à 30 cm tous deux, l'état passe tel quel ; de l'engrais vert à la culture, à 50 cm, le % du plein reste.
  assert.equal(commun[4].capacityMm, commun[3].capacityMm);
  assert.ok(Math.abs(commun[4].startMm! - commun[3].stateMm!) < 1e-12);
  assert.ok(commun[6].capacityMm! > commun[5].capacityMm!);
  assert.ok(Math.abs(commun[6].startMm! / commun[6].capacityMm! - commun[5].stateMm! / commun[5].capacityMm!) < 1e-12);
});

test('un sol qui ne retient rien (0 mm/m) vaut un sol absent avec le moteur commun, le seul chiffre qui change', () => {
  const days = dates(D1, 3);
  const input = soilInput({
    waterDays: days.map((date) => cropDay(date, [crop({ etmMm: 2 })])),
    rain: new Map([[days[0], { mm: 0, nature: 'gauge' }], [days[1], { mm: 12, nature: 'gauge' }], [days[2], { mm: 0, nature: 'gauge' }]]),
    // 0,4 mm/m au laboratoire, arrondi à 0 mm/m : une faute de saisie.
    soilRecords: [soilRecord({ labRfuMmPerMeter: 0.4 })],
    observations: [observation(50, at(D1, 6))],
  });
  const { module, commun } = bothEngines(input);
  // Avant : un état de 0 mm, un % du plein inconnu et tout l'apport compté en drainage.
  assert.deepEqual(module.map((day) => [day.capacityMm, day.stateMm, day.percent]), [[0, 0, null], [0, 0, null], [0, 0, null]]);
  assert.equal(module[1].drainageMm, 10);
  // Avec le moteur : « Inconnue : aucune RFU saisie pour sa parcelle ».
  for (const day of commun) {
    assert.deepEqual([day.mode, day.capacityMm, day.stateMm, day.drainageMm, day.unknown], [null, null, null, 0, { kind: 'no-soil' }]);
  }
});

test('un sol sans réserve au milieu des jours coupe le suivi : le tronçon suivant part inconnu, « pas encore de départ »', () => {
  const days = dates(D1, 5);
  const { commun } = bothEngines(soilInput({
    waterDays: days.map((date) => cropDay(date, [crop({ etmMm: 2 })])),
    soilRecords: [
      soilRecord(),
      soilRecord({ labRfuMmPerMeter: 0.4, effectiveFrom: days[2], recordedAt: `${days[2]}T08:00:00.000Z` }),
      soilRecord({ effectiveFrom: days[3], recordedAt: `${days[3]}T08:00:00.000Z` }),
    ],
    observations: [observation(50, at(D1, 6)), observation(60, at(days[4], 12))],
  }));
  assert.deepEqual(commun.map((day) => day.stateMm === null), [false, false, true, true, false]);
  assert.deepEqual(commun[2].unknown, { kind: 'no-soil' });
  assert.deepEqual(commun[3].unknown, { kind: 'not-started' });
  assert.equal(commun[4].restart, 'observation');
});

test('une consommation impossible sous un couvert (ET0 négative) rend le jour inconnu au lieu d’un nombre faux', () => {
  const days = dates(D1, 3);
  const input = soilInput({
    waterDays: [bareDay(days[0], 4), bareDay(days[1], -1), bareDay(days[2], 4)],
    rain: dryDays(days),
    observations: [observation(50, at(D1, 6))],
    surfaceDeclarations: [declaration(D1, 'green-manure-full')],
  });
  const { module, commun } = bothEngines(input);
  // L'ancien calcul comptait une consommation négative : la jauge montait sans eau.
  assert.ok(module[1].stateMm! > module[0].stateMm!);
  assert.equal(commun[0].stateMm, module[0].stateMm);
  assert.deepEqual([commun[1].stateMm, commun[1].unknown], [null, { kind: 'missing-et0', date: days[1] }]);
  assert.deepEqual([commun[2].stateMm, commun[2].unknown], [null, { kind: 'missing-et0', date: days[1] }]);
});

test('la comparaison du matin ne garde que des nombres et des noms de grandeurs', () => {
  const days = dates(D1, 4);
  const computed = bedSoilReserve(soilInput({
    waterDays: days.map((date) => cropDay(date, [crop({ etmMm: 2 })])),
    observations: [observation(50, at(days[1], 6))],
  }), 'module');
  const known = computed.filter((day) => day.stateMm !== null).length;
  assert.equal(known, 3);

  const tally = emptyGaugeComparison();
  compareBed(tally, computed, () => computed);
  assert.deepEqual(tally, { beds: 1, days: 4, daysWithGap: 0, gapsByField: {}, maxGap: 0, failures: 0, firstFailure: null, skippedBeds: 0 });

  // Un écart sous 0,01 mm se mesure sans compter ; au-delà, il compte par grandeur.
  compareBed(tally, computed, () => computed.map((day) => ({ ...day, drainageMm: day.drainageMm + 0.004 })));
  assert.equal(tally.daysWithGap, 0);
  compareBed(tally, computed, () => computed.map((day) => (day.stateMm === null ? day : { ...day, stateMm: day.stateMm + 0.02, bare: null })));
  assert.equal(tally.daysWithGap, known);
  assert.ok(Math.abs(tally.maxGap - 0.02) < 1e-9);
  compareBed(tally, computed, () => computed.slice(0, -1));
  assert.deepEqual(tally.gapsByField, { stateMm: known, days: 1 });

  // L'échec de l'autre calcul est compté, jamais levé ; sa raison garde sa forme, les dates masquées.
  compareBed(tally, computed, () => {
    throw new RangeError('2026-06-02 : etc_mm null ou ≥ 0');
  });
  compareBed(tally, computed, () => {
    throw new Error('une autre');
  });
  assert.deepEqual([tally.beds, tally.failures, tally.firstFailure], [4, 2, 'RangeError : AAAA-MM-JJ : etc_mm null ou ≥ 0']);
  assert.doesNotMatch(JSON.stringify(tally), /\d{4}-\d{2}-\d{2}|planche|parcelle|jardin/);

  // La limite du matin atteinte, la planche est comptée sans que l'autre calcul tourne.
  tally.days = COMPARED_DAYS_PER_MORNING - 1;
  compareBed(tally, computed, () => computed);
  let replayed = false;
  compareBed(tally, computed, () => {
    replayed = true;
    return computed;
  });
  assert.deepEqual([replayed, tally.beds, tally.days, tally.skippedBeds], [false, 5, COMPARED_DAYS_PER_MORNING + 3, 1]);
});
