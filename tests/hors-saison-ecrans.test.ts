import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { gardenState } from '../lib/domain/besoins-phone.ts';
import { OFF_SEASON_HELP } from '../lib/domain/features/help.ts';
import { offSeasonSchedule, type OffSeasonScope } from '../lib/domain/off-season.ts';
import {
  gardenAllOffSeason,
  gardenOffSeasonText,
  offSeasonCanceledText,
  offSeasonNeedText,
  offSeasonPlannedLines,
  offSeasonPlannedQuestion,
  offSeasonPutText,
  offSeasonResumeText,
  offSeasonScopeChoiceGroups,
  offSeasonScopeFromValue,
  offSeasonScopeLabel,
  offSeasonSinceText,
  offSeasonView,
  parsedOffSeasonScope,
  stillOffSeasonAfterResume,
} from '../lib/domain/off-season-view.ts';
import { gardenUnknownReason } from '../lib/domain/objective-reading.ts';
import type { BedIrrigationNeed } from '../lib/domain/irrigation-needs.ts';
import { buildWeeklyPlan } from '../lib/domain/planning/engine.ts';
import { todayWeek } from '../lib/domain/today/week.ts';
import {
  at, BEFORE, dashboard, FARM_BEDS, garden, JARDIN_NORD, MONDAY, NORD, PLEIN_CHAMP, put, resume, row, rowsOf, snapshotOf,
  SOUS_ABRI, SUNDAY, THURSDAY, WEDNESDAY,
} from './support/off-season-fixtures.ts';
import { byEquipment, farm, settings } from './support/planning-fixtures.ts';

/**
 * Le filtre « hors saison », PR B3 : les écrans
 * (docs/objectif-automatique-saison-contract.md, sections 4.3 à 4.5, 6 et
 * 10 ; D-337, D-353). Les mots du bloc « Hors saison », la fenêtre des
 * arrosages prévus, la ligne du tableau des besoins, la tuile
 * d'« Aujourd'hui ». La règle est celle de B1, testée à part.
 *
 * La ferme : tests/support/off-season-fixtures.ts (Nord et Sud en plein
 * champ, un abri, un jardin neuf à classer, le verger dans une autre
 * parcelle). Les noms y valent les identifiants.
 */

const FARM = snapshotOf(FARM_BEDS);
const view = (gestures: Parameters<typeof offSeasonSchedule>[0], today = WEDNESDAY) =>
  offSeasonView({ schedule: gestures.length === 0 ? null : offSeasonSchedule(gestures), places: FARM, season: 2026, today });

test('le bloc : les endroits hors saison, du plus large au plus étroit, chacun depuis son jour et avec ses planches', () => {
  const shown = view([put(JARDIN_NORD, at('2026-06-09')), put(PLEIN_CHAMP, BEFORE), put({ level: 'bed', bedId: 'planche-abri-1' }, at(MONDAY))]);
  assert.deepEqual(shown.chips.map((chip) => [chip.label, chip.since, chip.beds]), [
    ['Tout le plein champ', '2026-06-08', 4],
    ['Jardin · jardin-nord', '2026-06-09', 2],
    ['Planche · planche-abri-1', MONDAY, 1],
  ]);
  assert.equal(shown.offSeasonBeds, 5, 'une planche couverte deux fois compte une fois');
  assert.deepEqual(shown.modes, { garden: true, greenhouse: true });
  assert.equal(shown.unclassifiedGardens, 1, 'le jardin neuf, à classer');
  assert.equal(offSeasonSinceText('2026-11-20'), 'depuis le 20 nov.');
});

test('le bloc : filtre vide, aucune puce ; une portée reprise disparaît ; le jour du geste compte, en heure de Paris', () => {
  assert.deepEqual(view([]).chips, []);
  assert.equal(view([]).offSeasonBeds, 0);
  assert.deepEqual(view([put(PLEIN_CHAMP, BEFORE), resume(PLEIN_CHAMP, at(MONDAY))]).chips, []);
  // Posé jeudi : mercredi, il n'est pas encore là.
  assert.deepEqual(view([put(PLEIN_CHAMP, at(THURSDAY))]).chips, []);
  assert.equal(view([put(PLEIN_CHAMP, at(THURSDAY))], THURSDAY).chips.length, 1);
  // 23 h 30 à Paris le mardi 16 : son jour est mardi.
  assert.equal(view([put(PLEIN_CHAMP, '2026-06-16T21:30:00.000Z')]).chips[0].since, '2026-06-16');
});

