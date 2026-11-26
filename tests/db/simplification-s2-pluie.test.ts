import assert from 'node:assert/strict';
import test, { afterEach, beforeEach } from 'node:test';
import { deleteManualRainfallForUser, saveManualRainfallForUser, upsertWeatherDailyValuesForUser } from '../../db/water-management-repository';
import type { IrrigationSnapshot } from '../../lib/domain/domain';
import { FEATURE_IDS } from '../../lib/domain/features/catalogue';
import { manualRainfallRefusal, rainAlreadyText, rainButton, readRainMm, type RainEntryDay } from '../../lib/domain/today/rain-entry';
import { weatherLocationKey } from '../../lib/domain/weather/location';
import { getTodayViewForUser } from '../../lib/services/today-service';
import { readWeatherPreference } from '../../lib/services/weather-preference';
import { installTestDatabase, type TestDatabase } from '../support/d1-sqlite';
import { FIXTURE_PLOT_ID, FIXTURE_ZONE_ID } from '../support/irrigation-fixtures';
import { ALICE, BOB } from '../support/spaces';

/**
 * Simplifier l'usage du module, lot S2, PR 4 : « Noter la pluie », lue et
 * écrite sur la vraie base, à deux fermes (docs/simplification-s2-contract.md,
 * section 7). L'écriture est celle d'« Objectifs et besoins »
 * (`saveManualRainfallForUser`, derrière `saveManualRainfallAction`) ; la
 * fenêtre relit la mesure déjà notée par la page « Aujourd'hui ». Une ferme ne
 * voit jamais la pluie d'une autre.
 */

/** Le jeudi 12 novembre 2026, 6 h à la ferme : hier est le 11. */
const NOW = new Date('2026-11-12T05:00:00.000Z');
const ALL = [...FEATURE_IDS];

let database: TestDatabase;
beforeEach(() => {
  database = installTestDatabase();
});
afterEach(() => {
  database.dispose();
});

function snapshot(mode: 'garden' | 'greenhouse' = 'garden'): IrrigationSnapshot {
  return {
    configuration: { seasonFirst: 2025, seasonLast: 2026 },
    structure: { id: '17', name: 'Ferme', legalCity: 'Rennes', legalPostcode: '35000', legalCountry: 'FR' },
    zones: [{ id: FIXTURE_ZONE_ID, name: 'Zone', area: 1000, seasons: [2026] }],
    plots: [{ id: FIXTURE_PLOT_ID, zoneId: FIXTURE_ZONE_ID, name: 'Jardin', mode, length: 40, width: 30, area: 1200, seasons: [2026] }],
    beds: [{ id: 'bed-1', zoneId: FIXTURE_ZONE_ID, plotId: FIXTURE_PLOT_ID, name: 'P1', length: 40, width: 0.75, alleyWidth: 0.45, area: 30, seasons: [2026] }],
    source: 'cache',
    lastSuccessfulReadAt: '2026-11-11T00:00:00.000Z',
  };
}

async function rainOf(owner: string, options: { mode?: 'garden' | 'greenhouse'; enabled?: typeof ALL } = {}) {
  const view = await getTodayViewForUser({ ownerUserId: owner, season: 2026, snapshot: snapshot(options.mode), enabled: options.enabled ?? ALL, now: NOW });
  return view.rain;
}

function day(days: readonly RainEntryDay[] | undefined, date: string): RainEntryDay {
  const found = days?.find((item) => item.date === date);
  assert.ok(found, `jour ${date}`);
  return found;
}

test('noter 8 mm pour hier, puis 0 mm, puis remplacer : la fenêtre relit la mesure et le dit', async () => {
  const before = await rainOf(ALICE);
  assert.equal(before?.defaultDate, '2026-11-11');
  assert.equal(day(before?.days, '2026-11-11').measuredMm, null);
  assert.deepEqual(rainButton(day(before?.days, '2026-11-11'), readRainMm('8')), { label: 'Enregistrer 8 mm', enabled: true });

  // Les gardes de l'action laissent passer, puis l'écriture d'« Objectifs et besoins ».
  assert.equal(manualRainfallRefusal({ date: '2026-11-11', precipitationMm: 8, today: '2026-11-12' }), null);
  await saveManualRainfallForUser(ALICE, '2026-11-11', 8);
  const noted = await rainOf(ALICE);
  const yesterday = day(noted?.days, '2026-11-11');
  assert.equal(yesterday.measuredMm, 8);
  assert.equal(rainAlreadyText(yesterday), '8 mm déjà notés pour hier.');
  assert.deepEqual(rainButton(yesterday, readRainMm('0')), { label: 'Remplacer par 0 mm', enabled: true });

  // 0 mm est une vraie mesure (D-003) : elle remplace, et se relit 0, jamais « aucune ».
  await saveManualRainfallForUser(ALICE, '2026-11-11', 0);
  const zero = day((await rainOf(ALICE))?.days, '2026-11-11');
  assert.equal(zero.measuredMm, 0);
  assert.equal(rainAlreadyText(zero), '0 mm déjà noté pour hier.');

  // Remplacer encore : la dernière saisie compte, une seule mesure pour le jour.
  await saveManualRainfallForUser(ALICE, '2026-11-11', 5.5);
  const replaced = await rainOf(ALICE);
  assert.equal(day(replaced?.days, '2026-11-11').measuredMm, 5.5);
  assert.equal(replaced?.days.filter((item) => item.measuredMm !== null).length, 1);

  // Retirer reste sur « Objectifs et besoins » : la fenêtre ne dit plus rien pour ce jour.
  assert.equal(await deleteManualRainfallForUser(ALICE, '2026-11-11'), true);
  assert.equal(day((await rainOf(ALICE))?.days, '2026-11-11').measuredMm, null);
});

