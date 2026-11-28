import assert from 'node:assert/strict';
import test, { afterEach } from 'node:test';
import { batchWholeGroups } from '../../db/batches';
import { db, observeDatabaseCalls, overrideDatabase } from '../../db/binding';
import { saveFrostLinkForUser } from '../../db/crop-alerts/inputs';
import { saveAdoptedGoalForUser, saveAdoptedGoalsForUser } from '../../db/crop-water/adoptions';
import { saveSpeciesCorrespondenceForUser } from '../../db/crop-water/entries';
import { saveDemoSpeciesForUser } from '../../db/demo-seed-repository';
import { readFeatureSelectionForUser } from '../../db/feature-selection-repository';
import { writeForecastArchiveForUser, writeForecastArchivesForUser } from '../../db/forecast-archive-repository';
import { createCompletedIrrigationEventsForUser, createIrrigationEventForUser } from '../../db/irrigation-event/create';
import { IrrigationEventInputError } from '../../db/irrigation-event/errors';
import { createRequestMemo, provideRequestMemo } from '../../db/request-memo';
import { createWorkspaceIfAbsent } from '../../db/workspace-repository';
import { demoFarmSnapshot } from '../../lib/adapters/demo/farms';
import { DEMO_FROST_COMMON_KEYS, DEMO_SPECIES_REFERENCES } from '../../lib/adapters/demo/module-data';
import { adoptionRevision, type AdoptedGoalRevision } from '../../lib/domain/crop-water/proposal';
import { DEMO_PROFILES, demoOwnerUserId, resolveDemoChoice } from '../../lib/domain/demo/catalogue';
import { addDaysToDateKey } from '../../lib/domain/water-management';
import { getBedCropWaterSheetForUser, getBedWeekProposalsForUser } from '../../lib/services/crop-water-bed';
import { installSimulatedDate, runOnSimulatedDay, uninstallSimulatedDate } from '../../lib/services/demo-clock';
import { prepareDemoSpace } from '../../lib/services/demo-space';
import { installTestDatabase, type TestDatabase } from '../support/d1-sqlite';
import { completedDraft, createDripFixture } from '../support/irrigation-fixtures';
import { ALICE } from '../support/spaces';

/**
 * La première ouverture d'un espace de démonstration écrit la ferme fictive
 * en quelques lots (accélérer le site, A2, D-359 ;
 * docs/acceleration-du-site-contract.md, section 4). Chaque écriture groupée
 * écrit les lignes du geste ordinaire répété, toutes tables, dans le même
 * ordre (F1107) ; un lot ne coupe jamais un geste (F1108) ; un refus arrête
 * tout avant la première écriture (F1109) ; préparer un espace demande au
 * plus 300 appels à la base, quel que soit le profil ou le moment (F1110).
 */

const savedDemoMode = process.env.DEMO_MODE;
afterEach(() => {
  observeDatabaseCalls(null);
  provideRequestMemo(null);
  uninstallSimulatedDate();
  if (savedDemoMode === undefined) delete process.env.DEMO_MODE;
  else process.env.DEMO_MODE = savedDemoMode;
});

const RealDate = globalThis.Date;
/** L'horloge arrêtée des écritures comparées : deux écritures des mêmes lignes portent les mêmes heures. */
const FROZEN_AT = RealDate.parse('2026-06-16T09:41:07.123Z');

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

const TIMESTAMP = /\d{4}-\d{2}-\d{2}[T ]\d{2}:\d{2}:\d{2}(?:\.\d+)?Z?/g;

/**
 * Les lignes qu'écrit `write` dans une base neuve, toutes tables, chacune
 * dans l'ordre de son écriture. Les identifiants sont tirés dans l'ordre
 * (…0001, …0002…) et l'horloge est arrêtée : deux écritures des mêmes lignes,
 * dans le même ordre, se comparent telles quelles. L'heure que la base pose
 * elle-même (« maintenant » de SQLite) devient un repère.
 */
