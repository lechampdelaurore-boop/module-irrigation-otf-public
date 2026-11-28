import assert from 'node:assert/strict';
import { AsyncLocalStorage } from 'node:async_hooks';
import test, { afterEach, beforeEach } from 'node:test';
import { listAutomaticObjectiveRevisionsForUser } from '../../db/automatic-objective-repository';
import { observeDatabaseCalls, overrideDatabase } from '../../db/binding';
import { listSpeciesCorrespondencesForWorkspace } from '../../db/crop-water/entries';
import { readCropWaterInputsForWorkspace } from '../../db/crop-water/inputs';
import { listEquipmentPosesForUser } from '../../db/equipment-placement-poses';
import { listEquipmentForUser } from '../../db/equipment/read';
import { saveFeatureSelectionForUser } from '../../db/feature-selection-repository';
import { listGardenGroupsForUser } from '../../db/garden-group-repository';
import { readIrrigationNeedSettingsForUser } from '../../db/irrigation-need-repository';
import { listIrrigationEventsForUser } from '../../db/irrigation-event/read';
import { readLatestPlanForUser, readPlanningSettingsForUser } from '../../db/planning-repository';
import { createRequestMemo, provideRequestMemo, type RequestMemo } from '../../db/request-memo';
import { listWeatherDailyValuesForUser, readWeatherGeocodeForUser } from '../../db/water-management-repository';
import { listWaterInfrastructureForUser } from '../../db/water-resource-repository';
import { ensureWorkspaceForUser, findWorkspaceIdForUser } from '../../db/workspace-repository';
import { demoFarmSnapshot } from '../../lib/adapters/demo/farms';
import { DEMO_PROFILES, demoOwnerUserId, resolveDemoChoice, type DemoChoice } from '../../lib/domain/demo/catalogue';
import { weekDateKeys, weekStartDateKey } from '../../lib/domain/water-management';
import type { TodayView } from '../../lib/domain/today/today-view';
import { prepareDemoSpace } from '../../lib/services/demo-space';
import { getFeatureSelectionForUser } from '../../lib/services/feature-selection-service';
import { getIrrigationFeasibilityForUser } from '../../lib/services/irrigation-feasibility-service';
import { getTodayViewForUser } from '../../lib/services/today-service';
import { installTestDatabase, type TestDatabase } from '../support/d1-sqlite';
import { ALICE, BOB } from '../support/spaces';

/**
 * « Aujourd'hui » lit chaque donnée une fois, et d'un bloc (accélérer le site,
 * A3, D-360 ; docs/acceleration-du-site-contract.md, section 5). Le modèle de
 * la page est le même avec et sans la mémoire de la requête, pour chaque
 * profil et chaque moment de la démonstration (F1111) ; huit lectures de plus
 * ne vont qu'une fois à la base par requête et par espace, une copie par
 * appelant, relues après une écriture (F1112) ; la faisabilité qui recommence
 * relit ses sources (F1113) ; les lectures d'un même dépôt partent en un seul
 * appel (F1114) ; le modèle demande au plus 60 appels à la base (F1115).
 * Rejoué dans les passages d'isolation (F336, F379) : Alice et Bob y sont deux
 * personnes, deux fermes d'une même personne, ou l'espace sans ferme et
 * l'espace de ferme d'une même personne.
 */

const RealDate = globalThis.Date;

/** Une horloge arrêtée : les deux calculs d'un même modèle voient le même instant. */
function frozenDate(at: number): DateConstructor {
  function FrozenDate(this: unknown, ...args: unknown[]) {
    if (!new.target) return new RealDate(at).toString();
    return Reflect.construct(RealDate, args.length === 0 ? [at] : args, new.target);
  }
  FrozenDate.prototype = RealDate.prototype;
  FrozenDate.now = () => at;
  FrozenDate.parse = RealDate.parse;
  FrozenDate.UTC = RealDate.UTC;
  return FrozenDate as unknown as DateConstructor;
}

const requests = new AsyncLocalStorage<RequestMemo>();

/** Une requête simulée : sa propre mémoire, le temps de `work`, comme vinext en donne une à chaque requête. */
function inRequest<T>(work: () => Promise<T>): Promise<T> {
  return requests.run(createRequestMemo(), work);
}

