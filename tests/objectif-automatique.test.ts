import assert from 'node:assert/strict';
import test from 'node:test';
import {
  automaticObjectiveEnabledOn,
  type AutomaticObjectiveInput,
  type AutomaticObjectiveSettingRevision,
} from '../lib/domain/automatic-objective.ts';
import type { CropSeries, ImplantationTask } from '../lib/domain/domain.ts';
import type { Et0Reading } from '../lib/domain/crop-water/etm.ts';
import type { KcOverride } from '../lib/domain/crop-water/kc.ts';
import { bedWaterDays, type BedWaterDay } from '../lib/domain/crop-water/proposal.ts';
import type { CorrespondenceEntry } from '../lib/domain/crop-water/species.ts';
import type { GoalRevisionLike } from '../lib/domain/irrigation-history/contract.ts';
import { objectiveForBed } from '../lib/domain/irrigation-needs.ts';
import { CARROT, REFERENCE_CROPS, cultivation, series, task } from './support/crop-water-references.ts';

/**
 * L'objectif automatique, O1 : la règle (docs/objectif-automatique-contract.md,
 * section 3, D-309, D-316). Les douze cas chiffrés du contrat, puis les
 * précisions faites en codant (F769 à F773). Semaine du lundi 15 au dimanche
 * 21 juin 2026, ET0 des sept jours 4,0 · 4,2 · 3,8 · 4,5 · 5,0 · 4,6 · 3,9 mm,
 * soit 30,0 mm ; réglage allumé depuis une semaine antérieure, sauf mention.
 */

const BED = { id: 'planche-a', zoneId: 'parcelle', plotId: 'jardin' };
const WEEK = ['2026-06-15', '2026-06-16', '2026-06-17', '2026-06-18', '2026-06-19', '2026-06-20', '2026-06-21'];
const [MONDAY, TUESDAY, WEDNESDAY, THURSDAY, FRIDAY, , SUNDAY] = WEEK;
const ET0 = [4.0, 4.2, 3.8, 4.5, 5.0, 4.6, 3.9];
/** Le lundi qui suit : tous les jours de la semaine sont passés, leur ET0 est la réanalyse. */
const NEXT_MONDAY = '2026-06-22';
const ON_BEFORE: AutomaticObjectiveSettingRevision = { enabled: true, createdAt: '2026-06-01T07:00:00.000Z' };

const reanalysis = (values: readonly (number | null)[] = ET0): Et0Reading[] => WEEK.map((date, index) => ({ date, reanalysisMm: values[index], forecastMm: null }));

function automatic(overrides: Partial<AutomaticObjectiveInput> = {}): AutomaticObjectiveInput {
  return {
    settings: [ON_BEFORE],
    today: NEXT_MONDAY,
    et0Readings: reanalysis(),
    plotMode: 'garden',
    shelterFactors: [],
    cropNeed: { status: 'off' },
    ...overrides,
  };
}

function objective(input: AutomaticObjectiveInput | undefined, revisions: readonly GoalRevisionLike[] = []) {
  return objectiveForBed(revisions, BED, MONDAY, SUNDAY, input);
}

function near(actual: number | null | undefined, expected: number, message = '') {
  assert.ok(typeof actual === 'number' && Math.abs(actual - expected) < 1e-9, `${message} : attendu ${expected}, obtenu ${actual}`);
}

/** Un jour de la planche d'après sa culture, tel que `bedWaterDays` le rend. */
function cropDay(index: number, status: BedWaterDay['status'], etmMm: number | null): BedWaterDay {
  return { date: WEEK[index], status, etmMm, et0: { mm: ET0[index], nature: 'reanalysis' }, crops: [], irrigationStop: false, problems: [] };
}

/** Une culture au Kc `kc` à partir du jour `from` de la semaine ; aucune culture avant. */
const cropFrom = (kc: number, from = 0): BedWaterDay[] => WEEK.map((_, index) => (
  index < from ? cropDay(index, 'no-crop', 0) : cropDay(index, 'computed', kc * ET0[index])
));

