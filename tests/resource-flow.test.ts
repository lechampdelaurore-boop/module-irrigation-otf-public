import assert from 'node:assert/strict';
import test from 'node:test';
import {
  NOTABLE_FLOW_CHANGE_RATIO,
  authorisedEnvelope,
  flowReferenceChange,
  measureResourceFlow,
  resourceConsumptionByMonth,
  resourceFlowSeries,
  validateMeterReading,
  type MeterReadingDraft,
  type ResourceMeterReading,
} from '../lib/domain/resource-flow.ts';

const NOW = new Date('2026-09-22T12:00:00.000Z');

function reading(overrides: Partial<ResourceMeterReading> & { id: string; takenAt: string; meterIndexCubicMeters: number }): ResourceMeterReading {
  return { stoppedSeconds: null, meterReplaced: false, ...overrides };
}

function draft(overrides: Partial<MeterReadingDraft> = {}): MeterReadingDraft {
  return {
    takenAt: '2026-09-22T06:00:00.000Z',
    meterIndexCubicMeters: 1_249,
    stoppedSeconds: 16 * 60 * 60,
    meterReplaced: false,
    ...overrides,
  };
}

// L'exemple du cahier des charges, repris tel quel par le contrat.
const LUNDI = reading({ id: 'lundi', takenAt: '2026-09-21T06:00:00.000Z', meterIndexCubicMeters: 1_240 });
const MARDI = reading({
  id: 'mardi',
  takenAt: '2026-09-22T06:00:00.000Z',
  meterIndexCubicMeters: 1_249,
  stoppedSeconds: 16 * 60 * 60,
});

test('le forage du cahier des charges : 9 m³ en 8 heures de marche donnent 1,125 m³/h', () => {
  const measurement = measureResourceFlow(LUNDI, MARDI);

  assert.ok(measurement);
  assert.equal(measurement.producedCubicMeters, 9);
  assert.equal(measurement.elapsedSeconds, 24 * 60 * 60);
  assert.equal(measurement.runningSeconds, 8 * 60 * 60);
  assert.equal(measurement.runningFlowCubicMetersPerHour, 1.125);
  // Le débit moyen sur la période inclut les arrêts : il ferait paraître le
  // forage trois fois plus faible qu'il n'est.
  assert.equal(measurement.averageFlowCubicMetersPerHour, 0.375);
});

test('sans arrêt, les deux débits se confondent', () => {
  const measurement = measureResourceFlow(
    LUNDI,
    reading({ id: 'continu', takenAt: '2026-09-21T14:00:00.000Z', meterIndexCubicMeters: 1_249, stoppedSeconds: 0 }),
  );

  assert.ok(measurement);
  assert.equal(measurement.runningFlowCubicMetersPerHour, 1.125);
  assert.equal(measurement.averageFlowCubicMetersPerHour, 1.125);
});

test('une pompe restée à l’arrêt ne donne aucun débit en fonctionnement, et non zéro', () => {
  const measurement = measureResourceFlow(
    LUNDI,
    reading({ id: 'arret', takenAt: '2026-09-22T06:00:00.000Z', meterIndexCubicMeters: 1_240, stoppedSeconds: 24 * 60 * 60 }),
  );

  assert.ok(measurement);
  assert.equal(measurement.producedCubicMeters, 0);
  assert.equal(measurement.runningSeconds, 0);
  assert.equal(measurement.runningFlowCubicMetersPerHour, null, 'aucun chiffre inventé');
  assert.equal(measurement.averageFlowCubicMetersPerHour, 0);
});

test('une pompe qui tourne sans rien produire donne un débit nul, qui est une information', () => {
  const measurement = measureResourceFlow(
    LUNDI,
    reading({ id: 'sec', takenAt: '2026-09-22T06:00:00.000Z', meterIndexCubicMeters: 1_240, stoppedSeconds: 0 }),
  );

  assert.ok(measurement);
  assert.equal(measurement.runningFlowCubicMetersPerHour, 0);
});

test('un compteur remplacé coupe la chaîne : aucun débit entre les deux relevés', () => {
  const measurement = measureResourceFlow(
    MARDI,
    reading({ id: 'neuf', takenAt: '2026-09-23T06:00:00.000Z', meterIndexCubicMeters: 0, stoppedSeconds: 0, meterReplaced: true }),
  );

  assert.equal(measurement, null);
});