/** Les appels à la base faits pendant `work`, comptés comme l'en-tête de A1 les compte : un lot pour un appel. */
async function countedCalls<T>(work: () => Promise<T>): Promise<{ value: T; calls: number }> {
  let calls = 0;
  observeDatabaseCalls((call) => {
    calls += 1;
    return call();
  });
  try {
    return { value: await work(), calls };
  } finally {
    observeDatabaseCalls(null);
  }
}

type Execution = { sql: string };

/**
 * La base de test, observée : chaque instruction exécutée est notée, et une
 * instruction choisie peut faire écrire la base juste avant de partir, sans
 * passer par `db` : l'écriture d'une autre requête, que la mémoire de
 * celle-ci ne voit pas.
 */
function observe(d1: D1Database) {
  const executions: Execution[] = [];
  const inner = new WeakMap<D1PreparedStatement, D1PreparedStatement>();
  const sqlOf = new WeakMap<D1PreparedStatement, string>();
  let before: ((sql: string) => void) | null = null;
  const statement = (real: D1PreparedStatement, sql: string): D1PreparedStatement => {
    const observed = new Proxy(real, {
      get(target, property) {
        const value = Reflect.get(target, property) as unknown;
        if (typeof value !== 'function') return value;
        const method = value as (...args: unknown[]) => unknown;
        if (property === 'bind') return (...values: unknown[]) => statement(method.apply(target, values) as D1PreparedStatement, sql);
        if (property === 'first' || property === 'all' || property === 'run' || property === 'raw') {
          return (...args: unknown[]) => {
            before?.(sql);
            executions.push({ sql });
            return method.apply(target, args);
          };
        }
        return method.bind(target);
      },
    });
    inner.set(observed, real);
    sqlOf.set(observed, sql);
    return observed;
  };
  const database = new Proxy(d1, {
    get(target, property) {
      if (property === 'prepare') return (sql: string) => statement(target.prepare(sql), sql);
      if (property === 'batch') {
        return (statements: D1PreparedStatement[]) => {
          for (const item of statements) executions.push({ sql: sqlOf.get(item) ?? '' });
          return target.batch(statements.map((item) => inner.get(item) ?? item));
        };
      }
      const value = Reflect.get(target, property) as unknown;
      return typeof value === 'function' ? (value as (...args: unknown[]) => unknown).bind(target) : value;
    },
  });
  return {
    database,
    executions,
    /** `hook` reçoit le texte de chaque instruction juste avant qu'elle parte. */
    beforeEach: (hook: ((sql: string) => void) | null) => {
      before = hook;
    },
  };
}

let database: TestDatabase;
const savedDemoMode = process.env.DEMO_MODE;
beforeEach(() => {
  database = installTestDatabase();
  provideRequestMemo(() => requests.getStore() ?? null);
});
afterEach(() => {
  observeDatabaseCalls(null);
  provideRequestMemo(null);
  globalThis.Date = RealDate;
  if (savedDemoMode === undefined) delete process.env.DEMO_MODE;
  else process.env.DEMO_MODE = savedDemoMode;
  database.dispose();
});

/**
 * Un espace de démonstration préparé, l'horloge arrêtée au matin de son
 * moment ; la ferme vierge n'en a pas tant que l'invité n'a rien choisi.
 */
async function demoSpace(choice: DemoChoice): Promise<{ owner: string; workspaceId: string | null; locationKey: string | null }> {
  process.env.DEMO_MODE = 'true';
  globalThis.Date = frozenDate(RealDate.parse(`${choice.moment.dateKey}T09:41:07.123Z`));
  const owner = demoOwnerUserId('invite-a', choice);
  await prepareDemoSpace(owner, choice);
  const workspaceId = await findWorkspaceIdForUser(owner);
  const location = workspaceId === null ? undefined : database.sqlite.prepare(
    `SELECT location_key FROM irrigation_weather_geocodes WHERE workspace_id = ? ORDER BY location_key LIMIT 1`,
  ).get(workspaceId) as { location_key: string } | undefined;
  return { owner, workspaceId, locationKey: location?.location_key ?? null };
}

/** L'espace préparé de la ferme la plus complète, au début de l'été : toutes les lectures y trouvent des données. */
async function fullDemoSpace(): Promise<{ owner: string; workspaceId: string; locationKey: string }> {
  const { owner, workspaceId, locationKey } = await demoSpace(resolveDemoChoice('maraichage', 'ete'));
  assert.ok(workspaceId, 'l’espace de la ferme de démonstration');
  assert.ok(locationKey, 'la ferme de démonstration a son lieu de météo');
  return { owner, workspaceId, locationKey };
}

