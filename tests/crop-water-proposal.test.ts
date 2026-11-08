import assert from 'node:assert/strict';
import test from 'node:test';
import type { CropSeries, ImplantationTask, IrrigationSnapshot } from '../lib/domain/domain.ts';
import { goalRevisionFirstDate } from '../lib/domain/hydric-goal-revisions.ts';
import type { GoalRevisionLike } from '../lib/domain/irrigation-history/contract.ts';
import { buildIrrigationNeedsDashboard } from '../lib/domain/irrigation-needs.ts';
import type { WaterDashboardDay } from '../lib/domain/water-management.ts';
import type { BedWaterSettings, Et0Reading } from '../lib/domain/crop-water/etm.ts';
import {
  adoptionRevision,
  bedWeekProposal,
  EARLY_SPRINKLER_WARNING,
  earlySprinklerWarning,
  weekProposal,
  type BedCropWaterInput,
} from '../lib/domain/crop-water/proposal.ts';
import { calendarCycleDates, isMonthDay, referenceCropProblems, type ReferenceCrop } from '../lib/domain/crop-water/reference.ts';
import { resolveCorrespondence, speciesWithoutReference, type CorrespondenceEntry } from '../lib/domain/crop-water/species.ts';
import {
  ARTICHOKE,
  BROCCOLI,
  CARROT,
  CAULIFLOWER,
  cultivation,
  GARLIC,
  GREEN_ONION,
  REFERENCE_CROPS,
  series,
  task,
} from './support/crop-water-references.ts';

/**
 * L'objectif proposé de la semaine et son adoption
 * (docs/crop-water-need-contract.md, « L'objectif proposé », « Les
 * garde-fous ») : scénarios 8, 9, 10 et 13 du contrat, les alertes de
 * cohérence, l'avertissement d'aspersion, la vérification des tables et la
 * correspondance des espèces.
 */

const BED = { id: 'planche-a', zoneId: 'parcelle', plotId: 'jardin' };
const OPEN_FIELD: BedWaterSettings = { bedId: BED.id, shelterId: null, shelterFactors: [], mulch: [], shadeNets: [] };
const CORRESPONDENCES: CorrespondenceEntry[] = [
  { plantId: 'plant-carotte', seriesId: null, target: { kind: 'reference', referenceCropId: CARROT.id, analogy: false } },
  { plantId: 'plant-panais', seriesId: null, target: { kind: 'reference', referenceCropId: CARROT.id, analogy: true } },
  { plantId: 'plant-chou-fleur', seriesId: null, target: { kind: 'reference', referenceCropId: CAULIFLOWER.id, analogy: false } },
  { plantId: 'plant-brocoli', seriesId: null, target: { kind: 'reference', referenceCropId: BROCCOLI.id, analogy: false } },
  { plantId: 'plant-ail', seriesId: null, target: { kind: 'reference', referenceCropId: GARLIC.id, analogy: false } },
  { plantId: 'plant-ail', seriesId: 'aillet', target: { kind: 'reference', referenceCropId: GREEN_ONION.id, analogy: false } },
  { plantId: 'plant-ail', seriesId: 'allium', target: { kind: 'without-reference' } },
  { plantId: 'plant-zinnia', seriesId: null, target: { kind: 'without-reference' } },
];

// Semaine 2026-W16, du lundi 13 au dimanche 19 avril : la carotte semée en 2026-W10 est au Kc 1.
const WEEK = ['2026-04-13', '2026-04-14', '2026-04-15', '2026-04-16', '2026-04-17', '2026-04-18', '2026-04-19'];
const carrotSeries = series('carotte', [cultivation('carotte-c', 'plant-carotte', 'Carotte', { expected: ['2026-W26'] })]);
const carrotTasks = [task('carotte', 'direct-sowing', '2026-W10')];

function weekInput(
  seriesList: CropSeries[],
  tasks: ImplantationTask[],
  et0Readings: Et0Reading[],
  options: { objectiveMm?: number | null; today?: string; weekStart?: string } = {},
): BedCropWaterInput & { weekStart: string; objectiveMm: number | null } {
  return {
    bedId: BED.id,
    today: options.today ?? '2026-04-20',
    cropPlan: {
      series: seriesList,
      places: seriesList.map((item) => ({ id: `place-${item.id}`, seriesId: item.id, bedId: BED.id, lengthMeters: null })),
      implantationTasks: tasks,
    },
    referenceCrops: REFERENCE_CROPS,
    correspondences: CORRESPONDENCES,
    overrides: [],
    declarations: [],
    et0Readings,
    settings: OPEN_FIELD,
    weekStart: options.weekStart ?? WEEK[0],
    objectiveMm: options.objectiveMm === undefined ? 20 : options.objectiveMm,
  };
}