function goal(scope: GoalRevisionLike['scopeType'], amountMm: number | null, createdAt: string, weekStart = MONDAY): GoalRevisionLike {
  return {
    id: `${scope}-${createdAt}`,
    weekStart,
    scopeType: scope,
    otfZoneId: scope === 'farm' ? null : BED.zoneId,
    otfPlotId: scope === 'farm' || scope === 'zone' ? null : BED.plotId,
    otfBedId: scope === 'bed' ? BED.id : null,
    amountMm,
    action: amountMm === null ? 'cleared' : 'set',
    createdAt,
  };
}

test('cas 1 : plein champ, « Besoin par culture » décochée, aucun objectif saisi : 30,0 mm, automatique d’après l’ET0', () => {
  const result = objective(automatic());
  near(result.value, 30, 'objectif de la semaine');
  assert.equal(result.complete, true);
  assert.equal(result.origin, 'automatic');
  assert.equal(result.source, null, 'aucun objectif saisi n’a servi');
  assert.ok(result.automatic);
  assert.equal(result.automatic.basis, 'et0');
  assert.deepEqual(result.automatic.days.map((day) => day.status), Array(7).fill('et0'));
  assert.deepEqual(result.automatic.missingDates, []);
  near(result.automatic.byNature.reanalysis, 30, 'tout est réanalysé');
  assert.equal(result.automatic.byNature.forecast, 0);
});

test('cas 2 : sous abri, K_abri 0,8 par défaut : 24,0 mm ; un K_abri enregistré de 0,6 pour cet abri : 18,0 mm', () => {
  const sheltered = objective(automatic({ plotMode: 'greenhouse' }));
  near(sheltered.value, 24, 'ET0 × 0,8');
  assert.equal(sheltered.automatic?.basis, 'sheltered-et0');
  assert.ok(sheltered.automatic?.days.every((day) => day.status === 'et0' && day.shelterFactor === 0.8));

  const recorded = { value: 0.6, effectiveFrom: '2026-01-01', recordedAt: '2026-01-01T08:00:00.000Z' };
  near(objective(automatic({ plotMode: 'greenhouse', shelterFactors: [{ shelterId: BED.plotId, ...recorded }] })).value, 18, 'ET0 × 0,6');
  near(objective(automatic({ plotMode: 'greenhouse', shelterFactors: [{ shelterId: 'autre-abri', ...recorded }] })).value, 24, 'le K_abri d’un autre abri ne compte pas');
  near(objective(automatic({ shelterFactors: [{ shelterId: BED.plotId, ...recorded }] })).value, 30, 'en plein champ, K_abri vaut 1');
});

test('cas 3 : plein champ, besoin de la culture calculé, Kc 0,7 toute la semaine : 21,0 mm, automatique d’après la culture', () => {
  const result = objective(automatic({ cropNeed: { status: 'read', days: cropFrom(0.7) } }));
  near(result.value, 21, 'ETM de la semaine');
  assert.equal(result.origin, 'automatic');
  assert.equal(result.automatic?.basis, 'crop');
  near(result.automatic?.byNature.reanalysis, 21, 'nature de l’ET0 de l’ETM');
});

test('cas 4 : une espèce sans culture de référence : 30,0 mm, l’ET0 faute de besoin connu', () => {
  const days = WEEK.map((_, index) => cropDay(index, 'no-etm', null));
  const result = objective(automatic({ cropNeed: { status: 'read', days } }));
  near(result.value, 30, 'ET0 de la semaine');
  assert.equal(result.automatic?.basis, 'et0');
  assert.ok(result.automatic?.days.every((day) => day.status === 'et0' && day.cropNeedUnknown), 'chaque jour dit : faute de besoin connu');
});

