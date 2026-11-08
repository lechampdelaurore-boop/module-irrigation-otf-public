import assert from 'node:assert/strict';
import test from 'node:test';
import { addMonthsToDateKey, cultivationDates, daysFromTo, type CultivationDates } from '../lib/domain/crop-water/crop-calendar.ts';
import { stageKc } from '../lib/domain/crop-water/kc.ts';
import type { ReferenceCrop } from '../lib/domain/crop-water/reference.ts';
import { stageOfDay, type StageDeclaration, type StagedDay } from '../lib/domain/crop-water/stage.ts';
import { resolveSeriesOccupation } from '../lib/domain/series/occupation.ts';
import {
  ARTICHOKE,
  ASPARAGUS,
  BROAD_BEAN,
  BROCCOLI,
  CARROT,
  CAULIFLOWER,
  cultivation,
  datesOf,
  GARLIC,
  ONION,
  POTATO,
  series,
  task,
  TOMATO,
} from './support/crop-water-references.ts';

/**
 * Le stade et le Kc d'une culture (docs/crop-water-need-contract.md, D-054),
 * avec les deux réponses du porteur du 5 novembre 2026 (D-057) : un stade
 * déclaré recale le calendrier, et la culture reste sur sa planche jusqu'à la
 * plus tardive de ses semaines de récolte. Les scénarios chiffrés du contrat
 * portent leur numéro.
 */

function stageOn(crop: ReferenceCrop, dates: CultivationDates, date: string, declarations: StageDeclaration[] = [], bedId = 'planche-a') {
  return stageOfDay({ crop, dates, declarations, bedId, date });
}

function staged(crop: ReferenceCrop, dates: CultivationDates, date: string, declarations: StageDeclaration[] = [], bedId = 'planche-a'): StagedDay {
  const stage = stageOn(crop, dates, date, declarations, bedId);
  assert.equal(stage.status, 'staged', `${crop.name} le ${date} : ${stage.status}`);
  return stage as StagedDay;
}

/** Le Kc du jour, sans surcharge ni lissage. */
function kcOn(crop: ReferenceCrop, dates: CultivationDates, date: string, declarations: StageDeclaration[] = [], bedId = 'planche-a'): number {
  const stage = staged(crop, dates, date, declarations, bedId);
  const kc = stageKc(crop, stage.position, [], date);
  assert.ok(kc, `${crop.name} : rang ${stage.rank} absent de la table`);
  return Math.round(kc.kc * 1000) / 1000;
}

function declaration(
  crop: ReferenceCrop,
  seriesId: string,
  rank: number,
  date: string,
  options: { bedId?: string | null; recordedAt?: string } = {},
): StageDeclaration {
  return { seriesId, bedId: options.bedId ?? null, referenceCropId: crop.id, rank, date, recordedAt: options.recordedAt ?? `${date}T18:00:00.000Z` };
}

const weeks = (from: number, to: number, year = 2026) =>
  Array.from({ length: to - from + 1 }, (_, index) => `${year}-W${String(from + index).padStart(2, '0')}`);

// Scénario 15 : tomate plantée en 2026-W17, récoltes de 2026-W27 à 2026-W40.
const tomatoSeries = series('tomate', [cultivation('tomate-c', 'plant-tomate', 'Tomate', { expected: weeks(27, 40) })]);
const tomato = datesOf(tomatoSeries, [task('tomate', 'planting', '2026-W17')]);

// Scénarios 2, 3, 11 : carotte semée en 2026-W10.
const carrotSeries = series('carotte', [cultivation('carotte-c', 'plant-carotte', 'Carotte', { expected: ['2026-W26'] })]);
const carrot = datesOf(carrotSeries, [task('carotte', 'direct-sowing', '2026-W10')]);

// Scénario 16 : ail planté à l'automne 2025, dernière récolte en 2026-W28.
const garlicSeries = series('ail-sec', [cultivation('ail-c', 'plant-ail', 'Ail', { expected: ['2026-W28'] })]);
const garlic = datesOf(garlicSeries, [task('ail-sec', 'planting', '2025-W44')]);

// Scénario 17 : pomme de terre plantée en 2026-W12, récoltée en 2026-W27.
const potatoSeries = series('pdt', [cultivation('pdt-c', 'plant-pdt', 'Pomme de terre', { expected: ['2026-W27'] })]);
const potato = datesOf(potatoSeries, [task('pdt', 'planting', '2026-W12')]);

