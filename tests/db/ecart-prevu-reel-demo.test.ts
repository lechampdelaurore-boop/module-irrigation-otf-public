import assert from 'node:assert/strict';
import test, { afterEach, beforeEach } from 'node:test';
import { listEquipmentForUser } from '../../db/equipment/read';
import { listIrrigationEventsForUser } from '../../db/irrigation-event/read';
import { demoFarmSnapshot } from '../../lib/adapters/demo/farms';
import { DEMO_HISTORY_MINUTES_BY_MONTH } from '../../lib/adapters/demo/module-data';
import type { GapAdoption } from '../../lib/domain/applied-water-gap';
import { DEMO_PROFILES, demoOwnerUserId, resolveDemoChoice, type DemoChoice } from '../../lib/domain/demo/catalogue';
import { millisecondsFromMinutes, millisecondsFromSeconds, secondsFromMilliseconds } from '../../lib/domain/units';
import { getAppliedWaterGapsForUser } from '../../lib/services/applied-water-gap';
import { adoptAppliedWaterGapForUser } from '../../lib/services/applied-water-gap-adoption';
import { installSimulatedDate, runOnSimulatedDay, uninstallSimulatedDate } from '../../lib/services/demo-clock';
import { resetDemoSpace, resetInactiveDemoSpaces } from '../../lib/services/demo-reset';
import { prepareDemoSpace } from '../../lib/services/demo-space';
import { installTestDatabase, type TestDatabase } from '../support/d1-sqlite';

/**
 * Le cas d'écart prévu/réel de la démonstration (amélioration n° 5,
 * docs/ameliorations-4-5-contract.md, section 4, F747, D-295 ; écart E2 de la
 * recette du 22 novembre 2026) : la « Ferme des Trois Noues », au début de
 * l'été, a arrosé son clos plus longtemps que prévu les trois semaines
 * d'avant. Préparée comme le Worker de démonstration la prépare, au jour du
 * moment, elle montre le bloc « L'eau apportée s'écarte du prévu » ; aucune
 * autre ferme, aucun autre moment ; « Adopter » ne change que l'espace de
 * l'invité, et la remise à zéro, du bouton comme de la nuit, rend le cas. La
 * règle elle-même se prouve dans tests/ecart-prevu-reel.test.ts.
 */

/** L'heure réelle, figée comme dans les tests du lot I : la démonstration se prépare à l'heure réelle de la ferme. */
const OriginalDate = Date;
const realClockNow = OriginalDate.now;
const PINNED_REAL_NOW = OriginalDate.UTC(2026, 10, 18, 10, 30);
const SEASON = 2026;
const ETE = resolveDemoChoice('maraichage', 'ete');
const CLOS = 'Goutte-à-goutte du clos';
/** Les lundis des trois semaines comparées au 16 juin 2026, à 7 h à la ferme. */
const MONDAYS = ['2026-05-25T05:00:00.000Z', '2026-06-01T05:00:00.000Z', '2026-06-08T05:00:00.000Z'];

let database: TestDatabase;
const savedDemoMode = process.env.DEMO_MODE;
beforeEach(() => {
  database = installTestDatabase();
  process.env.DEMO_MODE = 'true';
  OriginalDate.now = () => PINNED_REAL_NOW;
  installSimulatedDate();
});
afterEach(() => {
  uninstallSimulatedDate();
  OriginalDate.now = realClockNow;
  database.dispose();
  if (savedDemoMode === undefined) delete process.env.DEMO_MODE;
  else process.env.DEMO_MODE = savedDemoMode;
});

/** L'espace d'un invité, préparé au jour du moment ; `onDay` joue un geste ce jour-là. */
async function openDemo(guest: string, choice: DemoChoice = ETE) {
  const owner = demoOwnerUserId(guest, choice);
  const onDay = <T>(work: () => Promise<T>) => runOnSimulatedDay(choice.moment.dateKey, work);
  await onDay(() => prepareDemoSpace(owner, choice));
  const snapshot = demoFarmSnapshot(choice.profile.id, choice.moment.dateKey);
  const view = () => onDay(() => getAppliedWaterGapsForUser({ ownerUserId: owner, season: SEASON, snapshot }));
  return { owner, onDay, snapshot, view };
}