const constantEt0 = (mm: number, days = WEEK): Et0Reading[] => days.map((date) => ({ date, reanalysisMm: mm, forecastMm: null }));

test('scénario 8 : sept jours à 3,5 mm/j font une proposition de 24,5 mm/semaine', () => {
  const proposal = bedWeekProposal(weekInput([carrotSeries], carrotTasks, constantEt0(3.5)));
  assert.equal(proposal.status, 'complete');
  assert.deepEqual(proposal.days.map((day) => day.etmMm), [3.5, 3.5, 3.5, 3.5, 3.5, 3.5, 3.5]);
  assert.equal(proposal.proposedMm, 24.5);
  assert.deepEqual(proposal.byNature, { reanalysis: 24.5, estimated: 0, forecast: 0 });
  assert.equal(proposal.objectiveMm, 20);
  assert.equal(proposal.differenceMm, 4.5);
  assert.equal(proposal.differencePercent, 22.5);
  assert.deepEqual(proposal.alerts, []);
  assert.equal(proposal.adoptable, true);
  assert.equal(proposal.weekStart, '2026-04-13');
  assert.equal(proposal.weekEnd, '2026-04-19');
});

test('scénarios 8 et 13 : tant qu\'elle n\'est pas adoptée, le besoin lit l\'objectif saisi ; adoptée mercredi, elle vaut dès mercredi', () => {
  const garden: GoalRevisionLike = {
    id: 'objectif-jardin', weekStart: WEEK[0], scopeType: 'plot', otfZoneId: BED.zoneId, otfPlotId: BED.plotId, otfBedId: null,
    amountMm: 20, action: 'set', createdAt: '2026-04-10T08:00:00.000Z',
  };
  assert.equal(needsObjective([garden]), 20, 'la proposition n\'entre pas dans le besoin');

  // Mercredi 15 avril : réanalyse lundi et mardi, prévision de mercredi à dimanche.
  const readings = WEEK.map((date) => ({ date, reanalysisMm: date < '2026-04-15' ? 3.5 : null, forecastMm: 3.5 }));
  const proposal = bedWeekProposal(weekInput([carrotSeries], carrotTasks, readings, { today: '2026-04-15' }));
  assert.deepEqual(proposal.byNature, { reanalysis: 7, estimated: 0, forecast: 17.5 });
  const adoption = adoptionRevision(proposal, BED, '2026-04-15T08:00:00.000Z');
  assert.deepEqual(adoption, {
    weekStart: '2026-04-13', scopeType: 'bed', otfZoneId: 'parcelle', otfPlotId: 'jardin', otfBedId: 'planche-a',
    amountMm: 24.5, action: 'set', createdAt: '2026-04-15T08:00:00.000Z', copiedFromGoalId: null, origin: 'adopted-proposal',
  });
  assert.ok(adoption);
  assert.equal(goalRevisionFirstDate(adoption), '2026-04-15', 'valable dès mercredi');
  const objective = needsObjective([garden, { ...adoption, id: 'adoption' }]);
  assert.ok(Math.abs((objective ?? 0) - (2 * 20 + 5 * 24.5) / 7) < 1e-9, 'le jardin vaut encore lundi et mardi');
});

test('scénario 9 : un mercredi sans ET0 rend la proposition partielle, mercredi nommé ; elle ne s\'adopte pas', () => {
  const readings = constantEt0(3.5).map((reading) => (reading.date === '2026-04-15' ? { ...reading, reanalysisMm: null } : reading));
  const proposal = bedWeekProposal(weekInput([carrotSeries], carrotTasks, readings));
  assert.equal(proposal.status, 'partial');
  assert.deepEqual(proposal.missingDays, ['2026-04-15']);
  assert.equal(proposal.proposedMm, 21, 'la somme des jours connus, jamais le mercredi pour zéro');
  assert.equal(proposal.differenceMm, null);
  assert.equal(proposal.adoptable, false);
  assert.equal(adoptionRevision(proposal, BED, '2026-04-20T08:00:00.000Z'), null);

  const estimated = constantEt0(3.5).map((reading) => (reading.date === '2026-04-15' ? { ...reading, reanalysisMm: null, forecastMm: 4 } : reading));
  const withForecast = bedWeekProposal(weekInput([carrotSeries], carrotTasks, estimated));
  assert.equal(withForecast.status, 'complete');
  assert.deepEqual(withForecast.byNature, { reanalysis: 21, estimated: 4, forecast: 0 }, 'estimé et observé ne sont jamais confondus');
});