test('les dates de la tomate du scénario 15 : jour 0, première récolte, dernière récolte et mi-récolte', () => {
  assert.equal(tomato.dayZero, '2026-04-20');
  assert.equal(tomato.firstHarvest, '2026-06-29');
  assert.equal(tomato.lastHarvest, '2026-10-04');
  assert.equal(daysFromTo('2026-06-29', '2026-10-04') + 1, 98);
  assert.equal(tomato.midHarvest, '2026-08-17');
});

test('scénario 15 : la floraison du 3e bouquet au jour 30, la mi-récolte calée sur OTF', () => {
  assert.equal(kcOn(TOMATO, tomato, '2026-04-20'), 0.2);
  assert.equal(kcOn(TOMATO, tomato, '2026-05-05'), 0.6);
  assert.equal(kcOn(TOMATO, tomato, '2026-05-19'), 0.6);
  assert.equal(kcOn(TOMATO, tomato, '2026-05-20'), 0.9);
  assert.equal(kcOn(TOMATO, tomato, '2026-08-16'), 0.9);
  assert.equal(kcOn(TOMATO, tomato, '2026-08-17'), 0.7);
  assert.equal(kcOn(TOMATO, tomato, '2026-10-04'), 0.7);
  assert.equal(stageOn(TOMATO, tomato, '2026-10-05').status, 'absent');
  assert.equal(stageOn(TOMATO, tomato, '2026-04-19').status, 'absent');
  const flowering = staged(TOMATO, tomato, '2026-06-01');
  assert.equal(flowering.estimated, true, 'J30 est une estimation, affichée comme telle');
  assert.deepEqual(flowering.nextChange, { rank: 4, label: 'Mi-récolte → Fin culture', date: '2026-08-17' });
  assert.equal(flowering.origin, 'calculated');
});

test('scénarios 2, 3 et 11 : la carotte passe de 0,5 à 1 au jour 30, mercredi 1er avril', () => {
  assert.equal(carrot.dayZero, '2026-03-02');
  assert.equal(kcOn(CARROT, carrot, '2026-03-12'), 0.5, 'jour 10');
  assert.equal(kcOn(CARROT, carrot, '2026-03-31'), 0.5);
  assert.equal(kcOn(CARROT, carrot, '2026-04-01'), 1, 'jour 30');
  assert.equal(kcOn(CARROT, carrot, '2026-04-16'), 1, 'jour 45');
  assert.deepEqual(staged(CARROT, carrot, '2026-03-12').nextChange, { rank: 2, label: '30 j → Récolte', date: '2026-04-01' });
});

test('scénario 16 : l\'ail se compte à rebours depuis le dimanche de sa dernière récolte', () => {
  assert.equal(garlic.lastHarvest, '2026-07-12');
  assert.equal(kcOn(GARLIC, garlic, '2025-10-27'), 0.5, 'premier stade dès le jour 0, délai de levée compris');
  assert.equal(kcOn(GARLIC, garlic, '2026-05-27'), 0.5);
  assert.equal(kcOn(GARLIC, garlic, '2026-05-28'), 0.9, 'J-45');
  assert.equal(kcOn(GARLIC, garlic, '2026-06-17'), 0.6, 'J-25');
  assert.equal(kcOn(GARLIC, garlic, '2026-06-21'), 0.6);
  assert.equal(kcOn(GARLIC, garlic, '2026-06-22'), 0, 'J-20 : arrêt');
  assert.equal(kcOn(GARLIC, garlic, '2026-07-02'), 0, 'dix jours avant la récolte (scénario 4)');
});

test('scénario 17 : le délai de levée ne décale que les stades comptés depuis la levée', () => {
  assert.equal(potato.dayZero, '2026-03-16');
  assert.equal(kcOn(POTATO, potato, '2026-03-16'), 0.5, 'Kc du premier stade pendant le délai de levée');
  assert.equal(kcOn(POTATO, potato, '2026-04-29'), 0.5);
  assert.equal(kcOn(POTATO, potato, '2026-04-30'), 1.1, 'levée le 10 avril + 20 j');
  assert.equal(kcOn(POTATO, potato, '2026-06-05'), 0.6, 'J-30');
  assert.equal(kcOn(POTATO, potato, '2026-06-15'), 0, 'J-20');
  // La carotte du scénario 11, délai de 10 jours : son stade se compte depuis le semis.
  assert.equal(kcOn(CARROT, carrot, '2026-04-01'), 1);
});

