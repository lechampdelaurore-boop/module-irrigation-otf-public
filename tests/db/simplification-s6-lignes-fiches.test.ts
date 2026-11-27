import assert from 'node:assert/strict';
import test, { afterEach, beforeEach } from 'node:test';
import { overrideDatabase } from '../../db/binding';
import { saveSpeciesCorrespondenceForUser } from '../../db/crop-water/entries';
import { createEquipmentForUser, setEquipmentArchivedForUser } from '../../db/equipment/equipment';
import { listEquipmentForUser } from '../../db/equipment/read';
import { listEquipmentPosesForUser } from '../../db/equipment-placement-poses';
import { addSoilRecordForUser } from '../../db/soil-reserve/entries';
import { saveWaterReservoirForUser, saveWaterResourceForUser } from '../../db/water-resource-repository';
import {
  createWeatherAlertCriterionForUser,
  deleteWeatherAlertCriterionForUser,
  listWeatherAlertCriteriaForWorkspace,
} from '../../db/weather-alert-repository';
import { findWorkspaceIdForUser } from '../../db/workspace-repository';
import type { IrrigationSnapshot } from '../../lib/domain/domain';
import { referenceCropSeriesCount, splitBySeasonUse } from '../../lib/domain/crop-water/crop-summary';
import { poseCounts } from '../../lib/domain/equipment-pose-presentation';
import { farmCardLines, type FarmCardLines } from '../../lib/domain/farm-home/lines';
import { FEATURE_IDS, type FeatureId } from '../../lib/domain/features/catalogue';
import { FARM_CARD_LINES, farmCards } from '../../lib/domain/features/farm-cards';
import { usesWeather } from '../../lib/domain/features/socle';
import { startWaySelection } from '../../lib/domain/features/start';
import type { SoilRecord } from '../../lib/domain/soil-reserve/soil';
import { getCropCoefficientsViewForUser } from '../../lib/services/crop-water-coefficients';
import { chooseStartForUser } from '../../lib/services/start-choice';
import { farmHomeCounts, startRouteCounts, startRouteReads } from '../../lib/services/start-route';
import { cultivation, series } from '../support/crop-water-references';
import { installTestDatabase, type TestDatabase } from '../support/d1-sqlite';
import { FIXTURE_PLOT_ID, FIXTURE_ZONE_ID, createDripFixture } from '../support/irrigation-fixtures';
import { confirmFarmLocation } from '../support/onboarding';
import { FARM_SOIL } from '../support/soil-reserve-fixtures';
import { ALICE, BOB } from '../support/spaces';

/**
 * Simplifier l'usage du module, lot S6, PR 3 : les lignes d'état des fiches
 * de « Ma ferme » lues en base (docs/simplification-s6-contract.md,
 * section 7). La même lecture que la mise en route, jamais deux comptes qui
 * peuvent différer ; chaque nombre, celui que la page de la fiche montre ;
 * Alice et Bob aux quatre passages d'isolation ; trois cents planches coûtent
 * autant de requêtes que trois ; une lecture qui échoue rend la ligne fixe.
 */

let database: TestDatabase;
beforeEach(() => {
  database = installTestDatabase();
});
afterEach(() => {
  database.dispose();
});

const SEASON = 2026;
/** Un mercredi : la semaine commence le lundi 7 septembre. */
const NOW = new Date('2026-09-09T08:00:00.000Z');
const CHAMP = 'plot-champ';
const OTHER_ZONE = 'zone-2';
const ALL = [...FEATURE_IDS];

/**
 * Le plan des cultures : trois espèces de la saison sur des planches (la tomate, la tomate cerise, la salade de deux
 * séries), une sur un bloc, une de l'an passé ; seules les trois premières comptent.
 */
const CROP_PLAN: NonNullable<IrrigationSnapshot['cropPlan']> = {
  series: [
    series('tomates', [cultivation('tomate-c', 'plant-tomate', 'Tomate')]),
    series('cerises', [cultivation('cerise-c', 'plant-tomate-cerise', 'Tomate cerise')]),
    series('salades', [cultivation('salade-c', 'plant-salade', 'Salade')]),
    series('salades-2', [cultivation('salade-c2', 'plant-salade', 'Salade')]),
    series('ble', [cultivation('ble-c', 'plant-ble', 'Blé')], { use: 'block' }),
    series('poireaux-2025', [cultivation('poireau-c', 'plant-poireau', 'Poireau')], { season: 2025 }),
  ],
  places: [],
  implantationTasks: [],
  readSummary: { seriesRead: 6, placesRead: 0, tasksRead: 0, tasksRetained: 0, placesWithoutSeries: 0, placesOfUnknownSeries: 0, placesWithUnknownBed: 0 },
};

