import type { IrrigationEventRecord } from '../lib/domain/irrigation-event-record.ts';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import type { IrrigationSnapshot } from '../lib/domain/domain.ts';
import {
  applyPlanningThreshold,
  buildIrrigationNeedsDashboard,
  needVolumeCubicMeters,
  planningNeedMm,
  realRemainingMm,
  relativeDeficitPercent,
  resolveIrrigationNeedsWeekStart,
  type IrrigationNeedDecision,
} from '../lib/domain/irrigation-needs.ts';
import type { WaterDashboardDay } from '../lib/domain/water-management.ts';
import type { EquipmentKind } from '../lib/domain/irrigation-domain.ts';
import { remainingPlannedApplications } from '../lib/domain/planned-irrigation.ts';

test('3.4 un horizon partagé vide ou inversé ne produit aucun volume négatif', () => {
  const events = [irrigation('planned', 'planned', 20, 0)];
  const date = new Date('2026-09-07T10:00:00Z');
  assert.deepEqual(remainingPlannedApplications(events, date, date), []);
  assert.deepEqual(remainingPlannedApplications(events, new Date('2026-09-07T12:00:00Z'), date), []);
});

test('l’ET0 n’entre pas dans le besoin : objectif 35, pluie 8 et irrigation 20 laissent 7 mm quelle que soit l’ET0', () => {
  for (const et0 of [20, 42]) {
    const need = build({
      et0, actualRain: 8, forecastRain: 0,
      goals: [goal('farm', null, null, null, 35)],
      events: [irrigation('real-twenty', 'completed', 20, 20)],
    }).gardens[0].beds[0];
    assert.ok(Math.abs((need.et0Mm ?? 0) - et0) < 1e-9, 'l’ET0 reste affichée pour information');
    assert.ok(Math.abs((need.objectiveMm ?? 0) - 35) < 1e-9);
    assert.ok(Math.abs((need.realRemainingMm ?? 0) - 7) < 1e-9, `ET0 ${et0} : reste réel`);
    assert.ok(Math.abs((need.rawPlanningNeedMm ?? 0) - 7) < 1e-9, `ET0 ${et0} : reste à planifier`);
    assert.ok(Math.abs((need.relativeDeficitPercent ?? 0) - 20) < 1e-9, 'déficit relatif rapporté à l’objectif');
  }
});

test('les restes réel et planifiable sont bornés à zéro', () => {
  assert.equal(realRemainingMm(35, 4, 10), 21);
  assert.equal(realRemainingMm(10, 4, 12), 0);
  assert.equal(planningNeedMm(35, 4, 6, 10, 5), 10);
  assert.equal(planningNeedMm(35, 4, 35, 10, 5), 0);
});

test('le déficit relatif couvre 50 %, 25 % et 0 %', () => {
  assert.equal(relativeDeficitPercent(10, 20), 50);
  assert.equal(relativeDeficitPercent(5, 20), 25);
  assert.equal(relativeDeficitPercent(0, 20), 0);
  assert.equal(relativeDeficitPercent(0, 0), 0);
});

test('le seuil élimine uniquement les valeurs strictement inférieures', () => {
  assert.equal(applyPlanningThreshold(1.5, 2), 0);
  assert.equal(applyPlanningThreshold(2, 2), 2);
  assert.equal(applyPlanningThreshold(null, 2), null);
});

test('le volume suit la surface et les agrégats de jardin sont pondérés', () => {
  assert.equal(needVolumeCubicMeters(10, 100), 1);
  const dashboard = build({ beds: [bed('bed-a', 'Planche A', 'plot-out', 100), bed('bed-b', 'Planche B', 'plot-out', 300)], et0: 30,
    goals: [goal('farm', null, null, null, 70)],
    decisions: [decision('bed-a', 10), decision('bed-b', 30)] });
  assert.equal(dashboard.gardens[0].effectiveNeedMm, 25);
  assert.equal(dashboard.gardens[0].effectiveVolumeCubicMeters, 10);
});