/**
 * Le modèle d'« Aujourd'hui » de chaque espace de démonstration, calculé deux
 * fois sur les mêmes données : sans la mémoire de la requête, chaque lecture
 * allant à la base, puis avec elle, comme en ligne, ses appels comptés.
 */
async function todayTwice(choice: DemoChoice): Promise<{ without: TodayView; remembered: TodayView; calls: number; writes: string[] }> {
  const { owner } = await demoSpace(choice);
  const observed = observe(database.d1);
  overrideDatabase(observed.database);
  const snapshot = demoFarmSnapshot(choice.profile.id, choice.moment.dateKey);
  const { enabled } = await getFeatureSelectionForUser(owner);
  const request = { ownerUserId: owner, season: snapshot.configuration.seasonFirst, snapshot, enabled, now: new Date() };
  const without = await getTodayViewForUser(request);
  const { value: remembered, calls } = await inRequest(() => countedCalls(() => getTodayViewForUser(request)));
  const writes = observed.executions.map((item) => item.sql).filter((sql) => !/^\s*SELECT\b/i.test(sql));
  return { without, remembered, calls, writes };
}

test('F1111 : le modèle d’« Aujourd’hui » est le même avec et sans la mémoire de la requête, pour chaque profil et chaque moment', async () => {
  for (const profile of DEMO_PROFILES) {
    for (const moment of profile.moments) {
      const label = `${profile.id} · ${moment.id}`;
      database.dispose();
      database = installTestDatabase();
      const { without, remembered, writes } = await todayTwice(resolveDemoChoice(profile.id, moment.id));
      assert.deepEqual(writes, [], `${label} : le modèle n’écrit rien, les deux calculs lisent les mêmes données`);
      assert.deepStrictEqual(remembered, without, label);
    }
  }
});

test('F1115 : le modèle d’« Aujourd’hui » demande au plus 60 appels à la base, pour chaque profil et chaque moment', async () => {
  const counts: string[] = [];
  for (const profile of DEMO_PROFILES) {
    for (const moment of profile.moments) {
      database.dispose();
      database = installTestDatabase();
      const { calls } = await todayTwice(resolveDemoChoice(profile.id, moment.id));
      counts.push(`${profile.id} · ${moment.id} : ${calls}`);
      assert.ok(calls <= 60, counts.at(-1));
    }
  }
  // La ferme la plus complète : toutes ses lectures, une fois chacune (101 avant la PR).
  assert.ok(counts.some((line) => line.startsWith('maraichage · ete : ') && Number(line.split(' : ')[1]) > 20), counts.join('\n'));
});

const SEASON = 2026;
const WEEK_START = '2026-06-15';
const WEEK = weekDateKeys(WEEK_START);
const NEXT_WEEK_START = '2026-06-22';
const LOCATION = 'otf:nantes:44000';
const OTHER_LOCATION = 'otf:angers:49000';

type Space = { key: string; workspaceId: string; locationKey: string };

/**
 * Les huit lectures gardées pour la requête (F1112), chacune lue pour un
 * espace : sa clé et son identifiant. `others` : la même lecture, un autre
 * argument changé à chaque fois (une saison, une semaine, une date, un lieu),
 * qui a sa propre entrée.
 */