test('l\'oignon semé compte ses stades depuis la levée, sept jours après le jour 0', () => {
  const onionSeries = series('oignon', [cultivation('oignon-c', 'plant-oignon', 'Oignon', { expected: ['2026-W33'] })]);
  const onion = datesOf(onionSeries, [task('oignon', 'direct-sowing', '2026-W10')]);
  assert.equal(kcOn(ONION, onion, '2026-03-02'), 0.6);
  assert.equal(kcOn(ONION, onion, '2026-04-07'), 0.6, 'levée le 9 mars + 30 j = 8 avril');
  assert.equal(kcOn(ONION, onion, '2026-04-08'), 0.8);
  assert.equal(kcOn(ONION, onion, '2026-05-08'), 1, 'levée + 60 j');
  assert.equal(kcOn(ONION, onion, '2026-07-07'), 1.1, 'J-40 avant le dimanche 16 août');
  assert.equal(kcOn(ONION, onion, '2026-07-27'), 0.5, 'J-20');
});

test('scénario 18 : l\'asperge suit son calendrier et reste sur sa planche jusqu\'à sa fin (exception à D-022)', () => {
  const asparagusSeries = series('asperge', [cultivation('asperge-c', 'plant-asperge', 'Asperge', { realized: weeks(12, 22) })], { cycle: 'perennial' });
  const asparagus = datesOf(asparagusSeries, [task('asperge', 'planting', '2023-W10')]);
  assert.equal(asparagus.presenceStart, '2026-01-01');
  assert.equal(asparagus.lastHarvest, '2026-05-31');
  assert.equal(stageOn(ASPARAGUS, asparagus, '2026-04-15').status, 'off-calendar', 'pendant sa récolte, pas de proposition');
  assert.equal(kcOn(ASPARAGUS, asparagus, '2026-05-31'), 0.5);
  assert.equal(kcOn(ASPARAGUS, asparagus, '2026-06-07'), 0.9);
  assert.equal(kcOn(ASPARAGUS, asparagus, '2026-07-15'), 0.7, 'une ETM existe bien que la dernière récolte soit en mai');
  assert.equal(kcOn(ASPARAGUS, asparagus, '2026-09-07'), 0.5, 'la fin du calendrier est comprise');
  assert.equal(stageOn(ASPARAGUS, asparagus, '2026-09-08').status, 'absent');
  assert.equal(stageOn(ASPARAGUS, asparagus, '2026-09-20').status, 'absent', 'le 20 septembre, pas de proposition');
});

test('scénario 20 : le jeu de saison se choisit selon le mois du jour 0', () => {
  const autumnSeries = series('chou-automne', [cultivation('cf-a', 'plant-cf', 'Chou-fleur', { expected: ['2027-W14'] })]);
  const autumn = datesOf(autumnSeries, [task('chou-automne', 'planting', '2026-W42')]);
  assert.equal(autumn.dayZero, '2026-10-12');
  assert.equal(kcOn(CAULIFLOWER, autumn, '2026-11-10'), 0.5);
  assert.equal(kcOn(CAULIFLOWER, autumn, '2026-11-11'), 1, 'J30');
  assert.equal(kcOn(CAULIFLOWER, autumn, '2027-03-15'), 1);
  assert.equal(kcOn(CAULIFLOWER, autumn, '2027-03-16'), 1.3, 'J155, mardi 16 mars 2027');

  const springSeries = series('chou-printemps', [cultivation('cf-p', 'plant-cf', 'Chou-fleur', { expected: ['2026-W24'] })]);
  const spring = datesOf(springSeries, [task('chou-printemps', 'planting', '2026-W14')]);
  assert.equal(spring.dayZero, '2026-03-30');
  assert.equal(kcOn(CAULIFLOWER, spring, '2026-05-03'), 0.5);
  assert.equal(kcOn(CAULIFLOWER, spring, '2026-05-04'), 1, 'J35');
  assert.equal(kcOn(CAULIFLOWER, spring, '2026-05-18'), 1);
  assert.equal(kcOn(CAULIFLOWER, spring, '2026-05-19'), 1.3, 'J50');
});

