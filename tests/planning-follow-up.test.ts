import assert from 'node:assert/strict';
import test from 'node:test';
import type { PlanChanges } from '../lib/domain/planning/changes.ts';
import type { PlanSuggestionCause, StoredPlanSuggestion } from '../lib/domain/planning/contract.ts';
import { latenessLabel, planChangesLines, planChangesTitle, splitSuggestions, suggestionCauseLabel, suggestionLabel } from '../lib/domain/planning/follow-up.ts';
import { validatedIrrigation } from './support/planning-fixtures.ts';

/**
 * La présentation du suivi (3.7, docs/replanning-contract.md, « L'écran ») :
 * les libellés des suggestions et de leurs raisons, le signal du retard, les
 * lignes du pli « Ce qui a changé ». Les composants n'ont qu'à les afficher.
 */

const format = {
  dateTime: (iso: string) => `[${iso}]`,
  time: (iso: string) => `(${iso.slice(11, 16)})`,
  day: (dateKey: string) => `<${dateKey}>`,
};

function suggestion(overrides: Partial<StoredPlanSuggestion>): StoredPlanSuggestion {
  return {
    eventId: 'event-1', eventEquipmentId: 'ee-1', equipmentId: 'asp1', equipmentName: 'Rampe bloc 2', kind: 'sprinkler', priority: 'normal',
    plannedStartAt: '2026-09-30T06:00:00.000Z', plannedEndAt: '2026-09-30T08:00:00.000Z', plannedDurationSeconds: 7200, plannedDoseMm: 12,
    suggestion: 'cancel', doseMm: null, durationSeconds: null, endAt: null, causes: [], kept: false,
    ...overrides,
  };
}

test('« Annuler » ou « Réduire à X mm », la dose au dixième', () => {
  assert.equal(suggestionLabel(suggestion({})), 'Annuler');
  assert.equal(suggestionLabel(suggestion({ suggestion: 'reduce', doseMm: 7.52 })), 'Réduire à 7,5 mm');
  assert.equal(suggestionLabel(suggestion({ suggestion: 'reduce', doseMm: 8 })), 'Réduire à 8 mm');
});

test('chaque raison dit sur quoi elle repose : les termes du besoin, le matériel et la date du retrait, la limite et ce que le jour porte', () => {
  const usefulDose: PlanSuggestionCause = {
    kind: 'useful-dose', bedId: 'b1', bedName: 'B2-1', objectiveMm: 10, manual: false, actualRainMm: 8, forecastRainMm: 0, actualIrrigationMm: 0,
    earlierPlannedMm: 0, needBeforeMm: 2, usefulMm: 2, plannedMm: 10, minimumMm: 3, lastDay: false,
  };
  assert.equal(
    suggestionCauseLabel(usefulDose, format),
    'B2-1 : objectif 10 mm, pluie au pluviomètre 8 mm ; besoin utile 2 mm pour 10 mm prévus, sous la dose minimale de 3 mm',
  );
  assert.equal(
    suggestionCauseLabel({ ...usefulDose, manual: true, actualRainMm: 0, forecastRainMm: 1.5, actualIrrigationMm: 2, earlierPlannedMm: 3, usefulMm: 4, lastDay: true }, format),
    'B2-1 : besoin posé à la main 10 mm, pluie prévue comptée 1,5 mm, déjà arrosé 2 mm, arrosages validés avant celui-ci 3 mm ; besoin utile 4 mm pour 10 mm prévus',
  );
  assert.equal(
    suggestionCauseLabel({ ...usefulDose, usefulMm: 0, lastDay: true }, format),
    'B2-1 : objectif 10 mm, pluie au pluviomètre 8 mm ; besoin utile 0 mm pour 10 mm prévus, sous la dose minimale de 3 mm (dernier jour de la semaine)',
  );
  assert.equal(suggestionCauseLabel({ kind: 'equipment-stored', equipmentName: 'Rampe bloc 2', removedAt: '2026-09-29T15:00:00.000Z' }, format), 'Rampe bloc 2 stocké depuis le [2026-09-29T15:00:00.000Z] : l’irrigation ne peut pas démarrer');
  assert.equal(suggestionCauseLabel({ kind: 'equipment-moved', equipmentName: 'Rampe bloc 2' }, format), 'Rampe bloc 2 reposé ailleurs : l’irrigation ne peut pas démarrer');
  assert.equal(suggestionCauseLabel({ kind: 'daily-limit', date: '2026-09-30', limitCubicMeters: 3, committedCubicMeters: 5.775 }, format), 'limite journalière du <2026-09-30> : 3,00 m³ pour 5,78 m³ engagés');
  assert.equal(suggestionCauseLabel({ kind: 'volume-unknown', date: '2026-09-30' }, format), 'volume invérifiable le <2026-09-30> sous une limite journalière');
});

test('les suggestions gardées se replient à part', () => {
  const kept = suggestion({ eventEquipmentId: 'ee-2', kept: true });
  const active = suggestion({});
  assert.deepEqual(splitSuggestions([kept, active]), { active: [active], kept: [kept] });
});