async function writtenRows(write: () => Promise<void>): Promise<string[]> {
  const database = installTestDatabase();
  let drawn = 0;
  Object.defineProperty(globalThis.crypto, 'randomUUID', {
    configurable: true,
    value: () => `00000000-0000-4000-8000-${(drawn += 1).toString(16).padStart(12, '0')}`,
  });
  const startedAt = RealDate.now();
  globalThis.Date = frozenDate(FROZEN_AT);
  try {
    await write();
  } finally {
    globalThis.Date = RealDate;
    delete (globalThis.crypto as { randomUUID?: unknown }).randomUUID;
  }
  try {
    return tableRows(database, startedAt - 1000, RealDate.now() + 1000);
  } finally {
    database.dispose();
  }
}

function tableRows(database: TestDatabase, from: number, to: number): string[] {
  const databaseNow = (text: string) => text.replace(TIMESTAMP, (stamp) => {
    const at = RealDate.parse(stamp.includes('T') ? stamp : `${stamp.replace(' ', 'T')}Z`);
    return at >= from && at <= to ? '<maintenant>' : stamp;
  });
  const tables = database.sqlite.prepare(
    `SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%' AND name NOT LIKE 'd1_%' ORDER BY name`,
  ).all() as { name: string }[];
  return tables.flatMap(({ name }) => (database.sqlite.prepare(`SELECT * FROM "${name}" ORDER BY rowid`).all() as Record<string, unknown>[])
    .map((row) => `${name} ${databaseNow(JSON.stringify(row))}`));
}

function linesOf(rows: readonly string[], table: string): string[] {
  return rows.filter((line) => line.startsWith(`${table} `));
}

test('F1107 : des irrigations faites saisies ensemble écrivent les lignes de la saisie une à une, dans le même ordre', async () => {
  const drafts = async () => {
    const drip = await createDripFixture(ALICE, { beds: ['bed-1', 'bed-2'] });
    const other = await createDripFixture(ALICE, { name: 'Goutte-à-goutte du tunnel', beds: ['bed-3'], rateMmPerHour: 6 });
    return [
      completedDraft(drip, { startAt: '2026-06-01T05:00:00.000Z', endAt: '2026-06-01T06:00:00.000Z', durationSeconds: 3600 }),
      completedDraft(other, { startAt: '2026-06-01T05:00:00.000Z', endAt: '2026-06-01T05:30:00.000Z', durationSeconds: 1800 }),
      completedDraft(drip, { startAt: '2026-06-08T05:00:00.000Z', endAt: '2026-06-08T06:30:00.000Z', durationSeconds: 5400 }, {
        plannedStartAt: '2026-06-08T05:00:00.000Z',
        plannedEndAt: '2026-06-08T06:00:00.000Z',
        plannedDurationSeconds: 3600,
      }),
    ];
  };
  const oneByOne = await writtenRows(async () => {
    for (const draft of await drafts()) await createIrrigationEventForUser(ALICE, draft);
  });
  const together = await writtenRows(async () => createCompletedIrrigationEventsForUser(ALICE, await drafts()));
  assert.equal(linesOf(together, 'irrigation_events').length, 3);
  assert.equal(linesOf(together, 'irrigation_bed_applications').length, 5);
  assert.deepEqual(together, oneByOne);
});

test('F1109 : une irrigation refusée arrête la saisie groupée avant la première écriture', async () => {
  const database = installTestDatabase();
  try {
    const drip = await createDripFixture(ALICE, { placedAt: '2026-05-01T08:00:00.000Z' });
    const done = completedDraft(drip, { startAt: '2026-06-01T05:00:00.000Z', endAt: '2026-06-01T06:00:00.000Z', durationSeconds: 3600 });
    const beforeItsPose = completedDraft(drip, { startAt: '2026-04-20T05:00:00.000Z', endAt: '2026-04-20T06:00:00.000Z', durationSeconds: 3600 });
    await assert.rejects(createCompletedIrrigationEventsForUser(ALICE, [done, beforeItsPose]), IrrigationEventInputError);
    await assert.rejects(createCompletedIrrigationEventsForUser(ALICE, [done, { ...done, applications: [] }]), IrrigationEventInputError);
    const planned = { ...done, kind: 'planned' as const, plannedStartAt: done.actualStartAt, plannedEndAt: done.actualEndAt, actualStartAt: null, actualEndAt: null };
    await assert.rejects(createCompletedIrrigationEventsForUser(ALICE, [done, planned]), IrrigationEventInputError);
    assert.equal((database.sqlite.prepare('SELECT COUNT(*) AS n FROM irrigation_events').get() as { n: number }).n, 0);
  } finally {
    database.dispose();
  }
});

