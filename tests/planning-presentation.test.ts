import assert from 'node:assert/strict';
import test from 'node:test';
import type { PlanBedOutcome, StoredProposal, StoredWeeklyPlan, UnplacedReason } from '../lib/domain/planning/contract.ts';
import { PLAN_EVENT_KINDS } from '../lib/domain/planning/contract.ts';
import {
  PLAN_EVENT_LABELS,
  adjustProposalTiming,
  calculationTriggerLabel,
  doseReasonLabel,
  earlierCalculationDate,
  isAdjusted,
  minutesFromTimeInput,
  pendingEventNotice,
  planDays,
  planningSettingsForm,
  proposalStatusLabel,
  proposedIds,
  settingsFromForm,
  settingsIssueLabel,
  summarizePlan,
  summarizeSettings,
  timeInputFromMinutes,
  timingReasonLabel,
  unplacedBeds,
  unplacedReasonLabel,
  validatedProposalNote,
  waterDeficitExplanation,
  windowLabel,
} from '../lib/domain/planning/presentation.ts';
import { DEFAULT_PLANNING_SETTINGS } from '../lib/domain/planning/settings.ts';
import { unknownWaterChainCount, waterDeficitDetail, waterDeficitTileDetail, waterDeficitValue } from '../lib/domain/planning/water-deficit-summary.ts';
import { cubicMetersFromMillimeters, millimetersForRate } from '../lib/domain/units.ts';

/**
 * La présentation pure du planning (docs/planning-contract.md, « Interface ») :
 * la semaine en jours à la ferme, le résumé, les planches non servies,
 * l'ajustement d'une proposition et le formulaire des réglages dans les deux
 * sens. Rien ici ne place un créneau : c'est le moteur qui le fait.
 */

const NOW = new Date('2026-09-29T10:52:00.000Z'); // mardi 12 h 52 à la ferme

function proposal(overrides: Partial<StoredProposal> & Pick<StoredProposal, 'id' | 'startAt' | 'endAt'>): StoredProposal {
  return {
    storedId: `stored-${overrides.id}`,
    calculationId: 'calc-1',
    calculatedAt: NOW.toISOString(),
    status: 'proposed',
    validatedEventId: null, irrigationStatus: null,
    replacedByCalculationId: null,
    decidedAt: null,
    actorUserId: null,
    equipmentId: 'gag1',
    equipmentName: 'gag1',
    kind: 'drip',
    settingId: 'gag1-setting',
    settingName: 'standard',
    placementId: 'gag1-placement',
    durationSeconds: 3600,
    doseMm: 10,
    applications: [],
    bedApplications: [],
    volumeCubicMeters: 0.66,
    flowCubicMetersPerHour: 0.66,
    pumpId: 'pompe',
    pumpOriginId: 'origine',
    justification: {
      priority: 'normal',
      doseReason: 'maximum-dose',
      timingReason: 'earliest',
      limitingConstraint: null,
      pump: null,
      supply: null,
      hydraulicallyVerified: true,
    },
    ...overrides,
  };
}

function bed(overrides: Partial<PlanBedOutcome> & Pick<PlanBedOutcome, 'bedId'>): PlanBedOutcome {
  return {
    bedName: overrides.bedId,
    plotName: 'bloc 1',
    priority: 'normal',
    needMm: 20,
    targetMm: 20,
    placedMm: 20,
    surplusMm: 0,
    deficitMm: 0,
    reasons: [],
    proposalIds: [],
    equipmentId: 'gag1',
    ...overrides,
  };
}

function plan(proposals: StoredProposal[], beds: PlanBedOutcome[] = []): StoredWeeklyPlan {
  return {
    calculation: {
      id: 'calc-1',
      season: 2026,
      weekStart: '2026-09-28',
      trigger: 'manual',
      triggerEvent: null,
      computedAt: NOW.toISOString(),
      horizonStartAt: NOW.toISOString(),
      horizonEndAt: '2026-10-04T22:00:00.000Z',
      settings: DEFAULT_PLANNING_SETTINGS,
      summary: {
        weekEnd: '2026-10-04',
        beds,
        deficit: { waterCubicMeters: 0, pumpTimeCubicMeters: 0, byReason: {}, bedCount: 0 },
        budgets: [],
        assumptions: { forecastDays: 6, reservoirsObservedAt: [] },
        suggestions: [],
        overcommittedDays: [],
        changes: null,
      },
    },
    proposals,
    suggestions: [],
    pendingEvent: null,
  };
}