test('5.0 le volume du besoin suit la surface mouillée du matériel positionné, les millimètres restent sur la planche', () => {
  // bed-a : 100 m² de planche, 10 m de long, passe-pied 0,5 m, donc 105 m² mouillés en aspersion.
  const goals = [goal('farm', null, null, null, 35)];
  const decisions = [decision('bed-a', 10)];
  const none = build({ goals, decisions }).gardens[0].beds[0];
  assert.equal(none.wettedAreaSource, 'bed-only');
  assert.equal(none.wettedAreaSquareMeters, 100);
  assert.equal(none.effectiveVolumeCubicMeters, 1);
  const drip = build({ goals, decisions, coverage: [positioned('bed-a', 'drip')] }).gardens[0].beds[0];
  assert.equal(drip.wettedAreaSource, 'drip');
  assert.equal(drip.effectiveVolumeCubicMeters, 1);
  const sprinkler = build({ goals, decisions, coverage: [positioned('bed-a', 'sprinkler')] }).gardens[0].beds[0];
  assert.equal(sprinkler.wettedAreaSource, 'sprinkler');
  assert.equal(sprinkler.wettedAreaSquareMeters, 105);
  assert.ok(Math.abs((sprinkler.effectiveVolumeCubicMeters ?? 0) - 1.05) < 1e-9);
  assert.equal(sprinkler.areaSquareMeters, 100, 'la surface de la planche ne change pas');
  const mixed = build({ goals, decisions, coverage: [positioned('bed-a', 'drip', 'sprinkler')] }).gardens[0].beds[0];
  assert.equal(mixed.wettedAreaSource, 'sprinkler', 'les deux matériels ensemble : la plus grande surface');
  assert.ok(Math.abs((mixed.effectiveVolumeCubicMeters ?? 0) - 1.05) < 1e-9);
});

test('5.0 une aspersion sur une planche sans passe-pied connu rend le volume inconnu, jamais zéro', () => {
  const dashboard = build({
    beds: [{ ...bed('bed-a', 'Planche A', 'plot-out', 100), alleyWidth: null }, bed('bed-b', 'Planche B', 'plot-out', 300)],
    goals: [goal('farm', null, null, null, 70)],
    decisions: [decision('bed-a', 10), decision('bed-b', 30)],
    coverage: [positioned('bed-a', 'sprinkler'), positioned('bed-b', 'drip')],
  });
  const [a, b] = dashboard.gardens[0].beds;
  assert.equal(a.wettedAreaSource, 'unknown-alley');
  assert.equal(a.wettedAreaSquareMeters, null);
  assert.equal(a.effectiveVolumeCubicMeters, null);
  assert.equal(a.effectiveNeedMm, 10, 'les millimètres restent calculables');
  assert.equal(a.completeness.complete, true, 'la surface inconnue ne touche pas la complétude des millimètres');
  assert.equal(b.effectiveVolumeCubicMeters, 9);
  assert.equal(dashboard.gardens[0].effectiveVolumeCubicMeters, null, 'le total du jardin est incomplet, pas faussé');
  assert.equal(dashboard.gardens[0].effectiveNeedMm, 25, 'la pondération des millimètres reste sur la surface de la planche');
});

test('un remplacement manuel, y compris zéro, prévaut sans modifier le calcul', () => {
  const overridden = build({ goals: [goal('farm', null, null, null, 35)], decisions: [decision('bed-a', 10)] }).gardens[0].beds[0];
  assert.equal(overridden.calculatedNeedMm, 35);
  assert.equal(overridden.manualOverrideMm, 10);
  assert.equal(overridden.effectiveNeedMm, 10);
  const zero = build({ goals: [goal('farm', null, null, null, 35)], decisions: [decision('bed-a', 0)] }).gardens[0].beds[0];
  assert.equal(zero.effectiveNeedMm, 0);
  const rainChanged = build({ actualRain: 10, goals: [goal('farm', null, null, null, 35)], decisions: [decision('bed-a', 10)] }).gardens[0].beds[0];
  assert.equal(rainChanged.calculatedNeedMm, 25);
  assert.equal(rainChanged.effectiveNeedMm, 10);
});