test('F1107 : des matins de prévisions archivés ensemble écrivent les lignes des matins un à un ; la première ligne d’un jour reste', async () => {
  const issues = Array.from({ length: 16 }, (_, index) => addDaysToDateKey('2026-06-01', index));
  const archives = issues.map((issuedOn, index) => ({
    locationKey: 'lieu-essai',
    issuedOn,
    source: 'open-meteo',
    fetchedAt: `${issuedOn}T05:15:00.000Z`,
    rows: Array.from({ length: 7 }, (_, horizon) => ({
      targetDate: addDaysToDateKey(issuedOn, horizon + 1),
      horizonDays: horizon + 1,
      precipitationMm: (index + horizon) % 3,
      et0Mm: 3 + horizon / 10,
      minimumTemperatureCelsius: 11,
      maximumTemperatureCelsius: 24 + horizon,
      solarEnergyMegajoulesPerSquareMeter: horizon === 6 ? null : 21,
    })),
  }));
  // Un matin relu plus tard : rien n'est écrasé, ni dans un lot, ni d'un lot à l'autre.
  const again = { ...archives[2], fetchedAt: `${archives[2].issuedOn}T09:00:00.000Z`, rows: archives[2].rows.map((row) => ({ ...row, et0Mm: 9 })) };
  const mornings = [...archives, again];
  const oneByOne = await writtenRows(async () => {
    await createWorkspaceIfAbsent(ALICE);
    for (const morning of mornings) await writeForecastArchiveForUser(ALICE, morning);
  });
  const together = await writtenRows(async () => {
    await createWorkspaceIfAbsent(ALICE);
    await writeForecastArchivesForUser(ALICE, mornings);
  });
  assert.equal(linesOf(together, 'irrigation_weather_forecast_archive').length, 16 * 7);
  assert.deepEqual(together, oneByOne);
});

test('F1107 : des propositions adoptées ensemble écrivent les lignes des adoptions une à une, journal compris', async () => {
  const at = '2026-06-16T09:41:07.123Z';
  const proposal = (proposedMm: number) => ({ weekStart: '2026-06-15', proposedMm, adoptable: true });
  const revisions = [
    adoptionRevision(proposal(12.345), { id: 'bed-1', zoneId: 'zone-1', plotId: 'plot-1' }, at),
    adoptionRevision(proposal(8), { id: 'bed-2', zoneId: 'zone-1', plotId: 'plot-1' }, at),
    // La même planche, adoptée de nouveau : son journal lit pour « avant » l'adoption écrite juste avant, dans le même lot.
    adoptionRevision(proposal(15.5), { id: 'bed-1', zoneId: 'zone-1', plotId: 'plot-1' }, at),
  ].filter((revision): revision is AdoptedGoalRevision => revision !== null);
  assert.equal(revisions.length, 3);
  const oneByOne = await writtenRows(async () => {
    await createWorkspaceIfAbsent(ALICE);
    for (const revision of revisions) await saveAdoptedGoalForUser(ALICE, 2026, revision);
  });
  const together = await writtenRows(async () => {
    await createWorkspaceIfAbsent(ALICE);
    await saveAdoptedGoalsForUser(ALICE, 2026, revisions);
  });
  assert.equal(linesOf(together, 'irrigation_hydric_goal_revisions').length, 3);
  assert.equal(linesOf(together, 'irrigation_change_journal').length, 3);
  assert.deepEqual(together, oneByOne);
});