test('la série suit l’ordre des dates, pas celui de la saisie, et saute les coupures', () => {
  const neuf = reading({ id: 'neuf', takenAt: '2026-09-23T06:00:00.000Z', meterIndexCubicMeters: 0, stoppedSeconds: 0, meterReplaced: true });
  const apres = reading({ id: 'apres', takenAt: '2026-09-24T06:00:00.000Z', meterIndexCubicMeters: 12, stoppedSeconds: 12 * 60 * 60 });

  const series = resourceFlowSeries([apres, LUNDI, neuf, MARDI]);

  assert.deepEqual(series.map((item) => item.toReadingId), ['mardi', 'apres']);
  assert.equal(series[1].runningFlowCubicMetersPerHour, 1);
});

test('un seul relevé ne donne aucune mesure', () => {
  assert.deepEqual(resourceFlowSeries([LUNDI]), []);
  assert.deepEqual(resourceFlowSeries([]), []);
});

test('les saisies impossibles sont refusées, chacune avec sa raison', () => {
  const cases: Array<[string, MeterReadingRejectionCase]> = [
    ['invalid_date', { draft: draft({ takenAt: 'pas une date' }), previous: LUNDI }],
    ['future_date', { draft: draft({ takenAt: '2026-09-23T06:00:00.000Z' }), previous: LUNDI }],
    ['invalid_index', { draft: draft({ meterIndexCubicMeters: Number.NaN }), previous: LUNDI }],
    ['negative_index', { draft: draft({ meterIndexCubicMeters: -1 }), previous: LUNDI }],
    ['invalid_stopped', { draft: draft({ stoppedSeconds: Number.NaN }), previous: LUNDI }],
    ['negative_stopped', { draft: draft({ stoppedSeconds: -1 }), previous: LUNDI }],
    ['duplicate_instant', { draft: draft({ takenAt: LUNDI.takenAt }), previous: LUNDI }],
    ['index_went_backwards', { draft: draft({ meterIndexCubicMeters: 1_239 }), previous: LUNDI }],
    ['stopped_exceeds_elapsed', { draft: draft({ stoppedSeconds: 25 * 60 * 60 }), previous: LUNDI }],
    ['production_without_running_time', { draft: draft({ stoppedSeconds: 24 * 60 * 60 }), previous: LUNDI }],
  ];

  for (const [expected, scenario] of cases) {
    assert.equal(
      validateMeterReading(scenario.draft, { previous: scenario.previous }, NOW),
      expected,
      `cas ${expected}`,
    );
  }
});

type MeterReadingRejectionCase = { draft: MeterReadingDraft; previous: ResourceMeterReading | null };

test('un index qui recule passe quand le relevé déclare un compteur remplacé', () => {
  assert.equal(
    validateMeterReading(draft({ meterIndexCubicMeters: 0, stoppedSeconds: 0, meterReplaced: true }), { previous: LUNDI }, NOW),
    null,
  );
});

test('le premier relevé d’une ressource n’a rien à respecter que lui-même', () => {
  assert.equal(validateMeterReading(draft(), {}, NOW), null);
  assert.equal(validateMeterReading(draft({ meterIndexCubicMeters: -1 }), {}, NOW), 'negative_index');
});

test('un relevé rattrapé après coup est vérifié des deux côtés', () => {
  const apres = reading({
    id: 'apres',
    takenAt: '2026-09-22T06:00:00.000Z',
    meterIndexCubicMeters: 1_249,
    stoppedSeconds: 16 * 60 * 60,
  });
  // Six heures après le lundi : il reste dix-huit heures avant le relevé
  // suivant, dont les seize heures d'arrêt tiennent encore.
  const intercale = draft({ takenAt: '2026-09-21T12:00:00.000Z', meterIndexCubicMeters: 1_245, stoppedSeconds: 2 * 60 * 60 });

  assert.equal(validateMeterReading(intercale, { previous: LUNDI, next: apres }, NOW), null);

  // Placé plus tard, le même relevé raccourcit l'intervalle du suivant au
  // point que ses seize heures d'arrêt n'y tiennent plus, alors qu'elles
  // tenaient dans les vingt-quatre heures d'origine.
  assert.equal(
    validateMeterReading(draft({ takenAt: '2026-09-22T00:00:00.000Z', meterIndexCubicMeters: 1_245, stoppedSeconds: 0 }), { previous: LUNDI, next: apres }, NOW),
    'stopped_exceeds_elapsed',
  );

  // Et un index intercalé supérieur au suivant ferait reculer le compteur.
  assert.equal(
    validateMeterReading(draft({ takenAt: '2026-09-21T12:00:00.000Z', meterIndexCubicMeters: 1_260, stoppedSeconds: 0 }), { previous: LUNDI, next: apres }, NOW),
    'index_went_backwards',
  );
});

