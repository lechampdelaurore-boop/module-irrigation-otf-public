import assert from 'node:assert/strict';
import test from 'node:test';
import type { Bed } from '../lib/domain/domain';
import type { EquipmentPlacementRecord } from '../lib/domain/equipment-placement-record';
import type { EquipmentListItem } from '../lib/domain/equipment-record';
import { calculateIrrigationCoverage } from '../lib/domain/irrigation-coverage';
import {
  calculateIrrigationSetting,
  missingFieldsText,
  type CalculatorResult,
} from '../lib/domain/irrigation-calculator/calculate';
import { applyExample, CALCULATOR_EXAMPLES, examplesForKind } from '../lib/domain/irrigation-calculator/examples';
import { coneRateAtDistance, coneSharePercent } from '../lib/domain/irrigation-calculator/formulas';
import { pressureCorrectedFlow } from '../lib/domain/irrigation-calculator/flow';
import {
  emptyCalculatorInputs,
  fieldError,
  parseCalculatorInputs,
  type CalculatorInputs,
  type CalculatorMethod,
} from '../lib/domain/irrigation-calculator/inputs';
import {
  calculatorSettingValues,
  decideProvenance,
  deserializeCalculatorInputs,
  serializeCalculatorInputs,
  settingLabelOf,
  type SettingValues,
} from '../lib/domain/irrigation-calculator/provenance';

/**
 * Les cas chiffrés de docs/irrigation-calculator-contract.md, section 15,
 * valeurs attendues écrites dans le contrat avant le code (6 novembre 2026).
 */

function inputs(method: CalculatorMethod, fields: Partial<CalculatorInputs>): CalculatorInputs {
  return { ...emptyCalculatorInputs(method), ...fields };
}

function close(actual: number | null, expected: number, tolerance: number, label: string) {
  assert.ok(actual !== null, `${label} : valeur connue`);
  assert.ok(Math.abs(actual - expected) <= tolerance, `${label} : ${actual} au lieu de ${expected} ± ${tolerance}`);
}

function known(result: CalculatorResult) {
  assert.deepEqual(result.errors, []);
  assert.deepEqual(result.missing, []);
  return result;
}

test('SuperNet 30 l/h, s 1 m, w 3 m : 10 mm/h théoriques, 6,4 mm/h reçus à 64 %, estimé', () => {
  const result = known(calculateIrrigationSetting(inputs('sprinkler_mean', {
    referenceFlowLitersPerHour: 30, spacingMeters: 1, wettedWidthMeters: 3, efficiencyPercent: 64,
  })));
  assert.equal(result.theoreticalRateMmPerHour, 10);
  assert.equal(result.receivedRateMmPerHour, 6.4, 'le test n’est pas plié aux 6,8 mm/h de la fiche');
  assert.equal(result.level, 'estimated');
  assert.equal(result.zoneSharePercent, 64);
  assert.deepEqual(result.profile, [
    { distanceMeters: 0, rateMmPerHour: 6.4 },
    { distanceMeters: 1.5, rateMmPerHour: 6.4 },
  ], 'le palier de 0 à w ÷ 2, deux points par côté, rien au-delà');
});

test('AmnonDrip par planche, w 0,75 m : 7,11 mm/h sur une ligne, 14,22 mm/h sur deux, calculé à 100 %', () => {
  const one = known(calculateIrrigationSetting(inputs('drip_per_bed', {
    lineCount: 1, referenceFlowLitersPerHour: 1.6, spacingMeters: 0.3, bedWidthMeters: 0.75,
  })));
  assert.equal(one.receivedRateMmPerHour, 7.11);
  assert.equal(one.level, 'calculated');
  const two = known(calculateIrrigationSetting(inputs('drip_per_bed', {
    lineCount: 2, referenceFlowLitersPerHour: 1.6, spacingMeters: 0.3, bedWidthMeters: 0.75,
  })));
  assert.equal(two.receivedRateMmPerHour, 14.22);
  assert.equal(two.theoreticalRateMmPerHour, 14.22);
  close(two.nominalFlowLitersPerHour, 10.67, 0.01, 'eau pompée par mètre de planche');
  assert.equal(two.nominalScope, 'per-meter-of-bed');
  const estimated = calculateIrrigationSetting(inputs('drip_per_bed', {
    lineCount: 2, referenceFlowLitersPerHour: 1.6, spacingMeters: 0.3, bedWidthMeters: 0.75, efficiencyPercent: 90,
  }));
  assert.equal(estimated.level, 'estimated', 'dès que l’efficacité n’est pas 100 %, estimé');
  assert.equal(estimated.receivedRateMmPerHour, 12.8);
});

