import assert from 'node:assert/strict';
import test, { afterEach, beforeEach } from 'node:test';
import { createIrrigationEventForUser } from '../../db/irrigation-event/create';
import { saveWaterReservoirForUser } from '../../db/water-resource-repository';
import type { IrrigationSnapshot } from '../../lib/domain/domain';
import { FEATURE_IDS } from '../../lib/domain/features/catalogue';
import type { TodayBlock, TodayView } from '../../lib/domain/today/today-view';
import { getTodayBadgeForUser, getTodayViewForUser } from '../../lib/services/today-service';
import { installTestDatabase, type TestDatabase } from '../support/d1-sqlite';
import { FIXTURE_PLOT_ID, FIXTURE_ZONE_ID, createDripFixture, plannedDraft } from '../support/irrigation-fixtures';

/**
 * La page « Aujourd'hui » lue en base (audit ergonomique, points 1 et 3,
 * 3.8 quater lot 2, docs/audit-ergonomie-lot2-contract.md, cas 20) : un
 * autre utilisateur, sur une autre ferme, ne voit aucune ligne, aucun nom ni
 * aucun volume de la première — comme l'isolation des autres lectures.
 */

const ALICE = 'alice';
const BOB = 'bob';
const NOW = new Date('2026-11-12T05:00:00.000Z');
const ALL = [...FEATURE_IDS];

let database: TestDatabase;
beforeEach(() => {
  database = installTestDatabase();
});
afterEach(() => {
  database.dispose();
});

function snapshotFor(bedName: string): IrrigationSnapshot {
  return {
    configuration: { seasonFirst: 2025, seasonLast: 2026 },
    structure: { id: '17', name: 'Ferme', legalCity: 'Rennes', legalPostcode: '35000', legalCountry: 'FR' },
    zones: [{ id: FIXTURE_ZONE_ID, name: 'Zone', area: 1000, seasons: [2026] }],
    plots: [{ id: FIXTURE_PLOT_ID, zoneId: FIXTURE_ZONE_ID, name: 'Jardin', mode: 'garden', length: 40, width: 30, area: 1200, seasons: [2026] }],
    beds: [{ id: 'bed-1', zoneId: FIXTURE_ZONE_ID, plotId: FIXTURE_PLOT_ID, name: bedName, length: 40, width: 0.75, alleyWidth: 0.45, area: 30, seasons: [2026] }],
    source: 'cache',
    lastSuccessfulReadAt: '2026-11-11T00:00:00.000Z',
  };
}

function block<K extends TodayBlock['kind']>(view: TodayView, kind: K): Extract<TodayBlock, { kind: K }> {
  const found = view.blocks.find((item) => item.kind === kind);
  assert.ok(found, `bloc ${kind}`);
  return found as Extract<TodayBlock, { kind: K }>;
}

async function seedAlice() {
  const fixture = await createDripFixture(ALICE, { name: 'Goutte-à-goutte d’Alice', beds: ['bed-1'] });
  // Une irrigation planifiée hier, jamais démarrée : « Non faite ».
  await createIrrigationEventForUser(ALICE, plannedDraft(fixture, {
    startAt: '2026-11-11T06:00:00.000Z',
    endAt: '2026-11-11T07:00:00.000Z',
    durationSeconds: 3600,
  }));
  await saveWaterReservoirForUser(ALICE, ALICE, null, {
    name: 'Cuve d’Alice',
    type: 'tank',
    capacityCubicMeters: 20,
    currentVolumeCubicMeters: 12,
    minimumSafetyCubicMeters: 0,
    exposedSurfaceSquareMeters: 0,
    receivesRain: false,
    evaporationEnabled: false,
    evaporationCoefficient: 1,
    status: 'active',
    notes: null,
  }, '2026-10-05T07:00:00.000Z');
}

test('cas 20 : la ferme d’à côté ne voit aucune ligne, aucun nom ni aucun volume de la première', async () => {
  await seedAlice();

  const alice = await getTodayViewForUser({ ownerUserId: ALICE, season: 2026, snapshot: snapshotFor('A1'), enabled: ALL, now: NOW });
  assert.equal(block(alice, 'late').lines.length, 1);
  assert.equal(block(alice, 'late').lines[0].title, 'Goutte-à-goutte d’Alice · Réglage 1');
  assert.equal(block(alice, 'late').lines[0].status, 'Non faite');
  assert.match(block(alice, 'late').lines[0].detail, /planche A1/);
  assert.deepEqual(block(alice, 'water').lines, ['Cuve d’Alice : 12 m³ sur 20 m³, observé le 5 oct. 2026 (38 jours).']);
  assert.ok(block(alice, 'reliability').zone.shown.some((line) => line.key.startsWith('reservoir-volume:')));

  const bob = await getTodayViewForUser({ ownerUserId: BOB, season: 2026, snapshot: snapshotFor('B1'), enabled: ALL, now: NOW });
  assert.deepEqual(block(bob, 'late').lines, []);
  assert.deepEqual(block(bob, 'todo').lines, []);
  assert.deepEqual(block(bob, 'water').lines, []);
  assert.ok(block(bob, 'reliability').zone.shown.every((line) => line.kind !== 'reservoir-volume'));
  const seen = JSON.stringify(bob);
  for (const secret of ['Alice', 'Cuve', 'Goutte', '12 m³', '20 m³', 'A1']) assert.ok(!seen.includes(secret), secret);
  // Le retard d'Alice ne gonfle pas la pastille de Bob.
  assert.equal(bob.badge, block(bob, 'reliability').zone.shown.length + block(bob, 'reliability').zone.hidden.length || null);
});

test('une case décochée n’est pas lue : sans « Ressources et pompes », ni bloc de l’eau ni ligne de volume', async () => {
  await seedAlice();
  const enabled = ALL.filter((id) => id !== 'ressources');
  const view = await getTodayViewForUser({ ownerUserId: ALICE, season: 2026, snapshot: snapshotFor('A1'), enabled, now: NOW });
  assert.equal(view.blocks.some((item) => item.kind === 'water'), false);
  assert.ok(block(view, 'reliability').zone.shown.every((line) => line.kind !== 'reservoir-volume'));
  assert.equal(block(view, 'late').lines.length, 1);
});

test('F12 : la pastille lue seule, sans la météo, vaut celle de la page', async () => {
  await seedAlice();
  const request = { ownerUserId: ALICE, season: 2026, snapshot: snapshotFor('A1'), enabled: ALL, now: NOW };
  const view = await getTodayViewForUser(request);
  assert.ok(view.badge !== null && view.badge >= 2, 'la « Non faite » d’hier et au moins le plan jamais calculé');
  assert.equal(await getTodayBadgeForUser(request), view.badge);
  // Le retard d'Alice et le volume de sa cuve ne comptent pas chez Bob.
  const bob = { ...request, ownerUserId: BOB, snapshot: snapshotFor('B1') };
  assert.equal(await getTodayBadgeForUser(bob), (await getTodayViewForUser(bob)).badge);
  assert.equal(await getTodayBadgeForUser(bob), view.badge - 2);
});