test('scénario 6 : le brocoli suit le trapèze de la FAO, 0,875 au jour 35', () => {
  const broccoliSeries = series('brocoli', [cultivation('bro-c', 'plant-brocoli', 'Chou brocoli', { expected: ['2026-W30'] })]);
  const broccoli = datesOf(broccoliSeries, [task('brocoli', 'planting', '2026-W10')]);
  assert.equal(kcOn(BROCCOLI, broccoli, '2026-03-21'), 0.7, 'jour 19, début');
  assert.equal(kcOn(BROCCOLI, broccoli, '2026-04-06'), 0.875, 'jour 35 : 0,7 + 0,35 × 15 / 30');
  assert.equal(staged(BROCCOLI, broccoli, '2026-04-06').label, 'Développement');
  assert.equal(kcOn(BROCCOLI, broccoli, '2026-04-21'), 1.05, 'jour 50, pleine saison');
  assert.equal(kcOn(BROCCOLI, broccoli, '2026-05-16'), 1, 'jour 75 : 1,05 − 0,10 × 5 / 10');
  assert.equal(kcOn(BROCCOLI, broccoli, '2026-07-01'), 0.95, 'après la dernière phase, le Kc de fin jusqu\'à la récolte');
});

test('une phase de durée nulle passe directement au Kc de fin (fève : 90 / 45 / 40 / 0)', () => {
  const beanSeries = series('feve', [cultivation('feve-c', 'plant-feve', 'Fève', { expected: ['2026-W30'] })]);
  const bean = datesOf(beanSeries, [task('feve', 'direct-sowing', '2025-W45')]);
  assert.equal(kcOn(BROAD_BEAN, bean, addDays(bean.dayZero, 174)), 1.15);
  assert.equal(kcOn(BROAD_BEAN, bean, addDays(bean.dayZero, 175)), 1.1);
});

test('scénario 5 : le chou-fleur déclaré hier « Début formation des choux » a un Kc de 1,3 aujourd\'hui', () => {
  const cauliflowerSeries = series('chou', [cultivation('cf', 'plant-cf', 'Chou-fleur', { expected: ['2026-W24'] })]);
  const cauliflower = datesOf(cauliflowerSeries, [task('chou', 'planting', '2026-W14')]);
  assert.equal(kcOn(CAULIFLOWER, cauliflower, '2026-05-10'), 1, 'le stade calculé donne encore 1');
  const observed = [declaration(CAULIFLOWER, 'chou', 3, '2026-05-09')];
  assert.equal(kcOn(CAULIFLOWER, cauliflower, '2026-05-10', observed), 1.3);
  const stage = staged(CAULIFLOWER, cauliflower, '2026-05-10', observed);
  assert.equal(stage.origin, 'observed');
  assert.equal(stage.startedOn, '2026-05-09');
  assert.equal(kcOn(CAULIFLOWER, cauliflower, '2026-05-08', observed), 1, 'la déclaration vaut à partir de son jour');
});

test('scénario 22 (D-057) : la levée déclarée décale les stades comptés depuis la levée, pas ceux comptés depuis la récolte', () => {
  const emergence = [declaration(POTATO, 'pdt', 1, '2026-04-15')];
  assert.equal(kcOn(POTATO, potato, '2026-04-30', emergence), 0.5, 'levée + 20 j recalé au 5 mai');
  assert.equal(kcOn(POTATO, potato, '2026-05-04', emergence), 0.5);
  assert.equal(kcOn(POTATO, potato, '2026-05-05', emergence), 1.1);
  const recaled = staged(POTATO, potato, '2026-05-05', emergence);
  assert.equal(recaled.origin, 'calculated', 'le stade suivant arrive seul ; il reste recalé sur la déclaration');
  assert.equal(recaled.declaration?.date, '2026-04-15');
  assert.equal(kcOn(POTATO, potato, '2026-06-05', emergence), 0.6, 'J-30 garde sa date');
  assert.equal(kcOn(POTATO, potato, '2026-06-15', emergence), 0, 'J-20 garde sa date : l\'arrêt avant récolte reste');
});