test('vanne de Francis, 30 lignes de 25 m, 1 l/h tous les 33 cm : 2 272,7 l/h ; sans g le mm/h est inconnu ; g 0,5 m : 6,06 mm/h', () => {
  const base = { lineCount: 30, lineLengthMeters: 25, referenceFlowLitersPerHour: 1, spacingMeters: 0.33 };
  const withoutGap = calculateIrrigationSetting(inputs('drip_per_valve', base));
  close(withoutGap.valveFlowLitersPerHour, 2272.7, 0.05, 'débit de la vanne');
  assert.equal(withoutGap.receivedRateMmPerHour, null, 'inconnu, jamais zéro');
  assert.deepEqual(withoutGap.missing, ['lineGapMeters']);
  assert.equal(missingFieldsText(withoutGap.missing), 'Il manque : écartement entre lignes.');
  assert.ok(withoutGap.steps.some((step) => /2\s272,7 l\/h/.test(step) && step.includes('2,27 m³/h')), withoutGap.steps.join('\n'));
  assert.ok(withoutGap.steps.some((step) => step.includes('estimation')), 'le nombre de goutteurs en continu est dit');
  const withGap = known(calculateIrrigationSetting(inputs('drip_per_valve', { ...base, lineGapMeters: 0.5 })));
  assert.equal(withGap.receivedRateMmPerHour, 6.06);
  assert.equal(withGap.level, 'calculated');
});

test('Hadar 7110, 166 l/h, s 2,475 m, w 4 m : 16,77 mm/h', () => {
  const result = known(calculateIrrigationSetting(inputs('sprinkler_mean', {
    referenceFlowLitersPerHour: 166, spacingMeters: 2.475, wettedWidthMeters: 4, efficiencyPercent: 100,
  })));
  assert.equal(result.theoreticalRateMmPerHour, 16.77);
  assert.equal(result.receivedRateMmPerHour, 16.77);
});

test('cône 427, 450 l/h, R 11 m, s 6,4 m : les huit valeurs du contrat à ± 0,01, P(11) = 0', () => {
  const expected: [number, number][] = [[0, 6.10], [1, 5.92], [2, 5.52], [3, 4.98], [4, 4.34], [6, 2.91], [8, 1.47], [10, 0.31]];
  for (const [distance, rate] of expected) close(coneRateAtDistance(450, 11, 6.4, distance), rate, 0.01, `${distance} m`);
  assert.equal(coneRateAtDistance(450, 11, 6.4, 11), 0);
  assert.equal(coneRateAtDistance(450, 11, 6.4, 12), 0);
});

test('cône Hadar, 166 l/h, R 5,3 m, s 2,48 m : les six valeurs du contrat', () => {
  const expected: [number, number][] = [[0, 12.06], [1, 10.83], [2, 8.37], [3, 5.42], [4, 2.51], [5, 0.30]];
  for (const [distance, rate] of expected) close(coneRateAtDistance(166, 5.3, 2.48, distance), rate, 0.01, `${distance} m`);
});

test('conservation : sur toute la portée, chaque cône rend Q ÷ s à 0,5 %', () => {
  close(coneSharePercent(450, 11, 6.4, 22), 100, 0.5, 'cône 427');
  close(coneSharePercent(166, 5.3, 2.48, 10.6), 100, 0.5, 'cône Hadar');
  close(coneSharePercent(450, 11, 6.4, 40), 100, 0.5, 'une bande plus large que le jet ne compte pas deux fois');
});