async function clos(owner: string) {
  const equipment = (await listEquipmentForUser(owner)).find((item) => item.name === CLOS);
  assert.ok(equipment, CLOS);
  const [setting] = equipment.settings;
  assert.equal(setting.kind, 'drip');
  return { equipment, rateMmPerHour: setting.kind === 'drip' ? setting.rateMmPerHour : null };
}

function setLastVisit(ownerUserId: string, modifier: string): void {
  database.sqlite.prepare(`UPDATE irrigation_workspaces SET updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now', ?) WHERE owner_user_id = ?`)
    .run(modifier, ownerUserId);
}

test('début d’été : le bloc pour les deux planches du clos, plus d’eau apportée que prévu, la cause du débit, 4 mm/h proposés', async () => {
  const { view } = await openDemo('invite-a');
  const read = await view();
  assert.equal(read.weekStart, '2026-06-15');
  assert.deepEqual(read.weeks.map((week) => week.weekStart), ['2026-05-25', '2026-06-01', '2026-06-08']);
  assert.deepEqual(read.gaps.map((gap) => [gap.bedName, gap.plotName, gap.direction, gap.doneIrrigations]),
    [['S01', 'Clos des saules', 'more', 3], ['S02', 'Clos des saules', 'more', 3]]);
  for (const gap of read.gaps) {
    assert.deepEqual(gap.weeks.map((week) => [week.plannedMm, week.appliedMm, Math.round(week.gapPercent)]), [[4, 6, 50], [8, 12, 50], [8, 12, 50]], gap.bedName);
    // Une seule cause, le débit ; aucune pluie mesurée dans la démonstration, donc pas la cause de la pluie.
    assert.deepEqual(gap.causes.map((cause) => cause.kind), ['flow'], gap.bedName);
    const [flow] = gap.causes;
    assert.ok(flow.kind === 'flow');
    assert.deepEqual([flow.equipmentName, flow.settingName, flow.irrigations], [CLOS, 'Réglage habituel', 3]);
    assert.ok(Math.abs(flow.durationRatio - 2 / 3) < 1e-9, 'la médiane des rapports « durée prévue / durée réelle » : deux tiers');
    assert.deepEqual([flow.current, flow.proposed], [{ kind: 'drip', rateMmPerHour: 6 }, { kind: 'drip', rateMmPerHour: 4 }]);
  }
  assert.equal(read.objectiveCauseNotice, null);
});

test('début d’été : seule la prévision change ; les durées faites restent l’habitude de la ferme (F169), les autres arrosages sans prévision', async () => {
  const { owner } = await openDemo('invite-a');
  const events = await listIrrigationEventsForUser(owner, SEASON);
  // Un arrosage par semaine et par goutte-à-goutte, du lundi 20 avril au lundi 15 juin.
  assert.equal(events.length, 4 * 9);
  for (const event of events) {
    const { actualStartAt, plannedStartAt, plannedEndAt, plannedDurationSeconds, actualDurationSeconds } = event.equipment;
    assert.ok(actualStartAt);
    assert.equal(event.status, 'completed');
    const habitSeconds = secondsFromMilliseconds(millisecondsFromMinutes(DEMO_HISTORY_MINUTES_BY_MONTH[actualStartAt.slice(5, 7)]));
    assert.equal(actualDurationSeconds, habitSeconds, `${event.equipment.equipmentSnapshot.name} le ${actualStartAt}`);
    const longer = event.equipment.equipmentSnapshot.name === CLOS && MONDAYS.includes(actualStartAt);
    if (longer) {
      assert.equal(plannedStartAt, actualStartAt, 'prévu à l’heure où il a commencé');
      assert.equal(plannedDurationSeconds, habitSeconds * 2 / 3, 'prévu pour les deux tiers de la durée faite');
      assert.equal(Date.parse(plannedEndAt!) - Date.parse(plannedStartAt!), millisecondsFromSeconds(plannedDurationSeconds));
    } else {
      assert.deepEqual([plannedStartAt, plannedEndAt, plannedDurationSeconds], [null, null, habitSeconds], `${event.equipment.equipmentSnapshot.name} le ${actualStartAt}`);
    }
  }
  assert.equal(events.filter((event) => event.equipment.plannedStartAt !== null).length, MONDAYS.length);
});

