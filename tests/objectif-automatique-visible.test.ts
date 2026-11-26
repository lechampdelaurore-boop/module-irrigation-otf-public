import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import type { AutomaticObjectiveInput, AutomaticObjectiveSettingRevision } from '../lib/domain/automatic-objective.ts';
import type { Et0Reading } from '../lib/domain/crop-water/etm.ts';
import { farmObjective } from '../lib/domain/farm-objective.ts';
import type { GoalRevisionLike } from '../lib/domain/irrigation-history/contract.ts';
import { objectiveForBed } from '../lib/domain/irrigation-needs.ts';
import {
  automaticObjectiveEnableText,
  automaticObjectiveLines,
  automaticObjectiveResultText,
  objectiveInForce,
  type ObjectiveBedReading,
} from '../lib/domain/objective-reading.ts';

/**
 * L'objectif automatique se voit et se modifie (6 quaterdecies, PR A1,
 * docs/objectif-automatique-saison-contract.md, section 3 ; D-337) : les
 * lignes « automatique » du volet, la valeur en vigueur du champ, la phrase
 * de résultat et la fenêtre d'allumage. Affichage seul : les valeurs sont
 * celles d'`objectiveForBed`, les moyennes celles de `farmObjective`.
 * Semaine du lundi 15 au dimanche 21 juin 2026, ET0 4,0 · 4,2 · 3,8 · 4,5 ·
 * 5,0 · 4,6 · 3,9 mm, soit 30,0 mm (section 5 du contrat).
 */

const WEEK = ['2026-06-15', '2026-06-16', '2026-06-17', '2026-06-18', '2026-06-19', '2026-06-20', '2026-06-21'];
const [MONDAY, , , , , , SUNDAY] = WEEK;
const ET0 = [4.0, 4.2, 3.8, 4.5, 5.0, 4.6, 3.9];
const NEXT_MONDAY = '2026-06-22';
const ON_BEFORE: AutomaticObjectiveSettingRevision = { enabled: true, createdAt: '2026-06-01T07:00:00.000Z' };
const reanalysis = (values: readonly (number | null)[] = ET0): Et0Reading[] => WEEK.map((date, index) => ({ date, reanalysisMm: values[index], forecastMm: null }));

function automatic(overrides: Partial<AutomaticObjectiveInput> = {}): AutomaticObjectiveInput {
  return { settings: [ON_BEFORE], today: NEXT_MONDAY, et0Readings: reanalysis(), plotMode: 'garden', shelterFactors: [], cropNeed: { status: 'off' }, ...overrides };
}

type Place = { bedId: string; bedName: string; plotId: string; plotName: string; zoneId: string; areaSquareMeters: number };

const NORD = { plotId: 'nord', plotName: 'Jardin Nord', zoneId: 'parcelle' };
const SUD = { plotId: 'sud', plotName: 'Jardin Sud', zoneId: 'parcelle' };
const SERRE = { plotId: 'serre', plotName: 'Serre', zoneId: 'parcelle' };

function goal(place: Place | null, amountMm: number | null, createdAt = '2026-06-01T07:00:00.000Z'): GoalRevisionLike {
  return {
    id: `${place?.bedId ?? 'ferme'}-${createdAt}`, weekStart: MONDAY, scopeType: place === null ? 'farm' : 'bed',
    otfZoneId: place?.zoneId ?? null, otfPlotId: place?.plotId ?? null, otfBedId: place?.bedId ?? null,
    amountMm, action: amountMm === null ? 'cleared' : 'set', createdAt,
  };
}

/** Une planche telle que le tableau des besoins la rend au volet : son objectif lu par `objectiveForBed`. */
function bed(place: Place, input: AutomaticObjectiveInput | undefined, revisions: readonly GoalRevisionLike[] = []): ObjectiveBedReading {
  const objective = objectiveForBed(revisions, { id: place.bedId, zoneId: place.zoneId, plotId: place.plotId }, MONDAY, SUNDAY, input);
  return { ...place, objectiveMm: objective.value, objectiveOrigin: objective.origin, automaticObjective: objective.automatic };
}

const place = (garden: typeof NORD, bedId: string, areaSquareMeters: number): Place => ({ ...garden, bedId, bedName: `Planche ${bedId}`, areaSquareMeters });

test('une ligne « automatique » par jardin, ses mm de la semaine et son origine (point 2)', () => {
  const beds = [place(NORD, '1', 10), place(NORD, '2', 20), place(NORD, '3', 30)].map((where) => bed(where, automatic()));
  const lines = automaticObjectiveLines(beds);
  assert.equal(lines.length, 1, 'trois planches au même objectif : le jardin seul');
  assert.deepEqual(lines[0], {
    key: 'plot:nord', label: 'Jardin Nord · 3 planches', scopeValue: 'plot:parcelle:nord',
    mm: 30, origin: 'automatique, d’après l’ET0', forecast: false,
  });
});