test('profil en cône : 11 points de 0 à R, identiques des deux côtés, la part sur la planche en information', () => {
  const result = known(calculateIrrigationSetting(inputs('sprinkler_cone', {
    referenceFlowLitersPerHour: 450, spacingMeters: 6.4, reachMeters: 11, bedAndPathWidthMeters: 1.2,
  })));
  assert.equal(result.profile?.length, 11);
  assert.deepEqual(result.profile?.map((point) => point.distanceMeters), [0, 1.1, 2.2, 3.3, 4.4, 5.5, 6.6, 7.7, 8.8, 9.9, 11]);
  assert.equal(result.profile?.[0]?.rateMmPerHour, 6.1);
  assert.equal(result.profile?.at(-1)?.rateMmPerHour, 0);
  assert.equal(result.level, 'estimated');
  assert.equal(result.theoreticalRateMmPerHour, null);
  assert.equal(result.zoneSharePercent, null);
  close(result.bedSharePercent, 10.4, 0.1, 'part d’eau sur 1,2 m : environ 6 mm/h × 1,2 m ÷ (450 ÷ 6,4)');
  const values = calculatorSettingValues(inputs('sprinkler_cone', {
    referenceFlowLitersPerHour: 450, spacingMeters: 6.4, reachMeters: 11,
  }));
  assert.ok(values?.kind === 'sprinkler');
  assert.deepEqual(values.leftProfile, values.rightProfile);
});

test('pression : 450 l/h à 2 bars, x 0,5, à 0,35 bar → 188,2 l/h ; un débit mesuré prime ; x 0 laisse le débit inchangé', () => {
  close(pressureCorrectedFlow(450, 2, 0.35, 0.5), 188.2, 0.05, 'Naan 427 à 0,35 bar');
  const corrected = calculateIrrigationSetting(inputs('sprinkler_cone', {
    referenceFlowLitersPerHour: 450, referencePressureBar: 2, actualPressureBar: 0.35, pressureExponent: 0.5,
    pressureRangeMinBar: 2, pressureRangeMaxBar: 4, spacingMeters: 6.4, reachMeters: 11,
  }));
  assert.equal(corrected.flow?.source, 'pressure');
  close(corrected.flow?.litersPerHour ?? null, 188.2, 0.05, 'débit corrigé');
  assert.ok(corrected.warnings.includes('pressure-out-of-range'), 'hors de 2 à 4 bars : avertissement, rien de refusé');
  assert.notEqual(corrected.profile, null);
  const measured = calculateIrrigationSetting(inputs('sprinkler_cone', {
    measuredFlowLitersPerHour: 191, referenceFlowLitersPerHour: 450, referencePressureBar: 2, actualPressureBar: 0.35,
    spacingMeters: 6.4, reachMeters: 11,
  }));
  assert.deepEqual(measured.flow, { litersPerHour: 191, source: 'measured' });
  const selfRegulating = calculateIrrigationSetting(inputs('drip_per_bed', {
    lineCount: 2, referenceFlowLitersPerHour: 1.6, referencePressureBar: 1, actualPressureBar: 0.8, pressureExponent: 0,
    spacingMeters: 0.3, bedWidthMeters: 0.75,
  }));
  assert.equal(selfRegulating.flow?.litersPerHour, 1.6);
  assert.equal(selfRegulating.receivedRateMmPerHour, 14.22);
  const datasheet = calculateIrrigationSetting(inputs('drip_per_bed', {
    lineCount: 2, referenceFlowLitersPerHour: 1.6, spacingMeters: 0.3, bedWidthMeters: 0.75,
  }));
  assert.equal(datasheet.flow?.source, 'datasheet');
  assert.ok(datasheet.steps[0]?.includes('Débit de la fiche, à la pression de la fiche'));
  const noReferencePressure = calculateIrrigationSetting(inputs('drip_per_bed', {
    lineCount: 2, referenceFlowLitersPerHour: 1.6, actualPressureBar: 0.8, spacingMeters: 0.3, bedWidthMeters: 0.75,
  }));
  assert.deepEqual(noReferencePressure.missing, ['referencePressureBar'], 'une pression réelle sans celle de la fiche ne se corrige pas en silence');
  assert.equal(noReferencePressure.receivedRateMmPerHour, null);
});