test('aucune autre ferme, aucun autre moment n’a d’écart : leur historique n’a pas de prévision', async () => {
  for (const profile of DEMO_PROFILES) {
    for (const moment of profile.moments) {
      if (profile.id === 'maraichage' && moment.id === 'ete') continue;
      const choice = resolveDemoChoice(profile.id, moment.id);
      const { owner, view } = await openDemo('invite-b', choice);
      assert.deepEqual((await view()).gaps, [], `${profile.id} · ${moment.id}`);
      const events = await listIrrigationEventsForUser(owner, SEASON);
      assert.ok(events.every((event) => event.equipment.plannedStartAt === null), `${profile.id} · ${moment.id}`);
    }
  }
});

test('« Adopter » change le réglage de l’invité seul ; « Remettre à zéro » rend le cas', async () => {
  const mine = await openDemo('invite-a');
  const other = await openDemo('invite-b');
  const [gap] = (await mine.view()).gaps;
  const [flow] = gap.causes;
  assert.ok(flow.kind === 'flow' && flow.proposed);
  const adoption: GapAdoption = { kind: 'flow', bedId: gap.bedId, settingId: flow.settingId, proposed: flow.proposed };
  const adopted = await mine.onDay(() => adoptAppliedWaterGapForUser({
    ownerUserId: mine.owner, season: SEASON, snapshot: mine.snapshot, weekStart: '2026-06-15', adoption,
  }));
  assert.equal(adopted.adopted, true);
  assert.equal(adopted.message, `Le réglage « Réglage habituel » de ${CLOS} est enregistré : 4 mm/h. Les irrigations passées gardent l’ancien débit ; le plan se recalcule.`);
  assert.deepEqual(adopted.gaps, [], 'le bloc disparaît : les semaines passées ont été prévues avec l’ancien débit');
  assert.equal((await clos(mine.owner)).rateMmPerHour, 4);
  // L'autre invité, au même moment, n'a rien vu changer.
  assert.equal((await clos(other.owner)).rateMmPerHour, 6);
  assert.equal((await other.view()).gaps.length, 2);

  await mine.onDay(() => resetDemoSpace(mine.owner));
  assert.equal((await clos(mine.owner)).rateMmPerHour, 6, 'le réglage du premier jour');
  assert.deepEqual((await mine.view()).gaps.map((item) => item.bedName), ['S01', 'S02']);
});

test('la tâche de nuit rend le cas à l’invité qui revient après plus de 24 heures', async () => {
  const mine = await openDemo('invite-a');
  const [gap] = (await mine.view()).gaps;
  const [flow] = gap.causes;
  assert.ok(flow.kind === 'flow' && flow.proposed);
  await mine.onDay(() => adoptAppliedWaterGapForUser({
    ownerUserId: mine.owner, season: SEASON, snapshot: mine.snapshot, weekStart: '2026-06-15',
    adoption: { kind: 'flow', bedId: gap.bedId, settingId: flow.settingId, proposed: flow.proposed },
  }));
  assert.deepEqual((await mine.view()).gaps, []);

  setLastVisit(mine.owner, '-25 hours');
  assert.equal(await resetInactiveDemoSpaces(), 1);
  // La visite suivante prépare un espace neuf, comme à la première ouverture.
  const back = await openDemo('invite-a');
  assert.equal(back.owner, mine.owner);
  assert.equal((await clos(back.owner)).rateMmPerHour, 6);
  assert.deepEqual((await back.view()).gaps.map((item) => [item.bedName, item.causes.map((cause) => cause.kind)]), [['S01', ['flow']], ['S02', ['flow']]]);
});