test('cas 5 : un objectif de ferme saisi, 20 mm, passe avant : 20,0 mm, saisi', () => {
  const result = objective(automatic(), [goal('farm', 20, '2026-06-08T06:00:00.000Z', '2026-06-08')]);
  near(result.value, 20, 'objectif saisi');
  assert.equal(result.origin, 'entered');
  assert.equal(result.source, 'farm');
  assert.equal(result.automatic, null, 'l’objectif automatique ne s’applique à aucun jour');
  const zero = objective(automatic(), [goal('bed', 0, '2026-06-08T06:00:00.000Z', '2026-06-08')]);
  assert.equal(zero.value, 0, 'un objectif saisi de 0 mm passe avant lui aussi');
  assert.equal(zero.origin, 'entered');
});

test('cas 6 : un objectif de planche de 20 mm vidé le jeudi : 3 × 20 / 7 + 18,0 = 26,6 mm, les deux', () => {
  const revisions = [goal('bed', 20, '2026-06-10T08:00:00.000Z', '2026-06-08'), goal('bed', null, '2026-06-18T08:00:00.000Z')];
  const result = objective(automatic(), revisions);
  near(result.value, 3 * 20 / 7 + 4.5 + 5.0 + 4.6 + 3.9, 'objectif de la semaine');
  assert.equal(result.value?.toFixed(1), '26.6');
  assert.equal(result.origin, 'both');
  assert.equal(result.source, 'bed');
  assert.deepEqual(result.automatic?.days.map((day) => day.date), [THURSDAY, FRIDAY, '2026-06-20', SUNDAY]);
});

test('cas 7 : le réglage allumé le mercredi, aucun objectif saisi : 21,8 mm, automatique à partir du mercredi', () => {
  const result = objective(automatic({ settings: [{ enabled: true, createdAt: '2026-06-17T06:00:00.000Z' }] }));
  near(result.value, 3.8 + 4.5 + 5.0 + 4.6 + 3.9, 'du mercredi au dimanche');
  assert.equal(result.value?.toFixed(1), '21.8');
  assert.equal(result.origin, 'automatic');
  assert.equal(result.automatic?.days[0].date, WEDNESDAY, 'lundi et mardi n’avaient pas de cible');
  assert.deepEqual(result.automatic?.missingDates, [], 'les jours d’avant le geste ne manquent pas : ils n’avaient pas de cible');
});

test('cas 8 : l’ET0 du dimanche inconnue : 26,1 mm, « incomplet : 1 jour sans ET0 », jamais compté pour zéro en silence', () => {
  const result = objective(automatic({ et0Readings: reanalysis([4.0, 4.2, 3.8, 4.5, 5.0, 4.6, null]) }));
  near(result.value, 26.1, 'somme des jours connus');
  assert.equal(result.complete, true, 'la semaine a un objectif');
  assert.deepEqual(result.automatic?.missingDates, [SUNDAY], 'le jour sans ET0 est nommé');
  assert.equal(result.automatic?.days.at(-1)?.status, 'missing-et0');
  const none = objective(automatic({ et0Readings: [] }));
  assert.equal(none.value, null, 'aucune ET0 : pas d’objectif inventé');
  assert.equal(none.complete, false);
  assert.equal(none.automatic?.missingDates.length, 7);
});

test('cas 9 : « Besoin par culture » cochée, aucune culture de la semaine : pas d’objectif, « pas de culture cette semaine »', () => {
  const result = objective(automatic({ cropNeed: { status: 'read', days: cropFrom(0.7, 7) } }));
  assert.equal(result.value, null);
  assert.equal(result.complete, false);
  assert.equal(result.origin, null);
  assert.equal(result.automatic?.noCropWeek, true);
  assert.equal(result.automatic?.mm, null);
  assert.equal(result.automatic?.basis, null);
});