test('la semaine se lit en sept jours à la ferme, une plage qui passe minuit appartenant au jour où elle commence', () => {
  const stored = plan([
    // Mercredi 00 h 30 à la ferme : c'est un créneau du mercredi, pas de la nuit de mardi.
    proposal({ id: 'p-3', startAt: '2026-09-29T22:30:00.000Z', endAt: '2026-09-29T23:30:00.000Z' }),
    // Mardi 21 h à la ferme.
    proposal({ id: 'p-2', startAt: '2026-09-29T19:00:00.000Z', endAt: '2026-09-29T21:15:00.000Z', volumeCubicMeters: null }),
    // Mardi 13 h, validée.
    proposal({ id: 'p-1', startAt: '2026-09-29T11:00:00.000Z', endAt: '2026-09-29T12:00:00.000Z', status: 'validated', validatedEventId: 'event-1' }),
    // Lundi, jamais décidée et passée : expirée à la lecture.
    proposal({ id: 'p-0', startAt: '2026-09-28T05:00:00.000Z', endAt: '2026-09-28T06:00:00.000Z' }),
  ]);
  const days = planDays(stored, NOW);
  assert.deepEqual(days.map((day) => day.dateKey), ['2026-09-28', '2026-09-29', '2026-09-30', '2026-10-01', '2026-10-02', '2026-10-03', '2026-10-04']);
  assert.deepEqual(days.map((day) => day.beforeHorizon), [true, false, false, false, false, false, false]);
  assert.deepEqual(days[0].proposals.map((item) => item.id), ['p-0']);
  assert.equal(days[0].counts.expired, 1);
  assert.deepEqual(days[1].proposals.map((item) => item.id), ['p-1', 'p-2'], 'dans l’ordre des débuts');
  assert.deepEqual(days[1].counts, { proposed: 1, validated: 1, refused: 0, replaced: 0, expired: 0 });
  assert.equal(days[1].volumeCubicMeters, 0.66, 'la validée compte, la proposée au volume inconnu est comptée à part');
  assert.equal(days[1].unknownVolumeCount, 1);
  assert.deepEqual(days[2].proposals.map((item) => item.id), ['p-3']);
  assert.equal(days[3].proposals.length, 0);

  const summary = summarizePlan(stored, NOW);
  assert.deepEqual(summary.counts, { proposed: 2, validated: 1, refused: 0, replaced: 0, expired: 1 });
  assert.ok(Math.abs(summary.volumeCubicMeters - 1.32) < 1e-9);
  assert.equal(summary.unknownVolumeCount, 1);
  assert.equal(summary.unverifiedCount, 0);
  assert.deepEqual(proposedIds(days[1].proposals, NOW), ['stored-p-2'], 'valider le jour ne désigne que les proposées');
});

test('le résumé compte les propositions non vérifiées et le jour de la semaine ignore les refusées dans le volume', () => {
  const stored = plan([
    proposal({ id: 'p-1', startAt: '2026-09-30T05:00:00.000Z', endAt: '2026-09-30T06:00:00.000Z', justification: { priority: 'high', doseReason: 'remaining-need', timingReason: 'window', limitingConstraint: null, pump: null, supply: null, hydraulicallyVerified: false } }),
    proposal({ id: 'p-2', startAt: '2026-09-30T07:00:00.000Z', endAt: '2026-09-30T08:00:00.000Z', status: 'refused', decidedAt: NOW.toISOString() }),
  ]);
  const summary = summarizePlan(stored, NOW);
  assert.equal(summary.unverifiedCount, 1);
  assert.equal(summary.counts.refused, 1);
  assert.equal(summary.volumeCubicMeters, 0.66);
  assert.equal(planDays(stored, NOW)[2].volumeCubicMeters, 0.66);
});