test('seule la mesure du pluviomètre se dit « déjà notée » : la réanalyse et la prévision, jamais', async () => {
  // Le lieu que la page lit (sans commune choisie : « unconfigured », comme le service).
  const key = weatherLocationKey(await readWeatherPreference(ALICE), snapshot().structure) ?? 'unconfigured';
  await upsertWeatherDailyValuesForUser(ALICE, key, 'reanalysis', [{ date: '2026-11-10', precipitationMm: 6, et0Mm: 1 }], 'open-meteo', '2026-11-11T05:00:00.000Z');
  await upsertWeatherDailyValuesForUser(ALICE, key, 'forecast', [{ date: '2026-11-12', precipitationMm: 3, et0Mm: 1 }], 'open-meteo', '2026-11-11T05:00:00.000Z');
  const rain = await rainOf(ALICE);
  assert.equal(day(rain?.days, '2026-11-10').measuredMm, null);
  assert.equal(day(rain?.days, '2026-11-12').measuredMm, null);
  // Notée par-dessus, la mesure se dit, et prime (la réanalyse reste à côté, jamais écrasée).
  await saveManualRainfallForUser(ALICE, '2026-11-10', 0);
  assert.equal(day((await rainOf(ALICE))?.days, '2026-11-10').measuredMm, 0);
});

test('un jour futur et un chiffre hors bornes sont refusés avant toute écriture', async () => {
  assert.equal(manualRainfallRefusal({ date: '2026-11-13', precipitationMm: 8, today: '2026-11-12' }), 'Une mesure réelle doit concerner une date valide, aujourd’hui ou dans le passé.');
  assert.equal(manualRainfallRefusal({ date: '2026-11-11', precipitationMm: 1200, today: '2026-11-12' }), 'La pluie mesurée doit être comprise entre 0 et 1 000 mm.');
  // La base refuse aussi un chiffre négatif, même sans l'action.
  await assert.rejects(saveManualRainfallForUser(ALICE, '2026-11-11', -2), /CHECK constraint failed/);
  assert.ok((await rainOf(ALICE))?.days.every((item) => item.measuredMm === null));
});

test('les jours proposés : sept jours en arrière au plus ; une mesure plus ancienne reste sur « Objectifs et besoins »', async () => {
  await saveManualRainfallForUser(ALICE, '2026-11-05', 3);
  await saveManualRainfallForUser(ALICE, '2026-11-04', 9);
  const rain = await rainOf(ALICE);
  assert.equal(rain?.days.length, 8);
  assert.equal(rain?.days.at(-1)?.date, '2026-11-05');
  assert.equal(day(rain?.days, '2026-11-05').measuredMm, 3);
  assert.equal(rain?.days.some((item) => item.date === '2026-11-04'), false);
});

test('isolation : la ferme d’à côté ne voit ni ne remplace la pluie de la première', async () => {
  await saveManualRainfallForUser(ALICE, '2026-11-11', 8);
  const bob = await rainOf(BOB);
  assert.ok(bob?.days.every((item) => item.measuredMm === null), 'Bob ne voit pas la mesure d’Alice');
  assert.deepEqual(rainButton(day(bob?.days, '2026-11-11'), readRainMm('2')), { label: 'Enregistrer 2 mm', enabled: true });

  await saveManualRainfallForUser(BOB, '2026-11-11', 2);
  assert.equal(day((await rainOf(ALICE))?.days, '2026-11-11').measuredMm, 8, 'la saisie de Bob ne touche pas Alice');
  assert.equal(day((await rainOf(BOB))?.days, '2026-11-11').measuredMm, 2);
  assert.equal(await deleteManualRainfallForUser(BOB, '2026-11-11'), true);
  assert.equal(day((await rainOf(ALICE))?.days, '2026-11-11').measuredMm, 8, 'le retrait de Bob non plus');
});

test('pas de fenêtre pour une ferme toute sous abri (D-032), ni sans « Objectifs et besoins »', async () => {
  assert.equal(await rainOf(ALICE, { mode: 'greenhouse' }), null);
  assert.equal(await rainOf(ALICE, { enabled: ALL.filter((id) => id !== 'besoins') }), null);
});