test('cas 10 : une culture plantée le jeudi, Kc 0,5 : 0,5 × 18,0 = 9,0 mm, automatique d’après la culture', () => {
  const result = objective(automatic({ cropNeed: { status: 'read', days: cropFrom(0.5, 3) } }));
  near(result.value, 9, 'lundi à mercredi sans culture comptent 0');
  assert.equal(result.automatic?.noCropWeek, false);
  assert.equal(result.automatic?.basis, 'crop');
  assert.deepEqual(result.automatic?.days.slice(0, 3).map((day) => day.status), ['no-crop', 'no-crop', 'no-crop']);
});

test('cas 11 : réglage éteint, l’objectif saisi ou aucun, comme aujourd’hui', () => {
  const configurations: GoalRevisionLike[][] = [
    [],
    [goal('farm', 20, '2026-06-08T06:00:00.000Z', '2026-06-08')],
    [goal('bed', 20, '2026-06-10T08:00:00.000Z', '2026-06-08'), goal('bed', null, '2026-06-18T08:00:00.000Z')],
    [goal('plot', 12, '2026-06-16T08:00:00.000Z'), goal('zone', 30, '2026-06-01T08:00:00.000Z', '2026-06-01')],
  ];
  const off: AutomaticObjectiveSettingRevision[][] = [
    [],
    [ON_BEFORE, { enabled: false, createdAt: '2026-06-05T07:00:00.000Z' }],
    [{ enabled: true, createdAt: '2026-06-22T07:00:00.000Z' }],
  ];
  for (const revisions of configurations) {
    const before = objectiveForBed(revisions, BED, MONDAY, SUNDAY);
    assert.equal(before.automatic, null);
    for (const settings of off) {
      for (const cropNeed of [{ status: 'off' }, { status: 'read', days: cropFrom(0.7) }, { status: 'unread' }] as const) {
        assert.deepEqual(objective(automatic({ settings, cropNeed }), revisions), before, 'réglage éteint : rien ne change');
      }
    }
  }
});

test('cas 12 : le mardi matin, la prévision du vendredi passe de 5,0 à 6,0 mm : 31,0 mm, relu chaque matin', () => {
  const monday = WEEK.map((date, index) => ({ date, reanalysisMm: null, forecastMm: ET0[index] }));
  const onMonday = objective(automatic({ today: MONDAY, et0Readings: monday }));
  near(onMonday.value, 30, 'le lundi matin, tout est prévu');
  near(onMonday.automatic?.byNature.forecast, 30, 'prévu');

  const tuesday = WEEK.map((date, index) => ({
    date,
    reanalysisMm: date === MONDAY ? ET0[index] : null,
    forecastMm: date === FRIDAY ? 6.0 : ET0[index],
  }));
  const onTuesday = objective(automatic({ today: TUESDAY, et0Readings: tuesday }));
  near(onTuesday.value, 31, 'le mardi matin');
  near(onTuesday.automatic?.byNature.reanalysis, 4.0, 'lundi passé');
  near(onTuesday.automatic?.byNature.forecast, 27, 'mardi à dimanche prévus');
});

test('un jour passé sans réanalyse prend la prévision enregistrée, marquée estimée, jamais confondue (D-006)', () => {
  const readings = WEEK.map((date, index) => ({
    date,
    reanalysisMm: date < WEDNESDAY ? ET0[index] : null,
    forecastMm: date >= WEDNESDAY ? ET0[index] : null,
  }));
  const result = objective(automatic({ today: THURSDAY, et0Readings: readings }));
  near(result.value, 30, 'semaine entière');
  near(result.automatic?.byNature.reanalysis, 8.2, 'lundi et mardi réanalysés');
  near(result.automatic?.byNature.estimated, 3.8, 'mercredi estimé');
  near(result.automatic?.byNature.forecast, 18, 'jeudi à dimanche prévus');
});

