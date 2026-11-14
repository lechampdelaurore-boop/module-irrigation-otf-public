import assert from 'node:assert/strict';
import test from 'node:test';
import { isIrrigationSnapshot } from '../lib/domain/snapshot-validation.ts';

const validSnapshot = {
  configuration: { seasonFirst: 2026, seasonLast: 2026 },
  structure: { id: '17', name: 'Ferme', legalCity: 'Rennes', legalPostcode: '35000', legalCountry: 'FR' },
  zones: [{ id: '14', name: 'Clémentière', area: 10309, seasons: [2026] }],
  plots: [],
  beds: [],
  source: 'live',
  lastSuccessfulReadAt: '2026-08-27T05:46:58.000Z',
};

test('un instantané avec une surface de parcelle valide est accepté', () => {
  assert.equal(isIrrigationSnapshot(validSnapshot), true);
  assert.equal(
    isIrrigationSnapshot({
      ...validSnapshot,
      zones: [{ id: '14', name: 'Clémentière', area: null, seasons: [2026] }],
    }),
    true,
  );
});

test("un ancien cache sans surface de parcelle est rejeté", () => {
  assert.equal(
    isIrrigationSnapshot({
      ...validSnapshot,
      zones: [{ id: '14', name: 'Clémentière', seasons: [2026] }],
    }),
    false,
  );
});

const cropPlan = {
  series: [{ id: 'serie-1', name: 'Aillet', season: 2026, use: 'bed', cycle: 'annual', cultivations: [] }],
  places: [{ id: 'place-1', seriesId: 'serie-1', bedId: 'bed-1', lengthMeters: 32 }],
  implantationTasks: [{ id: 'tache-1', seriesId: 'serie-1', cultivationId: null, kind: 'direct-sowing', plannedWeek: '2025-W45', doneWeek: '2025-W45', status: 'done' }],
  readSummary: { seriesRead: 1, placesRead: 1, tasksRead: 1, tasksRetained: 1, placesWithoutSeries: 0, placesOfUnknownSeries: 0, placesWithUnknownBed: 0 },
};

test('un cache sans plan de culture reste valide, un plan de culture présent doit être entier', () => {
  assert.equal(isIrrigationSnapshot(validSnapshot), true, 'absent : plan non lu, instantané valide');
  assert.equal(isIrrigationSnapshot({ ...validSnapshot, cropPlan }), true);
  assert.equal(isIrrigationSnapshot({ ...validSnapshot, cropPlan: { ...cropPlan, readSummary: undefined } }), false);
  assert.equal(isIrrigationSnapshot({ ...validSnapshot, cropPlan: { ...cropPlan, places: [{ id: 'place-1' }] } }), false, 'un emplacement sans série ni planche');
  assert.equal(isIrrigationSnapshot({ ...validSnapshot, cropPlan: { ...cropPlan, series: [{ id: 'serie-1' }] } }), false, 'une série sans mises en culture');
  assert.equal(isIrrigationSnapshot({ ...validSnapshot, cropPlan: null }), false);
});

const outline = [{
  exterior: [[2.4, 47], [2.401, 47], [2.401, 47.001], [2.4, 47.001], [2.4, 47]],
  holes: [],
}];
const plot = { id: '21', zoneId: '14', name: 'Jardin', mode: 'garden', length: 30, width: 10, area: 300, seasons: [2026] };

test('F202 : un ancien cache sans contour reste valide ; un contour rangé est accepté sur la parcelle et le jardin', () => {
  assert.equal(isIrrigationSnapshot({ ...validSnapshot, plots: [plot] }), true, 'cache antérieur à S3 : contour absent');
  const withOutlines = {
    ...validSnapshot,
    zones: [{ ...validSnapshot.zones[0], outline }],
    plots: [{ ...plot, outline }],
  };
  assert.equal(isIrrigationSnapshot(withOutlines), true);
  assert.equal(isIrrigationSnapshot(JSON.parse(JSON.stringify(withOutlines))), true, 'relu du cache');
});

test('F202 : un contour présent mais abîmé fait écarter le cache, comme un plan de culture abîmé', () => {
  const broken = [
    null,
    [],
    'carré',
    [{ exterior: [[2.4, 47], [2.401, 47], [2.4, 47]], holes: [] }],
    [{ exterior: outline[0].exterior }],
    [{ exterior: outline[0].exterior, holes: [[[2.4, 47]]] }],
    [{ exterior: [[2.4, 47], [2.401, 47], [2.401, null], [2.4, 47.001], [2.4, 47]], holes: [] }],
    outline[0].exterior,
  ];
  for (const value of broken) {
    assert.equal(isIrrigationSnapshot({ ...validSnapshot, zones: [{ ...validSnapshot.zones[0], outline: value }] }), false, `parcelle ${JSON.stringify(value)}`);
    assert.equal(isIrrigationSnapshot({ ...validSnapshot, plots: [{ ...plot, outline: value }] }), false, `jardin ${JSON.stringify(value)}`);
  }
});