test('scénario 23 (D-057) : un stade déclaré en retard repousse les stades comptés depuis la plantation', () => {
  const late = [declaration(TOMATO, 'tomate', 2, '2026-05-10')];
  assert.equal(kcOn(TOMATO, tomato, '2026-05-07', late), 0.6, 'avant la déclaration, le stade calculé');
  assert.equal(kcOn(TOMATO, tomato, '2026-05-24', late), 0.6, 'J30 décalé de 5 jours, au 25 mai');
  assert.equal(kcOn(TOMATO, tomato, '2026-05-25', late), 0.9);
  assert.equal(kcOn(TOMATO, tomato, '2026-08-17', late), 0.7, 'la mi-récolte d\'OTF garde sa date');
  assert.deepEqual(staged(TOMATO, tomato, '2026-05-12', late).nextChange, { rank: 3, label: 'Floraison 3e bouquet → Mi-récolte', date: '2026-05-25' });
});

test('D-057 : un stade suivant dont la date est passée au jour déclaré ne revient pas seul', () => {
  // Formation du bulbe déclarée le 18 juin, après J-25 (17 juin) : le grossissement maximal ne vient pas.
  const bulb = [declaration(GARLIC, 'ail-sec', 2, '2026-06-18')];
  assert.equal(kcOn(GARLIC, garlic, '2026-06-18', bulb), 0.9);
  assert.equal(kcOn(GARLIC, garlic, '2026-06-21', bulb), 0.9);
  assert.equal(kcOn(GARLIC, garlic, '2026-06-22', bulb), 0, 'J-20 garde sa date et vient seul');
});

test('D-057 : la déclaration d\'une planche prime sur celle de la série', () => {
  const cauliflowerSeries = series('chou', [cultivation('cf', 'plant-cf', 'Chou-fleur', { expected: ['2026-W24'] })]);
  const cauliflower = datesOf(cauliflowerSeries, [task('chou', 'planting', '2026-W14')]);
  const declarations = [
    declaration(CAULIFLOWER, 'chou', 3, '2026-05-09'),
    declaration(CAULIFLOWER, 'chou', 2, '2026-05-01', { bedId: 'planche-a' }),
  ];
  assert.equal(kcOn(CAULIFLOWER, cauliflower, '2026-05-10', declarations, 'planche-a'), 1, 'la planche a sa propre déclaration');
  assert.equal(kcOn(CAULIFLOWER, cauliflower, '2026-05-15', declarations, 'planche-a'), 1);
  assert.equal(kcOn(CAULIFLOWER, cauliflower, '2026-05-16', declarations, 'planche-a'), 1.3, 'J50 recalé de −3 jours');
  assert.equal(kcOn(CAULIFLOWER, cauliflower, '2026-05-10', declarations, 'planche-b'), 1.3, 'une autre planche suit la série');
});

test('une correction remplace la déclaration du même stade ; à date égale, la dernière enregistrée fait foi', () => {
  const first = declaration(TOMATO, 'tomate', 3, '2026-05-15', { recordedAt: '2026-05-15T08:00:00.000Z' });
  const correction = declaration(TOMATO, 'tomate', 3, '2026-05-18', { recordedAt: '2026-05-18T08:00:00.000Z' });
  assert.equal(kcOn(TOMATO, tomato, '2026-05-16', [first]), 0.9);
  assert.equal(kcOn(TOMATO, tomato, '2026-05-16', [first, correction]), 0.6, 'la floraison corrigée au 18 mai');
  assert.equal(kcOn(TOMATO, tomato, '2026-05-18', [first, correction]), 0.9);

  const flowering = declaration(TOMATO, 'tomate', 3, '2026-05-12', { recordedAt: '2026-05-12T08:00:00.000Z' });
  const backwards = declaration(TOMATO, 'tomate', 2, '2026-05-12', { recordedAt: '2026-05-12T09:00:00.000Z' });
  assert.equal(kcOn(TOMATO, tomato, '2026-05-13', [flowering, backwards]), 0.6, 'stade corrigé en arrière');
  assert.equal(kcOn(TOMATO, tomato, '2026-05-13', [backwards, flowering]), 0.6, 'l\'ordre de lecture ne compte pas');
});