test('le réglage compte à partir du jour du geste, en heure de Paris ; deux gestes du même jour : le second fait foi (F773)', () => {
  // 23 h 30 le mardi à Paris (21 h 30 UTC) : dès mardi ; 0 h 30 le mercredi à Paris (22 h 30 UTC mardi) : dès mercredi.
  assert.equal(automaticObjectiveEnabledOn([{ enabled: true, createdAt: '2026-06-16T21:30:00.000Z' }], TUESDAY), true);
  assert.equal(automaticObjectiveEnabledOn([{ enabled: true, createdAt: '2026-06-16T22:30:00.000Z' }], TUESDAY), false);
  assert.equal(automaticObjectiveEnabledOn([{ enabled: true, createdAt: '2026-06-16T22:30:00.000Z' }], WEDNESDAY), true);
  const sameDay = [{ enabled: true, createdAt: '2026-06-17T06:00:00.000Z' }, { enabled: false, createdAt: '2026-06-17T08:00:00.000Z' }];
  assert.equal(automaticObjectiveEnabledOn(sameDay, WEDNESDAY), false, 'éteint dans la journée : éteint ce jour-là');
  assert.equal(automaticObjectiveEnabledOn([...sameDay].reverse(), WEDNESDAY), false, 'l’ordre reçu ne change pas le plus récent');
  const sameInstant = [{ enabled: true, createdAt: '2026-06-17T06:00:00.000Z' }, { enabled: false, createdAt: '2026-06-17T06:00:00.000Z' }];
  assert.equal(automaticObjectiveEnabledOn(sameInstant, WEDNESDAY), false, 'même milliseconde : le second reçu fait foi');
  assert.equal(automaticObjectiveEnabledOn([], WEDNESDAY), false, 'aucun geste : éteint');

  const offThursday = objective(automatic({ settings: [ON_BEFORE, { enabled: false, createdAt: '2026-06-18T07:00:00.000Z' }] }));
  near(offThursday.value, 4.0 + 4.2 + 3.8, 'éteint jeudi : lundi à mercredi seulement');
});

test('une ETM partielle (une culture sur deux) ou bloquée prend l’ET0 du jour pour toute la planche, jamais une demi-ETM', () => {
  const days = cropFrom(0.5);
  days[1] = cropDay(1, 'partial', 0.4 * ET0[1]);
  days[2] = { ...cropDay(2, 'blocked', null), problems: ['Tomate : le stade 3 manque dans la table.'] };
  const result = objective(automatic({ cropNeed: { status: 'read', days } }));
  near(result.value, 0.5 * (30 - 4.2 - 3.8) + 4.2 + 3.8, 'mardi et mercredi à l’ET0');
  assert.equal(result.automatic?.basis, 'mixed');
  const tuesday = result.automatic?.days[1];
  assert.ok(tuesday?.status === 'et0' && tuesday.cropNeedUnknown);
});

test('une ET0 hors bornes ne donne pas de valeur au jour, le message la nomme (F771)', () => {
  const result = objective(automatic({ et0Readings: reanalysis([4.0, 4.2, 16, 4.5, 5.0, 4.6, 3.9]) }));
  near(result.value, 30 - 3.8, 'mercredi n’est pas compté');
  assert.deepEqual(result.automatic?.missingDates, [WEDNESDAY]);
  const wednesday = result.automatic?.days[2];
  assert.ok(wednesday?.status === 'blocked');
  assert.match(wednesday.problems[0], /ET0 hors bornes le 17 juin 2026 : 16 mm\/j/);
});

test('un jardin à classer n’a pas d’objectif automatique : on ne sait pas s’il est sous abri (F769)', () => {
  const result = objective(automatic({ plotMode: 'unclassified' }));
  assert.equal(result.value, null);
  assert.equal(result.origin, null);
  assert.ok(result.automatic?.days.every((day) => day.status === 'unclassified-plot'));
  assert.equal(result.automatic?.missingDates.length, 7);
});

test('« Besoin par culture » cochée, plan de culture non lu : pas de valeur, jamais l’ET0 d’une planche peut-être vide (F770)', () => {
  const result = objective(automatic({ cropNeed: { status: 'unread' } }));
  assert.equal(result.value, null);
  assert.ok(result.automatic?.days.every((day) => day.status === 'crop-plan-unread'));
  assert.equal(result.automatic?.missingDates.length, 7);
});