const REMEMBERED_READS: { name: string; read: (space: Space) => Promise<unknown>; others: ((space: Space) => Promise<unknown>)[] }[] = [
  {
    name: 'le dernier plan d’une semaine',
    read: ({ key }) => readLatestPlanForUser(key, SEASON, WEEK_START),
    others: [({ key }) => readLatestPlanForUser(key, SEASON - 1, WEEK_START), ({ key }) => readLatestPlanForUser(key, SEASON, NEXT_WEEK_START)],
  },
  {
    name: 'les entrées du besoin par culture',
    read: ({ workspaceId }) => readCropWaterInputsForWorkspace(workspaceId, SEASON),
    others: [({ workspaceId }) => readCropWaterInputsForWorkspace(workspaceId, SEASON - 1)],
  },
  { name: 'la correspondance des espèces', read: ({ workspaceId }) => listSpeciesCorrespondencesForWorkspace(workspaceId), others: [] },
  {
    name: 'les poses du matériel',
    read: ({ key }) => listEquipmentPosesForUser(key, SEASON),
    others: [({ key }) => listEquipmentPosesForUser(key, SEASON - 1)],
  },
  {
    name: 'les valeurs météo',
    read: ({ key, locationKey }) => listWeatherDailyValuesForUser(key, locationKey, WEEK[0], WEEK[6]),
    others: [
      ({ key, locationKey }) => listWeatherDailyValuesForUser(key, locationKey, WEEK[1], WEEK[6]),
      ({ key, locationKey }) => listWeatherDailyValuesForUser(key, locationKey, WEEK[0], WEEK[5]),
      ({ key }) => listWeatherDailyValuesForUser(key, OTHER_LOCATION, WEEK[0], WEEK[6]),
    ],
  },
  {
    name: 'le lieu de la météo',
    read: ({ key, locationKey }) => readWeatherGeocodeForUser(key, locationKey),
    others: [({ key }) => readWeatherGeocodeForUser(key, OTHER_LOCATION)],
  },
  { name: 'les réglages du planning', read: ({ key }) => readPlanningSettingsForUser(key), others: [] },
  { name: 'l’objectif automatique', read: ({ key }) => listAutomaticObjectiveRevisionsForUser(key), others: [] },
];

test('F1112 : chacune des huit lectures ne va qu’une fois à la base par requête et par espace, même demandée en parallèle, et se relit après une écriture', async () => {
  const alice = { key: ALICE, workspaceId: await ensureWorkspaceForUser(ALICE), locationKey: LOCATION };
  const bob = { key: BOB, workspaceId: await ensureWorkspaceForUser(BOB), locationKey: LOCATION };
  for (const { name, read, others } of REMEMBERED_READS) {
    // Hors d'une requête (la tâche du matin, les tests), lue à chaque fois.
    const alone = (await countedCalls(() => read(alice))).calls;
    assert.ok(alone > 0, `${name} : lue à la base`);
    assert.equal((await countedCalls(() => read(alice))).calls, alone, `${name} : hors d’une requête, relue à chaque fois`);

    await inRequest(async () => {
      assert.equal((await countedCalls(() => Promise.all([read(alice), read(alice)]))).calls, alone, `${name} : une seule lecture pour deux demandes en même temps`);
      assert.equal((await countedCalls(() => read(alice))).calls, 0, `${name} : gardée pour la requête`);
      for (const [index, other] of others.entries()) {
        // L'espace est déjà connu de la requête : seule la lecture elle-même va à la base.
        assert.ok((await countedCalls(() => other(alice))).calls > 0, `${name} : un autre argument (${index + 1}), une autre lecture`);
      }
      assert.equal((await countedCalls(() => read(bob))).calls, alone, `${name} : l’espace de Bob se lit pour lui`);
      assert.equal((await countedCalls(() => read(bob))).calls, 0, `${name} : gardée pour Bob aussi`);
      // Une écriture, quelle qu'elle soit, vide la mémoire de la requête (F812).
      await saveFeatureSelectionForUser(ALICE, ['arrosages', 'materiel'], new Date('2026-06-16T08:00:00Z'));
      assert.equal((await countedCalls(() => read(alice))).calls, alone, `${name} : relue après une écriture`);
    });
    await inRequest(async () => {
      assert.equal((await countedCalls(() => read(alice))).calls, alone, `${name} : une requête neuve relit la base`);
    });
  }
});

/** Change tout ce qui se change dans une valeur lue : ses listes, ses tables, ses objets, à toute profondeur. */
function scramble(value: unknown, depth = 0): void {
  if (depth > 6 || value === null || typeof value !== 'object') return;
  if (Array.isArray(value)) {
    for (const item of value) scramble(item, depth + 1);
    value.push('changé par un appelant');
    return;
  }
  if (value instanceof Map) {
    for (const item of value.values()) scramble(item, depth + 1);
    value.set('changé', 'par un appelant');
    return;
  }
  if (value instanceof Set) {
    value.add('changé par un appelant');
    return;
  }
  const record = value as Record<string, unknown>;
  for (const key of Object.keys(record)) scramble(record[key], depth + 1);
  record.changeParUnAppelant = true;
}