test('les noms des endroits : tout le plein champ, tout le sous-abri, parcelle, jardin ou abri, planche ; un lieu disparu se dit tel', () => {
  assert.equal(offSeasonScopeLabel(PLEIN_CHAMP, FARM), 'Tout le plein champ');
  assert.equal(offSeasonScopeLabel(SOUS_ABRI, FARM), 'Tout le sous-abri');
  assert.equal(offSeasonScopeLabel({ level: 'zone', zoneId: 'verger' }, FARM), 'Parcelle · verger');
  assert.equal(offSeasonScopeLabel(JARDIN_NORD, FARM), 'Jardin · jardin-nord');
  assert.equal(offSeasonScopeLabel({ level: 'plot', plotId: 'abri' }, FARM), 'Abri · abri');
  assert.equal(offSeasonScopeLabel({ level: 'bed', bedId: NORD.id }, FARM), 'Planche · planche-nord-1');
  assert.equal(offSeasonScopeLabel({ level: 'bed', bedId: 'partie' }, FARM), 'Une planche qui n’est plus dans Ouvre ta ferme');
  assert.equal(offSeasonScopeLabel({ level: 'plot', plotId: 'parti' }, FARM), 'Un jardin qui n’est plus dans Ouvre ta ferme');
  assert.equal(offSeasonScopeLabel({ level: 'zone', zoneId: 'partie' }, FARM), 'Une parcelle qui n’est plus dans Ouvre ta ferme');
});

test('le choix des cinq portées : les modes que la ferme a, puis les parcelles et les jardins avec leurs planches, jamais « Toute la ferme »', () => {
  const groups = offSeasonScopeChoiceGroups(FARM, 2026, { garden: true, greenhouse: true });
  assert.deepEqual(groups[0], { label: 'Plein champ et sous-abri', choices: [
    { value: 'mode:garden', label: 'Tout le plein champ', searchText: 'Tout le plein champ' },
    { value: 'mode:greenhouse', label: 'Tout le sous-abri', searchText: 'Tout le sous-abri abri' },
  ] });
  assert.deepEqual(groups[1].choices.map((choice) => choice.label), ['Parcelle · parcelle', 'Parcelle · verger']);
  const values = groups.flatMap((group) => group.choices.map((choice) => choice.value));
  assert.equal(values.includes('farm'), false);
  assert.ok(values.includes('plot:parcelle:jardin-nord') && values.includes('bed:parcelle:jardin-nord:planche-nord-1'));
  // Une ferme sans abri ne voit pas « tout le sous-abri » ; sans jardin classé, ni l'un ni l'autre (section 4.3).
  assert.deepEqual(offSeasonScopeChoiceGroups(FARM, 2026, { garden: true, greenhouse: false })[0].choices.map((choice) => choice.value), ['mode:garden']);
  assert.equal(offSeasonScopeChoiceGroups(FARM, 2026, { garden: false, greenhouse: false })[0].label, 'Parcelles');
  const farmWithoutShelter = snapshotOf(FARM_BEDS.filter((bed) => bed.plotMode !== 'greenhouse'));
  assert.deepEqual(offSeasonView({ schedule: null, places: farmWithoutShelter, season: 2026, today: WEDNESDAY }).modes, { garden: true, greenhouse: false });
});