function snapshotWith(extraBeds = 0, cropPlan: IrrigationSnapshot['cropPlan'] | null = CROP_PLAN): IrrigationSnapshot {
  return {
    configuration: { seasonFirst: 2025, seasonLast: 2027 },
    structure: { id: '17', name: 'Ferme', legalCity: 'Rennes', legalPostcode: '35000', legalCountry: 'FR' },
    zones: [
      { id: FIXTURE_ZONE_ID, name: 'Parcelle', area: 1000, seasons: [SEASON] },
      { id: OTHER_ZONE, name: 'Parcelle du bas', area: 1000, seasons: [SEASON] },
      { id: 'zone-ancienne', name: 'Ancienne parcelle', area: 500, seasons: [2025] },
    ],
    plots: [
      { id: FIXTURE_PLOT_ID, zoneId: FIXTURE_ZONE_ID, name: 'Serre', mode: 'greenhouse', length: 20, width: 10, area: 200, seasons: [SEASON] },
      { id: CHAMP, zoneId: OTHER_ZONE, name: 'Champ', mode: 'garden', length: 40, width: 20, area: 800, seasons: [SEASON] },
    ],
    beds: [
      { id: 'bed-1', zoneId: FIXTURE_ZONE_ID, plotId: FIXTURE_PLOT_ID, name: '1', length: 30, width: 1, alleyWidth: null, area: 30, seasons: [SEASON] },
      { id: 'bed-2', zoneId: FIXTURE_ZONE_ID, plotId: FIXTURE_PLOT_ID, name: '2', length: 30, width: 1, alleyWidth: null, area: 30, seasons: [SEASON] },
      { id: 'bed-c', zoneId: OTHER_ZONE, plotId: CHAMP, name: 'C', length: 800, width: 1, alleyWidth: null, area: 800, seasons: [SEASON] },
      ...Array.from({ length: extraBeds }, (_, index) => ({
        id: `bed-x${index}`, zoneId: OTHER_ZONE, plotId: CHAMP, name: `X${index}`, length: 10, width: 1, alleyWidth: null, area: 10, seasons: [SEASON],
      })),
    ],
    cropPlan: cropPlan ?? undefined,
    source: 'cache',
    lastSuccessfulReadAt: '2026-09-07T00:00:00.000Z',
  };
}

/** Les lignes que la page « Ma ferme » montre : la lecture des fiches seule, comme quand la carte n'est plus là. */
async function linesOf(owner: string, snapshot: IrrigationSnapshot = snapshotWith(), enabled: readonly FeatureId[] = ALL): Promise<FarmCardLines> {
  const reads = startRouteReads(owner, SEASON, enabled, NOW, { route: false, cards: true });
  const counts = await farmHomeCounts(reads, { season: SEASON, snapshot });
  return farmCardLines({ enabled, usesWeather: usesWeather(enabled), counts, now: NOW });
}

const RESERVOIR = { type: 'pond', capacityCubicMeters: 40, currentVolumeCubicMeters: 30, minimumSafetyCubicMeters: 0, exposedSurfaceSquareMeters: 0, receivesRain: false, evaporationEnabled: false, evaporationCoefficient: 1, notes: null } as const;
const ALERT = { field: 'precipitation' as const, direction: 'above' as const, threshold: 10, horizonDays: 2, active: true, label: 'Grosse pluie' };

/**
 * La ferme d'Alice, passée par « Tout » : un goutte-à-goutte posé, une
 * aspersion pas encore posée et un vieux tuyau archivé ; un puits, un bassin
 * relevé lundi, un forage et une cuve arrêtés ; deux alertes réglées dont une
 * inactive, une supprimée ; la tomate et la tomate cerise rattachées à la même
 * culture, la salade non ; le sol d'une parcelle sur deux.
 */
