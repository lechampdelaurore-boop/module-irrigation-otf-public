import assert from 'node:assert/strict';
import test from 'node:test';
import type { WaterDashboardDay } from '../lib/domain/water-management.ts';
import { isQuietWaterDay, quietWaterDaysText, waterDaySummary } from '../lib/domain/water-week-days.ts';

function day(patch: Partial<WaterDashboardDay> = {}): WaterDashboardDay {
  return {
    date: '2026-06-15',
    volumeIncomplete: false,
    realizedIrrigationCubicMeters: 0,
    plannedIrrigationCubicMeters: 0,
    estimatedOngoingCubicMeters: 0,
    reanalysisRainMm: null,
    manualRainMm: null,
    effectiveActualRainMm: null,
    forecastRainMm: null,
    forecastMinimumTemperatureCelsius: null,
    forecastMaximumTemperatureCelsius: null,
    et0Mm: null,
    et0Kind: null,
    limitCubicMeters: null,
    limitExceededByCubicMeters: 0,
    actualLimitExceededByCubicMeters: 0,
    ...patch,
  };
}

test('un jour replié se lit en une ligne, avec les arrondis de l’écran (audit final, lot D, J3, F299)', () => {
  assert.equal(waterDaySummary(day({ realizedIrrigationCubicMeters: 2.314, effectiveActualRainMm: 4.25 })), '2,31 m³ arrosés · pluie 4,3 mm');
  assert.equal(waterDaySummary(day({ plannedIrrigationCubicMeters: 0.4, forecastRainMm: 6 })), '400 L planifiés · 6 mm de pluie prévus');
  assert.equal(waterDaySummary(day({ estimatedOngoingCubicMeters: 1.5, limitExceededByCubicMeters: 0.2 })), '1,5 m³ en cours · limite dépassée');
  assert.equal(waterDaySummary(day()), 'sans irrigation ni pluie mesurée');
});

test('les jours sans irrigation ni pluie se comptent en une phrase, jamais masqués ni comptés zéro (F301, D-003)', () => {
  assert.equal(isQuietWaterDay(day()), true, 'une pluie inconnue n’est pas une pluie');
  assert.equal(isQuietWaterDay(day({ effectiveActualRainMm: 0 })), true);
  assert.equal(isQuietWaterDay(day({ effectiveActualRainMm: 0.2 })), false);
  assert.equal(isQuietWaterDay(day({ plannedIrrigationCubicMeters: 0.1 })), false);
  assert.equal(quietWaterDaysText([day(), day({ effectiveActualRainMm: 0 }), day({ realizedIrrigationCubicMeters: 1 }), day()]), '3 jours sans irrigation ni pluie mesurée');
  assert.equal(quietWaterDaysText([day()]), '1 jour sans irrigation ni pluie mesurée');
  assert.equal(quietWaterDaysText([day({ realizedIrrigationCubicMeters: 1 })]), null);
});
