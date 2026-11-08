import assert from 'node:assert/strict';
import test from 'node:test';
import { bedEtmOrigin, proposedObjectiveOrigin } from '../lib/domain/crop-water/presentation';
import type { CropWaterDay } from '../lib/domain/crop-water/etm';
import { weekProposal, type BedWaterDay } from '../lib/domain/crop-water/proposal';
import { realRemainingMm, realRemainingOrigin } from '../lib/domain/irrigation-needs';
import type { PlanBedOutcome, PlanProposal } from '../lib/domain/planning/contract';
import { proposalOrigin, unplacedOrigin } from '../lib/domain/planning/origins';
import { gaugePercentOrigin, thresholdOrigin } from '../lib/domain/soil-reserve/gauge-view';
import { actualRainOrigin } from '../lib/domain/water-management';
import { coverageOrigin } from '../lib/domain/irrigation-coverage';
import { frostThresholdOrigin } from '../lib/domain/crop-alerts/view';
import { frostAlertThresholdCelsius, frostMarginCelsius } from '../lib/domain/crop-alerts/thresholds';
import { durationSecondsForTarget, irrigationPreviewOrigin } from '../lib/domain/irrigation-timer';
import { measureResourceFlow, flowMeasurementOrigin } from '../lib/domain/resource-flow';
import { availableAfterPlanningOrigin } from '../lib/domain/reservoir-origin';
import { mobilizableVolume } from '../lib/domain/water-resources';
import { irrigationCumulOrigin } from '../lib/domain/irrigation-history/summary';

/**
 * Les bulles « d'où vient ce chiffre » (3.8, docs/feature-selection-contract.md,
 * section 6, preuve de fin 4) : une par bulle, les nombres de la bulle sont
 * ceux du chiffre affiché, avec les arrondis de l'écran.
 */

const screenMm = (value: number) => `${new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 1 }).format(value)} mm`;
const screenWhole = (value: number) => new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 0 }).format(value);
const screenVolume = (value: number) => `${new Intl.NumberFormat('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 3 }).format(value)} m³`;

test('objectifs et besoins : la bulle du besoin de la semaine dit le calcul et finit sur le chiffre affiché', () => {
  const bed = { objectiveMm: 20, actualRainMm: 3, actualIrrigationMm: 5, sheltered: false, realRemainingMm: realRemainingMm(20, 3, 5) };
  const text = realRemainingOrigin(bed);
  assert.equal(text, `Objectif ${screenMm(20)} − (arrosé ${screenMm(5)} + pluie ${screenMm(3)}) = ${screenMm(12)} à apporter cette semaine.`);
  assert.equal(bed.realRemainingMm, 12);
  const reached = { ...bed, actualIrrigationMm: 18.5, realRemainingMm: realRemainingMm(20, 3, 18.5) };
  assert.match(realRemainingOrigin(reached) ?? '', /= 0 mm : l’objectif de la semaine est atteint\.$/);
  assert.match(realRemainingOrigin({ ...bed, sheltered: true }) ?? '', /pluie 3 mm sous abri/);
  assert.equal(realRemainingOrigin({ ...bed, actualRainMm: null, realRemainingMm: null }), null, 'pas de chiffre, pas de bulle');
});

test('objectifs et besoins : la bulle de la pluie réelle nomme sa source et son chiffre', () => {
  assert.equal(
    actualRainOrigin({ manualRainMm: 4.2, reanalysisRainMm: 3.1, effectiveActualRainMm: 4.2 }),
    `Pluie mesurée au pluviomètre : ${screenMm(4.2)} ; elle remplace la réanalyse météo, ${screenMm(3.1)}.`,
  );
  assert.equal(
    actualRainOrigin({ manualRainMm: null, reanalysisRainMm: 2.25, effectiveActualRainMm: 2.25 }),
    `Réanalyse météo du jour : ${screenMm(2.25)}, faute de mesure au pluviomètre.`,
  );
  assert.equal(actualRainOrigin({ manualRainMm: null, reanalysisRainMm: null, effectiveActualRainMm: null }), null);
});

