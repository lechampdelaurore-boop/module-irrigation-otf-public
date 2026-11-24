import assert from 'node:assert/strict';
import test, { afterEach, beforeEach } from 'node:test';
import { saveAutomaticObjectiveForUser } from '../../db/automatic-objective-repository';
import { saveFeatureSelectionForUser } from '../../db/feature-selection-repository';
import { saveHydricGoalForUser, upsertWeatherDailyValuesForUser } from '../../db/water-management-repository';
import type { IrrigationSnapshot } from '../../lib/domain/domain';
import { automaticObjectiveOriginText, objectiveOriginText } from '../../lib/domain/objective-reading';
import { weekDateKeys } from '../../lib/domain/water-management';
import { weatherLocationKey } from '../../lib/domain/weather/location';
import { getIrrigationNeedsDashboardForUser } from '../../lib/services/irrigation-needs-service';
import { getTodayBadgeForUser } from '../../lib/services/today-service';
import { getWaterDashboardForUser } from '../../lib/services/water-dashboard';
import { installTestDatabase, type TestDatabase } from '../support/d1-sqlite';
import { confirmFarmLocation } from '../support/onboarding';
import { ALICE, BOB } from '../support/spaces';

/**
 * L'objectif automatique sur l'ET0, PR O4 : les écrans
 * (docs/objectif-automatique-contract.md, section 5 ; D-319), à deux fermes.
 * Le volet des objectifs lit le réglage de sa ferme et les planches qui
 * gardent un objectif saisi ; le tableau des besoins rend de quoi dire
 * l'origine ; « Fiabilité du calcul » ne suit l'objectif automatique que
 * réglage allumé. La ferme d'à côté ne voit rien de plus.
 *
 * La semaine du contrat : du lundi 15 au dimanche 21 juin 2026, ET0
 * 4,0 · 4,2 · 3,8 · 4,5 · 5,0 · 4,6 · 3,9 mm ; l'ET0 du dimanche manque.
 */

let database: TestDatabase;
beforeEach(() => {
  database = installTestDatabase();
});
afterEach(() => {
  database.dispose();
});

const WEEK = '2026-06-15';
const ET0 = [4.0, 4.2, 3.8, 4.5, 5.0, 4.6, 3.9];
/** Lundi 15 juin 2026, 7 h à Paris : toute la semaine est prévue. */
const MONDAY_MORNING = new Date('2026-06-15T05:00:00.000Z');
/** Le réglage allumé avant la semaine (cas 1 à 12 du contrat). */
const BEFORE_THE_WEEK = new Date('2026-06-01T07:00:00.000Z');
const NORTH = 'jardin-nord';
const SHELTER = 'serre';
const OPEN_BED = 'planche-a';
const SHELTERED_BED = 'planche-s';

const snapshot: IrrigationSnapshot = {
  configuration: { seasonFirst: 2025, seasonLast: 2027 },
  structure: { id: '17', name: 'Ferme', legalCity: 'Rennes', legalPostcode: '35000', legalCountry: 'FR' },
  zones: [{ id: 'parcelle', name: 'Parcelle', area: null, seasons: [2026] }],
  plots: [
    { id: NORTH, zoneId: 'parcelle', name: 'Nord', mode: 'garden', length: 10, width: 8, area: 80, seasons: [2026] },
    { id: SHELTER, zoneId: 'parcelle', name: 'Serre', mode: 'greenhouse', length: 10, width: 8, area: 80, seasons: [2026] },
  ],
  beds: [
    { id: OPEN_BED, zoneId: 'parcelle', plotId: NORTH, name: 'A', length: 10, width: 0.8, alleyWidth: 0.4, area: 8, seasons: [2026] },
    { id: SHELTERED_BED, zoneId: 'parcelle', plotId: SHELTER, name: 'S', length: 10, width: 0.8, alleyWidth: 0.4, area: 8, seasons: [2026] },
  ],
  source: 'cache',
  lastSuccessfulReadAt: '2026-06-15T00:00:00.000Z',
};

/** Une ferme qui n'a pas coché « Besoin par culture » : l'objectif automatique suit l'ET0 (choix 3). */
async function prepareFarm(owner: string, et0: readonly (number | null)[] = [...ET0.slice(0, 6), null]) {
  await saveFeatureSelectionForUser(owner, ['materiel', 'arrosages', 'besoins', 'planning', 'historique'], BEFORE_THE_WEEK);
  await confirmFarmLocation(owner, snapshot.structure);
  const location = weatherLocationKey({ locationMode: 'otf', customCity: null, customPostcode: null, locationConfirmed: true }, snapshot.structure);
  assert.ok(location);
  await upsertWeatherDailyValuesForUser(
    owner, location, 'forecast',
    weekDateKeys(WEEK).map((date, index) => ({ date, precipitationMm: 0, et0Mm: et0[index] })),
    'test', '2026-06-15T04:15:00.000Z',
  );
}