test('la semaine en cours mêle le passé et le prévu ; une ETM au-delà de 8 mm/j est signalée', () => {
  const cauliflowerSeries = series('chou', [cultivation('cf', 'plant-chou-fleur', 'Chou-fleur', { expected: ['2026-W26'] })]);
  const tasks = [task('chou', 'planting', '2026-W14')];
  const week = ['2026-05-18', '2026-05-19', '2026-05-20', '2026-05-21', '2026-05-22', '2026-05-23', '2026-05-24'];
  const readings: Et0Reading[] = week.map((date, index) => ({ date, reanalysisMm: index < 3 ? 5 : null, forecastMm: index < 3 ? null : 7 }));
  const proposal = bedWeekProposal(weekInput([cauliflowerSeries], tasks, readings, { today: '2026-05-21', weekStart: week[0], objectiveMm: 30 }));
  assert.equal(proposal.status, 'complete');
  assert.equal(proposal.days[0].etmMm, 5, 'lundi 18 mai, Kc 1');
  assert.equal(proposal.days[1].etmMm, 6.5, 'mardi 19 mai, J50, Kc 1,3');
  assert.equal(Math.round((proposal.days[3].etmMm ?? 0) * 100) / 100, 9.1);
  assert.equal(proposal.byNature.forecast > 0 && proposal.byNature.reanalysis > 0, true);
  assert.deepEqual(proposal.alerts.filter((alert) => alert.kind === 'high-etm').map((alert) => alert.kind === 'high-etm' && alert.date), week.slice(3));
  assert.ok(proposal.alerts.some((alert) => alert.kind === 'deviation'), '54,4 mm contre 30 mm, plus de 50 %');
});

test('l\'alerte d\'écart : plus de 50 % de l\'objectif applicable, ou une proposition face à un objectif de 0', () => {
  const at = (objectiveMm: number | null) => bedWeekProposal(weekInput([carrotSeries], carrotTasks, constantEt0(3), { objectiveMm }));
  assert.deepEqual(at(14).alerts, [], '21 mm contre 14 mm : exactement 50 %');
  assert.deepEqual(at(13).alerts, [{ kind: 'deviation', proposedMm: 21, objectiveMm: 13 }]);
  assert.deepEqual(at(50).alerts, [{ kind: 'deviation', proposedMm: 21, objectiveMm: 50 }]);
  assert.deepEqual(at(0).alerts, [{ kind: 'deviation', proposedMm: 21, objectiveMm: 0 }]);
  assert.equal(at(0).differencePercent, null);
  assert.deepEqual(at(null).alerts, [], 'sans objectif, rien à comparer');
  assert.equal(at(null).differenceMm, null);
});

test('une planche sans culture un jour compte 0 ; une semaine sans culture n\'a pas de proposition', () => {
  // La carotte récoltée en 2026-W16 quitte la planche le dimanche ; la semaine suivante est vide.
  const shortCarrot = series('carotte-courte', [cultivation('cc', 'plant-carotte', 'Carotte', { expected: ['2026-W16'] })]);
  const tasks = [task('carotte-courte', 'direct-sowing', '2026-W10')];
  const lastWeek = bedWeekProposal(weekInput([shortCarrot], tasks, constantEt0(3)));
  assert.equal(lastWeek.status, 'complete');
  const nextWeek = ['2026-04-20', '2026-04-21', '2026-04-22', '2026-04-23', '2026-04-24', '2026-04-25', '2026-04-26'];
  const empty = bedWeekProposal(weekInput([shortCarrot], tasks, constantEt0(3, nextWeek), { weekStart: nextWeek[0], today: '2026-04-27' }));
  assert.equal(empty.status, 'no-crop');
  assert.equal(empty.proposedMm, null);
  assert.equal(empty.adoptable, false);

  const midWeek = series('carotte-mi', [cultivation('cm', 'plant-carotte', 'Carotte', { expected: ['2026-W16'] })]);
  const sowing = [task('carotte-mi', 'direct-sowing', '2026-W16')];
  const late = bedWeekProposal(weekInput([midWeek, shortCarrot], [...sowing, ...tasks], constantEt0(2, nextWeek), { weekStart: nextWeek[0], today: '2026-04-27' }));
  assert.equal(late.status, 'no-crop', 'les deux carottes ont fini le 19 avril');
});

