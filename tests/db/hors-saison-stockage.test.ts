import assert from 'node:assert/strict';
import test, { afterEach, beforeEach } from 'node:test';
import { listChangeJournalForUser } from '../../db/change-journal/read';
import { cancelPlannedIrrigationForUser } from '../../db/irrigation-event/completion';
import { createIrrigationEventForUser } from '../../db/irrigation-event/create';
import { listIrrigationEventsForUser } from '../../db/irrigation-event/read';
import { listOffSeasonRevisionsForUser, saveOffSeasonForUser } from '../../db/off-season-repository';
import { savePumpForUser, saveEquipmentDefaultPumpForUser } from '../../db/pump-repository';
import { saveHydricGoalForUser } from '../../db/water-management-repository';
import { saveResourceReservoirLinkForUser, saveWaterReservoirForUser, saveWaterResourceForUser } from '../../db/water-resource-repository';
import { ensureWorkspaceForUser, findWorkspaceIdForUser } from '../../db/workspace-repository';
import { changeJournalCard, snapshotNames } from '../../lib/domain/change-journal/card';
import type { ChangeJournalEntry } from '../../lib/domain/change-journal/entry';
import type { IrrigationSnapshot } from '../../lib/domain/domain';
import { offSeasonSchedule, type OffSeasonScope } from '../../lib/domain/off-season';
import { getIrrigationFormHintsForUser } from '../../lib/services/irrigation-form-hints';
import { getIrrigationHistoryDashboardForUser } from '../../lib/services/irrigation-history-service';
import { getIrrigationNeedsDashboardForUser } from '../../lib/services/irrigation-needs-service';
import { listPlannedIrrigationsUnderOffSeasonForUser, OffSeasonScopeError, saveOffSeasonScopeForUser } from '../../lib/services/off-season-service';
import { computeWeeklyPlanForUser } from '../../lib/services/planning-service';
import { fieldsWithoutWords } from '../support/change-journal-words';
import { installTestDatabase, type TestDatabase } from '../support/d1-sqlite';
import { FIXTURE_PLOT_ID, FIXTURE_ZONE_ID, createDripFixture, plannedDraft } from '../support/irrigation-fixtures';
import { validatePlanningSettings } from '../support/onboarding';
import { crossSpaceReferences } from '../support/space-coherence';
import { ALICE, BOB } from '../support/spaces';

/**
 * Le filtre « hors saison », PR B2 : ses gestes enregistrés et ses lecteurs
 * (docs/objectif-automatique-saison-contract.md, sections 4.5, 6 et 7 ;
 * D-337, D-352). Chaque geste est gardé par ferme, daté, écrit au journal des
 * modifications ; un geste sans effet n'écrit rien. Chaque lecteur de
 * l'objectif lit le filtre de sa ferme, et la ferme d'à côté ne change pas.
 * Aucun écran ne l'allume encore (B3).
 *
 * La semaine du lundi 28 septembre au dimanche 4 octobre 2026 ; le calcul,
 * le mardi 29 à 12 h 52 à la ferme.
 */

let database: TestDatabase;
beforeEach(() => {
  database = installTestDatabase();
});
afterEach(() => {
  database.dispose();
});

const NOW = new Date('2026-09-29T10:52:00.000Z');
/** Le lundi 21 septembre à 9 h à la ferme : avant la semaine. */
const BEFORE_THE_WEEK = new Date('2026-09-21T07:00:00.000Z');
const LATER = new Date('2026-09-22T07:00:00.000Z');
const WEEK = ['2026-09-28', '2026-09-29', '2026-09-30', '2026-10-01', '2026-10-02', '2026-10-03', '2026-10-04'];
const PLEIN_CHAMP: OffSeasonScope = { level: 'mode', mode: 'garden' };
const BED_1: OffSeasonScope = { level: 'bed', bedId: 'bed-1' };