test('les priorités restent manuelles et sans effet sur le calcul', () => {
  const normal = build({}).gardens[0].beds[0];
  const low = build({ decisions: [{ ...decision('bed-a', null), priority: 'low' }] }).gardens[0].beds[0];
  const high = build({ decisions: [{ ...decision('bed-a', null), priority: 'high' }] }).gardens[0].beds[0];
  assert.equal(normal.priority, 'normal');
  assert.deepEqual([low.priority, normal.priority, high.priority], ['low', 'normal', 'high']);
  assert.equal(low.effectiveNeedMm, high.effectiveNeedMm);
  assert.equal(normal.priority, 'normal', 'un déficit ne change pas automatiquement la priorité');
});

test('la pluie extérieure est neutralisée uniquement sous un vrai abri OTF', () => {
  const dashboard = build({
    plots: [plot('plot-out', 'Jardin serre de nom', 'garden'), plot('plot-in', 'Tunnel', 'greenhouse')],
    beds: [bed('bed-a', 'Plein champ', 'plot-out', 100), bed('bed-in', 'Sous abri', 'plot-in', 100)],
    actualRain: 4, forecastRain: 6,
  });
  const outdoor = dashboard.gardens.find((garden) => garden.plotId === 'plot-out')!.beds[0];
  const sheltered = dashboard.gardens.find((garden) => garden.plotId === 'plot-in')!.beds[0];
  assert.equal(outdoor.actualRainMm, 4);
  assert.equal(outdoor.forecastRainMm, 6 * 6, 'six jours à venir : aujourd’hui compte dans le réel (D-019)');
  assert.equal(sheltered.actualRainMm, 0);
  assert.equal(sheltered.forecastRainMm, 0);
});

test('seules les irrigations réelles confirmées et les planifications actives comptent', () => {
  const dashboard = build({ events: [
    irrigation('completed', 'completed', 5, 5),
    irrigation('canceled', 'canceled', 9, 9),
    irrigation('planned', 'planned', 6, 0),
    irrigation('partial', 'partially_completed', 8, 3),
  ] });
  const need = dashboard.gardens[0].beds[0];
  assert.equal(need.actualIrrigationMm, 8);
  assert.equal(need.plannedIrrigationMm, 11);
});

test('un changement d’objectif en milieu de semaine est appliqué à partir de sa date', () => {
  const goals = [
    { ...goal('farm', null, null, null, 14), id: 'monday', createdAt: '2026-09-07T07:00:00.000Z' },
    { ...goal('farm', null, null, null, 35), id: 'thursday', createdAt: '2026-09-10T07:00:00.000Z' },
  ];
  const need = build({ et0: 70, goals }).gardens[0].beds[0];
  assert.equal(need.objectiveMm, 26);
});

test('un premier objectif posé un mercredi vaut pour les jours restants de la semaine (D-034)', () => {
  // Point ouvert 16 : 35 mm posés le mercredi 9 septembre couvrent cinq jours sur sept, soit 25 mm ; la semaine n'est plus « sans objectif ».
  const goals = [{ ...goal('farm', null, null, null, 35), id: 'wednesday', createdAt: '2026-09-09T07:00:00.000Z' }];
  const need = build({ et0: 70, goals }).gardens[0].beds[0];
  assert.equal(need.objectiveMm, 25);
  assert.equal(need.objectiveSource, 'farm');
  assert.ok(!need.completeness.missing.includes('objective'), 'les jours sans objectif ne sont pas une donnée manquante');
  assert.equal(need.completeness.demandComplete, true);
  // Un objectif posé après la semaine ne la couvre pas : elle reste sans objectif, signalé.
  const none = build({ et0: 70, goals: [{ ...goal('farm', null, null, null, 35), id: 'next-week', createdAt: '2026-09-14T07:00:00.000Z' }] }).gardens[0].beds[0];
  assert.equal(none.objectiveMm, null);
  assert.deepEqual(none.completeness.missing, ['objective']);
});

test('deux révisions d’objectif reçues dans la même milliseconde : la seconde fait foi, quel que soit l’identifiant', () => {
  // Le dépôt rend les révisions dans l'ordre d'enregistrement ; le domaine ne
  // les départage plus par l'identifiant, un UUID tiré au sort (point ouvert
  // 27, docs/revision-order-contract.md).
  const sameMillisecond = '2026-09-07T07:00:00.000Z';
  const goals = [
    { ...goal('farm', null, null, null, 14), id: 'zz-la-premiere', createdAt: sameMillisecond },
    { ...goal('farm', null, null, null, 35), id: 'aa-la-seconde', createdAt: sameMillisecond },
  ];
  assert.equal(build({ et0: 70, goals }).gardens[0].beds[0].objectiveMm, 35);
});