test('une déclaration d\'avant le jour 0, d\'un rang inconnu ou d\'une autre culture de référence est ignorée', () => {
  const ignored = [
    declaration(TOMATO, 'tomate', 3, '2026-04-10'),
    declaration(TOMATO, 'tomate', 9, '2026-05-01'),
    declaration(PEPPER_LIKE, 'tomate', 3, '2026-05-01'),
    declaration(TOMATO, 'autre-serie', 3, '2026-05-01'),
    declaration(TOMATO, 'tomate', 3, '2026-05-01', { bedId: 'autre-planche' }),
  ];
  assert.equal(kcOn(TOMATO, tomato, '2026-05-10', ignored), 0.6);
});

test('D-057 : déclarer une phase de la FAO déplace l\'origine du trapèze', () => {
  const broccoliSeries = series('brocoli', [cultivation('bro-c', 'plant-brocoli', 'Chou brocoli', { expected: ['2026-W30'] })]);
  const broccoli = datesOf(broccoliSeries, [task('brocoli', 'planting', '2026-W10')]);
  const full = [declaration(BROCCOLI, 'brocoli', 3, '2026-04-11')];
  assert.equal(kcOn(BROCCOLI, broccoli, '2026-04-10', full), 0.922, 'jour 39 calculé : 0,7 + 0,35 × 19 / 30');
  assert.equal(kcOn(BROCCOLI, broccoli, '2026-04-11', full), 1.05);
  const fullSeason = staged(BROCCOLI, broccoli, '2026-04-11', full);
  assert.equal(fullSeason.origin, 'observed');
  assert.deepEqual(fullSeason.nextChange, { rank: 4, label: 'Fin', date: '2026-05-01' });
  assert.equal(kcOn(BROCCOLI, broccoli, '2026-05-02', full), 1.04);
});

test('D-057 : sur un calendrier, une déclaration ouvre le cycle plus tôt et ne vaut que pour lui', () => {
  const asparagusSeries = series('asperge', [cultivation('asperge-c', 'plant-asperge', 'Asperge')], { cycle: 'perennial' });
  const asparagus = datesOf(asparagusSeries, [task('asperge', 'planting', '2024-W10')]);
  const early = [declaration(ASPARAGUS, 'asperge', 1, '2026-05-20')];
  assert.equal(stageOn(ASPARAGUS, asparagus, '2026-05-20').status, 'off-calendar');
  assert.equal(kcOn(ASPARAGUS, asparagus, '2026-05-20', early), 0.5, 'la fin de récolte déclarée ouvre le cycle');
  assert.equal(kcOn(ASPARAGUS, asparagus, '2026-06-07', early), 0.9, 'le débuttage vient à sa date');
  const summer = [declaration(ASPARAGUS, 'asperge', 3, '2026-06-20')];
  assert.equal(kcOn(ASPARAGUS, asparagus, '2026-06-25', summer), 0.7);
  assert.equal(kcOn(ASPARAGUS, asparagus, '2027-06-20', summer), 0.9, 'l\'année suivante, le calendrier reprend');
});

test('scénario 24 (D-057) : la culture reste sur sa planche jusqu\'à la plus tardive de ses récoltes ; le suivi par série garde sa règle', () => {
  const ongoing = series('tomate-en-cours', [cultivation('tc', 'plant-tomate', 'Tomate', { realized: weeks(27, 30), expected: weeks(27, 40) })]);
  const tasks = [task('tomate-en-cours', 'planting', '2026-W17')];
  const dates = datesOf(ongoing, tasks);
  assert.equal(dates.firstHarvest, '2026-06-29', 'la première récolte réalisée');
  assert.equal(dates.lastHarvest, '2026-10-04', 'la plus tardive, réalisée ou attendue');
  assert.equal(dates.midHarvest, '2026-08-17', 'la mi-récolte ne bouge pas quand les récoltes réalisées avancent');
  assert.equal(kcOn(TOMATO, dates, '2026-08-03'), 0.9, 'en 2026-W32, la tomate est toujours là');
  const occupation = resolveSeriesOccupation(ongoing, tasks, '2026-08-03');
  assert.ok(!('reason' in occupation));
  assert.equal(occupation.endDate, '2026-07-26', 'le suivi par série s\'arrête à la dernière semaine réalisée (D-022)');
});