const snapshot: IrrigationSnapshot = {
  configuration: { seasonFirst: 2025, seasonLast: 2026 },
  structure: { id: '17', name: 'Ferme', legalCity: 'Rennes', legalPostcode: '35000', legalCountry: 'FR' },
  zones: [{ id: FIXTURE_ZONE_ID, name: 'Zone', area: 1000, seasons: [2026] }],
  plots: [{ id: FIXTURE_PLOT_ID, zoneId: FIXTURE_ZONE_ID, name: 'Jardin', mode: 'garden', length: 40, width: 30, area: 1200, seasons: [2026] }],
  beds: [
    { id: 'bed-1', zoneId: FIXTURE_ZONE_ID, plotId: FIXTURE_PLOT_ID, name: 'P1', length: 40, width: 0.75, alleyWidth: 0.45, area: 30, seasons: [2026] },
    { id: 'bed-2', zoneId: FIXTURE_ZONE_ID, plotId: FIXTURE_PLOT_ID, name: 'P2', length: 40, width: 0.75, alleyWidth: 0.45, area: 30, seasons: [2026] },
  ],
  source: 'cache',
  lastSuccessfulReadAt: '2026-09-29T00:00:00.000Z',
};

const feasibilityRevision = async (owner: string) => Number((database.sqlite.prepare(
  'SELECT feasibility_revision AS revision FROM irrigation_workspaces WHERE id = ?',
).get(await findWorkspaceIdForUser(owner)) as { revision: number }).revision);

const OFF_SEASON_SUBJECTS: ReadonlySet<string> = new Set(['jardin-hors-saison', 'reprise-saison']);
const offSeasonLines = async (owner: string) => (await listChangeJournalForUser(owner, { limit: 50 })).filter((entry) => OFF_SEASON_SUBJECTS.has(entry.subject));
const card = (entry: ChangeJournalEntry) => {
  const read = changeJournalCard(entry, { viewerUserId: ALICE, nameOf: snapshotNames(snapshot) });
  return { subject: read.subject, action: read.action, object: read.object, lines: read.lines };
};

/** La ferme du service du planning (tests/db/planning-service.test.ts) : un goutte-à-goutte sur les deux planches, 20 mm d'objectif. */
async function farmWithWater(owner: string) {
  await validatePlanningSettings(owner);
  const fixture = await createDripFixture(owner, { beds: ['bed-1', 'bed-2'], rateMmPerHour: 14, bedAreaSquareMeters: 30 });
  const resourceId = await saveWaterResourceForUser(owner, owner, null, { name: 'Forage', type: 'borehole', nominalFlowCubicMetersPerHour: 0.511, status: 'active', availableFrom: null, availableUntil: null, notes: null });
  const reservoirId = await saveWaterReservoirForUser(owner, owner, null, {
    name: 'Réserve tampon', type: 'tank', capacityCubicMeters: 60, currentVolumeCubicMeters: 30, minimumSafetyCubicMeters: 0,
    exposedSurfaceSquareMeters: 0, receivesRain: false, evaporationEnabled: false, evaporationCoefficient: 0, status: 'active', notes: null,
  }, '2026-09-29T10:00:00.000Z');
  await saveResourceReservoirLinkForUser(owner, owner, { resourceId, reservoirId, fillMode: 'automatic', active: true });
  const pumpId = await savePumpForUser(owner, owner, null, { name: 'La pompe', maximumFlowCubicMetersPerHour: 8, status: 'active', notes: null, origins: [{ sourceKind: 'reservoir', resourceId: null, reservoirId, isDefault: true }] });
  await saveEquipmentDefaultPumpForUser(owner, owner, fixture.equipment.id, pumpId);
  await saveHydricGoalForUser(owner, { season: 2026, weekStart: '2026-09-21', scopeType: 'farm', otfZoneId: null, otfPlotId: null, otfBedId: null, amountMm: 20 });
  return fixture;
}

async function needsOf(owner: string) {
  const dashboard = await getIrrigationNeedsDashboardForUser({ ownerUserId: owner, season: 2026, snapshot, now: NOW });
  return new Map(dashboard.gardens.flatMap((garden) => garden.beds).map((bed) => [bed.bedId, bed]));
}