test('pas de double compte : η ignorée en cône, appliquée une fois en moyenne ; la couverture rend la valeur enregistrée', () => {
  const cone = (efficiencyPercent: number | null) => calculateIrrigationSetting(inputs('sprinkler_cone', {
    referenceFlowLitersPerHour: 450, spacingMeters: 6.4, reachMeters: 11, efficiencyPercent,
  }));
  assert.deepEqual(cone(50).profile, cone(null).profile, 'en cône, 50 % ne change rien');
  const mean = calculateIrrigationSetting(inputs('sprinkler_mean', {
    referenceFlowLitersPerHour: 30, spacingMeters: 1, wettedWidthMeters: 3, efficiencyPercent: 50,
  }));
  assert.equal(mean.receivedRateMmPerHour, 5, '10 × 50 %, une seule fois');

  const drip = calculatorSettingValues(inputs('drip_per_bed', {
    lineCount: 2, referenceFlowLitersPerHour: 1.6, spacingMeters: 0.3, bedWidthMeters: 0.75,
  }));
  assert.ok(drip?.kind === 'drip');
  const bed: Bed = { id: 'b1', plotId: 'p1', zoneId: 'z1', name: 'B1', length: 20, width: 0.75, alleyWidth: 0.45, area: 15, seasons: [2026] };
  const placement: EquipmentPlacementRecord = {
    id: 'pl', equipmentId: 'e1', settingId: 's1', season: 2026, gardenGroupId: null, otfZoneId: 'z1', otfPlotId: 'p1',
    anchor: { type: 'bed_center', anchorBedOtfId: 'b1' },
    selectedBeds: [{ otfZoneId: 'z1', otfPlotId: 'p1', otfBedId: 'b1' }],
  };
  const equipment = (setting: EquipmentListItem['settings'][number]): EquipmentListItem => ({
    id: 'e1', name: 'Matériel', kind: setting.kind, mobility: 'fixed', status: 'active', settingsCount: 1, archivedAt: null, settings: [setting],
  });
  const dripCoverage = calculateIrrigationCoverage({
    beds: [bed], groups: [], placements: [placement],
    equipment: [equipment({ id: 's1', name: 'Calculé', position: 1, kind: 'drip', rateMmPerHour: drip.rateMmPerHour })],
  });
  assert.equal(dripCoverage.beds[0]?.totalRateMmPerHour, 14.22, 'le moteur rend exactement la valeur enregistrée');

  const coneValues = calculatorSettingValues(inputs('sprinkler_cone', { referenceFlowLitersPerHour: 450, spacingMeters: 6.4, reachMeters: 11 }));
  assert.ok(coneValues?.kind === 'sprinkler');
  const coneCoverage = calculateIrrigationCoverage({
    beds: [bed], groups: [], placements: [placement],
    equipment: [equipment({ id: 's1', name: 'Cône', position: 1, kind: 'sprinkler', leftProfile: [...coneValues.leftProfile], rightProfile: [...coneValues.rightProfile] })],
  });
  assert.equal(coneCoverage.beds[0]?.totalRateMmPerHour, 6.1, 'sur la planche de la rampe, la pointe du cône, sans η');
});