test('le signal du retard : rien avant la tolérance, « En retard » ensuite avec le délai, « Non faite » le créneau passé', () => {
  const start = '2026-09-29T19:00:00.000Z';
  const event = validatedIrrigation('irrigation-1', 'rampe-bloc-2', start, 8100, ['B2-1'], { kind: 'sprinkler' });
  const at = (minutes: number) => new Date(Date.parse(start) + minutes * 60_000);
  assert.equal(latenessLabel(event, 30, at(29)), null);
  assert.match(latenessLabel(event, 30, at(35)) ?? '', /^En retard : non démarrée 35 min après l’heure prévue\./u);
  assert.match(latenessLabel(event, 30, at(125)) ?? '', /^En retard : non démarrée 2 h 05 après l’heure prévue\./u);
  assert.match(latenessLabel(event, 30, at(120)) ?? '', /2 h après/u);
  assert.match(latenessLabel(event, 30, at(135)) ?? '', /^Non faite : le créneau est passé sans démarrage\./u);
  assert.equal(latenessLabel({ ...event, equipment: { ...event.equipment, timerState: 'running' } }, 30, at(35)), null, 'démarrée : plus de retard');
});

test('le pli « Ce qui a changé » : une ligne par proposition, suggestion, planche entrée ou sortie, et l’écart du manque d’eau ; rien quand rien n’a changé', () => {
  const slot = (startAt: string, endAt: string, doseMm: number) => ({ startAt, endAt, doseMm, bedNames: ['B2-1'] });
  const changes: PlanChanges = {
    previousCalculationId: 'calc-0',
    previousComputedAt: '2026-09-30T04:15:00.000Z',
    proposals: [
      { change: 'appeared', equipmentId: 'asp1', equipmentName: 'Rampe', settingName: 'R1', before: null, after: slot('2026-10-01T06:00:00.000Z', '2026-10-01T08:00:00.000Z', 12), proposalId: 'P1' },
      { change: 'removed', equipmentId: 'asp1', equipmentName: 'Rampe', settingName: 'R1', before: slot('2026-10-02T06:00:00.000Z', '2026-10-02T08:00:00.000Z', 12), after: null, proposalId: null },
      { change: 'moved', equipmentId: 'gag1', equipmentName: 'Goutte', settingName: 'G1', before: slot('2026-10-01T10:00:00.000Z', '2026-10-01T11:00:00.000Z', 6), after: slot('2026-10-01T14:00:00.000Z', '2026-10-01T15:00:00.000Z', 6), proposalId: 'P2' },
      { change: 'dose-changed', equipmentId: 'gag1', equipmentName: 'Goutte', settingName: 'G1', before: slot('2026-10-03T10:00:00.000Z', '2026-10-03T11:00:00.000Z', 6), after: slot('2026-10-03T10:00:00.000Z', '2026-10-03T10:40:00.000Z', 4), proposalId: 'P3' },
      { change: 'moved-and-dose-changed', equipmentId: 'gag1', equipmentName: 'Goutte', settingName: 'G1', before: slot('2026-10-04T10:00:00.000Z', '2026-10-04T11:00:00.000Z', 6), after: slot('2026-10-04T16:00:00.000Z', '2026-10-04T16:40:00.000Z', 4), proposalId: 'P4' },
    ],
    newSuggestions: [{ eventId: 'e1', eventEquipmentId: 'ee-1', equipmentName: 'Rampe bloc 2', plannedStartAt: '2026-09-30T06:00:00.000Z', suggestion: 'reduce', doseMm: 8 }],
    bedsNowUnplaced: [{ bedId: 'b1', bedName: 'B2-1', plotName: 'Bloc 2', priority: 'normal', deficitMm: 5.25, reasons: ['water-budget'] }],
    bedsNowPlaced: [{ bedId: 'b2', bedName: 'B2-2', plotName: 'Bloc 2', priority: 'normal', deficitMm: 0, reasons: [] }],
    waterDeficitBeforeCubicMeters: 3.2,
    waterDeficitAfterCubicMeters: 1.05,
  };
  assert.equal(planChangesTitle(changes, format), 'Ce qui a changé depuis le calcul du [2026-09-30T04:15:00.000Z]');
  assert.deepEqual(planChangesLines(changes, format).map((line) => [line.kind, line.text]), [
    ['proposal', 'Proposition apparue : Rampe · R1, [2026-10-01T06:00:00.000Z] → (08:00), 12 mm'],
    ['proposal', 'Proposition retirée : Rampe · R1, [2026-10-02T06:00:00.000Z] → (08:00), 12 mm'],
    ['proposal', 'Proposition déplacée : Goutte · G1, de [2026-10-01T10:00:00.000Z] → (11:00), 6 mm à [2026-10-01T14:00:00.000Z] → (15:00), 6 mm'],
    ['proposal', 'Dose changée : Goutte · G1, [2026-10-03T10:00:00.000Z], de 6 à 4 mm'],
    ['proposal', 'Proposition déplacée et dose changée : Goutte · G1, de [2026-10-04T10:00:00.000Z] → (11:00), 6 mm à [2026-10-04T16:00:00.000Z] → (16:40), 4 mm'],
    ['suggestion', 'Suggestion nouvelle : réduire à 8 mm Rampe bloc 2, [2026-09-30T06:00:00.000Z]'],
    ['unplaced', 'Désormais non servie : B2-1 (Bloc 2), manque 5,3 mm'],
    ['placed', 'De nouveau servie : B2-2 (Bloc 2)'],
    ['deficit', 'Manque d’eau : de 3,20 à 1,05 m³ (−2,15 m³)'],
  ]);
  assert.deepEqual(planChangesLines({ ...changes, proposals: [], newSuggestions: [], bedsNowUnplaced: [], bedsNowPlaced: [], waterDeficitAfterCubicMeters: 3.201 }, format), []);
});