const proposal: Pick<PlanProposal, 'doseMm' | 'applications' | 'bedApplications' | 'volumeCubicMeters'> = {
  doseMm: 10,
  applications: [
    { otfZoneId: 'z', otfPlotId: 'p', otfBedId: 'a', rateMmPerHour: 8, bedAreaSquareMeters: 20, wettedAreaSquareMeters: 20 },
    { otfZoneId: 'z', otfPlotId: 'p', otfBedId: 'b', rateMmPerHour: 6, bedAreaSquareMeters: 15, wettedAreaSquareMeters: 15 },
  ],
  bedApplications: [
    { bedId: 'a', bedName: 'A1', needBeforeMm: 12, appliedMm: 10, needAfterMm: 2, surplusMm: 0, wettedAreaSquareMeters: 20 },
    { bedId: 'b', bedName: 'B1', needBeforeMm: 6, appliedMm: 7.5, needAfterMm: 0, surplusMm: 1.5, wettedAreaSquareMeters: 15 },
  ],
  volumeCubicMeters: 0.3125,
};

test('planning : la bulle d’une proposition dit la durée, la part de chaque planche et le volume affiché', () => {
  const text = proposalOrigin(proposal, '1 h 15 min');
  assert.match(text, /^1 h 15 min : le temps pour que A1, la mieux arrosée \(8 mm\/h\), reçoive la dose de 10 mm\./);
  assert.match(text, /A1 10 mm pour un besoin de 12 mm ; B1 7,5 mm pour un besoin de 6 mm, dont 1,5 mm de trop\./);
  assert.ok(text.includes(`Volume : 10 mm sur 20 m² + 7,5 mm sur 15 m² = ${screenVolume(0.3125)}`), text);
  const unknown = proposalOrigin({ ...proposal, volumeCubicMeters: null, bedApplications: proposal.bedApplications.map((item) => item.bedId === 'b' ? { ...item, wettedAreaSquareMeters: null } : item) }, '1 h 15 min');
  assert.match(unknown, /Volume inconnu : la surface mouillée de B1 n’est pas connue/);
});

test('planning : la bulle d’un « Non placé » dit besoin − placé = manque, la cible réduite et le motif', () => {
  const bed: Pick<PlanBedOutcome, 'needMm' | 'targetMm' | 'placedMm' | 'deficitMm' | 'reasons'> = { needMm: 14, targetMm: 10, placedMm: 6, deficitMm: 8, reasons: ['water-budget'] };
  const text = unplacedOrigin(bed);
  assert.ok(text.startsWith(`Besoin au départ du calcul ${screenMm(14)} − placé ${screenMm(6)} = ${screenMm(8)} de manque.`), text);
  assert.match(text, /ramené sa cible à 10 mm/);
  assert.match(text, /Motif : stock et ressources insuffisants d’ici dimanche\.$/);
  assert.match(unplacedOrigin({ ...bed, targetMm: 14, reasons: [] }), /Motif : manque partiel, faute de place/);
});

const current = { mm: 31.5, capacityMm: 60, percent: 52.5, thresholdMm: 30, observedAt: null };

test('réserve du sol : la bulle de la jauge redit l’état, le plein et le pourcentage affichés', () => {
  const text = gaugePercentOrigin(current, 0.3);
  assert.equal(text, `${screenMm(31.5)} d’eau utilisable dans le sol au début du jour, sur un plein de ${screenMm(60)} : ${screenWhole(52.5)} % du plein. Le plein est l’eau que le sol retient à portée des racines, racines à 0,30 m.`);
  assert.equal(gaugePercentOrigin(null, 0.3), null);
});

test('réserve du sol : la bulle du seuil dit d’où il vient, réglé par la ferme ou selon la culture', () => {
  assert.match(thresholdOrigin(current, { p: 0.5, cropThresholdPercent: null }) ?? '', /^Seuil 30 mm sur un plein de 60 mm : .*\(p = 0,5\)/);
  assert.match(thresholdOrigin(current, { p: 0.5, cropThresholdPercent: 45 }) ?? '', /réglé par l’exploitation ; la culture seule conseillerait 45 % du plein\.$/);
  assert.equal(thresholdOrigin({ ...current, thresholdMm: null }, null), null);
});

function computedCrop(plantName: string, et0: number, kc: number, shelterFactor: number, etmMm: number): CropWaterDay {
  return {
    plantName,
    status: 'computed',
    etmMm,
    et0: { mm: et0, nature: 'reanalysis' },
    irrigationStop: false,
    trace: { kc: { kc }, shelterFactor, mulchFactor: 1, shadeFactor: 1 },
  } as unknown as CropWaterDay;
}