test('le changement de référence dit ce que la mise à jour ferait', () => {
  const measurement = measureResourceFlow(LUNDI, MARDI)!;

  const faible = flowReferenceChange(measurement, 1.25);
  assert.ok(faible);
  assert.equal(faible.fromCubicMetersPerHour, 1.25);
  assert.equal(faible.toCubicMetersPerHour, 1.125);
  assert.equal(faible.ratio, -0.1);
  assert.equal(faible.notable, false, 'dix pour cent ne méritent pas la mise en évidence');

  const fort = flowReferenceChange(measurement, 2);
  assert.ok(fort);
  assert.equal(fort.notable, true);
  assert.ok(Math.abs(fort.ratio) >= NOTABLE_FLOW_CHANGE_RATIO);
});

test('sans débit en fonctionnement, il n’y a rien à appliquer', () => {
  const immobile = measureResourceFlow(
    LUNDI,
    reading({ id: 'arret', takenAt: '2026-09-22T06:00:00.000Z', meterIndexCubicMeters: 1_240, stoppedSeconds: 24 * 60 * 60 }),
  )!;

  assert.equal(flowReferenceChange(immobile, 1.25), null);
});

test('une référence absente ou nulle rend le changement notable sans le refuser', () => {
  const measurement = measureResourceFlow(LUNDI, MARDI)!;
  const change = flowReferenceChange(measurement, 0);

  assert.ok(change);
  assert.equal(change.toCubicMetersPerHour, 1.125);
  assert.equal(change.notable, true);
});

test('les consommations se cumulent par mois, au mois du relevé d’arrivée', () => {
  const series = resourceFlowSeries([
    reading({ id: 'a', takenAt: '2026-08-30T06:00:00.000Z', meterIndexCubicMeters: 1_000 }),
    reading({ id: 'b', takenAt: '2026-08-31T06:00:00.000Z', meterIndexCubicMeters: 1_012, stoppedSeconds: 0 }),
    // Cette mesure chevauche deux mois : elle est rattachée à septembre, mois
    // de son relevé d'arrivée, sans répartition au prorata.
    reading({ id: 'c', takenAt: '2026-09-02T06:00:00.000Z', meterIndexCubicMeters: 1_030, stoppedSeconds: 0 }),
    reading({ id: 'd', takenAt: '2026-09-20T06:00:00.000Z', meterIndexCubicMeters: 1_100, stoppedSeconds: 0 }),
  ]);

  const periods = resourceConsumptionByMonth(series);

  assert.deepEqual(periods.map((item) => item.month), ['2026-08', '2026-09']);
  assert.equal(periods[0].producedCubicMeters, 12);
  assert.equal(periods[0].measurementCount, 1);
  assert.equal(periods[0].days, 31);
  assert.equal(periods[1].producedCubicMeters, 88, '18 puis 70 mètres cubes');
  assert.equal(periods[1].measurementCount, 2);
  assert.equal(periods[1].days, 30);
});

test('sans mesure, il n’y a aucune période à afficher', () => {
  assert.deepEqual(resourceConsumptionByMonth([]), []);
});

test('l’enveloppe autorisée vaut la limite journalière multipliée par les jours du mois', () => {
  const [septembre] = resourceConsumptionByMonth(resourceFlowSeries([
    reading({ id: 'a', takenAt: '2026-09-01T06:00:00.000Z', meterIndexCubicMeters: 0 }),
    reading({ id: 'b', takenAt: '2026-09-20T06:00:00.000Z', meterIndexCubicMeters: 150, stoppedSeconds: 0 }),
  ]));

  const enveloppe = authorisedEnvelope(septembre, 10);
  assert.ok(enveloppe);
  assert.equal(enveloppe.allowedCubicMeters, 300, 'dix mètres cubes par jour sur trente jours');
  assert.equal(enveloppe.usedRatio, 0.5);
});

test('sans limite active, il n’y a pas d’enveloppe à comparer', () => {
  const [mois] = resourceConsumptionByMonth(resourceFlowSeries([
    reading({ id: 'a', takenAt: '2026-09-01T06:00:00.000Z', meterIndexCubicMeters: 0 }),
    reading({ id: 'b', takenAt: '2026-09-20T06:00:00.000Z', meterIndexCubicMeters: 150, stoppedSeconds: 0 }),
  ]));

  assert.equal(authorisedEnvelope(mois, null), null);
  assert.equal(authorisedEnvelope(mois, 0), null, 'une limite nulle ne se compare pas');
});