test('un objectif récurrent copié pour la semaine est effectif dès le lundi', () => {
  const copiedGoal = {
    ...goal('farm', null, null, null, 35),
    id: 'copied-on-tuesday',
    copiedFromGoalId: 'previous-week-goal',
    createdAt: '2026-09-08T07:00:00.000Z',
  };
  const need = build({ et0: 70, goals: [copiedGoal] }).gardens[0].beds[0];
  assert.equal(need.objectiveMm, 35);
});

test('une pluie réelle absente est reprise de la prévision du jour, le besoin reste calculable et le jour est signalé (D-019)', () => {
  // Le 7 septembre, jour courant, n’a ni pluviomètre ni réanalyse : sa prévision de 3 mm sert d’estimation.
  const estimated = build({ missingActualRain: true, actualRain: 0, forecastRain: 3, goals: [goal('farm', null, null, null, 35)] }).gardens[0].beds[0];
  assert.equal(estimated.actualRainMm, 3, 'la prévision du jour remplace la pluie réelle manquante');
  assert.ok(Math.abs((estimated.realRemainingMm ?? 0) - 32) < 1e-9, 'le besoin réel reste calculable');
  assert.deepEqual(estimated.completeness.missingDates.actualRain, ['2026-09-07'], 'le jour reste signalé manquant');
  assert.deepEqual(estimated.completeness.estimatedDates.actualRain, ['2026-09-07'], 'et signalé comme estimé');
  assert.equal(estimated.completeness.realComplete, false, 'partiel, donc pas complet');
  assert.deepEqual(estimated.completeness.missing, ['actual-rain']);
});

test('sans pluie réelle ni prévision, le jour compte zéro, reste signalé manquant et n’est pas dit estimé (D-019)', () => {
  const zeroFilled = build({ missingActualRain: true, missingForecastToday: true, actualRain: 0, goals: [goal('farm', null, null, null, 35)] }).gardens[0].beds[0];
  assert.equal(zeroFilled.actualRainMm, 0, 'aucune source : zéro, jamais null');
  assert.ok(Math.abs((zeroFilled.realRemainingMm ?? 0) - 35) < 1e-9);
  assert.deepEqual(zeroFilled.completeness.missingDates.actualRain, ['2026-09-07']);
  assert.deepEqual(zeroFilled.completeness.estimatedDates.actualRain, [], 'rien n’a été estimé, la valeur a été comptée zéro');
});

test('une prévision absente sur un jour à venir compte zéro et reste signalée, le besoin reste calculable (D-019)', () => {
  const missingFuture = build({ missingForecast: true }).gardens[0].beds[0];
  assert.notEqual(missingFuture.realRemainingMm, null);
  assert.notEqual(missingFuture.rawPlanningNeedMm, null, 'plus jamais non calculable');
  assert.deepEqual(missingFuture.completeness.missingDates.forecastRain, ['2026-09-13']);
  assert.equal(missingFuture.completeness.planningComplete, false);
});

test('seul un objectif absent rend encore le besoin non calculable (D-019)', () => {
  const noGoal = build({ goals: [] }).gardens[0].beds[0];
  assert.equal(noGoal.objectiveMm, null);
  assert.equal(noGoal.realRemainingMm, null, 'sans cible, il n’y a rien à calculer');
  assert.equal(noGoal.effectiveNeedMm, null);
  assert.equal(noGoal.completeness.demandComplete, false);
  assert.deepEqual(noGoal.completeness.missing, ['objective']);
});

test('aujourd’hui compte une seule fois : sa pluie n’est pas déduite deux fois (D-019)', () => {
  // Objectif 35, sept jours à 2 mm de prévision : aujourd’hui en réel, les six jours suivants en prévu.
  const need = build({ missingActualRain: true, actualRain: 0, forecastRain: 2, goals: [goal('farm', null, null, null, 35)] }).gardens[0].beds[0];
  assert.equal(need.actualRainMm, 2, 'aujourd’hui, repris de sa prévision');
  assert.equal(need.forecastRainMm, 12, 'six jours à venir seulement, aujourd’hui exclu');
  assert.ok(Math.abs((need.rawPlanningNeedMm ?? 0) - 21) < 1e-9, '35 − 2 − 12, sans double déduction');
});