test('scénario 10 et 21 : sans référence, aucune proposition ; avec une autre culture, la proposition est partielle et nomme l\'espèce', () => {
  const zinnia = series('zinnia', [cultivation('z', 'plant-zinnia', 'Zinnia', { expected: ['2026-W30'] })]);
  const zinniaTasks = [task('zinnia', 'planting', '2026-W14')];
  const alone = bedWeekProposal(weekInput([zinnia], zinniaTasks, constantEt0(3)));
  assert.equal(alone.status, 'unavailable', 'l\'objectif saisi reste seul');
  assert.equal(alone.proposedMm, null);
  assert.deepEqual(alone.cropsWithoutEtm, [{ seriesName: 'zinnia', plantName: 'Zinnia', reason: 'without-reference' }]);

  const unknown = series('physalis', [cultivation('p', 'plant-physalis', 'Physalis', { expected: ['2026-W30'] })]);
  const mixed = bedWeekProposal(weekInput([carrotSeries, unknown], [...carrotTasks, task('physalis', 'planting', '2026-W14')], constantEt0(3)));
  assert.equal(mixed.status, 'partial');
  assert.equal(mixed.proposedMm, 21);
  assert.deepEqual(mixed.cropsWithoutEtm, [{ seriesName: 'physalis', plantName: 'Physalis', reason: 'missing-correspondence' }]);
  assert.equal(mixed.adoptable, false);
});

test('une série posée sur la planche sans semaine d\'implantation est rendue à part, sans stade', () => {
  const pending = series('a-planter', [cultivation('ap', 'plant-carotte', 'Carotte')]);
  const proposal = bedWeekProposal(weekInput([carrotSeries, pending], carrotTasks, constantEt0(3)));
  assert.equal(proposal.status, 'complete');
  assert.deepEqual(proposal.unplaced.map((item) => [item.seriesId, item.reason]), [['a-planter', 'no-implantation']]);
});

test('un jour bloqué par une valeur hors bornes est nommé ; la semaine est partielle', () => {
  const readings = constantEt0(3).map((reading) => (reading.date === '2026-04-16' ? { ...reading, reanalysisMm: 14 } : reading));
  const proposal = bedWeekProposal(weekInput([carrotSeries], carrotTasks, readings));
  assert.equal(proposal.status, 'partial');
  assert.deepEqual(proposal.blockedDays, [{ date: '2026-04-16', problems: ['ET0 hors bornes le 16 avril 2026 : 14 mm/j (entre 0 et 12).'] }]);
  assert.equal(proposal.proposedMm, 18);
});

test('l\'arrêt d\'irrigation avant récolte se lit jour par jour', () => {
  const garlic = series('ail', [cultivation('a', 'plant-ail', 'Ail', { expected: ['2026-W28'] })]);
  const week = ['2026-06-15', '2026-06-16', '2026-06-17', '2026-06-18', '2026-06-19', '2026-06-20', '2026-06-21'];
  const proposal = bedWeekProposal(weekInput([garlic], [task('ail', 'planting', '2025-W44')], constantEt0(5, week), { weekStart: week[0], today: '2026-06-22' }));
  assert.deepEqual(proposal.irrigationStopDates, []);
  const stopWeek = ['2026-06-22', '2026-06-23', '2026-06-24', '2026-06-25', '2026-06-26', '2026-06-27', '2026-06-28'];
  const stop = bedWeekProposal(weekInput([garlic], [task('ail', 'planting', '2025-W44')], constantEt0(5, stopWeek), { weekStart: stopWeek[0], today: '2026-06-29' }));
  assert.deepEqual(stop.irrigationStopDates, stopWeek);
  assert.equal(stop.proposedMm, 0);
  assert.equal(stop.adoptable, true, 'adopter 0 mm, c\'est arrêter l\'irrigation avant la récolte');
});

