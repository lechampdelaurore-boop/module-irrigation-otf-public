import assert from 'node:assert/strict';
import test, { afterEach, beforeEach } from 'node:test';
import { listAutomaticObjectiveRevisionsForUser, saveAutomaticObjectiveForUser } from '../../db/automatic-objective-repository';
import { listChangeJournalForUser } from '../../db/change-journal/read';
import { saveFeatureSelectionForUser } from '../../db/feature-selection-repository';
import { saveHydricGoalForUser, upsertWeatherDailyValuesForUser } from '../../db/water-management-repository';
import { findWorkspaceIdForUser } from '../../db/workspace-repository';
import type { IrrigationSnapshot } from '../../lib/domain/domain';
import { weekDateKeys } from '../../lib/domain/water-management';
import { weatherLocationKey } from '../../lib/domain/weather/location';
import { getIrrigationFormHintsForUser } from '../../lib/services/irrigation-form-hints';
import { getIrrigationHistoryDashboardForUser } from '../../lib/services/irrigation-history-service';
import { getIrrigationNeedsDashboardForUser } from '../../lib/services/irrigation-needs-service';
import { fieldsWithoutWords } from '../support/change-journal-words';
import { installTestDatabase, type TestDatabase } from '../support/d1-sqlite';
import { confirmFarmLocation } from '../support/onboarding';
import { crossSpaceReferences } from '../support/space-coherence';
import { ALICE, BOB } from '../support/spaces';