const waterOf = (owner: string, includeAutomaticObjective = true) => getWaterDashboardForUser({
  ownerUserId: owner, season: 2026, snapshot, weekStart: WEEK, now: MONDAY_MORNING, allowWeatherRefresh: false, includeAutomaticObjective,
});

test('le volet des objectifs lit le réglage de sa ferme et compte les planches qui gardent un objectif saisi (section 5, points 1 et 2)', async () => {
  await prepareFarm(ALICE);
  await prepareFarm(BOB);
  assert.deepEqual((await waterOf(ALICE)).automaticObjective, { enabled: false, keptGoalBeds: 0 }, 'éteint au départ');
  assert.equal((await waterOf(ALICE, false)).automaticObjective, null, 'les autres écrans ne le lisent pas');

  await saveAutomaticObjectiveForUser(ALICE, true, BEFORE_THE_WEEK);
  await saveHydricGoalForUser(ALICE, { season: 2026, weekStart: WEEK, scopeType: 'plot', otfZoneId: 'parcelle', otfPlotId: SHELTER, otfBedId: null, amountMm: 15 });
  assert.deepEqual((await waterOf(ALICE)).automaticObjective, { enabled: true, keptGoalBeds: 1 }, 'l’objectif de la serre couvre une planche');
  await saveHydricGoalForUser(ALICE, { season: 2026, weekStart: WEEK, scopeType: 'farm', otfZoneId: null, otfPlotId: null, otfBedId: null, amountMm: 20 });
  assert.deepEqual((await waterOf(ALICE)).automaticObjective, { enabled: true, keptGoalBeds: 2 }, 'un objectif de ferme les couvre toutes (cas 5)');
  assert.deepEqual((await waterOf(BOB)).automaticObjective, { enabled: false, keptGoalBeds: 0 }, 'la ferme d’à côté ne voit rien');
  // Éteint ensuite : le dernier geste fait foi, les objectifs saisis restent comptés.
  await saveAutomaticObjectiveForUser(ALICE, false, new Date('2026-06-10T07:00:00.000Z'));
  assert.deepEqual((await waterOf(ALICE)).automaticObjective, { enabled: false, keptGoalBeds: 2 });
});

test('le tableau des besoins rend l’origine dite à l’écran, et la bulle nomme le jour sans ET0 (section 5, point 3)', async () => {
  await prepareFarm(ALICE);
  await prepareFarm(BOB);
  await saveAutomaticObjectiveForUser(ALICE, true, BEFORE_THE_WEEK);
  const needs = async (owner: string) => new Map((await getIrrigationNeedsDashboardForUser({ ownerUserId: owner, season: 2026, snapshot, weekStart: WEEK, now: MONDAY_MORNING }))
    .gardens.flatMap((garden) => garden.beds).map((bed) => [bed.bedId, bed]));
  const alice = await needs(ALICE);
  const open = alice.get(OPEN_BED);
  assert.ok(open);
  assert.equal(objectiveOriginText(open), 'automatique, d’après l’ET0');
  assert.equal(automaticObjectiveOriginText(open), 'Objectif automatique sur 7 jours : 26,1 mm d’après l’ET0. Dont 26,1 mm sur prévision. Sans valeur, non comptés : dim. 21 juin (ET0 manquante). Mis à jour chaque matin avec la météo.');
  const sheltered = alice.get(SHELTERED_BED);
  assert.ok(sheltered);
  assert.equal(objectiveOriginText(sheltered), 'automatique, d’après l’ET0 sous abri');
  const bob = (await needs(BOB)).get(OPEN_BED);
  assert.ok(bob);
  assert.equal(objectiveOriginText(bob), null, 'BOB n’a rien allumé : l’écran d’avant');
  assert.equal(automaticObjectiveOriginText(bob), null);
});

test('« Fiabilité du calcul » compte la ligne « Objectif automatique » pour la ferme qui l’a allumé, pas pour l’autre (section 5, point 5)', async () => {
  await prepareFarm(ALICE);
  await prepareFarm(BOB);
  const badge = (owner: string) => getTodayBadgeForUser({ ownerUserId: owner, season: 2026, snapshot, enabled: ['besoins'], now: MONDAY_MORNING });
  const before = await badge(ALICE);
  assert.equal(before, await badge(BOB), 'les deux fermes partent du même compte');
  await saveAutomaticObjectiveForUser(ALICE, true, BEFORE_THE_WEEK);
  assert.equal(await badge(ALICE), (before ?? 0) + 1, 'le dimanche sans ET0 : une ligne de plus');
  assert.equal(await badge(BOB), before, 'la ferme d’à côté ne change pas');
  // Éteint ce matin : la donnée n'est plus suivie.
  await saveAutomaticObjectiveForUser(ALICE, false, new Date('2026-06-15T04:30:00.000Z'));
  assert.equal(await badge(ALICE), before);
});