test('les valeurs du choix donnent la portée, et le serveur ne prend qu’une portée bien formée', () => {
  const cases: [string, OffSeasonScope | null][] = [
    ['mode:garden', PLEIN_CHAMP],
    ['mode:greenhouse', SOUS_ABRI],
    ['zone:verger', { level: 'zone', zoneId: 'verger' }],
    ['plot:parcelle:jardin-nord', JARDIN_NORD],
    ['bed:parcelle:jardin-nord:planche-nord-1', { level: 'bed', bedId: NORD.id }],
    ['farm', null], ['mode:unclassified', null], ['bed:parcelle', null], ['zone:', null], ['', null],
  ];
  for (const [value, scope] of cases) assert.deepEqual(offSeasonScopeFromValue(value), scope, value);
  assert.deepEqual(parsedOffSeasonScope({ level: 'plot', plotId: 'jardin-nord' }), JARDIN_NORD);
  for (const junk of [null, 'mode:garden', { level: 'mode', mode: 'unclassified' }, { level: 'bed', bedId: '' }, { level: 'bed', bedId: 3 }, { level: 'farm' }, { level: 'zone', zoneId: 'x'.repeat(201) }]) {
    assert.equal(parsedOffSeasonScope(junk), null, JSON.stringify(junk));
  }
  // Rien d'autre que la portée n'entre.
  assert.deepEqual(parsedOffSeasonScope({ level: 'mode', mode: 'garden', ownerUserId: 'autre' }), PLEIN_CHAMP);
});

test('les messages : un geste qui change dit quoi et depuis quand ; un geste sans effet le dit (section 4.5)', () => {
  assert.equal(offSeasonPutText('Tout le plein champ', true, 4), 'Tout le plein champ est hors saison à partir d’aujourd’hui (4 planches) : son irrigation est ignorée, ni objectif ni arrosage proposé. La pluie, la météo et les alertes restent suivies.');
  assert.equal(offSeasonPutText('Planche · N1', true, 1).includes('(1 planche)'), true);
  assert.equal(offSeasonPutText('Tout le plein champ', false, 4), 'Tout le plein champ était déjà hors saison : rien n’a changé.');
  assert.equal(offSeasonResumeText('Jardin · Nord', false, { beds: 0, labels: [] }), 'Jardin · Nord n’était pas hors saison : rien n’a changé.');
  assert.equal(offSeasonResumeText('Jardin · Nord', true, { beds: 0, labels: [] }), 'Jardin · Nord reprend : son irrigation est de nouveau calculée à partir d’aujourd’hui.');
});

test('cas 4 : reprendre tout le plein champ laisse le jardin Nord hors saison, et l’écran le dit', () => {
  const gestures = [put(PLEIN_CHAMP, BEFORE), put(JARDIN_NORD, BEFORE), resume(PLEIN_CHAMP, at(WEDNESDAY))];
  const still = stillOffSeasonAfterResume({ scope: PLEIN_CHAMP, schedule: offSeasonSchedule(gestures), places: FARM, season: 2026, today: WEDNESDAY });
  assert.deepEqual(still, { beds: 2, labels: ['Jardin · jardin-nord'] });
  assert.equal(offSeasonResumeText('Tout le plein champ', true, still), 'Tout le plein champ reprend : son irrigation est de nouveau calculée à partir d’aujourd’hui. 2 planches restent hors saison : Jardin · jardin-nord l’est encore.');
  // Reprendre le jardin quand tout le plein champ le couvre : ses planches restent hors saison.
  const other = [put(PLEIN_CHAMP, BEFORE), put(JARDIN_NORD, BEFORE), put({ level: 'zone', zoneId: 'parcelle' }, BEFORE), resume(JARDIN_NORD, at(WEDNESDAY))];
  const kept = stillOffSeasonAfterResume({ scope: JARDIN_NORD, schedule: offSeasonSchedule(other), places: FARM, season: 2026, today: WEDNESDAY });
  assert.deepEqual(kept, { beds: 2, labels: ['Tout le plein champ', 'Parcelle · parcelle'] });
  assert.match(offSeasonResumeText('Jardin · jardin-nord', true, kept), /2 planches restent hors saison : Tout le plein champ, Parcelle · parcelle le sont encore\.$/);
  assert.deepEqual(stillOffSeasonAfterResume({ scope: PLEIN_CHAMP, schedule: null, places: FARM, season: 2026, today: WEDNESDAY }), { beds: 0, labels: [] });
});