test('une validée dont l’irrigation est annulée se lit « Annulée », ne compte ni parmi les validées ni dans le volume ; réalisée ou partielle, elle le dit (statuts du contrat)', () => {
  const planned = proposal({ id: 'p-1', startAt: '2026-09-29T19:00:00.000Z', endAt: '2026-09-29T20:00:00.000Z', status: 'validated', validatedEventId: 'event-1', irrigationStatus: 'planned', volumeCubicMeters: 1 });
  const canceled = proposal({ id: 'p-2', startAt: '2026-09-30T19:00:00.000Z', endAt: '2026-09-30T20:00:00.000Z', status: 'validated', validatedEventId: 'event-2', irrigationStatus: 'canceled', volumeCubicMeters: 2 });
  const completed = proposal({ id: 'p-3', startAt: '2026-09-28T19:00:00.000Z', endAt: '2026-09-28T20:00:00.000Z', status: 'validated', validatedEventId: 'event-3', irrigationStatus: 'completed', volumeCubicMeters: 4 });
  const partial = proposal({ id: 'p-4', startAt: '2026-09-28T21:00:00.000Z', endAt: '2026-09-28T22:00:00.000Z', status: 'validated', validatedEventId: 'event-4', irrigationStatus: 'partially_completed', volumeCubicMeters: 8 });
  const summary = summarizePlan(plan([planned, canceled, completed, partial]), NOW);
  assert.equal(summary.counts.validated, 3, 'l’annulée ne compte plus');
  assert.equal(summary.volumeCubicMeters, 13, 'ni dans le volume');
  assert.deepEqual([planned, canceled, completed, partial].map((p) => proposalStatusLabel(p, NOW)), ['Validée', 'Annulée', 'Réalisée', 'Partielle']);
  assert.equal(proposalStatusLabel(proposal({ id: 'p-5', startAt: '2026-09-29T19:00:00.000Z', endAt: '2026-09-29T20:00:00.000Z' }), NOW), 'Proposée');
  assert.match(validatedProposalNote('canceled'), /revenu au plan/);
  assert.match(validatedProposalNote(null), /À venir ou à terminer/);
});

test('les planches non servies sont celles qui gardent un manque, prioritaires d’abord, puis par nom', () => {
  const stored = plan([], [
    bed({ bedId: 'B1-2', placedMm: 12, deficitMm: 8, reasons: ['no-time-left'] }),
    bed({ bedId: 'T1-1', priority: 'high', placedMm: 0, deficitMm: 20, reasons: ['no-equipment'] }),
    bed({ bedId: 'B1-1' }),
    bed({ bedId: 'B1-0', placedMm: 20, deficitMm: 0.004, reasons: [] }),
    bed({ bedId: 'S1', needMm: 0, targetMm: 0, placedMm: 0, deficitMm: 0, reasons: ['no-objective'] }),
  ]);
  assert.deepEqual(unplacedBeds(stored).map((item) => item.bedId), ['T1-1', 'B1-2', 'S1']);
  assert.equal(unplacedReasonLabel('no-equipment'), 'aucun matériel ne l’arrose');
  assert.equal(doseReasonLabel('maximum-dose'), 'la dose maximale par arrosage');
  assert.equal(timingReasonLabel('after-forecast-rain'), 'après la pluie prévue');
  assert.match(unplacedReasonLabel('insufficient-reach'), /^réglage plus large que la planche/);
  assert.match(unplacedReasonLabel('spacing'), /espacement/);
  // Le moteur lit les refus (D-030, point ouvert 31) : le motif, la dose coupée et le moment reportés se nomment.
  // Les identifiants des règles ne sont plus dans les libellés visibles (audit ergonomique, lot 3, point 5, F48).
  assert.equal(unplacedReasonLabel('refused-slot'), 'créneau refusé : ses seuls créneaux possibles ont été refusés cette semaine');
  assert.equal(doseReasonLabel('refused-slot-fit'), 'ce qui tient avant un créneau refusé');
  assert.equal(timingReasonLabel('after-refused-slot'), 'après un créneau refusé');
});