test('le cas de référence 25 mm garde l’objectif comme demande et affiche l’ET0 19,2 pour information', () => {
  const need = build({
    et0: 19.2,
    actualRain: 0,
    forecastRain: 0,
    goals: [goal('farm', null, null, null, 25)],
  }).gardens[0].beds[0];
  assert.ok(Math.abs((need.objectiveMm ?? 0) - 25) < 1e-9);
  assert.equal(need.objectiveSource, 'farm');
  assert.ok(Math.abs((need.et0Mm ?? 0) - 19.2) < 1e-9);
  assert.ok(Math.abs((need.realRemainingMm ?? 0) - 25) < 1e-9);
  assert.ok(Math.abs((need.rawPlanningNeedMm ?? 0) - 25) < 1e-9);
  assert.equal(need.completeness.complete, true);
});

test('les apports réels sont déduits de l’objectif', () => {
  const need = build({
    et0: 19.2,
    actualRain: 3,
    forecastRain: 0,
    goals: [goal('farm', null, null, null, 25)],
    events: [irrigation('real-five', 'completed', 5, 5)],
  }).gardens[0].beds[0];
  assert.ok(Math.abs((need.realRemainingMm ?? 0) - 17) < 1e-9);
});

test('une prévision inconnue ne rend pas le besoin réel non calculable', () => {
  const need = build({
    et0: 19.2,
    actualRain: 3,
    missingForecast: true,
    goals: [goal('farm', null, null, null, 25)],
    events: [irrigation('real-five', 'completed', 5, 5)],
  }).gardens[0].beds[0];
  assert.ok(Math.abs((need.realRemainingMm ?? 0) - 17) < 1e-9);
  assert.ok(Math.abs((need.rawPlanningNeedMm ?? 0) - 17) < 1e-9, 'le jour sans prévision compte zéro (D-019)');
  assert.equal(need.completeness.realComplete, true);
  assert.equal(need.completeness.planningComplete, false);
  assert.deepEqual(need.completeness.missingDates.forecastRain, ['2026-09-13']);
});

test('un objectif absent de la planche est hérité de la ferme', () => {
  const need = build({
    et0: 19.2,
    goals: [goal('farm', null, null, null, 25)],
  }).gardens[0].beds[0];
  assert.ok(Math.abs((need.objectiveMm ?? 0) - 25) < 1e-9);
  assert.equal(need.objectiveSource, 'farm');
});

test('sous abri la pluie extérieure devient un zéro valide', () => {
  const need = build({
    et0: 19.2,
    actualRain: 8,
    forecastRain: 8,
    plots: [plot('plot-in', 'Tunnel', 'greenhouse')],
    beds: [bed('bed-in', 'Sous abri', 'plot-in', 100)],
    goals: [goal('farm', null, null, null, 25)],
  }).gardens[0].beds[0];
  assert.equal(need.actualRainMm, 0);
  assert.equal(need.forecastRainMm, 0);
  assert.ok(Math.abs((need.realRemainingMm ?? 0) - 25) < 1e-9);
  assert.equal(need.completeness.complete, true);
});

test('une ET0 absente laisse le besoin calculable et reste signalée avec sa date', () => {
  const need = build({
    et0: 19.2,
    missingEt0: true,
    goals: [goal('farm', null, null, null, 25)],
  }).gardens[0].beds[0];
  assert.equal(need.et0Mm, null, 'le total ET0 n’est pas inventé');
  assert.ok((need.et0KnownMm ?? 0) > 0, 'la part connue reste affichable');
  assert.deepEqual(need.completeness.missingDates.et0, ['2026-09-07']);
  assert.ok(Math.abs((need.effectiveNeedMm ?? 0) - 25) < 1e-9, 'le besoin reste calculable');
  assert.equal(need.completeness.demandComplete, true);
  assert.equal(need.completeness.complete, true);
  assert.deepEqual(need.completeness.missing, []);
});

