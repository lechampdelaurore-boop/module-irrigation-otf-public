import assert from 'node:assert/strict';
import test, { afterEach, beforeEach } from 'node:test';
import {
  deleteFarmReferenceCropForUser,
  listReferenceCropsForWorkspace,
  saveFarmReferenceCropForUser,
  type StoredReferenceCrop,
} from '../../db/crop-water/references';
import { ensureWorkspaceForUser } from '../../db/workspace-repository';
import type { KcCurve, ReferenceCrop, StageStart, StepCurve } from '../../lib/domain/crop-water/reference';
import {
  ARTICHOKE,
  ASPARAGUS,
  BROAD_BEAN,
  BROCCOLI,
  CARROT,
  CAULIFLOWER,
  GARLIC,
  GREEN_ONION,
  ONION,
  PEPPER,
  POTATO,
  SUMMER_SALAD,
  TOMATO,
} from '../support/crop-water-references';
import { installTestDatabase, type TestDatabase } from '../support/d1-sqlite';

/**
 * Le jeu de référence en base (docs/crop-water-need-contract.md, « Le jeu de
 * référence est une donnée », relecture du 31 octobre 2026, D-054 ; migration
 * 0023) : les cultures écrites par la migration sont celles du contrat, chiffre
 * pour chiffre ; une ferme enregistre sa version d'une culture commune sans en
 * changer les Kc, ou une culture saisie par elle, pour elle seule.
 */

const ALICE = 'alice';
const BOB = 'bob';
const ALL_MONTHS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12];
const FAO_URL = 'https://www.fao.org/4/X0490E/x0490e0b.htm';
const CRIIAM_URL = 'https://www.criiamsud.fr/coefficients_culturaux';

let database: TestDatabase;
beforeEach(() => {
  database = installTestDatabase();
});
afterEach(() => {
  database.dispose();
});

/** Les mois d'un jeu sont un ensemble : on les range pour comparer. */
function normalized(crop: ReferenceCrop): ReferenceCrop {
  const curve: KcCurve = crop.curve.shape === 'calendar'
    ? crop.curve
    : { ...crop.curve, sets: crop.curve.sets.map((set) => ({ ...set, months: [...set.months].sort((a, b) => a - b) })) } as KcCurve;
  return { ...crop, curve };
}

function byKey(crops: readonly StoredReferenceCrop[], key: string): StoredReferenceCrop {
  const found = crops.find((stored) => stored.crop.id === key);
  assert.ok(found, `culture ${key} absente`);
  return found;
}

/** Le début de chaque stade d'un escalier, pour un mois d'implantation, en abrégé : « J30 », « J-20 », « levée+20 », « mi-récolte ». */
function starts(crop: ReferenceCrop, month: number): string[] {
  const curve = crop.curve as StepCurve;
  const set = curve.sets.find((candidate) => candidate.months.includes(month));
  assert.ok(set, `${crop.name} : aucun jeu pour le mois ${month}`);
  return set.value.map((start: StageStart) => {
    const anchor = start.anchor;
    const mark = start.estimated ? ' (estimation)' : '';
    if (anchor.from === 'implantation') return `J${anchor.days}${mark}`;
    if (anchor.from === 'emergence') return `levée+${anchor.days}${mark}`;
    if (anchor.from === 'before-harvest') return `J-${anchor.days}${mark}`;
    return `${anchor.from}${mark}`;
  });
}

const kcs = (crop: ReferenceCrop) => (crop.curve.shape === 'trapezoid'
  ? [crop.curve.kcInitial, crop.curve.kcMid, crop.curve.kcEnd]
  : crop.curve.stages.map((stage) => stage.kc));