test('F1107 : les espèces d’une ferme de démonstration, rattachées ensemble, écrivent les lignes des rattachements un à un', async () => {
  const plantIds = Object.keys(DEMO_SPECIES_REFERENCES).filter((plantId) => DEMO_FROST_COMMON_KEYS[plantId]).slice(0, 3);
  const withoutFrost = Object.keys(DEMO_SPECIES_REFERENCES).find((plantId) => !DEMO_FROST_COMMON_KEYS[plantId]);
  assert.equal(plantIds.length, 3);
  const species = [
    ...plantIds.map((plantId) => ({ plantId, referenceCropId: DEMO_SPECIES_REFERENCES[plantId], frostCommonKey: DEMO_FROST_COMMON_KEYS[plantId] })),
    ...(withoutFrost ? [{ plantId: withoutFrost, referenceCropId: DEMO_SPECIES_REFERENCES[withoutFrost], frostCommonKey: null }] : []),
    // Une espèce déjà rattachée, rattachée de nouveau : son journal lit pour « avant » le rattachement écrit juste avant.
    { plantId: plantIds[0], referenceCropId: DEMO_SPECIES_REFERENCES[plantIds[1]], frostCommonKey: DEMO_FROST_COMMON_KEYS[plantIds[1]] },
  ];
  const now = new Date('2026-06-16T09:41:07.123Z');
  const oneByOne = await writtenRows(async () => {
    for (const { plantId, referenceCropId, frostCommonKey } of species) {
      const link = await saveSpeciesCorrespondenceForUser(ALICE, { plantId, seriesId: null, target: { kind: 'reference', referenceCropId, analogy: false } }, now);
      assert.equal(link.ok, true);
      if (frostCommonKey) assert.equal((await saveFrostLinkForUser(ALICE, { plantId, seriesId: null, commonKey: frostCommonKey }, now)).ok, true);
    }
  });
  const together = await writtenRows(async () => {
    assert.deepEqual(await saveDemoSpeciesForUser(ALICE, species, now), { ok: true });
  });
  assert.equal(linesOf(together, 'irrigation_crop_species_links').length, species.length - 1);
  assert.equal(linesOf(together, 'irrigation_crop_frost_links').length, 4);
  assert.deepEqual(together, oneByOne);
});

test('F1109 : une espèce refusée arrête les rattachements groupés avant le premier ; chaque refus est dit', async () => {
  const database = installTestDatabase();
  try {
    const [first] = Object.keys(DEMO_SPECIES_REFERENCES);
    const refused = await saveDemoSpeciesForUser(ALICE, [
      { plantId: first, referenceCropId: DEMO_SPECIES_REFERENCES[first], frostCommonKey: DEMO_FROST_COMMON_KEYS[first] ?? null },
      { plantId: 'p-inconnue', referenceCropId: 'culture-inconnue', frostCommonKey: 'gel-inconnu' },
    ], new Date('2026-06-16T09:41:07.123Z'));
    assert.equal(refused.ok, false);
    assert.equal(refused.ok ? 0 : refused.problems.length, 2);
    for (const table of ['irrigation_crop_species_links', 'irrigation_crop_frost_links', 'irrigation_change_journal']) {
      assert.equal((database.sqlite.prepare(`SELECT COUNT(*) AS n FROM ${table}`).get() as { n: number }).n, 0, table);
    }
  } finally {
    database.dispose();
  }
});