test('une planche qui s’écarte de son jardin a sa ligne ; sous abri, l’ET0 sous abri (point 2)', () => {
  const nord = [place(NORD, '1', 10), place(NORD, '2', 30)];
  const beds = [
    bed(nord[0], automatic()),
    // Une ET0 plus faible sur la seconde planche : 20 mm au lieu de 30, le jardin à 22,5 mm.
    bed(nord[1], automatic({ et0Readings: reanalysis(ET0.map((value) => value * 2 / 3)) })),
    bed(place(SERRE, 's', 15), automatic({ plotMode: 'greenhouse' })),
  ];
  const lines = automaticObjectiveLines(beds);
  assert.deepEqual(lines.map((line) => [line.label, line.mm === null ? null : Math.round(line.mm * 10) / 10, line.origin, line.scopeValue]), [
    ['Jardin Nord · 2 planches', 22.5, 'automatique, d’après l’ET0', 'plot:parcelle:nord'],
    ['Jardin Nord · Planche 1', 30, 'automatique, d’après l’ET0', 'bed:parcelle:nord:1'],
    ['Jardin Nord · Planche 2', 20, 'automatique, d’après l’ET0', 'bed:parcelle:nord:2'],
    ['Serre · 1 planche', 24, 'automatique, d’après l’ET0 sous abri', 'plot:parcelle:serre'],
  ]);
});

test('les planches qui gardent un objectif saisi n’ont pas de ligne « automatique » ; réglage éteint, aucune ligne (point 2)', () => {
  const farm20 = [goal(null, 20)];
  assert.deepEqual(automaticObjectiveLines([bed(place(NORD, '1', 10), automatic(), farm20)]), [], 'un objectif de ferme saisi passe avant');
  assert.deepEqual(automaticObjectiveLines([bed(place(NORD, '1', 10), undefined), bed(place(SUD, '2', 10), automatic({ settings: [] }))]), [], 'éteint : l’écran d’avant');
  // Un objectif de planche vidé jeudi : saisi puis automatique, la ligne le dit.
  const where = place(SUD, '2', 10);
  const both = bed(where, automatic(), [goal(where, 20, '2026-06-15T07:00:00.000Z'), goal(where, null, '2026-06-18T07:00:00.000Z')]);
  assert.deepEqual(automaticObjectiveLines([both]).map((line) => line.origin), ['saisi et automatique']);
});

test('une semaine sans valeur le dit, jamais un zéro (D-003) ; une semaine à venir dit « prévu »', () => {
  const unknown = automaticObjectiveLines([bed(place(NORD, '1', 10), automatic({ et0Readings: reanalysis(ET0.map(() => null)) }))]);
  assert.equal(unknown.length, 1);
  assert.equal(unknown[0].mm, null);
  assert.equal(unknown[0].origin, 'automatique, sans valeur : aucun jour n’est connu');
  const upcoming = automatic({ today: '2026-06-10', et0Readings: WEEK.map((date, index) => ({ date, reanalysisMm: null, forecastMm: ET0[index] })) });
  const forecast = automaticObjectiveLines([bed(place(NORD, '1', 10), upcoming)]);
  assert.equal(forecast[0].forecast, true, 'toute l’ET0 est prévue');
  assert.equal(forecast[0].mm, 30);
  const current = automatic({ today: '2026-06-18', et0Readings: WEEK.map((date, index) => ({ date, reanalysisMm: index < 3 ? ET0[index] : null, forecastMm: ET0[index] })) });
  assert.equal(automaticObjectiveLines([bed(place(NORD, '1', 10), current)])[0].forecast, false, 'la semaine en cours n’est pas « prévue » en entier');
});