test('les gestes sont gardés par ferme et écrits au journal ; un geste sans effet n’écrit rien et le dit ; chaque geste qui change rend la faisabilité à refaire', async () => {
  await ensureWorkspaceForUser(ALICE);
  await ensureWorkspaceForUser(BOB);
  const revisionBefore = await feasibilityRevision(ALICE);
  assert.equal(await saveOffSeasonForUser(ALICE, PLEIN_CHAMP, true, BEFORE_THE_WEEK), true);
  assert.equal(await saveOffSeasonForUser(ALICE, PLEIN_CHAMP, true, LATER), false, 'déjà hors saison : rien');
  assert.equal(await saveOffSeasonForUser(ALICE, BED_1, false, LATER), false, 'reprendre une portée qui n’est pas hors saison : rien');
  assert.equal(await saveOffSeasonForUser(BOB, PLEIN_CHAMP, false, BEFORE_THE_WEEK), false);

  assert.deepEqual(await listOffSeasonRevisionsForUser(ALICE), [{ scope: PLEIN_CHAMP, offSeason: true, createdAt: BEFORE_THE_WEEK.toISOString() }]);
  assert.deepEqual(await listOffSeasonRevisionsForUser(BOB), [], 'la ferme d’à côté n’a rien');
  assert.equal(await feasibilityRevision(ALICE), revisionBefore + 1, 'le geste rend la faisabilité à refaire, une fois');

  const [put] = await offSeasonLines(ALICE);
  assert.deepEqual(fieldsWithoutWords(await offSeasonLines(ALICE)), [], 'le champ a ses mots à l’écran');
  assert.deepEqual(
    { family: put.family, subject: put.subject, action: put.action, objectId: put.objectId, context: put.context, before: put.before, after: put.after, at: put.createdAt },
    { family: 'objectif', subject: 'jardin-hors-saison', action: 'modifie', objectId: null, context: { offSeasonMode: 'garden' }, before: { offSeason: 0 }, after: { offSeason: 1 }, at: BEFORE_THE_WEEK.toISOString() },
  );
  assert.deepEqual(card(put), { subject: 'Mise hors saison', action: 'Modification', object: 'tout le plein champ', lines: [{ label: 'Irrigation', text: 'en saison → ignorée, hors saison' }] });
  assert.deepEqual(await offSeasonLines(BOB), []);

  // Reprendre le plein champ, puis une planche, par son nom.
  assert.equal(await saveOffSeasonForUser(ALICE, PLEIN_CHAMP, false, NOW), true);
  assert.equal(await saveOffSeasonForUser(ALICE, BED_1, true, NOW), true);
  const lines = await offSeasonLines(ALICE);
  assert.equal(lines.length, 3);
  const resumed = lines.find((entry) => entry.subject === 'reprise-saison')!;
  assert.deepEqual(card(resumed), { subject: 'Reprise de l’irrigation', action: 'Modification', object: 'tout le plein champ', lines: [{ label: 'Irrigation', text: 'ignorée, hors saison → en saison' }] });
  const bed = lines.find((entry) => entry.objectId === 'bed-1')!;
  assert.deepEqual([bed.subject, bed.context], ['jardin-hors-saison', { bedId: 'bed-1' }]);
  assert.equal(card(bed).object, 'Planche · P1');
  assert.deepEqual(fieldsWithoutWords(lines), []);
  assert.equal(await feasibilityRevision(ALICE), revisionBefore + 3);
  assert.deepEqual((await listOffSeasonRevisionsForUser(ALICE)).map((revision) => [revision.scope, revision.offSeason]), [[PLEIN_CHAMP, true], [PLEIN_CHAMP, false], [BED_1, true]]);
  assert.deepEqual(crossSpaceReferences(database.sqlite), []);
});

test('deux gestes de la même milliseconde : la base garde l’ordre reçu, et le second fait foi (docs/revision-order-contract.md)', async () => {
  const workspaceId = await ensureWorkspaceForUser(ALICE);
  const at = '2026-09-29T08:00:00.000Z';
  // Des identifiants dont l'ordre alphabétique contredit l'ordre d'écriture : seul `rowid` départage.
  const insert = database.sqlite.prepare(`INSERT INTO irrigation_off_season_revisions (id, workspace_id, scope_level, scope_id, off_season, actor_user_id, created_at) VALUES (?, ?, 'bed', 'bed-1', ?, ?, ?)`);
  insert.run('b-mettre', workspaceId, 1, ALICE, at);
  insert.run('a-reprendre', workspaceId, 0, ALICE, at);
  const revisions = await listOffSeasonRevisionsForUser(ALICE);
  assert.deepEqual(revisions.map((revision) => revision.offSeason), [true, false], 'dans l’ordre d’écriture');
  const bed1 = { id: 'bed-1', zoneId: FIXTURE_ZONE_ID, plotId: FIXTURE_PLOT_ID, plotMode: 'garden' as const };
  assert.equal(offSeasonSchedule(revisions).daysOf(bed1)('2026-09-29'), false, 'le second, « Reprendre », fait foi pour toute la journée');
  // La garde d'écriture lit le dernier geste de la même façon : la planche est en saison, la reprendre ne change rien.
  assert.equal(await saveOffSeasonForUser(ALICE, BED_1, false, new Date(at)), false);
  assert.equal(await saveOffSeasonForUser(ALICE, BED_1, true, new Date(at)), true, 'la remettre hors saison, à la même milliseconde, s’écrit');
  assert.equal(offSeasonSchedule(await listOffSeasonRevisionsForUser(ALICE)).daysOf(bed1)('2026-09-29'), true);
});