test('F1108 : les gestes partent dans leur ordre, en lots d’au plus 100 instructions, sans qu’aucun soit coupé', async () => {
  const database = installTestDatabase();
  database.sqlite.exec('CREATE TABLE essai_lots (n INTEGER NOT NULL)');
  const batchSizes: number[] = [];
  overrideDatabase(new Proxy(database.d1, {
    get(target, property) {
      if (property === 'batch') {
        return (statements: D1PreparedStatement[]) => {
          batchSizes.push(statements.length);
          return target.batch(statements);
        };
      }
      const value = Reflect.get(target, property) as unknown;
      return typeof value === 'function' ? (value as (...args: unknown[]) => unknown).bind(target) : value;
    },
  }));
  try {
    let next = 0;
    const gesture = (size: number) => Array.from({ length: size }, () => db.prepare('INSERT INTO essai_lots (n) VALUES (?)').bind((next += 1)));
    await batchWholeGroups([60, 30, 20, 0, 150, 5].map(gesture));
    // 60 + 30 tiennent ensemble ; 20 n'y tiendrait pas ; 150, plus grand que la limite, part seul.
    assert.deepEqual(batchSizes, [90, 20, 150, 5]);
    const written = (database.sqlite.prepare('SELECT n FROM essai_lots ORDER BY rowid').all() as { n: number }[]).map((row) => row.n);
    assert.deepEqual(written, Array.from({ length: 265 }, (_, index) => index + 1));
  } finally {
    overrideDatabase(database.d1);
    // La table de l'essai n'est pas une table du module : retirée avant le contrôle des espaces (F380).
    database.sqlite.exec('DROP TABLE essai_lots');
    database.dispose();
  }
});

test('F1107 : la proposition de chaque planche, lue pour toutes ensemble, est celle de sa fiche', async () => {
  process.env.DEMO_MODE = 'true';
  installSimulatedDate();
  const profile = DEMO_PROFILES.find((candidate) => candidate.id === 'maraichage');
  assert.ok(profile);
  for (const moment of profile.moments) {
    const database = installTestDatabase();
    try {
      const choice = resolveDemoChoice(profile.id, moment.id);
      const owner = demoOwnerUserId('invite-a', choice);
      await runOnSimulatedDay(choice.moment.dateKey, async () => {
        await prepareDemoSpace(owner, choice);
        const snapshot = demoFarmSnapshot(choice.profile.id, choice.moment.dateKey);
        const season = snapshot.configuration.seasonFirst;
        const now = new Date();
        const together = await getBedWeekProposalsForUser({ ownerUserId: owner, season, snapshot, now });
        const sheets = [];
        for (const bed of snapshot.beds) {
          const sheet = await getBedCropWaterSheetForUser({ ownerUserId: owner, season, snapshot, bedId: bed.id, now });
          if (sheet.available) sheets.push({ bedId: bed.id, weekOpen: sheet.weekOpen, proposal: sheet.bed.week });
        }
        assert.ok(sheets.length > 0, moment.id);
        assert.deepEqual(together.map(({ bed, weekOpen, proposal }) => ({ bedId: bed.id, weekOpen, proposal })), sheets, moment.id);
      });
    } finally {
      database.dispose();
    }
  }
});

test('F1110 : préparer l’espace d’un invité demande au plus 300 appels à la base, quel que soit le profil ou le moment', async () => {
  process.env.DEMO_MODE = 'true';
  installSimulatedDate();
  for (const profile of DEMO_PROFILES) {
    for (const moment of profile.moments) {
      const database = installTestDatabase();
      try {
        const choice = resolveDemoChoice(profile.id, moment.id);
        const owner = demoOwnerUserId('invite-a', choice);
        // La mémoire d'une requête, comme pour l'ouverture d'une page.
        const memo = createRequestMemo();
        provideRequestMemo(() => memo);
        let calls = 0;
        observeDatabaseCalls((call) => {
          calls += 1;
          return call();
        });
        await runOnSimulatedDay(choice.moment.dateKey, () => prepareDemoSpace(owner, choice));
        observeDatabaseCalls(null);
        provideRequestMemo(null);
        const label = `${profile.id} · ${moment.id} : ${calls} appels`;
        assert.ok(calls <= 300, label);
        const ready = (await readFeatureSelectionForUser(owner)).kind === 'stored';
        assert.equal(ready, choice.profile.features.length > 0, label);
      } finally {
        database.dispose();
      }
    }
  }
});