test('la migration écrit les 32 cultures du jeu commun, toutes utilisables, avec leur source et la date du relevé', async () => {
  const crops = await listReferenceCropsForWorkspace(null);
  assert.equal(crops.length, 32);
  for (const stored of crops) {
    assert.deepEqual(stored.problems, [], stored.crop.name);
    assert.equal(stored.origin, 'common');
    assert.ok(stored.datesSource, `${stored.crop.name} : source des dates`);
  }
  const criiam = crops.filter((stored) => stored.crop.source === 'criiam');
  const fao = crops.filter((stored) => stored.crop.source === 'fao56');
  assert.equal(criiam.length, 19, 'dix-sept légumes, l\'artichaut et le fraisier en deux types');
  assert.equal(fao.length, 13);
  assert.ok(criiam.every((stored) => stored.sourceUrl === CRIIAM_URL && stored.surveyedOn === '2026-10-29'));
  assert.ok(fao.every((stored) => stored.sourceUrl === FAO_URL && stored.surveyedOn === '2026-10-31'));
  assert.ok(fao.every((stored) => stored.crop.curve.shape === 'trapezoid' && stored.crop.curve.abatement === 1), 'abattement proposé à 1');
  assert.deepEqual(criiam.map((stored) => stored.crop.name), [
    'Ail', 'Artichaut non remontant', 'Artichaut remontant', 'Asperge', 'Aubergine', 'Betterave', 'Carotte', 'Chou-fleur', 'Courgette',
    'Fraisier non remontant', 'Fraisier remontant', 'Haricot', 'Melon', 'Oignon', 'Poireau', 'Poivron', 'Pomme de terre', "Salade d'été", 'Tomate',
  ]);
  assert.deepEqual(fao.map((stored) => stored.crop.name), [
    'Brocoli', 'Céleri', 'Concombre', 'Crucifères (choux)', 'Épinard', 'Fève', 'Navet', 'Oignon vert', 'Pastèque', 'Patate douce',
    'Petit pois', "Potiron, courge d'hiver", 'Radis',
  ]);
});

test('les cultures des scénarios du domaine sont, en base, exactement celles des tests du domaine', async () => {
  const crops = await listReferenceCropsForWorkspace(null);
  for (const fixture of [TOMATO, CARROT, GARLIC, CAULIFLOWER, PEPPER, POTATO, ONION, SUMMER_SALAD, ASPARAGUS, ARTICHOKE, GREEN_ONION, BROAD_BEAN]) {
    assert.deepEqual(normalized(byKey(crops, fixture.id).crop), normalized(fixture), fixture.name);
  }
  // Le brocoli suit la ligne « Crucifères » : le jeu de printemps des scénarios, et un jeu d'automne.
  const broccoli = byKey(crops, BROCCOLI.id).crop;
  assert.equal(broccoli.curve.shape, 'trapezoid');
  if (broccoli.curve.shape !== 'trapezoid' || BROCCOLI.curve.shape !== 'trapezoid') return;
  assert.deepEqual(kcs(broccoli), kcs(BROCCOLI));
  assert.deepEqual(normalized(broccoli).curve, {
    ...BROCCOLI.curve,
    sets: [
      { months: [3, 4, 5, 6, 7, 8], value: BROCCOLI.curve.sets[0].value },
      { months: [1, 2, 9, 10, 11, 12], value: { initial: 30, development: 35, mid: 90, late: 40 } },
    ],
  });
});

test('les autres cultures du CRIIAM : Kc de la source et dates par défaut de la relecture du 31 octobre 2026', async () => {
  const crops = await listReferenceCropsForWorkspace(null);
  const expected: [string, number[], string[], { 'direct-sowing': number; planting: number }][] = [
    ['criiam-aubergine', [0.5, 0.6, 0.9, 0.6], ['J0', 'J21', 'J45 (estimation)', 'mid-harvest'], { 'direct-sowing': 0, planting: 0 }],
    ['criiam-courgette', [0.5, 1, 0.7], ['J0', 'J20', 'mid-harvest'], { 'direct-sowing': 0, planting: 0 }],
    ['criiam-haricot', [0.6, 0.8, 1], ['J0', 'J40', 'J50 (estimation)'], { 'direct-sowing': 16, planting: 0 }],
    ['criiam-melon', [0.4, 0.6, 1, 0.65], ['J0', 'J25', 'J45', 'first-harvest'], { 'direct-sowing': 0, planting: 0 }],
    ['criiam-poireau', [0.7], ['J0'], { 'direct-sowing': 0, planting: 0 }],
  ];
  for (const [key, kc, dates, emergence] of expected) {
    const crop = byKey(crops, key).crop;
    assert.deepEqual(kcs(crop), kc, key);
    for (const month of ALL_MONTHS) assert.deepEqual(starts(crop, month), dates, `${key}, mois ${month}`);
    assert.deepEqual(crop.emergenceDelayDays, emergence, key);
  }
  const beet = byKey(crops, 'criiam-betterave').crop;
  assert.deepEqual(kcs(beet), [0.5, 0.7, 1]);
  assert.deepEqual(beet.emergenceDelayDays, { 'direct-sowing': 10, planting: 0 });
  for (const month of [4, 5, 6, 7, 8]) assert.deepEqual(starts(beet, month), ['J0', 'J30', 'J60'], `semis du mois ${month}`);
  for (const month of [9, 10, 11, 12, 1, 2, 3]) assert.deepEqual(starts(beet, month), ['J0', 'J30', 'J80'], `semis du mois ${month}`);
});