/**
 * L'objectif automatique sur l'ET0, PR O2 : le réglage par ferme et ses
 * lecteurs (docs/objectif-automatique-contract.md, sections 3 et 4 ; D-309,
 * D-317). Le réglage est gardé par ferme, geste par geste, écrit au journal
 * des modifications ; allumé, chaque lecteur de l'objectif lit l'objectif
 * automatique, et la ferme d'à côté ne change pas. Aucun écran ne l'allume
 * encore (O4).
 *
 * La semaine du contrat : du lundi 15 au dimanche 21 juin 2026, ET0
 * 4,0 · 4,2 · 3,8 · 4,5 · 5,0 · 4,6 · 3,9 mm, soit 30,0 mm.
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
async function prepareFarm(owner: string, et0 = ET0) {
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

async function needsOf(owner: string, now = MONDAY_MORNING) {
  const dashboard = await getIrrigationNeedsDashboardForUser({ ownerUserId: owner, season: 2026, snapshot, weekStart: WEEK, now });
  return new Map(dashboard.gardens.flatMap((garden) => garden.beds).map((bed) => [bed.bedId, bed]));
}

const near = (actual: number | null | undefined, expected: number, message?: string) => {
  assert.ok(actual !== null && actual !== undefined && Math.abs(actual - expected) < 1e-9, `${message ?? ''} : ${actual} au lieu de ${expected}`);
};

const feasibilityRevision = async (owner: string) => Number((database.sqlite.prepare(
  'SELECT feasibility_revision AS revision FROM irrigation_workspaces WHERE id = ?',
).get(await findWorkspaceIdForUser(owner)) as { revision: number }).revision);

test('éteint au départ : sans geste, aucune ferme ne change, l’objectif vide reste vide (D-309, cas 11)', async () => {
  await prepareFarm(ALICE);
  assert.deepEqual(await listAutomaticObjectiveRevisionsForUser(ALICE), []);
  const needs = await needsOf(ALICE);
  assert.equal(needs.get(OPEN_BED)?.objectiveMm, null, 'aucun objectif saisi, réglage éteint : pas d’objectif');
  assert.equal(needs.get(OPEN_BED)?.objectiveOrigin, null);
  assert.equal(needs.get(OPEN_BED)?.automaticObjective, null);
  assert.ok(needs.get(OPEN_BED)?.completeness.missing.includes('objective'), 'l’objectif manque, comme avant');
});

test('le réglage est gardé par ferme, geste par geste, au journal des modifications ; un geste sans changement n’écrit rien', async () => {
  await prepareFarm(ALICE);
  await prepareFarm(BOB);
  const revisionBefore = await feasibilityRevision(ALICE);
  assert.equal(await saveAutomaticObjectiveForUser(ALICE, true, BEFORE_THE_WEEK), true);
  assert.equal(await saveAutomaticObjectiveForUser(ALICE, true, new Date('2026-06-02T07:00:00.000Z')), false, 'déjà allumé : rien');
  assert.equal(await saveAutomaticObjectiveForUser(BOB, false, BEFORE_THE_WEEK), false, 'éteint au départ : l’éteindre ne change rien');

  assert.deepEqual(await listAutomaticObjectiveRevisionsForUser(ALICE), [{ enabled: true, createdAt: BEFORE_THE_WEEK.toISOString() }]);
  assert.deepEqual(await listAutomaticObjectiveRevisionsForUser(BOB), [], 'la ferme d’à côté n’a rien');
  assert.equal(await feasibilityRevision(ALICE), revisionBefore + 1, 'le geste rend la faisabilité à refaire, une fois');

  const aliceLines = (await listChangeJournalForUser(ALICE, { limit: 50 })).filter((entry) => entry.subject === 'objectif-automatique');
  assert.deepEqual(fieldsWithoutWords(aliceLines), [], 'le champ a ses mots à l’écran');
  assert.deepEqual(aliceLines.map((entry) => ({ family: entry.family, action: entry.action, before: entry.before, after: entry.after, at: entry.createdAt })), [
    { family: 'objectif', action: 'modifie', before: { enabled: 0 }, after: { enabled: 1 }, at: BEFORE_THE_WEEK.toISOString() },
  ]);
  assert.deepEqual((await listChangeJournalForUser(BOB, { limit: 50 })).filter((entry) => entry.subject === 'objectif-automatique'), []);

  assert.equal(await saveAutomaticObjectiveForUser(ALICE, false, new Date('2026-06-18T06:00:00.000Z')), true);
  assert.deepEqual((await listAutomaticObjectiveRevisionsForUser(ALICE)).map((revision) => revision.enabled), [true, false]);
  const lastLine = (await listChangeJournalForUser(ALICE, { limit: 50 })).find((entry) => entry.subject === 'objectif-automatique' && entry.after?.enabled === 0);
  assert.deepEqual(lastLine && { before: lastLine.before, after: lastLine.after }, { before: { enabled: 1 }, after: { enabled: 0 } });
  assert.deepEqual(crossSpaceReferences(database.sqlite), []);
});

test('allumé : le besoin lit l’objectif automatique, l’ET0 en plein champ, × K_abri sous abri ; la ferme d’à côté ne change pas (cas 1 et 2)', async () => {
  await prepareFarm(ALICE);
  await prepareFarm(BOB);
  await saveAutomaticObjectiveForUser(ALICE, true, BEFORE_THE_WEEK);

  const alice = await needsOf(ALICE);
  const open = alice.get(OPEN_BED);
  near(open?.objectiveMm, 30, 'plein champ : la somme des ET0');
  assert.equal(open?.objectiveOrigin, 'automatic');
  assert.equal(open?.objectiveSource, null, 'aucun objectif saisi n’a servi');
  assert.equal(open?.automaticObjective?.basis, 'et0');
  assert.deepEqual(open?.automaticObjective?.missingDates, []);
  near(open?.automaticObjective?.byNature.forecast, 30, 'lundi matin, toute la semaine est prévue');
  assert.deepEqual(open?.completeness.missing.includes('objective'), false);
  near(open?.realRemainingMm, 30, 'l’écart reste « objectif − (irrigation + pluie) »');
  const sheltered = alice.get(SHELTERED_BED);
  near(sheltered?.objectiveMm, 24, 'sous abri, K_abri 0,8 par défaut');
  assert.equal(sheltered?.automaticObjective?.basis, 'sheltered-et0');

  const bob = await needsOf(BOB);
  assert.equal(bob.get(OPEN_BED)?.objectiveMm, null, 'BOB n’a rien allumé : rien ne change pour lui');
  assert.equal(bob.get(OPEN_BED)?.automaticObjective, null);
});

test('un objectif saisi passe toujours avant, même à 0 mm ; l’objectif automatique ne remplit que les jours sans objectif saisi (cas 5)', async () => {
  await prepareFarm(ALICE);
  await saveAutomaticObjectiveForUser(ALICE, true, BEFORE_THE_WEEK);
  await saveHydricGoalForUser(ALICE, { season: 2026, weekStart: WEEK, scopeType: 'bed', otfZoneId: 'parcelle', otfPlotId: NORTH, otfBedId: OPEN_BED, amountMm: 0 });
  database.sqlite.exec(`UPDATE irrigation_hydric_goal_revisions SET created_at = '2026-06-08T08:00:00.000Z'`);
  const needs = await needsOf(ALICE);
  assert.equal(needs.get(OPEN_BED)?.objectiveMm, 0, '0 mm saisi : la planche n’a pas besoin d’eau, l’ET0 ne s’y substitue pas');
  assert.equal(needs.get(OPEN_BED)?.objectiveOrigin, 'entered');
  assert.equal(needs.get(OPEN_BED)?.automaticObjective, null);
  near(needs.get(SHELTERED_BED)?.objectiveMm, 24, 'l’autre planche garde l’objectif automatique');
});

test('éteint le jeudi : les jours d’avant gardent l’objectif automatique, les suivants n’en ont plus (règle 1, F773)', async () => {
  await prepareFarm(ALICE);
  await saveAutomaticObjectiveForUser(ALICE, true, BEFORE_THE_WEEK);
  await saveAutomaticObjectiveForUser(ALICE, false, new Date('2026-06-18T06:00:00.000Z'));
  const needs = await needsOf(ALICE, new Date('2026-06-18T07:00:00.000Z'));
  near(needs.get(OPEN_BED)?.objectiveMm, 4.0 + 4.2 + 3.8, 'lundi à mercredi');
  assert.deepEqual(needs.get(OPEN_BED)?.automaticObjective?.days.map((day) => day.date), ['2026-06-15', '2026-06-16', '2026-06-17']);
});

test('un jour sans ET0 n’a pas de valeur : la semaine se dit incomplète et nomme le jour, jamais compté pour zéro (cas 8, D-003)', async () => {
  await prepareFarm(ALICE, [4.0, 4.2, 3.8, 4.5, 5.0, 4.6, Number.NaN]);
  database.sqlite.exec(`DELETE FROM irrigation_weather_daily_values WHERE date = '2026-06-21'`);
  await saveAutomaticObjectiveForUser(ALICE, true, BEFORE_THE_WEEK);
  const open = (await needsOf(ALICE)).get(OPEN_BED);
  near(open?.objectiveMm, 26.1, 'six jours d’ET0');
  assert.deepEqual(open?.automaticObjective?.missingDates, ['2026-06-21']);
  assert.equal(open?.automaticObjective?.valuedDays, 6);

  // L'historique le dit aussi : deux planches sans valeur le dimanche, comptées à part, nommées dans les avertissements.
  const history = await getIrrigationHistoryDashboardForUser({
    ownerUserId: ALICE, season: 2026, snapshot, now: MONDAY_MORNING,
    selection: { period: { mode: 'week', anchorDate: WEEK }, scope: { level: 'farm' }, page: 1 },
  });
  assert.deepEqual(history.summary.objectiveAutomatic, { bedDays: 12, missingBedDays: 2, provisionalWeeks: 0 });
  assert.deepEqual(history.summary.objectiveAvailability, { availableBedDays: 12, totalBedDays: 14, complete: false });
  assert.ok(
    history.warnings.some((warning) => warning.startsWith('L’objectif automatique n’a pas de valeur pour 2 journées-planche')),
    history.warnings.join(' | '),
  );
});

test('l’historique et l’aide du formulaire d’irrigation lisent la même règle ; la ferme d’à côté garde les siens', async () => {
  await prepareFarm(ALICE);
  await prepareFarm(BOB);
  await saveAutomaticObjectiveForUser(ALICE, true, BEFORE_THE_WEEK);
  const selection = { period: { mode: 'week' as const, anchorDate: WEEK }, scope: { level: 'farm' as const }, page: 1 };

  const alice = await getIrrigationHistoryDashboardForUser({ ownerUserId: ALICE, season: 2026, snapshot, now: MONDAY_MORNING, selection });
  near(alice.summary.objectiveMm, (30 + 24) / 2, 'deux planches de même surface : la moyenne pondérée');
  assert.deepEqual(alice.summary.objectiveAvailability, { availableBedDays: 14, totalBedDays: 14, complete: true });
  assert.deepEqual(alice.summary.objectiveAutomatic, { bedDays: 14, missingBedDays: 0, provisionalWeeks: 0 });
  assert.equal(alice.warnings.some((warning) => warning.includes('objectif automatique')), false, 'rien ne manque : rien à dire');

  const bob = await getIrrigationHistoryDashboardForUser({ ownerUserId: BOB, season: 2026, snapshot, now: MONDAY_MORNING, selection });
  assert.equal(bob.summary.objectiveMm, null);
  assert.equal(bob.summary.objectiveAutomatic, undefined, 'réglage éteint : le résultat d’avant, sans rien de plus');

  const hints = await getIrrigationFormHintsForUser({ ownerUserId: ALICE, season: 2026, snapshot, now: MONDAY_MORNING, planningEnabled: false });
  near(hints.weeks[0].objectiveMmByBed[OPEN_BED], 30, 'la semaine en cours');
  assert.equal(hints.weeks[1].objectiveMmByBed[OPEN_BED], undefined, 'la semaine suivante n’a pas encore d’ET0 : pas de valeur, pas de zéro');
});