test('« sans culture de toute la semaine » se lit sur les sept jours : une culture récoltée le mercredi laisse 0 ensuite (F772)', () => {
  const harvested = WEEK.map((_, index) => (index < 3 ? cropDay(index, 'computed', ET0[index]) : cropDay(index, 'no-crop', 0)));
  const automaticOnly = objective(automatic({ cropNeed: { status: 'read', days: harvested } }));
  near(automaticOnly.value, 4.0 + 4.2 + 3.8, 'jeudi à dimanche comptent 0');
  assert.equal(automaticOnly.automatic?.noCropWeek, false);

  // L'objectif saisi couvre les jours de culture ; les jours automatiques sont tous sans culture : 0, pas « pas d'objectif ».
  const revisions = [goal('bed', 14, '2026-06-10T08:00:00.000Z', '2026-06-08'), goal('bed', null, '2026-06-18T08:00:00.000Z')];
  const both = objective(automatic({ cropNeed: { status: 'read', days: harvested } }), revisions);
  near(both.value, 3 * 14 / 7, 'lundi à mercredi saisis, jeudi à dimanche à 0');
  assert.equal(both.origin, 'both');
});

const CORRESPONDENCES: CorrespondenceEntry[] = [
  { plantId: 'plant-carotte', seriesId: null, target: { kind: 'reference', referenceCropId: CARROT.id, analogy: false } },
  { plantId: 'plant-zinnia', seriesId: null, target: { kind: 'without-reference' } },
];

function realCropDays(seriesList: CropSeries[], tasks: ImplantationTask[], overrides: KcOverride[] = []): BedWaterDay[] {
  return bedWaterDays({
    bedId: BED.id,
    today: NEXT_MONDAY,
    cropPlan: {
      series: seriesList,
      places: seriesList.map((item) => ({ id: `place-${item.id}`, seriesId: item.id, bedId: BED.id, lengthMeters: null })),
      implantationTasks: tasks,
    },
    referenceCrops: REFERENCE_CROPS,
    correspondences: CORRESPONDENCES,
    overrides,
    declarations: [],
    et0Readings: reanalysis(),
    settings: { bedId: BED.id, shelterId: null, shelterFactors: [], mulch: [], shadeNets: [] },
  }, WEEK).days;
}

test('par le vrai calcul de l’ETM : une carotte au Kc 0,7 donne 21,0 mm, un zinnia sans culture de référence l’ET0, 30,0 mm', () => {
  const carrot = series('carotte', [cultivation('carotte-c', 'plant-carotte', 'Carotte', { expected: ['2026-W30'] })]);
  const kc07: KcOverride = { referenceCropId: CARROT.id, target: { rank: 2 }, kc: 0.7, effectiveFrom: '2026-01-01', recordedAt: '2026-01-01T08:00:00.000Z' };
  const carrotDays = realCropDays([carrot], [task('carotte', 'direct-sowing', '2026-W10')], [kc07]);
  assert.ok(carrotDays.every((day) => day.status === 'computed'), 'la carotte est au stade 2 toute la semaine');
  near(objective(automatic({ cropNeed: { status: 'read', days: carrotDays } })).value, 21, 'ETM réelle');

  const zinnia = series('zinnia', [cultivation('zinnia-c', 'plant-zinnia', 'Zinnia', { expected: ['2026-W30'] })]);
  const zinniaDays = realCropDays([zinnia], [task('zinnia', 'planting', '2026-W20')]);
  assert.ok(zinniaDays.every((day) => day.status === 'no-etm'), 'le zinnia n’a pas de culture de référence');
  const result = objective(automatic({ cropNeed: { status: 'read', days: zinniaDays } }));
  near(result.value, 30, 'l’ET0 faute de besoin connu');
  assert.equal(result.automatic?.basis, 'et0');
});