test('F1112 : chaque appelant reçoit sa propre copie, la même que la base, données simples comprises', async () => {
  const { owner, workspaceId, locationKey } = await fullDemoSpace();
  const space = { key: owner, workspaceId, locationKey };
  assert.equal(weekStartDateKey(resolveDemoChoice('maraichage', 'ete').moment.dateKey), WEEK_START);
  for (const { name, read } of REMEMBERED_READS) {
    const fromBase = await read(space);
    await inRequest(async () => {
      const first = await read(space);
      assert.deepStrictEqual(first, fromBase, `${name} : la valeur gardée est celle de la base`);
      scramble(first);
      assert.deepStrictEqual(await read(space), fromBase, `${name} : ce qu’un appelant change ne se voit pas chez l’autre`);
    });
  }
  // Des données, pas des listes vides : la copie est éprouvée sur ce que la page lit vraiment.
  const plan = await readLatestPlanForUser(owner, SEASON, WEEK_START);
  assert.ok(plan && plan.proposals.length > 0, 'un plan de la semaine, avec ses propositions');
  assert.ok((await listEquipmentPosesForUser(owner, SEASON)).length > 0, 'des poses');
  assert.ok((await listSpeciesCorrespondencesForWorkspace(workspaceId)).length > 0, 'des espèces rattachées');
  assert.ok((await listWeatherDailyValuesForUser(owner, locationKey, WEEK[0], WEEK[6])).length > 0, 'la météo de la semaine');
});

test('F1113 : la faisabilité qui recommence, une source ayant changé dans une autre requête, relit ses sources à la base', async () => {
  const { owner, workspaceId } = await fullDemoSpace();
  const observed = observe(database.d1);
  overrideDatabase(observed.database);
  let revisionReads = 0;
  observed.beforeEach((sql) => {
    if (!sql.includes('SELECT feasibility_revision FROM irrigation_workspaces')) return;
    revisionReads += 1;
    // Une autre requête allume l'objectif automatique pendant le premier calcul, sans passer par cette requête-ci.
    if (revisionReads === 2) {
      database.sqlite.prepare(
        `INSERT INTO irrigation_automatic_objective_revisions (id, workspace_id, enabled, actor_user_id, created_at) VALUES (?, ?, 1, ?, ?)`,
      ).run('objectif-d-une-autre-requete', workspaceId, owner, '2026-06-16T09:00:00.000Z');
    }
  });
  const revisionBefore = (database.sqlite.prepare('SELECT feasibility_revision AS revision FROM irrigation_workspaces WHERE id = ?').get(workspaceId) as { revision: number }).revision;
  const result = await inRequest(() => getIrrigationFeasibilityForUser({ ownerUserId: owner, season: SEASON, now: new Date() }));
  observed.beforeEach(null);

  assert.equal(revisionReads, 4, 'deux calculs : la révision lue au début et à la fin de chacun');
  assert.equal(result.revision, revisionBefore + 1, 'le résultat est celui du second calcul');
  const objectiveReads = observed.executions.filter((item) => item.sql.includes('FROM irrigation_automatic_objective_revisions') && item.sql.includes('ORDER BY created_at, rowid'));
  assert.equal(objectiveReads.length, 2, 'le second calcul relit l’objectif automatique à la base, sans la mémoire du premier');
});