test('la fenêtre des arrosages prévus : chacun avec son matériel, son jour, ses planches, et les autres planches qu’il prive', () => {
  const lines = offSeasonPlannedLines([
    { eventId: 'e1', eventEquipmentId: 'ee1', equipmentName: 'Rampe nord', plannedStartAt: '2026-06-18T04:00:00.000Z', plannedEndAt: null, coveredBedIds: ['planche-nord-2', 'planche-nord-1'], otherBedIds: [] },
    { eventId: 'e2', eventEquipmentId: 'ee2', equipmentName: 'Asperseur', plannedStartAt: '2026-06-19T05:30:00.000Z', plannedEndAt: null, coveredBedIds: ['planche-sud-1'], otherBedIds: ['planche-abri-1', 'partie'] },
  ], FARM.beds);
  assert.deepEqual(lines, [
    { eventEquipmentId: 'ee1', text: 'Rampe nord · jeu. 18 juin, 6 h', covered: 'planche-nord-1, planche-nord-2', others: null },
    { eventEquipmentId: 'ee2', text: 'Asperseur · ven. 19 juin, 7 h 30', covered: 'planche-sud-1', others: 'partie, planche-abri-1' },
  ]);
  assert.equal(offSeasonPlannedQuestion(2), '2 arrosages planifiés ou validés arrosent ces planches à partir d’aujourd’hui. Les annuler ?');
  assert.equal(offSeasonPlannedQuestion(1), '1 arrosage planifié ou validé arrose ces planches à partir d’aujourd’hui. L’annuler ?');
  assert.equal(offSeasonCanceledText(2, 0), '2 arrosages planifiés annulés.');
  assert.equal(offSeasonCanceledText(1, 1), '1 arrosage planifié annulé. 1 n’a pas pu être annulé : voyez « Arrosages ».');
});

test('le tableau des besoins : une planche hors saison reste là, dite « hors saison », jamais « sans objectif » ; sa pluie reste suivie', () => {
  const board = dashboard({ gestures: [put(PLEIN_CHAMP, BEFORE)] });
  const north = row(board, NORD.id);
  assert.equal(offSeasonNeedText(north), 'Hors saison : son irrigation est ignorée, ni besoin ni arrosage proposé. La pluie reste suivie.');
  assert.equal(offSeasonNeedText(row(board, 'planche-abri-1')), null, 'en saison : aucune ligne');
  const nord = garden(board, 'jardin-nord');
  assert.equal(gardenAllOffSeason(nord.beds), true);
  assert.equal(gardenOffSeasonText(nord.beds), '2 hors saison');
  assert.equal(gardenUnknownReason(nord.beds, (bed) => bed.effectiveNeedMm), null, 'pas « 2 planches sans objectif adopté »');
  assert.deepEqual(gardenState(nord), { text: 'hors saison', tone: 'unknown' });
  assert.equal(gardenAllOffSeason(garden(board, 'abri').beds), false);
  assert.notEqual(gardenState(garden(board, 'abri')).text, 'hors saison');
  // Un besoin remplacé à la main reste enregistré, inactif (F991) ; mis hors saison jeudi, l'objectif des jours d'avant reste affiché (F1066).
  assert.match(offSeasonNeedText({ offSeason: true, offSeasonDates: [THURSDAY], objectiveMm: 12, manualOverrideMm: 8 })!, /^Hors saison depuis jeudi : .* L’objectif des jours d’avant reste affiché, sans rien à apporter\. Le besoin remplacé à la main reste enregistré, inactif\.$/);
  // Repris mercredi : lundi et mardi n'ont pas d'objectif, la planche est servie.
  assert.equal(offSeasonNeedText({ offSeasonDates: [MONDAY, '2026-06-16'], objectiveMm: 21.8, manualOverrideMm: null }), 'Hors saison lundi, mardi : ces jours n’ont pas d’objectif. La pluie reste suivie.');
  assert.equal(offSeasonNeedText({ objectiveMm: 20, manualOverrideMm: null }), null);
});