test('les calendriers des cultures pluriannuelles : artichaut non remontant et fraisiers estimés', async () => {
  const crops = await listReferenceCropsForWorkspace(null);
  const artichoke = byKey(crops, 'criiam-artichaut-non-remontant').crop;
  assert.deepEqual(artichoke.curve, {
    shape: 'calendar',
    stages: [
      { rank: 3, label: 'Montée des capitules → 15 j avant 1re récolte', kc: 0.8, start: '02-01', estimated: true },
      { rank: 4, label: '15 j avant 1re récolte → Fin 1re récolte', kc: 1.1, start: '02-15', estimated: false },
    ],
    end: '05-31',
    establishment: { rank: 1, label: 'Plantation-reprise → 2 mois après', kc: 0.5, months: 2 },
  });
  for (const [key, end] of [['criiam-fraisier', '06-30'], ['criiam-fraisier-remontant', '09-30']] as const) {
    const strawberry = byKey(crops, key).crop;
    assert.equal(strawberry.curve.shape, 'calendar');
    if (strawberry.curve.shape !== 'calendar') continue;
    assert.deepEqual(strawberry.curve.stages.map((stage) => [stage.start, stage.kc, stage.estimated]), [
      ['02-15', 0.4, true], ['03-20', 0.6, true], ['04-10', 0.9, true], ['05-01', 0.7, true],
    ]);
    assert.equal(strawberry.curve.end, end);
    assert.equal(byKey(crops, key).datesSource, 'Estimation sans source', 'affichée comme telle');
  }
});

test('les cultures de la FAO : Kc, durées des phases, jeux de saison et délais de levée du contrat', async () => {
  const crops = await listReferenceCropsForWorkspace(null);
  const expected: [string, number[], [number[], number[]][], number][] = [
    ['fao-celeri', [0.7, 1.05, 1], [[ALL_MONTHS, [25, 40, 45, 15]]], 0],
    ['fao-concombre', [0.6, 1, 0.75], [[ALL_MONTHS, [20, 30, 40, 15]]], 0],
    ['fao-cruciferes', [0.7, 1.05, 0.95], [[[3, 4, 5, 6, 7, 8], [20, 30, 20, 10]], [[1, 2, 9, 10, 11, 12], [30, 35, 90, 40]]], 0],
    ['fao-epinard', [0.7, 1, 0.95], [[ALL_MONTHS, [20, 20, 15, 5]]], 7],
    ['fao-navet', [0.5, 1.1, 0.95], [[[4, 5, 6, 7, 8], [15, 25, 20, 10]], [[1, 2, 3, 9, 10, 11, 12], [25, 30, 25, 10]]], 3],
    ['fao-pasteque', [0.4, 1, 0.75], [[ALL_MONTHS, [20, 30, 30, 30]]], 0],
    ['fao-patate-douce', [0.5, 1.15, 0.65], [[ALL_MONTHS, [20, 30, 60, 40]]], 0],
    ['fao-petit-pois', [0.5, 1.15, 1.1], [[ALL_MONTHS, [15, 25, 35, 15]]], 9],
    ['fao-potiron', [0.5, 1, 0.8], [[ALL_MONTHS, [20, 30, 30, 20]]], 0],
    ['fao-radis', [0.7, 0.9, 0.85], [[ALL_MONTHS, [5, 10, 15, 5]]], 6],
  ];
  for (const [key, kc, sets, sowing] of expected) {
    const crop = normalized(byKey(crops, key).crop);
    assert.deepEqual(kcs(crop), kc, key);
    assert.equal(crop.curve.shape, 'trapezoid');
    if (crop.curve.shape !== 'trapezoid') continue;
    assert.deepEqual(
      crop.curve.sets.map((set) => [set.months, [set.value.initial, set.value.development, set.value.mid, set.value.late]]),
      sets,
      key,
    );
    assert.deepEqual(crop.emergenceDelayDays, { 'direct-sowing': sowing, planting: 0 }, key);
  }
});