test('F1114 : les lectures d’un même dépôt partent en un seul appel à la base', async () => {
  const { owner } = await fullDemoSpace();
  const period = { startAt: '2026-06-15T00:00:00.000Z', endAt: '2026-06-22T00:00:00.000Z' };
  const grouped: { name: string; read: () => Promise<unknown>; calls: number }[] = [
    { name: 'l’eau (7 lectures)', read: () => listWaterInfrastructureForUser(owner), calls: 1 },
    { name: 'l’eau d’une période', read: () => listWaterInfrastructureForUser(owner, period), calls: 1 },
    { name: 'le matériel (4 lectures)', read: () => listEquipmentForUser(owner), calls: 1 },
    { name: 'les arrosages d’une saison (2 lectures)', read: () => listIrrigationEventsForUser(owner, SEASON), calls: 1 },
    { name: 'les arrosages et leurs chronomètres (3 lectures)', read: () => listIrrigationEventsForUser(owner, undefined, true), calls: 1 },
    { name: 'les arrosages d’une période', read: () => listIrrigationEventsForUser(owner, SEASON, true, period), calls: 1 },
    { name: 'les poses (2 lectures)', read: () => listEquipmentPosesForUser(owner, SEASON), calls: 1 },
    // L'espace, puis le reste d'un bloc.
    { name: 'les groupes de jardins (2 lectures)', read: () => listGardenGroupsForUser(owner, SEASON), calls: 2 },
    { name: 'les réglages des besoins (2 lectures)', read: () => readIrrigationNeedSettingsForUser(owner, SEASON, WEEK_START), calls: 2 },
  ];
  for (const { name, read, calls } of grouped) {
    assert.equal((await countedCalls(read)).calls, calls, name);
  }

  // Rien n'est perdu en route : chaque lecture du bloc rend toutes ses lignes,
  // comptées dans la base, qui ne tient que cet espace.
  const rows = (sql: string) => (database.sqlite.prepare(sql).get() as { value: number }).value;
  const total = (counts: number[]) => counts.reduce((sum, count) => sum + count, 0);

  const events = await listIrrigationEventsForUser(owner, undefined, true);
  assert.equal(events.length, rows('SELECT COUNT(*) AS value FROM irrigation_event_equipment'), 'chaque matériel de chaque arrosage');
  assert.equal(total(events.map((event) => event.equipment.applications.length)), rows('SELECT COUNT(*) AS value FROM irrigation_bed_applications'), 'les planches des arrosages');
  assert.equal(total(events.map((event) => event.timerHistory?.length ?? 0)), rows('SELECT COUNT(*) AS value FROM irrigation_event_log'), 'l’historique des chronomètres');
  assert.ok(total(events.map((event) => event.equipment.applications.length)) > 0 && total(events.map((event) => event.timerHistory?.length ?? 0)) > 0, 'des planches et des chronomètres à compter');

  const equipment = await listEquipmentForUser(owner);
  const settings = equipment.flatMap((item) => item.settings);
  assert.equal(equipment.length, rows('SELECT COUNT(*) AS value FROM irrigation_equipment'), 'le matériel');
  assert.equal(settings.length, rows('SELECT COUNT(*) AS value FROM irrigation_equipment_settings'), 'ses réglages');
  assert.equal(total(settings.map((setting) => (setting.kind === 'drip' ? setting.rateMmPerHour : 0))), rows('SELECT COALESCE(SUM(rate_mm_per_hour), 0) AS value FROM drip_setting_rates'), 'les débits des goutte-à-goutte');
  assert.equal(total(settings.map((setting) => (setting.kind === 'sprinkler' ? setting.leftProfile.length + setting.rightProfile.length : 0))), rows('SELECT COUNT(*) AS value FROM sprinkler_profile_points'), 'les profils des asperseurs');
  assert.ok(settings.some((setting) => setting.kind === 'drip' && setting.rateMmPerHour > 0), 'des débits à compter');

  const water = await listWaterInfrastructureForUser(owner);
  assert.equal(water.resources.length, rows('SELECT COUNT(*) AS value FROM irrigation_water_resources'), 'les ressources');
  assert.equal(water.reservoirs.length, rows('SELECT COUNT(*) AS value FROM irrigation_water_reservoirs'), 'les réserves');
  assert.equal(water.resourceLimits.length, rows('SELECT COUNT(*) AS value FROM irrigation_water_resource_limit_revisions'), 'les limites');
  assert.equal(water.resourceReservoirLinks.length, rows('SELECT COUNT(*) AS value FROM irrigation_water_resource_reservoir_links'), 'les liens des ressources');
  assert.equal(water.reservoirLinks.length, rows('SELECT COUNT(*) AS value FROM irrigation_water_reservoir_links'), 'les liens des réserves');
  assert.equal(water.defaultSupply === null ? 0 : 1, rows('SELECT COUNT(*) AS value FROM irrigation_water_supply_defaults'), 'l’alimentation par défaut');
  assert.equal(water.movements.length, rows('SELECT COUNT(*) AS value FROM irrigation_water_stock_movements'), 'les mouvements de stock');
  assert.ok(water.resources.length > 0 && water.defaultSupply !== null, 'de l’eau à compter');

  const poses = await listEquipmentPosesForUser(owner, SEASON);
  assert.equal(total(poses.map((pose) => pose.selectedBeds.length)), rows(
    `SELECT COUNT(*) AS value FROM irrigation_placement_selected_beds AS selected
     INNER JOIN irrigation_equipment_placements AS placement ON placement.id = selected.placement_id
     WHERE placement.season = ${SEASON}`,
  ), 'les planches des poses');
  assert.ok(poses.some((pose) => pose.selectedBeds.length > 0), 'des planches posées à compter');
});