test('« Aujourd’hui » : avec des planches hors saison, la tuile de l’objectif dit leur nombre et mène au bloc « Hors saison »', () => {
  const week = todayWeek({ weekStart: MONDAY, weekEnd: SUNDAY, beds: rowsOf(dashboard({ gestures: [put(PLEIN_CHAMP, BEFORE)] })), water: null })!;
  assert.deepEqual(week.links.objective, { label: '4 planches hors saison', page: 'semaine', anchor: 'hors-saison' });
  const plain = todayWeek({ weekStart: MONDAY, weekEnd: SUNDAY, beds: rowsOf(dashboard()), water: null })!;
  assert.deepEqual(plain.links.objective, { label: 'Modifier les objectifs', page: 'semaine', anchor: 'objectifs-de-la-semaine' }, 'filtre vide : le lien d’avant');
});

test('les écrans tiennent leurs promesses : l’annulation passe par le geste du planning, le bloc vit dans le pli des objectifs, l’aide dit tout', () => {
  const panel = readFileSync('app/irrigation/off-season-panel.tsx', 'utf8');
  assert.match(panel, /cancelPlannedIrrigationAction\(line\.eventEquipmentId\)/, 'arrosage par arrosage, par le geste existant');
  assert.match(panel, /className="primary" onClick=\{\(\) => choosePlanned\('keep'\)\}>Les garder</, '« Les garder » est le défaut');
  assert.match(panel, /focusLast/);
  const actions = readFileSync('app/irrigation/off-season-actions.ts', 'utf8');
  assert.match(actions, /if \(changed\) await recalculatePlanAfterEvent\(context\.ownerUserId, \{ kind: 'objective-changed'/, 'le plan se recalcule après un geste qui change');
  assert.doesNotMatch(actions, /cancelPlannedIrrigationForUser/, 'aucune annulation côté serveur sans le choix de la personne');
  const page = readFileSync('app/irrigation/semaine/page.tsx', 'utf8');
  assert.match(page, /offSeason=\{<OffSeasonPanel /);
  assert.deepEqual(OFF_SEASON_HELP.entries.map((entry) => entry.title), ['Ce que fait « hors saison »', 'Ce qui continue', 'Les endroits', 'Reprendre', 'Les arrosages déjà prévus']);
  assert.match(OFF_SEASON_HELP.entries[1].text, /pluie tombée dehors reste enregistrée/);
});

test('planning : un matériel partagé avec des planches en saison arrose encore la planche hors saison, et la proposition le marque (F1067)', () => {
  const offSeason: Partial<BedIrrigationNeed> = { offSeason: true, realRemainingMm: null, relativeDeficitPercent: null, rawPlanningNeedMm: null, calculatedNeedMm: null, effectiveNeedMm: null, effectiveVolumeCubicMeters: null };
  const needs = Object.fromEntries(Array.from({ length: 8 }, (_, index) => [`T1-${index + 1}`, index === 0 ? offSeason : { manualOverrideMm: 15 }]));
  const proposals = byEquipment(buildWeeklyPlan(farm({ needs }).inputs, settings), 'rampe-tunnel-1');
  assert.ok(proposals.length > 0, 'les sept autres planches sont servies');
  for (const proposal of proposals) {
    const shared = proposal.bedApplications.find((application) => application.bedId === 'T1-1')!;
    assert.equal(shared.horsSaison, true, 'eau réelle, dite');
    assert.equal(shared.bedName, 'T1-1');
    assert.equal(shared.needBeforeMm, 0);
    assert.equal(proposal.bedApplications.filter((application) => application.horsSaison === true).length, 1, 'les planches en saison ne sont pas marquées');
  }
  const plain = byEquipment(buildWeeklyPlan(farm({ needs: { 'T1-1': { manualOverrideMm: 15 } } }).inputs, settings), 'rampe-tunnel-1');
  assert.equal(plain.flatMap((proposal) => proposal.bedApplications).some((application) => 'horsSaison' in application), false, 'filtre vide : rien de plus');
});