test('une portée invalide ne s’écrit pas ; un lieu que la ferme ne connaît pas ne se met pas hors saison, mais toute portée se reprend', async () => {
  const workspaceId = await ensureWorkspaceForUser(ALICE);
  await assert.rejects(saveOffSeasonForUser(ALICE, { level: 'bed', bedId: ' ' }, true, NOW), /invalide/);
  await assert.rejects(saveOffSeasonForUser(ALICE, { level: 'mode', mode: 'unclassified' } as unknown as OffSeasonScope, true, NOW), /invalide/, 'jamais « à classer » (D-003)');
  assert.throws(() => database.sqlite.prepare(`INSERT INTO irrigation_off_season_revisions (id, workspace_id, scope_level, scope_id, off_season, actor_user_id) VALUES ('x', ?, 'farm', 'ferme', 1, ?)`).run(workspaceId, ALICE), /CHECK/, 'la base refuse aussi une portée inconnue');
  assert.deepEqual(await listOffSeasonRevisionsForUser(ALICE), []);

  const save = (scope: OffSeasonScope, offSeason: boolean, now = NOW) => saveOffSeasonScopeForUser({ ownerUserId: ALICE, snapshot, scope, offSeason, now });
  await assert.rejects(save({ level: 'bed', bedId: 'planche-inconnue' }, true), OffSeasonScopeError);
  await assert.rejects(save({ level: 'plot', plotId: 'jardin-inconnu' }, true), /rien n’a été mis hors saison/);
  await assert.rejects(save({ level: 'zone', zoneId: 'parcelle-inconnue' }, true), OffSeasonScopeError);
  assert.equal(await save({ level: 'plot', plotId: FIXTURE_PLOT_ID }, true), true, 'un jardin de la ferme');
  assert.equal(await save({ level: 'zone', zoneId: FIXTURE_ZONE_ID }, true), true, 'une parcelle de la ferme');
  assert.equal(await save({ level: 'mode', mode: 'greenhouse' }, true), true, 'tout le sous-abri, même sans abri');
  // Une planche qu'Ouvre ta ferme ne montre plus se reprend : rien ne reste hors saison sans pouvoir en sortir.
  const tomorrow = new Date('2026-09-30T07:00:00.000Z');
  assert.equal(await saveOffSeasonForUser(ALICE, { level: 'bed', bedId: 'planche-disparue' }, true, NOW), true);
  assert.equal(await save({ level: 'bed', bedId: 'planche-disparue' }, false, tomorrow), true);
  assert.equal(await save({ level: 'bed', bedId: 'planche-disparue' }, false, tomorrow), false, 'une seconde fois, rien');
});