test('l\'avertissement d\'aspersion : premier stade du CRIIAM, aspersion posée, arrosages à trois jours ou moins', () => {
  const sowingWeek = ['2026-03-02', '2026-03-03', '2026-03-04', '2026-03-05', '2026-03-06', '2026-03-07', '2026-03-08'];
  const { days } = bedWeekProposal(weekInput([carrotSeries], carrotTasks, constantEt0(2, sowingWeek), { weekStart: sowingWeek[0], today: '2026-03-09' }));
  assert.equal(earlySprinklerWarning({ days, sprinklerOnBed: true, irrigationDates: ['2026-03-02', '2026-03-05'] }), EARLY_SPRINKLER_WARNING);
  assert.equal(earlySprinklerWarning({ days, sprinklerOnBed: true, irrigationDates: ['2026-03-02', '2026-03-06'] }), null, 'quatre jours d\'écart');
  assert.equal(earlySprinklerWarning({ days, sprinklerOnBed: false, irrigationDates: ['2026-03-02', '2026-03-03'] }), null, 'goutte-à-goutte');
  const { days: later } = bedWeekProposal(weekInput([carrotSeries], carrotTasks, constantEt0(2)));
  assert.equal(earlySprinklerWarning({ days: later, sprinklerOnBed: true, irrigationDates: ['2026-04-13', '2026-04-14'] }), null, 'après le premier stade');
  const broccoli = series('brocoli', [cultivation('b', 'plant-brocoli', 'Chou brocoli', { expected: ['2026-W30'] })]);
  const { days: fao } = bedWeekProposal(weekInput([broccoli], [task('brocoli', 'planting', '2026-W10')], constantEt0(2, sowingWeek), { weekStart: sowingWeek[0], today: '2026-03-09' }));
  assert.equal(earlySprinklerWarning({ days: fao, sprinklerOnBed: true, irrigationDates: ['2026-03-02', '2026-03-03'] }), null, 'la FAO n\'est pas concernée');
});

test('une proposition calculée sur des jours donnés reste une somme de sept jours', () => {
  const proposal = weekProposal({ days: [], objectiveMm: 10 });
  assert.equal(proposal.status, 'no-crop');
  assert.equal(proposal.proposedMm, null);
});

test('les tables de référence des scénarios sont utilisables ; une table fausse est refusée en phrases', () => {
  for (const crop of REFERENCE_CROPS) assert.deepEqual(referenceCropProblems(crop), [], crop.name);
  const broken: ReferenceCrop = {
    id: 'cassee',
    name: 'Cassée',
    source: 'fao56',
    emergenceDelayDays: { 'direct-sowing': -1, planting: 0 },
    curve: {
      shape: 'steps',
      stages: [{ rank: 2, label: 'Un', kc: 1.5 }, { rank: 1, label: 'Deux', kc: 0.5 }],
      sets: [{ months: [1, 2, 3, 3], value: [{ anchor: { from: 'implantation', days: 0 }, estimated: false }] }],
    },
  };
  assert.deepEqual(referenceCropProblems(broken), [
    'Cassée : délai de levée invalide (-1).',
    'Cassée : la FAO-56 se lit en trapèze.',
    'Kc hors bornes pour Cassée, Un : 1,5 (entre 0 et 1,3).',
    'Cassée : rang de stade invalide (1).',
    'Cassée : le mois 3 a plusieurs jeux de dates.',
    ...[4, 5, 6, 7, 8, 9, 10, 11, 12].map((month) => `Cassée : le mois ${month} n'a aucun jeu de dates.`),
    'Cassée : le jeu de dates des mois 1, 2, 3, 3 ne donne pas un début à chaque stade.',
  ]);
  const longCalendar: ReferenceCrop = {
    ...ARTICHOKE,
    curve: { shape: 'calendar', stages: [{ rank: 1, label: 'Un', kc: 0.5, start: '03-01', estimated: false }, { rank: 2, label: 'Deux', kc: 0.6, start: '02-15', estimated: false }], end: '03-05', establishment: null },
  };
  assert.deepEqual(referenceCropProblems(longCalendar), ['Artichaut remontant : le calendrier dépasse un an.']);
  const leap: ReferenceCrop = { ...longCalendar, curve: { shape: 'calendar', stages: [{ rank: 1, label: 'Un', kc: 0.5, start: '02-29', estimated: false }], end: '05-31', establishment: null } };
  assert.deepEqual(referenceCropProblems(leap), ['Artichaut remontant : jour de calendrier invalide (02-29).']);
  assert.equal(isMonthDay('12-31'), true);
  assert.equal(isMonthDay('13-01'), false);
});