test('un ajustement fait suivre la durée à la dose et la fin au début, sans toucher au reste', () => {
  const base = { startAt: '2026-09-29T19:00:00.000Z', durationSeconds: 3600, doseMm: 10 };
  const adjusted = adjustProposalTiming(base, { startAt: '2026-09-29T20:30:00.000Z', doseMm: 6 });
  assert.deepEqual(adjusted, { startAt: '2026-09-29T20:30:00.000Z', endAt: '2026-09-29T21:06:00.000Z', durationSeconds: 2160, doseMm: 6 });
  assert.equal(isAdjusted(base, adjusted!), true);

  const same = adjustProposalTiming(base, { startAt: base.startAt, doseMm: 10 });
  assert.equal(same?.durationSeconds, 3600);
  assert.equal(isAdjusted(base, same!), false);

  // 2 h 15 pour 15 mm : 5 mm donnent 45 min à la seconde près.
  assert.equal(adjustProposalTiming({ ...base, durationSeconds: 8100, doseMm: 15 }, { startAt: base.startAt, doseMm: 5 })?.durationSeconds, 2700);
  assert.equal(adjustProposalTiming(base, { startAt: base.startAt, doseMm: 0 }), null, 'une dose nulle n’est pas un créneau');
  assert.equal(adjustProposalTiming(base, { startAt: 'demain', doseMm: 5 }), null, 'un début illisible non plus');
  assert.equal(adjustProposalTiming({ ...base, doseMm: 0 }, { startAt: base.startAt, doseMm: 5 }), null);
});

test('une carte se date de son calcul quand ce n’est pas le dernier, jamais quand elle en est', () => {
  // Deux cartes peuvent porter le même numéro : « p-12 » du calcul refusé et du nouveau calcul (constat du 29 septembre 2026).
  const refused = proposal({ id: 'p-12', startAt: '2026-09-29T19:00:00.000Z', endAt: '2026-09-29T21:15:00.000Z', status: 'refused' });
  assert.equal(earlierCalculationDate(refused, 'calc-1'), null, 'du calcul courant : le numéro suffit');
  assert.equal(earlierCalculationDate(refused, 'calc-2'), NOW.toISOString(), 'relue avec un calcul plus récent : datée du sien');
});

test('l’en-tête nomme le déclencheur, l’événement quand c’en est un, et l’avis dit à quoi le plan est antérieur (3.7, règles 6 et 7)', () => {
  for (const kind of PLAN_EVENT_KINDS) assert.ok(PLAN_EVENT_LABELS[kind].length > 0, `${kind} a un nom`);
  assert.equal(calculationTriggerLabel({ trigger: 'manual', triggerEvent: null }), 'à la demande');
  assert.equal(calculationTriggerLabel({ trigger: 'daily', triggerEvent: null }), 'recalcul du matin');
  assert.equal(calculationTriggerLabel({ trigger: 'event', triggerEvent: 'rain-recorded' }), 'après la pluie saisie au pluviomètre');
  assert.equal(calculationTriggerLabel({ trigger: 'event', triggerEvent: null }), 'sur événement', 'un calcul sur événement d’avant la 3.7 n’a pas de nom');
  assert.equal(pendingEventNotice({ kind: 'rain-recorded', status: 'pending' }, '29/09/2026 13:10'), 'Plan antérieur à : la pluie saisie au pluviomètre, le 29/09/2026 13:10 — recalcul en cours.');
  assert.equal(pendingEventNotice({ kind: 'proposal-refused', status: 'failed' }, '29/09/2026 13:20'), 'Plan antérieur à : une proposition refusée, le 29/09/2026 13:20 — le recalcul a échoué, recalculez.');
});