test('besoin par culture : la bulle de l’ETM du jour dit ET0 × Kc × facteurs pour chaque culture et retient la plus forte', () => {
  const day: Pick<BedWaterDay, 'etmMm' | 'status' | 'crops'> = {
    etmMm: 3.2 * 0.8 * 1.1,
    status: 'computed',
    crops: [computedCrop('Tomate', 3.2, 1.1, 0.8, 3.2 * 0.8 * 1.1), computedCrop('Basilic', 3.2, 0.7, 0.8, 3.2 * 0.8 * 0.7)],
  };
  const text = bedEtmOrigin(day) ?? '';
  assert.ok(text.startsWith(`ETM de la planche ${screenMm(day.etmMm ?? 0)} : la plus forte de ses cultures.`), text);
  assert.match(text, /Tomate : ET0 3,2 mm × Kc 1,10 × K_abri 0,8 = 2,8 mm ; Basilic : ET0 3,2 mm × Kc 0,70 × K_abri 0,8 = 1,8 mm\.$/);
  assert.equal(bedEtmOrigin({ etmMm: 0, status: 'no-crop', crops: [] }), 'Aucune culture à Kc sur la planche aujourd’hui : elle compte 0 mm.');
  assert.equal(bedEtmOrigin({ etmMm: null, status: 'unknown', crops: [] }), null);
});

test('besoin par culture : la bulle de l’objectif proposé additionne les ETM par nature et finit sur le chiffre affiché', () => {
  const day = (date: string, etmMm: number, nature: 'reanalysis' | 'forecast'): BedWaterDay => ({ date, status: 'computed', etmMm, et0: { mm: etmMm, nature }, crops: [], irrigationStop: false, problems: [] });
  const week = weekProposal({
    days: [day('2026-11-02', 2.5, 'reanalysis'), day('2026-11-03', 3, 'reanalysis'), day('2026-11-04', 2, 'forecast'), day('2026-11-05', 2, 'forecast'), day('2026-11-06', 2, 'forecast'), day('2026-11-07', 2, 'forecast'), day('2026-11-08', 2, 'forecast')],
    objectiveMm: 20,
  });
  assert.equal(proposedObjectiveOrigin(week), `La somme des ETM de la planche, du lundi au dimanche : ${screenMm(5.5)} de réanalyse + ${screenMm(10)} prévus = ${screenMm(week.proposedMm ?? 0)}.`);
  assert.equal(proposedObjectiveOrigin({ ...week, proposedMm: null }), null);
});

const screenRate = (value: number) => `${new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 2 }).format(value)} mm/h`;
const screenWater = (value: number, unit: string) => `${new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 3 }).format(value)} ${unit}`;
const screenCelsius = (value: number) => `${new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 1 }).format(Math.round(value * 10) / 10)} °C`;

test('matériel et placement : la bulle de l’apport horaire additionne les matériels posés jusqu’au chiffre affiché', () => {
  const coverage = {
    totalRateMmPerHour: 10 + 3.75,
    contributions: [
      { equipmentId: 'g', equipmentName: 'Goutte-à-goutte', settingId: 's1', settingName: 'Gaine 2 l/h', kind: 'drip' as const, rateMmPerHour: 10 },
      { equipmentId: 'a', equipmentName: 'Asperseur', settingId: 's2', settingName: 'Buse 3', kind: 'sprinkler' as const, rateMmPerHour: 3.75 },
    ],
  };
  assert.equal(
    coverageOrigin(coverage),
    `Apport horaire : Goutte-à-goutte (Gaine 2 l/h) ${screenRate(10)} + Asperseur (Buse 3, à sa distance du matériel) ${screenRate(3.75)} = ${screenRate(13.75)}. 1 mm/h, c’est 1 litre par heure sur chaque m² de la planche.`,
  );
  assert.equal(coverageOrigin({ totalRateMmPerHour: 10, contributions: [coverage.contributions[0]] }), `Apport horaire : Goutte-à-goutte (Gaine 2 l/h) ${screenRate(10)}. 1 mm/h, c’est 1 litre par heure sur chaque m² de la planche.`);
});

test('alertes cultures : la bulle du seuil de gel dit dégâts + marge + microclimat = le seuil d’alerte affiché', () => {
  const damage = -2;
  const row = { damageCelsius: damage, marginCelsius: frostMarginCelsius(damage), alertCelsius: frostAlertThresholdCelsius(damage, -1), source: 'common' as const };
  const text = frostThresholdOrigin(row, -1) ?? '';
  assert.ok(text.startsWith(`Alerte à ${screenCelsius(row.alertCelsius)} = dégâts à ${screenCelsius(damage)} (jeu commun) + marge ${screenCelsius(row.marginCelsius)} + microclimat ${screenCelsius(-1)}.`), text);
  assert.equal(frostThresholdOrigin({ damageCelsius: null, marginCelsius: null, alertCelsius: null, source: null }, 0), null);
});