test('un stade compté depuis une récolte inconnue attend : on reste au stade précédent, et c\'est signalé', () => {
  const noHarvest = series('tomate-sans-recolte', [cultivation('tsr', 'plant-tomate', 'Tomate')]);
  const dates = datesOf(noHarvest, [task('tomate-sans-recolte', 'planting', '2026-W17')]);
  const stage = staged(TOMATO, dates, '2026-09-30');
  assert.equal(stage.rank, 3);
  assert.equal(stage.waitingForHarvest, true);
  assert.equal(stage.nextChange, null);
  assert.equal(staged(TOMATO, dates, '2026-04-21').waitingForHarvest, true);
  assert.equal(kcOn(GARLIC, datesOf(series('ail-sans', [cultivation('as', 'plant-ail', 'Ail')]), [task('ail-sans', 'planting', '2025-W44')]), '2026-06-30'), 0.5);
});

test('l\'artichaut : 0,5 deux mois après la plantation la première année, puis son calendrier', () => {
  const spring = series('artichaut', [cultivation('art', 'plant-artichaut', 'Artichaut')], { cycle: 'perennial' });
  const dates = datesOf(spring, [task('artichaut', 'planting', '2026-W14')]);
  assert.equal(kcOn(ARTICHOKE, dates, '2026-04-15'), 0.5);
  assert.equal(kcOn(ARTICHOKE, dates, '2026-05-29'), 0.5);
  assert.deepEqual(staged(ARTICHOKE, dates, '2026-05-29').nextChange, { rank: 5, label: 'Fin 1re → Fin 2e récolte', date: '2026-05-30' });
  assert.equal(kcOn(ARTICHOKE, dates, '2026-05-30'), 0.6, 'deux mois après le 30 mars');
  assert.equal(stageOn(ARTICHOKE, dates, '2026-06-15').status, 'off-calendar', 'repos en juin et juillet');
  assert.equal(kcOn(ARTICHOKE, dates, '2026-08-01'), 0.8);
  assert.equal(kcOn(ARTICHOKE, dates, '2027-01-01'), 0.6, 'le cycle passe la fin de l\'année');

  const summer = series('artichaut-ete', [cultivation('art-e', 'plant-artichaut', 'Artichaut')], { cycle: 'perennial' });
  const summerDates = datesOf(summer, [task('artichaut-ete', 'planting', '2026-W27')]);
  assert.equal(kcOn(ARTICHOKE, summerDates, '2026-08-20'), 0.5, 'l\'installation prime sur le calendrier');
  assert.equal(kcOn(ARTICHOKE, summerDates, '2026-08-29'), 1.1);
  const declared = [declaration(ARTICHOKE, 'artichaut-ete', 4, '2026-08-20')];
  assert.equal(kcOn(ARTICHOKE, summerDates, '2026-08-20', declared), 1.1, 'un stade du calendrier déclaré met fin à l\'installation');
});

test('une série sans semaine d\'implantation ou en bloc n\'a pas de stade', () => {
  const lonely = series('sans-tache', [cultivation('st', 'plant-tomate', 'Tomate')]);
  assert.deepEqual(cultivationDates(lonely, lonely.cultivations[0], [], '2026-05-01'), {
    seriesId: 'sans-tache', seriesName: 'sans-tache', cultivationId: 'st', plantId: 'plant-tomate', plantName: 'Tomate', reason: 'no-implantation',
  });
  const block = series('bloc', [cultivation('b', 'plant-tomate', 'Tomate')], { use: 'block' });
  const unplaced = cultivationDates(block, block.cultivations[0], [task('bloc', 'planting', '2026-W17')], '2026-05-01');
  assert.equal('reason' in unplaced && unplaced.reason, 'block');
});

test('les mois s\'ajoutent au même jour, ramené au dernier jour d\'un mois plus court', () => {
  assert.equal(addMonthsToDateKey('2026-03-30', 2), '2026-05-30');
  assert.equal(addMonthsToDateKey('2026-03-31', 2), '2026-05-31');
  assert.equal(addMonthsToDateKey('2026-12-31', 2), '2027-02-28');
  assert.equal(addMonthsToDateKey('2027-12-31', 2), '2028-02-29');
  assert.equal(addMonthsToDateKey('2026-11-15', 2), '2027-01-15');
});

const PEPPER_LIKE: ReferenceCrop = { ...TOMATO, id: 'criiam-poivron' };

function addDays(dateKey: string, days: number): string {
  const date = new Date(`${dateKey}T12:00:00.000Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}