test('les réglages font l’aller-retour par le formulaire, et une saisie absurde est refusée avec son chemin', () => {
  const form = planningSettingsForm(DEFAULT_PLANNING_SETTINGS);
  assert.equal('dailyRecalculation' in form, false, 'R1 retiré le 5 octobre 2026 (D-029)');
  assert.equal(form.forecastRainSharePercent, '100');
  assert.deepEqual(form.windows.sprinkler, { start: '21:00', end: '08:00' });
  assert.deepEqual(form.doses.drip, { minimumMm: '3', maximumMm: '10', irrigationsPerDay: '1', spacingDays: '1' });
  assert.equal(form.commandingRateSharePercent, '50', 'R13');
  assert.equal(form.lateToleranceMinutes, '30', 'R14 (3.7, règle 18)');
  assert.deepEqual(settingsFromForm(form), { settings: DEFAULT_PLANNING_SETTINGS, issues: [] });
  assert.equal(settingsFromForm({ ...form, lateToleranceMinutes: '45' }).settings?.lateToleranceMinutes, 45);
  const lateRefused = settingsFromForm({ ...form, lateToleranceMinutes: '30,5' });
  assert.deepEqual(lateRefused.issues.map((issue) => [issue.path, settingsIssueLabel(issue.path)]), [['lateToleranceMinutes', 'R14, tolérance du retard']]);

  const edited = settingsFromForm({
    ...form,
    forecastRainSharePercent: '50',
    waitForForecastRainAboveMm: '7,5',
    windows: { ...form.windows, drip: { start: '00:00', end: '23:59' } },
  });
  assert.equal(edited.settings?.forecastRainShare, 0.5);
  assert.equal(edited.settings?.waitForForecastRainAboveMm, 7.5);
  assert.deepEqual(edited.settings?.windows.drip, { startMinute: 0, endMinute: 1439 });

  const refused = settingsFromForm({ ...form, windows: { ...form.windows, sprinkler: { start: '21h', end: '08:00' } }, doses: { ...form.doses, drip: { ...form.doses.drip, maximumMm: '' } } });
  assert.equal(refused.settings, null);
  assert.deepEqual(refused.issues.map((issue) => issue.path).sort(), ['doses.drip', 'windows.sprinkler']);

  assert.equal(timeInputFromMinutes(1260), '21:00');
  assert.equal(minutesFromTimeInput('8:05'), 485);
  assert.equal(minutesFromTimeInput('24:00'), null);
  assert.equal(windowLabel({ startMinute: 1260, endMinute: 480 }), '21:00 – 08:00');
  const summary = summarizeSettings(DEFAULT_PLANNING_SETTINGS);
  assert.match(summary, /aspersion 5 à 15 mm, 1 par jour, 1 j d’espacement, 21:00 – 08:00/);
  assert.match(summary, /goutte-à-goutte 3 à 10 mm/);
  assert.match(summary, /pluie prévue déduite à 100 %/);
  assert.match(summary, /pénurie : prioritaires d’abord, puis part égale/);
  assert.match(summary, /portée : une planche commande dès 50 % du débit le plus fort/);
  assert.match(summary, /retard : 30 min après l’heure prévue/);
  assert.doesNotMatch(summary, /recalcul à/, 'R1 retiré (D-029) : le résumé ne montre plus d’heure de recalcul');
  assert.ok(summary.startsWith('pluie prévue déduite'), 'R2 ouvre le résumé');
});

test('le sous-titre du manque d’eau nomme la limite journalière quand c’est elle qui coupe (point 35)', () => {
  assert.equal(waterDeficitDetail({ waterCubicMeters: 0, byReason: {} }), 'Ce que le stock et les ressources ne couvrent pas');
  assert.equal(waterDeficitDetail({ waterCubicMeters: 7.2, byReason: { 'water-budget': 7.2 } }), 'Ce que le stock et les ressources ne couvrent pas');
  assert.equal(waterDeficitDetail({ waterCubicMeters: 19.2, byReason: { 'daily-limit': 19.2 } }), 'Ce que la limite journalière ne laisse pas placer');
  assert.equal(waterDeficitDetail({ waterCubicMeters: 10, byReason: { 'water-budget': 7.5, 'daily-limit': 2.5 } }), 'Ce que le stock et les ressources ne couvrent pas, dont 2,5 m³ par la limite journalière');
});