test('la période explicitement sélectionnée prévaut sur la semaine courante et le tableau météo initial', () => {
  const now = new Date('2026-09-16T10:00:00.000Z');
  assert.equal(resolveIrrigationNeedsWeekStart({
    selectedWeekStart: '2026-09-21',
    waterDashboardWeekStart: '2026-09-14',
    now,
  }), '2026-09-21');
  assert.equal(resolveIrrigationNeedsWeekStart({
    waterDashboardWeekStart: '2026-09-14',
    now,
  }), '2026-09-14');
  assert.equal(resolveIrrigationNeedsWeekStart({ now }), '2026-09-14');
});

test('les diagnostics suivent la séquence semaine A, semaine B, puis semaine A sans mélange', () => {
  const now = new Date('2026-09-16T10:00:00.000Z');
  const weekADays = weekDays('2026-09-14').map((date) => {
    if (date === '2026-09-14') return { ...day(date, null, 0, 0), reanalysisRainMm: null, manualRainMm: 0, effectiveActualRainMm: 0 };
    return day(date, 3, date === '2026-09-16' ? null : 0, 0);
  });
  const weekBDays = weekDays('2026-09-21').map((date) => day(date, 3, null, 0));

  const weekA = buildForWeek('2026-09-14', weekADays, now);
  const weekB = buildForWeek('2026-09-21', weekBDays, now);
  const weekAAgain = buildForWeek('2026-09-14', weekADays, now);

  assert.deepEqual(weekA.completeness.missingDates.et0, ['2026-09-14']);
  assert.deepEqual(weekA.completeness.missingDates.actualRain, ['2026-09-16']);
  assert.equal(weekA.gardens[0].beds[0].actualRainMm, 0, 'le 16 reprend sa prévision : plus jamais null (D-019)');
  assert.deepEqual(weekA.gardens[0].beds[0].completeness.estimatedDates.actualRain, ['2026-09-16']);
  assert.equal(weekA.gardens[0].beds[0].completeness.missingDates.actualRain.includes('2026-09-14'), false);
  assert.equal(weekB.weekStart, '2026-09-21');
  assert.deepEqual(weekB.completeness.missingDates.et0, []);
  assert.deepEqual(weekB.completeness.missingDates.actualRain, []);
  assert.equal(weekB.gardens[0].beds[0].actualRainMm, 0, 'aucune pluie réelle future ne doit être exigée');
  assert.equal(weekB.gardens[0].beds[0].completeness.planningComplete, true);
  assert.deepEqual(weekAAgain.completeness.missingDates, weekA.completeness.missingDates);
});