async function describeAlice() {
  await createDripFixture(ALICE, { beds: ['bed-1', 'bed-2'] });
  await createEquipmentForUser(ALICE, { name: 'Asperseur', kind: 'sprinkler', mobility: 'mobile' });
  const old = await createEquipmentForUser(ALICE, { name: 'Vieux tuyau', kind: 'drip', mobility: 'mobile' });
  assert.equal(await setEquipmentArchivedForUser(ALICE, old, true), true);
  await saveWaterResourceForUser(ALICE, ALICE, null, { name: 'Puits', type: 'well', nominalFlowCubicMetersPerHour: 2, status: 'active', availableFrom: null, availableUntil: null, notes: null });
  await saveWaterResourceForUser(ALICE, ALICE, null, { name: 'Ancien forage', type: 'borehole', nominalFlowCubicMetersPerHour: 1, status: 'inactive', availableFrom: null, availableUntil: null, notes: null });
  await saveWaterReservoirForUser(ALICE, ALICE, null, { ...RESERVOIR, name: 'Bassin des noues', status: 'active' }, '2026-09-07T07:00:00.000Z');
  await saveWaterReservoirForUser(ALICE, ALICE, null, { ...RESERVOIR, name: 'Vieille cuve', status: 'inactive' }, '2026-09-07T07:00:00.000Z');
  await createWeatherAlertCriterionForUser(ALICE, ALERT, NOW);
  await createWeatherAlertCriterionForUser(ALICE, { ...ALERT, label: 'Gel', field: 'minimum-temperature', direction: 'below', threshold: 0, active: false }, NOW);
  const gone = await createWeatherAlertCriterionForUser(ALICE, { ...ALERT, label: 'Supprimée' }, NOW);
  assert.equal(await deleteWeatherAlertCriterionForUser(ALICE, gone.id, NOW), true);
  for (const plantId of ['plant-tomate', 'plant-tomate-cerise']) {
    assert.equal((await saveSpeciesCorrespondenceForUser(ALICE, { plantId, seriesId: null, target: { kind: 'reference', referenceCropId: 'criiam-tomate', analogy: false } }, NOW)).ok, true);
  }
  const soil = Object.fromEntries(Object.entries({ ...FARM_SOIL, zoneId: FIXTURE_ZONE_ID, plotId: null }).filter(([key]) => key !== 'recordedAt')) as Omit<SoilRecord, 'recordedAt'>;
  assert.equal((await addSoilRecordForUser(ALICE, soil, NOW)).ok, true);
}

test('section 7.2 : les lignes d’une ferme décrite, et rien de celle d’à côté', async () => {
  await chooseStartForUser(ALICE, { startMode: 'all', enabled: [] }, NOW);
  await chooseStartForUser(BOB, { startMode: 'all', enabled: [] }, NOW);
  await describeAlice();

  assert.deepEqual(await linesOf(ALICE), {
    // Le vieux tuyau archivé ne compte pas, comme dans l'inventaire.
    materiel: '1 goutte-à-goutte et 1 aspersion, 1 pas posé',
    // Le forage et la cuve arrêtés ne comptent pas ; le bassin relevé lundi l'est « cette semaine ».
    ressources: '1 ressource et 1 réserve, observée cette semaine',
    // « Vos cultures cette saison (1) » : deux espèces rattachées à la même culture, une à rattacher (Réglages le dit).
    cultures: '1 culture cette saison',
    // L'ancienne parcelle, hors de la saison, ne compte pas.
    sol: 'À renseigner pour 1 parcelle',
    // L'alerte supprimée ne compte pas.
    'alertes-meteo': '2 alertes réglées, 1 inactive',
    reglages: 'Commune à confirmer · 11 fonctionnalités cochées',
  });
  // Bob, les mêmes planches et le même plan d'Ouvre ta ferme, rien de décrit : aucune ligne d'Alice.
  assert.deepEqual(await linesOf(BOB), {
    cultures: 'Aucune culture ne sert à vos séries cette saison',
    sol: 'À renseigner pour 2 parcelles',
    'alertes-meteo': 'Aucune alerte réglée',
    reglages: 'Commune à confirmer · 11 fonctionnalités cochées',
  });

  // La commune confirmée : la ligne la nomme ; Bob ne voit rien changer.
  await confirmFarmLocation(ALICE, snapshotWith().structure);
  assert.equal((await linesOf(ALICE)).reglages, 'Météo de Rennes · 11 fonctionnalités cochées');
  assert.equal((await linesOf(BOB)).reglages, 'Commune à confirmer · 11 fonctionnalités cochées');

  // Les fiches : la ligne d'état là où elle est connue, la ligne fixe ailleurs.
  const cards = farmCards(ALL, [], await linesOf(BOB));
  assert.deepEqual(cards.filter((card) => card.lineKind === 'fixed').map((card) => card.page), ['materiel', 'ressources', 'alertes-cultures']);
  for (const card of cards.filter((item) => item.lineKind === 'fixed')) assert.equal(card.line, FARM_CARD_LINES[card.page]);
});