test('le manque d’eau sur une chaîne à l’eau inconnue : « non chiffré », ou « au moins » ce que les autres chiffrent, jamais un zéro (point ouvert 51, D-089)', () => {
  const line = (originKey: string, availableCubicMeters: number | null, demandCubicMeters: number) => ({
    originKey, originName: originKey, availableCubicMeters, dailyLimitRemainingCubicMeters: null, demandCubicMeters, fractions: { high: 1, normal: 1, low: 1 },
  });
  // Une réserve sans stock observé, un matériel sans pompe : leur eau est inconnue ; sans demande, une chaîne ne compte pas.
  assert.equal(unknownWaterChainCount([line('reservoir:reserve', null, 7.1), line('unverified:gag1', null, 1.32), line('resource:source', 8, 5.6), line('unverified:gag2', null, 0)]), 2);
  assert.equal(unknownWaterChainCount([line('reservoir:reserve', 97, 7.1)]), 0);
  assert.equal(unknownWaterChainCount([]), 0, 'sous un arbitrage, aucune ligne : la carte reste celle d’avant');
  const volume = (value: number) => `${String(value).replace('.', ',')} m³`;
  assert.equal(waterDeficitValue(0, 0, volume), '0 m³', 'toute l’eau connue : le zéro est prouvé');
  assert.equal(waterDeficitValue(2.5, 0, volume), '2,5 m³');
  assert.equal(waterDeficitValue(0, 1, volume), 'non chiffré');
  assert.equal(waterDeficitValue(2.5, 2, volume), 'au moins 2,5 m³');
  assert.equal(waterDeficitTileDetail({ waterCubicMeters: 7.2, byReason: { 'water-budget': 7.2 } }, 0), 'Ce que le stock et les ressources ne couvrent pas');
  assert.equal(waterDeficitTileDetail({ waterCubicMeters: 0, byReason: {} }, 1), 'Eau mobilisable inconnue sur une chaîne : le manque ne peut pas y être chiffré');
  assert.equal(waterDeficitTileDetail({ waterCubicMeters: 0, byReason: {} }, 3), 'Eau mobilisable inconnue sur 3 chaînes : le manque ne peut pas y être chiffré');
  assert.equal(
    waterDeficitTileDetail({ waterCubicMeters: 10, byReason: { 'water-budget': 7.5, 'daily-limit': 2.5 } }, 1),
    'Ce que le stock et les ressources ne couvrent pas, dont 2,5 m³ par la limite journalière ; eau mobilisable inconnue sur une chaîne, où le manque ne peut pas être chiffré',
  );
});

/** Le plan enregistré avec son manque et, s'il y a lieu, le budget de sa seule chaîne (D-038). */
function planWithDeficit(proposals: StoredProposal[], deficit: StoredWeeklyPlan['calculation']['summary']['deficit'], demandCubicMeters: number | null): StoredWeeklyPlan {
  const base = plan(proposals);
  const budgets = demandCubicMeters === null
    ? []
    : [{ originKey: 'reservoir:reserve', originName: 'Réserve tampon', availableCubicMeters: 25, dailyLimitRemainingCubicMeters: null, demandCubicMeters, fractions: { high: 1, normal: 0.3, low: 1 } }];
  return { ...base, calculation: { ...base.calculation, summary: { ...base.calculation.summary, deficit, budgets } } };
}