test('les lecteurs lisent le filtre de leur ferme : besoin, planning, historique, aide du formulaire ; la ferme d’à côté ne change pas', async () => {
  await farmWithWater(ALICE);
  await farmWithWater(BOB);
  assert.equal(await saveOffSeasonForUser(ALICE, BED_1, true, BEFORE_THE_WEEK), true);

  const alice = await needsOf(ALICE);
  const bob = await needsOf(BOB);
  assert.equal(alice.get('bed-1')?.objectiveMm, null, 'hors saison : pas d’objectif, jamais zéro');
  assert.equal(alice.get('bed-1')?.offSeason, true);
  assert.deepEqual(alice.get('bed-1')?.offSeasonDates, WEEK);
  assert.equal(alice.get('bed-1')?.effectiveNeedMm, null);
  assert.equal(alice.get('bed-1')?.completeness.missing.includes('objective'), false);
  assert.equal(alice.get('bed-2')?.objectiveMm, 20);
  assert.equal(bob.get('bed-1')?.objectiveMm, 20, 'la ferme d’à côté garde son objectif');
  assert.equal('offSeason' in bob.get('bed-1')!, false);

  const plan = async (owner: string) => (await computeWeeklyPlanForUser({ ownerUserId: owner, season: 2026, snapshot, now: NOW, trigger: 'manual', actorUserId: owner })).calculation.summary.beds.map((row) => row.bedId);
  assert.deepEqual(await plan(ALICE), ['bed-2'], 'le planning ne sert pas la planche hors saison');
  assert.deepEqual(await plan(BOB), ['bed-1', 'bed-2']);

  const selection = { period: { mode: 'week' as const, anchorDate: '2026-09-28' }, scope: { level: 'farm' as const }, page: 1 };
  const history = async (owner: string) => (await getIrrigationHistoryDashboardForUser({ ownerUserId: owner, season: 2026, snapshot, now: NOW, selection })).summary;
  assert.deepEqual((await history(ALICE)).objectiveBeds, { withObjective: 1, total: 2, bedDays: 7, offSeason: 1 });
  assert.deepEqual((await history(BOB)).objectiveBeds, { withObjective: 2, total: 2, bedDays: 14 });

  const hints = async (owner: string) => (await getIrrigationFormHintsForUser({ ownerUserId: owner, season: 2026, snapshot, now: NOW, planningEnabled: false })).weeks[0].objectiveMmByBed;
  assert.deepEqual(await hints(ALICE), { 'bed-2': 20 }, 'l’aide du formulaire ne propose rien pour la planche hors saison');
  assert.deepEqual(await hints(BOB), { 'bed-1': 20, 'bed-2': 20 });
});

test('la liste des arrosages planifiés à proposer à l’annulation : ceux de la ferme, pas démarrés ; annulés par le geste du planning, ils en sortent', async () => {
  const fixture = await farmWithWater(ALICE);
  const bobFixture = await farmWithWater(BOB);
  const wednesday = { startAt: '2026-09-30T06:00:00.000Z', endAt: '2026-09-30T07:00:00.000Z', durationSeconds: 3600 };
  const created = await createIrrigationEventForUser(ALICE, plannedDraft(fixture, wednesday));
  await createIrrigationEventForUser(BOB, plannedDraft(bobFixture, wednesday));
  const list = (owner: string, scope: OffSeasonScope = BED_1) => listPlannedIrrigationsUnderOffSeasonForUser({ ownerUserId: owner, season: 2026, snapshot, scope, now: NOW });

  const [item] = await list(ALICE);
  assert.deepEqual(
    { eventEquipmentId: item.eventEquipmentId, equipmentName: item.equipmentName, plannedStartAt: item.plannedStartAt, coveredBedIds: item.coveredBedIds, otherBedIds: item.otherBedIds },
    { eventEquipmentId: created.eventEquipmentId, equipmentName: 'Goutte-à-goutte', plannedStartAt: wednesday.startAt, coveredBedIds: ['bed-1'], otherBedIds: ['bed-2'] },
    'l’annuler prive aussi la planche P2 de son eau : l’écran le dira',
  );
  assert.equal((await list(ALICE, PLEIN_CHAMP))[0]?.coveredBedIds.length, 2);
  assert.deepEqual(await listOffSeasonRevisionsForUser(ALICE), [], 'la liste ne met rien hors saison');

  // Le geste ne réécrit pas l'arrosage planifié (section 4.2) : c'est la fenêtre de B3 qui proposera de l'annuler.
  const events = await listIrrigationEventsForUser(ALICE, 2026);
  assert.equal(await saveOffSeasonScopeForUser({ ownerUserId: ALICE, snapshot, scope: BED_1, offSeason: true, now: NOW }), true);
  assert.deepEqual(await listIrrigationEventsForUser(ALICE, 2026), events, 'l’arrosage planifié reste tel quel, planche hors saison');
  assert.equal((await list(ALICE)).length, 1, 'et reste proposé à l’annulation');

  await cancelPlannedIrrigationForUser(ALICE, item.eventEquipmentId);
  assert.deepEqual(await list(ALICE), [], 'annulé, il n’est plus proposé');
  assert.equal((await list(BOB)).length, 1, 'la ferme d’à côté garde le sien');
  assert.deepEqual(await list(ALICE, { level: 'mode', mode: 'greenhouse' }), [], 'tout le sous-abri ne couvre pas ce jardin');
});