test('section 7.1 : chaque nombre est celui de la page de la fiche, et la carte compte avec les mêmes lectures', async () => {
  await chooseStartForUser(ALICE, { startMode: 'all', enabled: [] }, NOW);
  await describeAlice();
  const snapshot = snapshotWith();
  const reads = startRouteReads(ALICE, SEASON, ALL, NOW, { route: true, cards: true });
  const [route, home] = await Promise.all([
    startRouteCounts(reads, { ownerUserId: ALICE, season: SEASON, snapshot, now: NOW }),
    farmHomeCounts(reads, { season: SEASON, snapshot }),
  ]);
  // Une seule lecture, plusieurs phrases : l'étape 1 et la fiche comptent les mêmes matériels ; l'étape 3 et la fiche les mêmes ressources ; l'étape 5 et la fiche les mêmes parcelles.
  assert.deepEqual([route.equipment?.drip, route.equipment?.sprinkler], [home.equipment?.drip, home.equipment?.sprinkler]);
  assert.equal(route.water?.total, (home.water?.resources.length ?? 0) + (home.water?.reservoirs.length ?? 0));
  assert.deepEqual([route.soil?.withoutSoil, route.soil?.total], [home.soil?.withoutSoil, home.soil?.total]);

  // « Matériel et placement » : les posés de l'inventaire (`poseCounts`), sur les matériels actifs.
  const equipment = (await listEquipmentForUser(ALICE)).filter((item) => item.status === 'active');
  assert.equal(home.equipment?.posed, poseCounts(equipment.map((item) => item.id), await listEquipmentPosesForUser(ALICE, SEASON)).posed);
  assert.equal(home.equipment?.posed, 1);
  // « Besoin par culture » : le titre « Vos cultures cette saison (N) » de la page, et ses espèces de la saison.
  const view = await getCropCoefficientsViewForUser({ ownerUserId: ALICE, season: SEASON, snapshot, now: NOW });
  assert.ok(view.available);
  const cultivated = splitBySeasonUse(view.crops, (stored) => referenceCropSeriesCount(stored.crop.id, view.species)).cultivated;
  assert.deepEqual(home.crops, { inUse: cultivated.length, species: view.species.length });
  assert.deepEqual(home.crops, { inUse: 1, species: 3 });
  const workspaceId = await findWorkspaceIdForUser(ALICE);
  assert.ok(workspaceId);
  // « Alertes météo » : la liste de la page, et ses critères actifs.
  const criteria = await listWeatherAlertCriteriaForWorkspace(workspaceId);
  assert.deepEqual(home.weatherAlerts, { total: criteria.length, active: criteria.filter((criterion) => criterion.active).length });
  // « Ressources et pompes » : le volume du bassin à la date de son relevé, jamais plus récent.
  assert.deepEqual(home.water?.reservoirs.map((item) => [item.name, item.currentVolumeCubicMeters, item.currentVolumeObservedAt]), [['Bassin des noues', 30, '2026-09-07T07:00:00.000Z']]);
});

test('section 7.2 : sans plan des cultures, une case décochée, une ferme vide : la ligne fixe, jamais un « 0 »', async () => {
  await chooseStartForUser(ALICE, { startMode: 'all', enabled: [] }, NOW);
  // Une ferme neuve : ni matériel, ni eau, ni culture ; la ligne fixe de ces fiches, jamais « 0 goutte-à-goutte ».
  const empty = await linesOf(ALICE, snapshotWith(0, { ...CROP_PLAN, series: [] }));
  assert.deepEqual(Object.keys(empty).sort(), ['alertes-meteo', 'reglages', 'sol']);
  // Sans plan des cultures lu, les espèces sont inconnues : la ligne fixe.
  await describeAlice();
  assert.equal((await linesOf(ALICE, snapshotWith(0, null))).cultures, undefined);
  // « Pour noter mes arrosages » : seules les fiches cochées sont lues, et rien d'une case décochée.
  const notes = startWaySelection('notes');
  const lines = await linesOf(ALICE, snapshotWith(), notes);
  assert.equal(lines.ressources, undefined);
  assert.equal(lines.sol, undefined);
  assert.equal(lines['alertes-meteo'], undefined);
  assert.equal(lines.materiel, '1 goutte-à-goutte et 1 aspersion, 1 pas posé');
  assert.match(lines.reglages ?? '', new RegExp(`^${notes.length} fonctionnalités cochées$`, 'iu'));
});