test('données inconnues : un champ manquant rend le résultat nul, jamais zéro, et nomme le champ', () => {
  const result = calculateIrrigationSetting(inputs('drip_per_bed', { lineCount: 2, referenceFlowLitersPerHour: 1.6, spacingMeters: 0.3 }));
  assert.equal(result.receivedRateMmPerHour, null);
  assert.equal(result.theoreticalRateMmPerHour, null);
  assert.deepEqual(result.missing, ['bedWidthMeters']);
  assert.equal(calculatorSettingValues(inputs('drip_per_bed', { lineCount: 2 })), null);
  const noFlow = calculateIrrigationSetting(inputs('sprinkler_cone', { spacingMeters: 6.4, reachMeters: 11 }));
  assert.deepEqual(noFlow.missing, ['referenceFlowLitersPerHour']);
  assert.equal(noFlow.profile, null);
});

test('validation : nombres finis et positifs, entiers d’au moins 1, η de 1 à 100, message par champ', () => {
  assert.equal(fieldError('spacingMeters', 0), 'Espacement : saisissez un nombre plus grand que zéro.');
  assert.equal(fieldError('spacingMeters', Number.NaN), 'Espacement : saisissez un nombre.');
  assert.equal(fieldError('lineCount', 1.5), 'Nombre de lignes : saisissez un nombre entier, au moins 1.');
  assert.equal(fieldError('efficiencyPercent', 0), 'Part d’eau sur la zone : saisissez un pourcentage de 1 à 100.');
  assert.equal(fieldError('efficiencyPercent', 101), 'Part d’eau sur la zone : saisissez un pourcentage de 1 à 100.');
  assert.equal(fieldError('efficiencyPercent', 1), null);
  assert.equal(fieldError('pressureExponent', 0), null);
  assert.equal(fieldError('bedWidthMeters', null), null, 'un champ vide n’est pas une erreur, il manque');
  const refused = calculateIrrigationSetting(inputs('drip_per_bed', {
    lineCount: 2, referenceFlowLitersPerHour: -1, spacingMeters: 0.3, bedWidthMeters: 0.75,
  }));
  assert.deepEqual(refused.errors.map((error) => error.field), ['referenceFlowLitersPerHour']);
  assert.equal(refused.receivedRateMmPerHour, null);
});

test('avertissements : jet plus large que la bande, s > R, plus de 100 mm/h ; rien n’est refusé', () => {
  const band = calculateIrrigationSetting(inputs('sprinkler_mean', {
    referenceFlowLitersPerHour: 450, spacingMeters: 6.4, wettedWidthMeters: 0.5, reachMeters: 11, efficiencyPercent: 100,
  }));
  assert.ok(band.warnings.includes('jet-wider-than-band'));
  assert.ok(band.warnings.includes('rate-above-plausible'), `${band.receivedRateMmPerHour} mm/h`);
  assert.notEqual(band.receivedRateMmPerHour, null, 'avertissement, pas refus');
  const spaced = calculateIrrigationSetting(inputs('sprinkler_cone', {
    referenceFlowLitersPerHour: 166, spacingMeters: 6, reachMeters: 5.3,
  }));
  assert.ok(spaced.warnings.includes('spacing-beyond-reach'));
  assert.notEqual(spaced.profile, null);
});

test('les quatre exemples sourcés préremplissent des champs seulement, avec source, date et réserve', () => {
  assert.deepEqual(CALCULATOR_EXAMPLES.map((example) => example.id), [
    'naandanjain-427-orange-2-8', 'naandanjain-hadar-7110-1-8', 'naandanjain-amnondrip-pc-as-16', 'netafim-supernet-sr-30',
  ]);
  for (const example of CALCULATOR_EXAMPLES) {
    assert.ok(example.source.length > 10 && example.reserve.length > 10, example.id);
    assert.match(example.readOn, /^\d{4}-\d{2}-\d{2}$/);
  }
  assert.deepEqual(examplesForKind('drip').map((example) => example.id), ['naandanjain-amnondrip-pc-as-16']);
  const filled = applyExample(inputs('drip_per_bed', { lineCount: 2, bedWidthMeters: 0.75, pressureRangeMaxBar: 9 }), examplesForKind('drip')[0]!);
  assert.equal(filled.lineCount, 2, 'ce que l’utilisateur avait saisi reste');
  assert.equal(filled.pressureRangeMaxBar, 3.5, 'la plage de l’exemple remplace l’ancienne');
  assert.equal(calculateIrrigationSetting(filled).receivedRateMmPerHour, 14.22);
  const supernet = CALCULATOR_EXAMPLES.find((example) => example.id === 'netafim-supernet-sr-30')!;
  assert.equal(calculateIrrigationSetting(applyExample(emptyCalculatorInputs('sprinkler_mean'), supernet)).receivedRateMmPerHour, 6.4);
});