test('arrosages : la bulle d’une irrigation en préparation dit la durée pour la dose, ce que reçoit chaque planche et le volume affiché', () => {
  const seconds = durationSecondsForTarget(10, 8);
  assert.equal(seconds, 4500);
  const text = irrigationPreviewOrigin({
    source: 'amount',
    targetMm: 10,
    reference: { bedName: 'A1', rateMmPerHour: 8 },
    durationText: '1 h 15',
    applications: [{ bedName: 'A1', amountMm: 10, wettedAreaSquareMeters: 20 }, { bedName: 'B1', amountMm: 7.5, wettedAreaSquareMeters: 15 }],
    volumeText: '312,5 L',
  });
  assert.equal(text, `1 h 15 : le temps pour que A1 reçoive 10 mm à ${screenRate(8)}. Pendant ce temps, chaque planche reçoit au taux de son réglage : A1 10 mm ; B1 7,5 mm. Volume : 10 mm sur 20 m² + 7,5 mm sur 15 m² = 312,5 L (1 mm sur 1 m², c’est 1 litre).`);
  const typed = irrigationPreviewOrigin({ source: 'duration', targetMm: 0, reference: null, durationText: '30 min', applications: [{ bedName: 'B1', amountMm: 3, wettedAreaSquareMeters: null }], volumeText: null });
  assert.match(typed, /^30 min : la durée saisie\..*Volume inconnu : la surface mouillée de B1 n’est pas connue/);
});

test('ressources et pompes : la bulle du débit mesuré dit volume ÷ temps de marche = le débit affiché', () => {
  const measurement = measureResourceFlow(
    { id: 'r1', takenAt: '2026-11-02T08:00:00.000Z', meterIndexCubicMeters: 100, stoppedSeconds: 0, meterReplaced: false },
    { id: 'r2', takenAt: '2026-11-02T14:00:00.000Z', meterIndexCubicMeters: 112, stoppedSeconds: 3600, meterReplaced: false },
  );
  assert.ok(measurement);
  const text = flowMeasurementOrigin(measurement) ?? '';
  assert.equal(text, `Volume produit 12 m³ ÷ temps de marche 5 h = ${screenWater(measurement.runningFlowCubicMetersPerHour ?? 0, 'm³/h')}. Le temps de marche est le temps entre les deux relevés, 6 h, moins les arrêts déclarés, 1 h.`);
  assert.equal(flowMeasurementOrigin({ ...measurement, runningFlowCubicMetersPerHour: null }), null);
});

test('ressources et pompes : la bulle du stock disponible dit le volume projeté moins le minimum de sécurité', () => {
  const projection = { startVolumeCubicMeters: 40, afterPlanningEndVolumeCubicMeters: 31.25, afterPlanningMobilizableCubicMeters: mobilizableVolume(31.25, 5), forecastRainCubicMeters: 1.5, estimatedEvaporationCubicMeters: 0.25, plannedConsumptionCubicMeters: 10 };
  const text = availableAfterPlanningOrigin(projection, 5) ?? '';
  assert.ok(text.startsWith(`Volume projeté à la fin de l’horizon ${screenWater(31.25, 'm³')} − minimum de sécurité ${screenWater(5, 'm³')} = ${screenWater(26.25, 'm³')} mobilisables.`), text);
  assert.match(text, /part du stock actuel, 40 m³/);
  assert.equal(availableAfterPlanningOrigin({ ...projection, startVolumeCubicMeters: null }, 5), null);
});

test('historique et cumuls : la bulle du cumul dit la pondération par la surface et redit le chiffre affiché', () => {
  const text = irrigationCumulOrigin({ irrigationMm: 12.345, irrigatedAreaSquareMeters: 30, scopeAreaSquareMeters: 45.5 }) ?? '';
  assert.ok(text.startsWith('Apport irrigation 12,35 mm : '), text);
  assert.match(text, /toute la surface du périmètre, 45,5 m²\. 30 m² ont été arrosés/);
  assert.equal(irrigationCumulOrigin({ irrigationMm: null, irrigatedAreaSquareMeters: 0, scopeAreaSquareMeters: 0 }), null);
});