test('le champ montre la valeur en vigueur de l’endroit choisi, marquée saisie ou automatique (point 3)', () => {
  const n1 = place(NORD, '1', 10);
  const n2 = place(NORD, '2', 30);
  const s1 = place(SUD, '3', 20);
  const revisions = [goal(s1, 12)];
  const beds = [bed(n1, automatic(), revisions), bed(n2, automatic(), revisions), bed(s1, automatic(), revisions)];
  const goals = [{ scopeType: 'bed' as const, otfZoneId: 'parcelle', otfPlotId: 'sud', otfBedId: '3', amountMm: 12 }];
  const farm = { scopeType: 'farm' as const, otfZoneId: null, otfPlotId: null, otfBedId: null };
  assert.deepEqual(objectiveInForce({ scopeType: 'plot', otfZoneId: 'parcelle', otfPlotId: 'nord', otfBedId: null }, goals, beds), { mm: 30, origin: 'automatique, d’après l’ET0' });
  assert.deepEqual(objectiveInForce({ scopeType: 'bed', otfZoneId: 'parcelle', otfPlotId: 'sud', otfBedId: '3' }, goals, beds), { mm: 12, origin: 'saisi' }, 'l’objectif saisi à cet endroit même');
  // La ferme : la moyenne de surface de toutes ses planches, comme `farmObjective` (D-328) : (30 × 40 + 12 × 20) / 60 = 24 mm.
  const whole = objectiveInForce(farm, goals, beds);
  assert.equal(whole?.mm, farmObjective(beds).objectiveMm);
  assert.equal(whole?.mm, 24);
  assert.equal(whole?.origin, 'saisi et automatique');
  assert.deepEqual(objectiveInForce(farm, [{ ...farm, amountMm: 20 }], beds), { mm: 20, origin: 'saisi' }, 'un objectif « Toute la ferme » saisi');
  assert.equal(objectiveInForce({ scopeType: 'plot', otfZoneId: 'parcelle', otfPlotId: 'ailleurs', otfBedId: null }, goals, beds), null, 'aucune planche : le champ reste vide');
  assert.equal(objectiveInForce(farm, [], [bed(n1, automatic({ et0Readings: reanalysis(ET0.map(() => null)) }))]), null, 'aucune valeur : jamais zéro');
});

test('la phrase de résultat reprend les chiffres de l’objectif de la ferme et les planches qui gardent un objectif saisi (point 6)', () => {
  const beds = [place(NORD, '1', 10), place(NORD, '2', 20), place(SUD, '3', 30)].map((where) => bed(where, automatic()));
  assert.equal(automaticObjectiveResultText(farmObjective(beds), beds, 0), 'Cette semaine : 30 mm en moyenne sur 3 planches, d’après l’ET0.');
  assert.equal(automaticObjectiveResultText(farmObjective(beds), beds, 2), 'Cette semaine : 30 mm en moyenne sur 3 planches, d’après l’ET0 ; 2 planches gardent un objectif saisi.');
  const where = place(SUD, '4', 10);
  const mixed = [...beds, bed(where, automatic(), [goal(where, 12)])];
  assert.equal(automaticObjectiveResultText(farmObjective(mixed), mixed, 1), 'Cette semaine : 27,4 mm en moyenne sur 4 planches, objectif saisi et automatique ; 1 planche garde un objectif saisi.');
  const empty = [bed(place(NORD, '1', 10), automatic({ et0Readings: reanalysis(ET0.map(() => null)) }))];
  assert.equal(automaticObjectiveResultText(farmObjective(empty), empty, 0), 'Cette semaine : aucune planche n’a encore d’objectif chiffré.');
});

test('la fenêtre d’allumage dit ce qui change, avant (point 5)', () => {
  assert.equal(automaticObjectiveEnableText(1), '1 planche a un objectif saisi, qui passe avant l’objectif automatique.');
  assert.equal(automaticObjectiveEnableText(7), '7 planches ont un objectif saisi, qui passe avant l’objectif automatique.');
});

test('l’écran : réglage éteint, celui d’avant ; allumé, la liste, le champ, la fenêtre et la phrase (section 3, points 2 à 6)', () => {
  const panel = readFileSync('app/irrigation/water-management-dashboard.tsx', 'utf8');
  // Les lignes, la valeur du champ et la phrase ne se lisent que réglage allumé.
  assert.match(panel, /const automaticLines = automaticOn && objectiveBeds !== null \? automaticObjectiveLines\(objectiveBeds\) : \[\];/);
  assert.match(panel, /const inForce = automaticOn && objectiveBeds !== null \? objectiveInForce\(/);
  assert.match(panel, /result=\{automaticOn && farmObjective !== null && objectiveBeds !== null \? automaticObjectiveResultText\(/);
  assert.match(panel, /\{automaticOn \? <><small>saisi<\/small><button[^>]*onClick=\{\(\) => backToAutomatic\(goal\)\}>Revenir à l’automatique<\/button><\/> : null\}/);
  // Un champ laissé tel quel n'écrit rien ; la fenêtre ne s'ouvre que si des planches gardent un objectif saisi.
  assert.match(panel, /if \(inForce !== null && goalAmount === inForceText\) \{/);
  assert.match(panel, /if \(enabled && kept > 0\) \{\s*setEnableAsked\(kept\);/);
  // « Revenir à l'automatique » est le geste « vider » de cet endroit seul.
  const actions = readFileSync('app/irrigation/water-actions.ts', 'utf8');
  assert.match(actions, /clearHydricGoalsForUser\(\s*context\.value\.ownerUserId,\s*input\.season,\s*weekStart,\s*scope === undefined \? undefined :/);
});