test('section 7.1 : une lecture qui échoue rend la ligne fixe de sa fiche, les autres restent', async () => {
  await chooseStartForUser(ALICE, { startMode: 'all', enabled: [] }, NOW);
  await describeAlice();
  const real = database.d1;
  const failing = new Proxy(real, {
    get(target, property) {
      const value = Reflect.get(target, property) as unknown;
      if (property === 'prepare' && typeof value === 'function') {
        return (sql: string) => {
          if (sql.includes('irrigation_weather_alert_criteria') || sql.includes('irrigation_water_reservoirs')) throw new Error('D1 indisponible');
          return (value as (sql: string) => D1PreparedStatement).call(target, sql);
        };
      }
      return typeof value === 'function' ? (value as (...args: unknown[]) => unknown).bind(target) : value;
    },
  });
  overrideDatabase(failing);
  try {
    const lines = await linesOf(ALICE);
    assert.equal(lines['alertes-meteo'], undefined, 'pas « Aucune alerte réglée » pour une lecture qui a échoué');
    assert.equal(lines.ressources, undefined, 'pas « 1 ressource » quand les réserves n’ont pas été lues');
    assert.equal(lines.materiel, '1 goutte-à-goutte et 1 aspersion, 1 pas posé');
    assert.equal(lines.sol, 'À renseigner pour 1 parcelle');
  } finally {
    overrideDatabase(real);
  }
});

test('section 7.1 : trois cents planches, autant de requêtes que trois, avec la carte et les fiches', async () => {
  await chooseStartForUser(ALICE, { startMode: 'all', enabled: [] }, NOW);
  await describeAlice();
  const real = database.d1;
  let prepared = 0;
  const counting = new Proxy(real, {
    get(target, property) {
      const value = Reflect.get(target, property) as unknown;
      if (property === 'prepare' && typeof value === 'function') {
        return (sql: string) => {
          prepared += 1;
          return (value as (sql: string) => D1PreparedStatement).call(target, sql);
        };
      }
      return typeof value === 'function' ? (value as (...args: unknown[]) => unknown).bind(target) : value;
    },
  });
  const both = async (snapshot: IrrigationSnapshot) => {
    const reads = startRouteReads(ALICE, SEASON, ALL, NOW, { route: true, cards: true });
    const [route, home] = await Promise.all([
      startRouteCounts(reads, { ownerUserId: ALICE, season: SEASON, snapshot, now: NOW }),
      farmHomeCounts(reads, { season: SEASON, snapshot }),
    ]);
    return { route, home };
  };
  overrideDatabase(counting);
  try {
    const small = await both(snapshotWith(0));
    const smallQueries = prepared;
    prepared = 0;
    const large = await both(snapshotWith(297));
    assert.equal(large.route.placement?.total, 300);
    assert.equal(small.route.placement?.total, 3);
    assert.equal(prepared, smallQueries, `${prepared} requêtes pour 300 planches, ${smallQueries} pour 3`);
    // La carte seule, puis la carte et les fiches : les fiches ajoutent leurs propres lectures, une poignée, jamais celles de la carte une seconde fois.
    prepared = 0;
    await startRouteCounts(startRouteReads(ALICE, SEASON, ALL, NOW), { ownerUserId: ALICE, season: SEASON, snapshot: snapshotWith(0), now: NOW });
    const routeOnly = prepared;
    assert.ok(smallQueries - routeOnly <= 8, `${smallQueries - routeOnly} requêtes de plus pour les fiches`);
    assert.ok(smallQueries <= 28, `${smallQueries} requêtes`);
  } finally {
    overrideDatabase(real);
  }
});