test('la note du manque d’eau chiffre l’écart entre demandé, placé et manque, et se tait quand l’identité tient (D-038)', () => {
  const placed = (volume: number | null, calculationId = 'calc-1') => proposal({ id: `p-${volume}-${calculationId}`, startAt: '2026-09-30T19:00:00.000Z', endAt: '2026-09-30T21:00:00.000Z', volumeCubicMeters: volume, calculationId });
  const deficit = (water: number, byReason: Partial<Record<UnplacedReason, number>>) => ({ waterCubicMeters: water, pumpTimeCubicMeters: 0, byReason, bedCount: 1 });
  // La recette du 9 octobre 2026 : 82,70 m³ demandés, 24,999 m³ placés, 62,187 m³ de manque d'eau — 4,486 m³ placés à côté.
  const beside = waterDeficitExplanation(planWithDeficit([placed(24.999)], deficit(62.187, { 'water-budget': 62.187 }), 82.7));
  assert.equal(beside, 'Demandés 82,7 m³, placés 24,999 m³, manque d’eau 62,187 m³ : l’écart tient à 4,486 m³ placés sans couvrir de besoin compté — à côté des planches, au-delà de leur besoin, ou sur une surface plus large que celle de leur propre matériel. Le manque se compte planche par planche, sur la surface que son propre matériel mouille.');
  // Un manque pour une autre raison que l'eau s'ajoute.
  const other = waterDeficitExplanation(planWithDeficit([placed(24.999)], deficit(60, { 'water-budget': 60, 'pump-time': 2.187 }), 82.7));
  assert.match(other ?? '', /manque d’eau 60 m³ : l’écart tient à 4,486 m³ placés sans couvrir de besoin compté — [^.]+ —, et à 2,187 m³ qui manquent pour une autre raison que l’eau \(temps de pompage, espacement, dose minimale\)\. Le manque/);
  // Du besoin couvert par moins d'eau qu'il n'en compte : le matériel qui l'a arrosé mouille une surface plus petite.
  const narrower = waterDeficitExplanation(planWithDeficit([placed(3)], deficit(6, { 'water-budget': 6 }), 10));
  assert.match(narrower ?? '', /^Demandés 10 m³, placés 3 m³, manque d’eau 6 m³ : l’écart tient à 1 m³ de besoin couverts par une eau comptée sur une surface plus petite que celle de leur propre matériel\. Le manque/);
  // L'identité tient, à moins d'un litre près : pas de note.
  assert.equal(waterDeficitExplanation(planWithDeficit([placed(4), placed(0.0005)], deficit(6, { 'water-budget': 6 }), 10)), null);
  // Un volume inconnu, un budget absent (arbitrage) ou un créneau d'un autre calcul : pas de note plutôt qu'un chiffre faux.
  assert.equal(waterDeficitExplanation(planWithDeficit([placed(3), placed(null)], deficit(6, { 'water-budget': 6 }), 10)), null);
  assert.equal(waterDeficitExplanation(planWithDeficit([placed(3)], deficit(6, { 'water-budget': 6 }), null)), null);
  assert.equal(waterDeficitExplanation(planWithDeficit([placed(4), placed(3, 'calc-0')], deficit(6, { 'water-budget': 6 }), 10)), null);
  assert.equal(doseReasonLabel('reserved-share'), 'la part de la semaine réservée à ses planches');
});

test('la note se tait sous le résidu d’arrondi des secondes, un centième de millimètre par planche et par créneau (D-040, point 41)', () => {
  // La recette du 10 octobre 2026 : 5 m³ de budget pour 896 m² mouillés à 10 mm/h, une part de 5,5804 mm par planche ;
  // quatre créneaux coupés à 2 008 s livrent 5,5778 mm, le moteur tient le reste pour reçu : 4,998 m³ placés, 5,000 comptés.
  const seconds = 2008;
  const appliedMm = millimetersForRate(10, seconds);
  const tunnel = (id: string, wetted: number) => proposal({
    id, startAt: '2026-10-10T19:00:00.000Z', endAt: '2026-10-10T19:33:28.000Z', durationSeconds: seconds, doseMm: appliedMm,
    volumeCubicMeters: cubicMetersFromMillimeters(appliedMm, 8 * wetted),
    bedApplications: Array.from({ length: 8 }, (_, index) => ({ bedId: `${id}-${index + 1}`, bedName: `${id}-${index + 1}`, needBeforeMm: 5.5804, appliedMm, needAfterMm: 0, surplusMm: 0, wettedAreaSquareMeters: wetted })),
  });
  const proposals = [tunnel('T1', 16), tunnel('T2', 32), tunnel('T3', 32), tunnel('T4', 32)];
  const deficit = (water: number) => ({ waterCubicMeters: water, pumpTimeCubicMeters: 0, byReason: { 'water-budget': water }, bedCount: 32 });
  const counted = cubicMetersFromMillimeters(20 - 5.5804, 896);
  assert.equal(waterDeficitExplanation(planWithDeficit(proposals, deficit(counted), 17.92)), null);
  // Au-delà du résidu — ici 9 L, un centième de millimètre sur 896 m² —, la note reparaît.
  assert.match(waterDeficitExplanation(planWithDeficit(proposals, deficit(counted - 0.02), 17.92)) ?? '', /0,022 m³ de besoin couverts par une eau comptée sur une surface plus petite/);
});