const drip = (rateMmPerHour: number): SettingValues => ({ kind: 'drip', rateMmPerHour });
const amnon = inputs('drip_per_bed', { lineCount: 2, referenceFlowLitersPerHour: 1.6, spacingMeters: 0.3, bedWidthMeters: 0.75 });

test('provenance : un calcul dont le résultat est la valeur enregistrée s’écrit ; « mesuré » est un geste ; retoucher efface', () => {
  const written = decideProvenance({ submitted: { calculation: amnon, measured: false }, values: drip(14.22), previous: null });
  assert.ok(written.kind === 'write' && written.provenance.level === 'calculated');
  assert.equal(written.provenance.theoreticalRateMmPerHour, 14.22);
  assert.equal(written.provenance.zoneSharePercent, 100);

  assert.deepEqual(decideProvenance({ submitted: { calculation: amnon, measured: false }, values: drip(14), previous: null }), { kind: 'keep' },
    'une valeur retouchée après « Utiliser ce résultat » n’est pas « calculée »');
  const calculated = written.provenance;
  assert.deepEqual(decideProvenance({ submitted: { calculation: null, measured: false }, values: drip(8), previous: { provenance: calculated, values: drip(14.22) } }), { kind: 'delete' });
  assert.deepEqual(decideProvenance({ submitted: { calculation: null, measured: false }, values: drip(14.22), previous: { provenance: calculated, values: drip(14.22) } }), { kind: 'keep' },
    'un nom changé ne rend pas le calcul faux');
  const measured = decideProvenance({ submitted: { calculation: null, measured: true }, values: drip(8), previous: null });
  assert.ok(measured.kind === 'write' && measured.provenance.level === 'measured');
  assert.deepEqual(decideProvenance({ submitted: { calculation: null, measured: false }, values: drip(8), previous: { provenance: measured.provenance, values: drip(8) } }), { kind: 'delete' },
    'la case décochée rend le réglage « saisi »');
  assert.deepEqual(decideProvenance({ submitted: { calculation: null, measured: null }, values: drip(8), previous: { provenance: measured.provenance, values: drip(8) } }), { kind: 'keep' },
    'calculateur décoché, la case n’est pas montrée : « mesuré » reste tant que les valeurs ne changent pas');
  assert.deepEqual(decideProvenance({ submitted: { calculation: null, measured: null }, values: drip(9), previous: { provenance: measured.provenance, values: drip(8) } }), { kind: 'delete' });
  assert.deepEqual(decideProvenance({ submitted: { calculation: { method: 'inconnue' }, measured: false }, values: drip(14.22), previous: null }), { kind: 'keep' });
  assert.equal(settingLabelOf(null), 'entered', 'un réglage sans provenance est « saisi », jamais deviné');
});

test('inputs_json : les entrées et la version des formules, relues sans rien deviner', () => {
  const json = serializeCalculatorInputs(amnon);
  assert.equal(JSON.parse(json).formulaVersion, 1);
  assert.deepEqual(deserializeCalculatorInputs(json), amnon);
  assert.equal(deserializeCalculatorInputs('pas du json'), null);
  assert.equal(deserializeCalculatorInputs(null), null);
  const odd = parseCalculatorInputs({ method: 'drip_per_bed', lineCount: '2' });
  assert.ok(odd && Number.isNaN(odd.lineCount), 'un texte n’est pas lu comme un nombre');
});