test('une ferme enregistre sa version d\'une culture commune : elle la remplace pour elle seule, la commune revient quand elle la retire', async () => {
  const aliceWorkspace = await ensureWorkspaceForUser(ALICE);
  const bobWorkspace = await ensureWorkspaceForUser(BOB);
  const curve = TOMATO.curve as StepCurve;
  const earlierFlowering: ReferenceCrop = {
    ...TOMATO,
    curve: { ...curve, sets: [{ months: ALL_MONTHS, value: curve.sets[0].value.map((start, index) => (index === 2 ? { anchor: { from: 'implantation', days: 25 }, estimated: false } : start)) }] },
  };
  const saved = await saveFarmReferenceCropForUser(ALICE, earlierFlowering, { sourceUrl: null, datesSource: 'Observation de la ferme, 2026' });
  assert.equal(saved.ok, true);

  const alice = byKey(await listReferenceCropsForWorkspace(aliceWorkspace), TOMATO.id);
  assert.equal(alice.origin, 'farm');
  assert.deepEqual(starts(alice.crop, 4), ['J0', 'J15', 'J25', 'mid-harvest']);
  assert.equal(alice.datesSource, 'Observation de la ferme, 2026');
  assert.equal((await listReferenceCropsForWorkspace(aliceWorkspace)).length, 32, 'la version remplace la commune, sans doublon');
  const bob = byKey(await listReferenceCropsForWorkspace(bobWorkspace), TOMATO.id);
  assert.equal(bob.origin, 'common', 'l\'autre ferme garde la culture commune');
  assert.deepEqual(starts(bob.crop, 4), ['J0', 'J15', 'J30 (estimation)', 'mid-harvest']);

  // Une seconde version remplace la première, d'un seul lot.
  assert.equal((await saveFarmReferenceCropForUser(ALICE, TOMATO, { sourceUrl: null, datesSource: null })).ok, true);
  assert.equal(database.sqlite.prepare("SELECT count(*) AS n FROM irrigation_crop_reference_crops WHERE crop_key = 'criiam-tomate'").get()?.n, 2);

  assert.equal(await deleteFarmReferenceCropForUser(ALICE, TOMATO.id), true);
  assert.equal(byKey(await listReferenceCropsForWorkspace(aliceWorkspace), TOMATO.id).origin, 'common');
  assert.equal(await deleteFarmReferenceCropForUser(ALICE, TOMATO.id), false);
  assert.equal(await deleteFarmReferenceCropForUser(BOB, TOMATO.id), false);
  assert.equal(database.sqlite.prepare('SELECT count(*) AS n FROM irrigation_crop_reference_stages WHERE reference_id NOT IN (SELECT id FROM irrigation_crop_reference_crops)').get()?.n, 0, 'les stades partent avec la version retirée');
});

test('la version d\'une ferme ne change ni la source, ni la forme, ni les Kc d\'une culture commune : ce sont des surcharges datées', async () => {
  const curve = TOMATO.curve as StepCurve;
  const otherKc: ReferenceCrop = { ...TOMATO, curve: { ...curve, stages: curve.stages.map((stage) => (stage.rank === 2 ? { ...stage, kc: 0.7 } : stage)) } };
  const refused = await saveFarmReferenceCropForUser(ALICE, otherKc, { sourceUrl: null, datesSource: null });
  assert.deepEqual(refused, { ok: false, problems: ["Tomate : les Kc d'une culture commune se changent par une surcharge datée, jamais dans sa table."] });
  const otherSource = await saveFarmReferenceCropForUser(ALICE, { ...TOMATO, source: 'local' }, { sourceUrl: null, datesSource: null });
  assert.equal(otherSource.ok, false);
  const broken = await saveFarmReferenceCropForUser(ALICE, { ...TOMATO, curve: { ...curve, sets: [] } }, { sourceUrl: null, datesSource: null });
  assert.equal(broken.ok, false, 'une culture inutilisable est refusée');
  assert.equal(database.sqlite.prepare('SELECT count(*) AS n FROM irrigation_crop_reference_crops WHERE workspace_id IS NOT NULL').get()?.n, 0);
});