test('le client transmet la semaine affichée aux besoins et le serveur la reçoit explicitement', () => {
  const waterSource = readFileSync('app/irrigation/water-management-dashboard.tsx', 'utf8');
  const needsSource = readFileSync('app/irrigation/irrigation-needs-dashboard.tsx', 'utf8');
  const actionSource = readFileSync('app/irrigation/irrigation-need-actions.ts', 'utf8');
  assert.match(waterSource, /detail: \{ weekStart: result\.dashboard\.weekStart \}/);
  assert.match(needsSource, /loadIrrigationNeedsAction\(\{ season, weekStart \}\)/);
  assert.match(needsSource, /saveIrrigationNeedThresholdAction\(\{ season, weekStart: dashboard\.weekStart/);
  assert.match(actionSource, /getIrrigationNeedsDashboardForUser\(\{ \.\.\.context, weekStart: input\.weekStart \}\)/);
});

test('les boutons d’information sont utilisables au clavier, au clic, au toucher et refermables', () => {
  const source = readFileSync('app/irrigation/irrigation-needs-dashboard.tsx', 'utf8');
  assert.match(source, /aria-expanded/);
  assert.match(source, /onFocus/);
  assert.match(source, /onClick/);
  assert.match(source, /Fermer l’explication/);
  assert.match(source, /role="tooltip"/);
  assert.match(source, /Pourquoi/);
  assert.match(source, /demandComplete/);
  assert.match(source, /planningComplete/);
});

function build(options: {
  et0?: number; actualRain?: number; forecastRain?: number; missingEt0?: boolean; missingActualRain?: boolean; missingForecast?: boolean;
  /** Prévision absente sur le premier jour de la semaine, celui qui est aussi le jour courant. */
  missingForecastToday?: boolean;
  plots?: ReturnType<typeof plot>[]; beds?: ReturnType<typeof bed>[];
  goals?: ReturnType<typeof goal>[]; decisions?: ReturnType<typeof decision>[]; events?: IrrigationEventRecord[];
  /** Matériels positionnés par planche, tels que la couverture 2.4 les décrit. */
  coverage?: ReturnType<typeof positioned>[];
} = {}) {
  const plots = options.plots ?? [plot('plot-out', 'Jardin', 'garden')];
  const beds = options.beds ?? [bed('bed-a', 'Planche A', 'plot-out', 100)];
  const snapshot: IrrigationSnapshot = { configuration: { seasonFirst: 2026, seasonLast: 2026 }, structure: { id: 'farm', name: 'Ferme', legalCity: null, legalPostcode: null, legalCountry: null }, zones: [{ id: 'zone', name: 'Parcelle', area: 400, seasons: [2026] }], plots, beds, source: 'cache', lastSuccessfulReadAt: '2026-09-07T00:00:00Z' };
  const dailyEt0 = (options.et0 ?? 35) / 7;
  const days = Array.from({ length: 7 }, (_, index) => day(`2026-09-${String(7 + index).padStart(2, '0')}`, options.missingEt0 && index === 0 ? null : dailyEt0, options.missingActualRain && index === 0 ? null : options.actualRain ?? 0, (options.missingForecast && index === 6) || (options.missingForecastToday && index === 0) ? null : options.forecastRain ?? 0));
  return buildIrrigationNeedsDashboard({ season: 2026, snapshot, days, events: options.events ?? [], goalRevisions: options.goals ?? [goal('farm', null, null, null, 35)], decisions: options.decisions ?? [], coverage: options.coverage ?? [], thresholdMm: 0, weekStart: '2026-09-07', weekEnd: '2026-09-13', now: new Date('2026-09-07T10:00:00.000Z') });
}

function positioned(bedId: string, ...kinds: EquipmentKind[]) { return { bedId, contributions: kinds.map((kind) => ({ kind })) }; }

function buildForWeek(weekStart: string, days: WaterDashboardDay[], now: Date) {
  const weekEnd = weekDays(weekStart)[6];
  const snapshot: IrrigationSnapshot = {
    configuration: { seasonFirst: 2026, seasonLast: 2026 },
    structure: { id: 'farm', name: 'Ferme', legalCity: null, legalPostcode: null, legalCountry: null },
    zones: [{ id: 'zone', name: 'Parcelle', area: 400, seasons: [2026] }],
    plots: [plot('plot-out', 'Jardin', 'garden')],
    beds: [bed('bed-a', 'Planche A', 'plot-out', 100)],
    source: 'cache',
    lastSuccessfulReadAt: '2026-09-16T00:00:00Z',
  };
  return buildIrrigationNeedsDashboard({
    season: 2026,
    snapshot,
    days,
    events: [],
    goalRevisions: [goal('farm', null, null, null, 35)],
    decisions: [],
    coverage: [],
    thresholdMm: 0,
    weekStart,
    weekEnd,
    now,
  });
}

function weekDays(weekStart: string) {
  const start = new Date(`${weekStart}T12:00:00.000Z`);
  return Array.from({ length: 7 }, (_, index) => {
    const value = new Date(start);
    value.setUTCDate(value.getUTCDate() + index);
    return value.toISOString().slice(0, 10);
  });
}

function plot(id: string, name: string, mode: 'garden' | 'greenhouse') { return { id, zoneId: 'zone', name, mode, length: 10, width: 10, area: 100, seasons: [2026] as number[] }; }
function bed(id: string, name: string, plotId: string, bedArea: number) { return { id, zoneId: 'zone', plotId, name, length: 10, width: 1, alleyWidth: .5 as number | null, area: bedArea, seasons: [2026] as number[] }; }
function day(date: string, et0Mm: number | null, actualRainMm: number | null, forecastRainMm: number | null): WaterDashboardDay { return { date, volumeIncomplete: false, realizedIrrigationCubicMeters: 0, plannedIrrigationCubicMeters: 0, estimatedOngoingCubicMeters: 0, reanalysisRainMm: actualRainMm, manualRainMm: null, effectiveActualRainMm: actualRainMm, forecastRainMm, forecastMinimumTemperatureCelsius: null, forecastMaximumTemperatureCelsius: null, et0Mm, et0Kind: et0Mm === null ? null : 'forecast', limitCubicMeters: null, limitExceededByCubicMeters: 0, actualLimitExceededByCubicMeters: 0 }; }
function goal(scopeType: 'farm' | 'zone' | 'plot' | 'bed', zoneId: string | null, plotId: string | null, bedId: string | null, amountMm: number) { return { id: `goal-${scopeType}-${bedId ?? plotId ?? zoneId ?? 'all'}`, weekStart: '2026-09-07', scopeType, otfZoneId: zoneId, otfPlotId: plotId, otfBedId: bedId, amountMm, action: 'set' as const, createdAt: '2026-09-07T00:00:00.000Z' }; }
function decision(bedId: string, manualOverrideMm: number | null): IrrigationNeedDecision { return { otfZoneId: 'zone', otfPlotId: bedId === 'bed-in' ? 'plot-in' : 'plot-out', otfBedId: bedId, priority: 'normal', manualOverrideMm, overrideReason: null, calculatedNeedAtOverrideMm: manualOverrideMm === null ? null : 18, updatedAt: '2026-09-07T10:00:00Z' }; }
function irrigation(id: string, status: IrrigationEventRecord['status'], planned: number, actual: number): IrrigationEventRecord {
  return { id, season: 2026, status, note: null, remainingCanceledAt: null, canceledAt: status === 'canceled' ? '2026-09-07T09:00:00Z' : null, createdAt: '2026-09-07T08:00:00Z', updatedAt: '2026-09-07T09:00:00Z', equipment: { id: `eq-${id}`, equipmentId: 'equipment', settingId: 'setting', placementId: 'placement', status, pumpId: null, pumpOriginId: null, requestedFlowCubicMetersPerHour: null, pumpSnapshot: null, pumpOriginSnapshot: null, plannedStartAt: '2026-09-08T08:00:00Z', plannedEndAt: '2026-09-08T09:00:00Z', actualStartAt: status === 'completed' || status === 'partially_completed' ? '2026-09-07T08:00:00Z' : null, actualEndAt: status === 'completed' || status === 'partially_completed' ? '2026-09-07T09:00:00Z' : null, plannedDurationSeconds: 3600, actualDurationSeconds: actual > 0 ? 3600 : 0, equipmentSnapshot: { id: 'equipment', name: 'Rampe', kind: 'sprinkler', mobility: 'mobile' }, settingSnapshot: { id: 'setting', name: 'Réglage', position: 1, kind: 'sprinkler', leftProfile: [{ distanceMeters: 0, rateMmPerHour: planned }], rightProfile: [{ distanceMeters: 0, rateMmPerHour: planned }] }, placementSnapshot: { id: 'placement', equipmentId: 'equipment', settingId: 'setting', season: 2026, gardenGroupId: null, otfZoneId: 'zone', otfPlotId: 'plot-out', anchor: { type: 'bed_center', anchorBedOtfId: 'bed-a' }, selectedBeds: [{ otfZoneId: 'zone', otfPlotId: 'plot-out', otfBedId: 'bed-a' }] }, timerState: null, timerStartedAt: null, timerResumedAt: null, timerPausedAt: null, timerTheoreticalEndAt: null, timerAccumulatedSeconds: 0, timerAlarmRevision: null, timerAlarmStatus: null, timerAlarmSyncedAt: null, remainingCanceledAt: null, canceledAt: status === 'canceled' ? '2026-09-07T09:00:00Z' : null, applications: [{ otfZoneId: 'zone', otfPlotId: 'plot-out', otfBedId: 'bed-a', rateMmPerHour: planned, bedAreaSquareMeters: 100, wettedAreaSquareMeters: 100, plannedAmountMm: planned, actualAmountMm: actual }] } };
}