test('le cycle d\'un calendrier peut passer la fin de l\'année', () => {
  assert.deepEqual(ARTICHOKE.curve.shape === 'calendar' && calendarCycleDates(ARTICHOKE.curve, 2026), {
    starts: ['2026-08-01', '2026-08-15', '2027-01-01'],
    end: '2027-05-31',
  });
});

test('la correspondance : l\'exception de la série prime sur l\'espèce ; une espèce sans rattachement est signalée, jamais devinée', () => {
  assert.deepEqual(resolveCorrespondence(CORRESPONDENCES, 'ail-sec', 'plant-ail'), { kind: 'reference', referenceCropId: GARLIC.id, analogy: false, exception: false });
  assert.deepEqual(resolveCorrespondence(CORRESPONDENCES, 'aillet', 'plant-ail'), { kind: 'reference', referenceCropId: GREEN_ONION.id, analogy: false, exception: true });
  assert.deepEqual(resolveCorrespondence(CORRESPONDENCES, 'allium', 'plant-ail'), { kind: 'without-reference', exception: true });
  assert.deepEqual(resolveCorrespondence(CORRESPONDENCES, 'panais', 'plant-panais'), { kind: 'reference', referenceCropId: CARROT.id, analogy: true, exception: false });
  assert.deepEqual(resolveCorrespondence(CORRESPONDENCES, 'physalis', 'plant-physalis'), { kind: 'missing' });

  const plan = [
    series('ail-sec', [cultivation('a1', 'plant-ail', 'Ail')]),
    series('allium', [cultivation('a2', 'plant-ail', 'Ail')]),
    series('zinnia', [cultivation('z', 'plant-zinnia', 'Zinnia')]),
    series('physalis', [cultivation('p', 'plant-physalis', 'Physalis')]),
    series('physalis-bloc', [cultivation('pb', 'plant-coqueret', 'Coqueret')], { use: 'block' }),
  ];
  assert.deepEqual(speciesWithoutReference(plan, CORRESPONDENCES), [
    { plantId: 'plant-ail', plantName: 'Ail', reason: 'without-reference', seriesIds: ['allium'] },
    { plantId: 'plant-physalis', plantName: 'Physalis', reason: 'missing', seriesIds: ['physalis'] },
    { plantId: 'plant-zinnia', plantName: 'Zinnia', reason: 'without-reference', seriesIds: ['zinnia'] },
  ]);
});

/** L'objectif de la planche que le tableau des besoins lit pour la semaine 2026-W16. */
function needsObjective(goalRevisions: GoalRevisionLike[]): number | null {
  const snapshot: IrrigationSnapshot = {
    configuration: { seasonFirst: 2026, seasonLast: 2026 },
    structure: { id: 'ferme', name: 'Ferme', legalCity: null, legalPostcode: null, legalCountry: null },
    zones: [{ id: BED.zoneId, name: 'Parcelle', area: 400, seasons: [2026] }],
    plots: [{ id: BED.plotId, zoneId: BED.zoneId, name: 'Jardin', mode: 'garden', length: 10, width: 10, area: 100, seasons: [2026] }],
    beds: [{ id: BED.id, zoneId: BED.zoneId, plotId: BED.plotId, name: 'Planche A', length: 10, width: 1, alleyWidth: 0.5, area: 10, seasons: [2026] }],
    source: 'cache',
    lastSuccessfulReadAt: '2026-04-15T05:00:00.000Z',
  };
  const days: WaterDashboardDay[] = WEEK.map((date) => ({
    date, volumeIncomplete: false, realizedIrrigationCubicMeters: 0, plannedIrrigationCubicMeters: 0, estimatedOngoingCubicMeters: 0,
    reanalysisRainMm: 0, manualRainMm: null, effectiveActualRainMm: 0, forecastRainMm: 0,
    forecastMinimumTemperatureCelsius: null, forecastMaximumTemperatureCelsius: null,
    et0Mm: 3.5, et0Kind: 'reanalysis', limitCubicMeters: null, limitExceededByCubicMeters: 0, actualLimitExceededByCubicMeters: 0,
  }));
  const dashboard = buildIrrigationNeedsDashboard({
    season: 2026, snapshot, days, events: [], goalRevisions, decisions: [], coverage: [], thresholdMm: 0,
    weekStart: WEEK[0], weekEnd: WEEK[6], now: new Date('2026-04-15T10:00:00.000Z'),
  });
  return dashboard.gardens.flatMap((garden) => garden.beds).find((bed) => bed.bedId === BED.id)?.objectiveMm ?? null;
}