test('une ferme saisit sa propre culture, de source « saisie locale », que l\'autre ferme ne voit pas', async () => {
  const sorrel: ReferenceCrop = {
    id: 'local-oseille',
    name: 'Oseille',
    source: 'local',
    emergenceDelayDays: { 'direct-sowing': 8, planting: 0 },
    curve: {
      shape: 'steps',
      stages: [{ rank: 1, label: 'Reprise → 30 j', kc: 0.6 }, { rank: 2, label: '30 j → Récolte', kc: 0.9 }],
      sets: [{ months: ALL_MONTHS, value: [{ anchor: { from: 'implantation', days: 0 }, estimated: false }, { anchor: { from: 'implantation', days: 30 }, estimated: true }] }],
    },
  };
  assert.equal((await saveFarmReferenceCropForUser(ALICE, { ...sorrel, source: 'criiam' }, { sourceUrl: null, datesSource: null })).ok, false);
  assert.equal((await saveFarmReferenceCropForUser(ALICE, sorrel, { sourceUrl: null, datesSource: 'Saisie de la ferme' })).ok, true);
  const alice = await listReferenceCropsForWorkspace(await ensureWorkspaceForUser(ALICE));
  assert.deepEqual(byKey(alice, 'local-oseille').crop, sorrel);
  assert.equal(alice.length, 33);
  const bob = await listReferenceCropsForWorkspace(await ensureWorkspaceForUser(BOB));
  assert.equal(bob.some((stored) => stored.crop.id === 'local-oseille'), false);
});

test('une durée en degrés-jours, hors de cette extension, rend la culture inutilisable et le dit', async () => {
  const workspace = await ensureWorkspaceForUser(ALICE);
  assert.equal((await saveFarmReferenceCropForUser(ALICE, CARROT, { sourceUrl: null, datesSource: null })).ok, true);
  database.sqlite.exec(`UPDATE irrigation_crop_reference_stage_starts SET duration_unit = 'degree-days', duration = 400
    WHERE rank = 2 AND reference_id = (SELECT id FROM irrigation_crop_reference_crops WHERE workspace_id IS NOT NULL)`);
  const carrot = byKey(await listReferenceCropsForWorkspace(workspace), CARROT.id);
  assert.deepEqual(carrot.problems, ['Carotte : des durées en degrés-jours, hors de cette extension.']);
});

test('la base refuse une culture incohérente : FAO hors trapèze, trapèze sans Kc, Kc hors bornes, deux jeux pour un mois', () => {
  const insert = (values: string) => () => database.sqlite.exec(`INSERT INTO irrigation_crop_reference_crops
    (id, crop_key, workspace_id, name, source, curve_shape, kc_initial, kc_mid, kc_end, abatement, calendar_end, emergence_sowing_days, emergence_planting_days)
    VALUES ${values}`);
  assert.throws(insert("('x1', 'x1', NULL, 'X', 'fao56', 'steps', NULL, NULL, NULL, NULL, NULL, 0, 0)"), /CHECK constraint failed/);
  assert.throws(insert("('x2', 'x2', NULL, 'X', 'fao56', 'trapezoid', 0.5, NULL, 0.8, 1, NULL, 0, 0)"), /CHECK constraint failed/);
  assert.throws(insert("('x3', 'x3', NULL, 'X', 'local', 'steps', NULL, NULL, NULL, NULL, '05-31', 0, 0)"), /CHECK constraint failed/);
  assert.throws(insert("('x4', 'criiam-tomate', NULL, 'X', 'local', 'steps', NULL, NULL, NULL, NULL, NULL, 0, 0)"), /UNIQUE constraint failed/);
  assert.throws(() => database.sqlite.exec("INSERT INTO irrigation_crop_reference_stages (reference_id, rank, label, kc) VALUES ('criiam-tomate', 9, 'X', 1.4)"), /CHECK constraint failed/);
  assert.throws(() => database.sqlite.exec("INSERT INTO irrigation_crop_reference_season_months (reference_id, month, set_number) VALUES ('criiam-chou-fleur', 4, 2)"), /UNIQUE constraint failed|PRIMARY KEY/);
  assert.throws(() => database.sqlite.exec("INSERT INTO irrigation_crop_reference_stage_starts (reference_id, set_number, rank, anchor, duration) VALUES ('criiam-tomate', 1, 9, 'implantation', 3)"), /FOREIGN KEY constraint failed/);
  assert.throws(() => database.sqlite.exec("UPDATE irrigation_crop_reference_stage_starts SET duration = 5 WHERE reference_id = 'criiam-tomate' AND rank = 4"), /CHECK constraint failed/, 'la mi-récolte n\'a pas de durée');
});
