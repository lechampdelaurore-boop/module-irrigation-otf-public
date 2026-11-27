import assert from 'node:assert/strict';
import test from 'node:test';
import { weekSections } from '../lib/domain/features/week-page';
import { SIMPLE_WORDS, TECHNICAL_WORDS } from '../lib/domain/simple-words';
import { weekHeading } from '../lib/domain/semaine/week-heading';
import { announcedRainText, toValidateText, weekBilan, weekSentence, type WeekFarmRow } from '../lib/domain/semaine/week-sentence';
import { weekDayEvents, weekDayLines, weekSlotText, type WeekDayEvent, type WeekWaterDay } from '../lib/domain/semaine/week-days';
import { WEEK_PAGE_GARDENS_SHOWN, weekGardens } from '../lib/domain/semaine/week-gardens';
import { GAP_SECTION_IDLE_LINE, PLAN_CURRENT_WEEK_ONLY, TIMER_AWAITING_LINE, WEEK_SECTION_TITLES, gapSectionLine, needsDetailLine, timerAwaiting, weekDetailSummary } from '../lib/domain/semaine/week-detail';
import { todayWeek, todayWeekInputs, WEEK_GARDENS_SHOWN, type TodayWeekBed } from '../lib/domain/today/week';
import { weekBar } from '../lib/domain/today/essential';
import { weekDateKeys } from '../lib/domain/water-management';
import type { IrrigationEventRecord } from '../lib/domain/irrigation-event-record';

/**
 * Simplifier l'usage du module, lot S4, PR 2 : le premier niveau de la page
 * « Semaine » (docs/simplification-s4-contract.md, sections 4 à 7 et 11) :
 * le titre et les flèches, la phrase, le bilan, « Jour par jour », « Jardin
 * par jardin », la ligne du détail. Des faits, jamais un jugement ; les mêmes
 * chiffres que sur « Aujourd'hui ».
 */

// Le titre et les flèches (section 4, point 1, et 4.1).

test('le titre : « Cette semaine », une semaine passée ou à venir, une autre saison, du lundi au dimanche', () => {
  const current = weekHeading({ weekStart: '2026-06-17', today: '2026-06-17', season: 2026, currentSeason: 2026 });
  assert.equal(current.state, 'current');
  assert.equal(current.title, 'Cette semaine');
  assert.equal(current.range, 'du lundi 15 au dimanche 21 juin');
  assert.equal(current.weekStart, '2026-06-15', 'un jour quelconque donné par « week » se ramène à son lundi');
  assert.equal(current.weekEnd, '2026-06-21');
  assert.equal(current.previous, '2026-06-08');
  assert.equal(current.next, '2026-06-22');
  assert.equal(current.thisWeek, null, '« Cette semaine » n’a pas de raccourci quand on y est (F470)');

  const past = weekHeading({ weekStart: '2026-06-08', today: '2026-06-17', season: 2026, currentSeason: 2026 });
  assert.equal(past.state, 'past');
  assert.equal(past.title, 'Semaine du 8 au 14 juin');
  assert.equal(past.thisWeek, '2026-06-15');

  const upcoming = weekHeading({ weekStart: '2026-06-29', today: '2026-06-17', season: 2026, currentSeason: 2026 });
  assert.equal(upcoming.state, 'upcoming');
  assert.equal(upcoming.title, 'Semaine du 29 juin au 5 juillet');
  assert.equal(upcoming.range, 'du lundi 29 juin au dimanche 5 juillet');

  const otherSeason = weekHeading({ weekStart: '2025-06-09', today: '2026-06-17', season: 2025, currentSeason: 2026 });
  assert.equal(otherSeason.title, 'Semaine du 9 au 15 juin 2025', 'la saison dite dans le titre');
});

test('le titre : une semaine qui change d’heure, une semaine à cheval sur deux années, le premier du mois', () => {
  // Le dimanche 25 octobre 2026, l'heure d'hiver : la semaine reste du lundi au dimanche (D-004).
  const autumn = weekHeading({ weekStart: '2026-10-25', today: '2026-10-21', season: 2026, currentSeason: 2026 });
  assert.equal(autumn.weekStart, '2026-10-19');
  assert.equal(autumn.weekEnd, '2026-10-25');
  assert.deepEqual(weekDateKeys(autumn.weekStart), ['2026-10-19', '2026-10-20', '2026-10-21', '2026-10-22', '2026-10-23', '2026-10-24', '2026-10-25']);
  const newYear = weekHeading({ weekStart: '2026-12-28', today: '2026-11-25', season: 2026, currentSeason: 2026 });
  assert.equal(newYear.title, 'Semaine du 28 décembre 2026 au 3 janvier 2027');
  assert.equal(newYear.range, 'du lundi 28 décembre 2026 au dimanche 3 janvier 2027');
  const first = weekHeading({ weekStart: '2026-06-01', today: '2026-06-17', season: 2026, currentSeason: 2026 });
  assert.equal(first.title, 'Semaine du 1er au 7 juin');
});

// La phrase (section 4.2).

function farm(overrides: Partial<WeekFarmRow> = {}): WeekFarmRow {
  return { objectiveMm: 23, irrigationMm: 8, rainMm: 4, receivedMm: 12, remainingMm: 11, objectiveBeds: { withObjective: 10, total: 10 }, ...overrides };
}

const NO_RAIN: readonly (number | null)[] = [];

test('la phrase, chaque cas de la section 4.2 : des faits chiffrés, jamais un jugement', () => {
  const current = (row: WeekFarmRow | null, toValidate = 0) => weekSentence({ state: 'current', farm: row, forecastRainMm: NO_RAIN, rainMatters: true, toValidate });
  assert.equal(current(farm()), '12 mm reçus sur 23 mm visés. Il manque encore 11 mm d’ici dimanche.');
  assert.equal(current(farm({ receivedMm: 25, rainMm: 17, remainingMm: 0 })), '25 mm reçus sur 23 mm visés.', 'jamais « il manque » négatif');
  assert.equal(current(farm(), 2), '12 mm reçus sur 23 mm visés. Il manque encore 11 mm d’ici dimanche. 2 arrosages restent à valider.');
  assert.equal(current(farm(), 1).endsWith('1 arrosage reste à valider.'), true);
  assert.equal(current(farm({ rainMm: null, receivedMm: null, remainingMm: null })), '8 mm irrigués sur 23 mm visés, pluie inconnue. Ce qui manque est inconnu.', 'l’eau reçue inconnue est dite inconnue (D-003)');
  assert.equal(current(farm({ objectiveMm: null })), SIMPLE_WORDS.weekNoGoal);
  assert.equal(current(null), 'Aucune eau visée cette semaine.');
  assert.equal(current(farm({ objectiveBeds: { withObjective: 7, total: 10 } })), '12 mm reçus sur 23 mm visés (7 planches de 10 ont un objectif). Il manque encore 11 mm d’ici dimanche.', 'un seul « sur » par phrase (F443)');

  const past = (row: WeekFarmRow) => weekSentence({ state: 'past', farm: row, forecastRainMm: NO_RAIN, rainMatters: true, toValidate: 3 });
  assert.equal(past(farm({ receivedMm: 21, remainingMm: 2 })), '21 mm reçus sur 23 mm visés : il a manqué 2 mm.', 'une semaine passée ne dit rien à valider');
  assert.equal(past(farm({ receivedMm: 25, remainingMm: 0 })), '25 mm reçus sur 23 mm visés.');

  const upcoming = (forecast: readonly (number | null)[], rainMatters = true) => weekSentence({ state: 'upcoming', farm: farm({ receivedMm: 0, irrigationMm: 0, rainMm: 0, remainingMm: 23 }), forecastRainMm: forecast, rainMatters, toValidate: 2 });
  assert.equal(upcoming([2, 4, 0, 8, 0, 0, 0]), '23 mm visés. 14 mm de pluie annoncés.');
  assert.equal(upcoming([null, null, null, null, null, null, null]), '23 mm visés. Pluie annoncée non disponible.');
  assert.equal(upcoming([5, null, null, null, null, null, null]), '23 mm visés. Au moins 5 mm de pluie annoncés.');
  assert.equal(upcoming([2, 4, 0, 8, 0, 0, 0], false), '23 mm visés.', 'une ferme toute sous abri ne dit pas la pluie (D-032)');
  assert.equal(announcedRainText([1.24], true), '1,2 mm de pluie annoncés.');
  assert.equal(toValidateText(0), null);
});

test('les mots de la phrase et du bilan : sous le test de garde de S1, sans jugement ni « pris au bassin »', () => {
  const texts = [
    weekSentence({ state: 'current', farm: farm(), forecastRainMm: NO_RAIN, rainMatters: true, toValidate: 2 }),
    weekSentence({ state: 'past', farm: farm({ remainingMm: 2 }), forecastRainMm: NO_RAIN, rainMatters: true, toValidate: 0 }),
    weekSentence({ state: 'upcoming', farm: farm(), forecastRainMm: [null], rainMatters: true, toValidate: 0 }),
    PLAN_CURRENT_WEEK_ONLY,
    TIMER_AWAITING_LINE,
    ...Object.values(WEEK_SECTION_TITLES),
  ];
  for (const text of texts) {
    for (const word of [...TECHNICAL_WORDS, 'bonne', 'mauvaise', 'à moitié', 'pris au bassin', 'ET0', 'insuffisant', 'suffisant']) {
      assert.ok(!text.toLocaleLowerCase('fr-FR').includes(word.toLocaleLowerCase('fr-FR')), `« ${text} » dit « ${word} »`);
    }
  }
  assert.equal(SIMPLE_WORDS.weekMissed, 'il a manqué');
  assert.equal(SIMPLE_WORDS.rainAnnounced, 'de pluie annoncés');
  assert.equal(SIMPLE_WORDS.rainAnnouncedUnknown, 'Pluie annoncée non disponible.');
});

// Le bilan et les jardins : les chiffres d'« Aujourd'hui » (sections 4.3, 4.4 et 6).

function bed(plotId: string, plotName: string, overrides: Partial<TodayWeekBed> = {}): TodayWeekBed {
  return { plotId, plotName, sheltered: false, areaSquareMeters: 10, objectiveMm: 20, actualRainMm: 4, actualIrrigationMm: 8, realRemainingMm: 8, ...overrides };
}

const DAYS = weekDateKeys('2026-06-15').map((date, index) => ({
  date,
  manualRainMm: index === 0 ? 4 : null,
  reanalysisRainMm: null,
  forecastRainMm: index > 2 ? 1 : null,
  volumeIncomplete: false,
}));

function inputs(beds: readonly TodayWeekBed[]) {
  return todayWeekInputs(
    { days: DAYS, totals: { realizedIrrigationCubicMeters: 1.4 }, todayWater: { realizedIrrigationCubicMeters: 0.3 } },
    { weekStart: '2026-06-15', weekEnd: '2026-06-21', gardens: [{ beds }] },
    '2026-06-17',
  );
}

test('le bilan : la barre reçus sur visés, pleine au-delà de 100 %, et trois chiffres, reçus, visés, arrosés', () => {
  const week = todayWeek(inputs([bed('p1', 'Jardin Nord'), bed('p2', 'Abri', { objectiveMm: 30, realRemainingMm: 18 })]));
  assert.ok(week);
  const bilan = weekBilan(week);
  assert.ok(bilan.bar);
  assert.equal(bilan.bar.label, '12 mm reçus sur 25 mm visés');
  assert.equal(bilan.bar.irrigationPercent, 32);
  assert.equal(bilan.bar.rainPercent, 16);
  assert.equal(bilan.received.value, '12 mm');
  assert.equal(bilan.received.detail, '8 mm d’irrigation, 4 mm de pluie mesurée', 'l’origine de la pluie gardée (F429, D-006)');
  assert.equal(bilan.objective.value, '25 mm');
  assert.equal(bilan.objective.detail, 'ferme entière');
  assert.equal(bilan.watered.value, '1,4 m³', 'des m³ arrosés, jamais « pris au bassin » (S4-d)');

  const over = weekBilan(todayWeek(inputs([bed('p1', 'Jardin Nord', { objectiveMm: 5, realRemainingMm: 0 })]))!);
  assert.equal(over.bar?.irrigationPercent, 100, 'au-delà de 100 %, la barre reste pleine');
  assert.equal(over.bar?.rainPercent, 0);
  assert.equal(over.bar?.label, '12 mm reçus sur 5 mm visés', 'le chiffre dit le dépassement');

  const none = weekBilan(todayWeek(inputs([bed('p1', 'Jardin Nord', { objectiveMm: null, realRemainingMm: null })]))!);
  assert.equal(none.bar, null, 'sans objectif, pas de barre');
  assert.equal(none.objective.value, null);

  const unknown = weekBilan(todayWeek(inputs([bed('p1', 'Jardin Nord', { actualRainMm: null, realRemainingMm: null })]))!);
  assert.equal(unknown.bar?.unknown, true);
  assert.equal(unknown.bar?.label, '8 mm irrigués sur 20 mm visés, pluie inconnue');
  assert.equal(unknown.received.value, null, 'jamais zéro (D-003)');
});

test('l’objectif, l’eau reçue et les jardins sont la même valeur que sur « Aujourd’hui », pour la même ferme', () => {
  const beds = Array.from({ length: 12 }, (_, index) => bed(`p${index + 1}`, `Jardin ${index + 1}`, { objectiveMm: index === 11 ? null : 10 + index, realRemainingMm: index === 11 ? null : Math.max(0, 10 + index - 12) }));
  const today = todayWeek(inputs(beds));
  const semaine = todayWeek(inputs(beds), new Set(), WEEK_PAGE_GARDENS_SHOWN);
  assert.ok(today && semaine);
  assert.deepEqual(semaine.farm, today.farm, 'la ligne de la ferme ne dépend pas du nombre de jardins montrés');
  assert.deepEqual(semaine.tiles, today.tiles);
  assert.equal(today.shown.length, WEEK_GARDENS_SHOWN);
  assert.equal(semaine.shown.length, 10);
  const rows = new Map([...today.shown, ...today.hidden].map((row) => [row.key, row]));
  for (const row of [...semaine.shown, ...semaine.hidden]) assert.deepEqual(row, rows.get(row.key), row.key);
  // La barre « La semaine » d'« Aujourd'hui » et la phrase de la page lisent les mêmes millimètres.
  const sentence = weekSentence({ state: 'current', farm: semaine.farm, forecastRainMm: NO_RAIN, rainMatters: true, toValidate: 0 });
  const bar = weekBar(today);
  assert.equal(bar.kind, 'bar');
  const remaining = /Il manque encore ([\d,]+ mm)/;
  assert.equal(sentence.match(remaining)?.[1], bar.sentence.match(remaining)?.[1]);
  assert.match(bar.sentence, new RegExp(`${weekBilan(semaine).objective.value} visés`));
});

test('« Jardin par jardin » : dix jardins puis « Voir les n autres », « pas d’eau visée », les planches non comptées dites une fois', () => {
  const beds = [
    ...Array.from({ length: 11 }, (_, index) => bed(`p${index + 1}`, `Jardin ${index + 1}`)),
    bed('p12', 'Jardin 12', { objectiveMm: null, realRemainingMm: null }),
  ];
  const gardens = weekGardens(todayWeek(inputs(beds), new Set(), WEEK_PAGE_GARDENS_SHOWN)!);
  assert.equal(gardens.shown.length, 10);
  assert.equal(gardens.hidden.length, 2);
  assert.equal(gardens.moreLabel, 'Voir les 2 autres jardins');
  const all = [...gardens.shown, ...gardens.hidden];
  assert.equal(all.length, 12, 'aucun jardin n’est perdu');
  const nord = all.find((line) => line.key === 'p1');
  assert.equal(nord?.text, '12 mm sur 20 mm');
  assert.equal(nord?.anchor, 'besoin-jardin-p1', 'son pli dans « Ce qu’il reste à arroser »');
  assert.equal(nord?.bar?.irrigationPercent, 40);
  assert.equal(nord?.bar?.rainPercent, 20);
  const none = all.find((line) => line.key === 'p12');
  assert.equal(none?.text, 'pas d’eau visée');
  assert.equal(none?.bar, null);
  assert.equal(none?.aimed, false);
  assert.equal(gardens.unaimedBeds, '1 planche n’a pas d’eau visée : elle n’est pas comptée.');
  assert.equal(weekGardens(todayWeek(inputs([bed('p1', 'A')]))!).unaimedBeds, null);
});

// « Jour par jour » (section 5).

function day(date: string, overrides: Partial<WeekWaterDay> = {}): WeekWaterDay {
  return { date, realizedIrrigationCubicMeters: 0, volumeIncomplete: false, manualRainMm: null, reanalysisRainMm: null, forecastRainMm: null, limitExceededByCubicMeters: 0, actualLimitExceededByCubicMeters: 0, ...overrides };
}

function event(id: string, dateKey: string, overrides: Partial<WeekDayEvent> = {}): WeekDayEvent {
  return { id, dateKey, plannedStartAt: `${dateKey}T05:00:00.000Z`, status: 'completed', running: false, equipmentName: 'Abri des noues', ...overrides };
}

const WEEK = weekDateKeys('2026-06-15');
const NOW = new Date('2026-06-17T10:00:00.000Z');

test('« Jour par jour » : sept lignes, une par jour, aujourd’hui marqué, ce qui s’est fait, ce qui tourne, ce qui est planifié, la pluie avec son mot', () => {
  const view = weekDayLines({
    weekStart: '2026-06-15',
    today: '2026-06-17',
    now: NOW,
    state: 'current',
    days: [
      day(WEEK[0], { realizedIrrigationCubicMeters: 1.4, manualRainMm: 4 }),
      day(WEEK[1], { realizedIrrigationCubicMeters: 0.4, volumeIncomplete: true, reanalysisRainMm: 2.5 }),
      day(WEEK[2], { forecastRainMm: 3, limitExceededByCubicMeters: 0.2 }),
      day(WEEK[3], { forecastRainMm: 5 }),
      day(WEEK[4], { forecastRainMm: 6 }),
      day(WEEK[5], { forecastRainMm: 0 }),
      day(WEEK[6]),
    ],
    events: [
      ...Array.from({ length: 4 }, (_, index) => event(`fait-${index}`, WEEK[0])),
      event('partiel', WEEK[1], { status: 'partially_completed' }),
      event('tourne', WEEK[2], { status: 'planned', running: true }),
      event('prevu', WEEK[2], { status: 'planned', plannedStartAt: '2026-06-17T16:00:00.000Z' }),
      event('du-plan', WEEK[2], { status: 'planned', plannedStartAt: '2026-06-17T18:00:00.000Z' }),
      event('annule', WEEK[3], { status: 'canceled' }),
    ],
    plan: { [WEEK[2]]: { total: 2, toValidate: 1 } },
    shownEventIds: new Set(['du-plan']),
    rainMatters: true,
  });
  assert.equal(view.lines.length, 7);
  assert.deepEqual(view.lines.map((line) => line.dateKey), WEEK, 'chaque jour a une ligne et une seule');
  const [monday, tuesday, wednesday, thursday, friday, saturday, sunday] = view.lines;
  assert.equal(monday.label, 'Lundi 15 juin');
  assert.equal(monday.shortLabel, 'lun. 15');
  assert.deepEqual(monday.facts, ['4 arrosages faits · 1,4 m³', 'pluie 4 mm, mesurée']);
  assert.deepEqual(tuesday.facts, ['1 arrosage fait · au moins 400 L', 'pluie 2,5 mm, estimée'], 'le volume incomplet le dit, jamais une somme fausse');
  assert.equal(wednesday.today, true);
  assert.deepEqual(wednesday.ongoing, ['Abri des noues'], 'en cours : démarré et terminé sur « Aujourd’hui » (S4-h)');
  assert.deepEqual(wednesday.facts, ['Planifié · 18 h', 'pluie 3 mm, annoncée', 'limite dépassée'], 'le créneau du plan déjà montré n’est pas redit');
  assert.equal(wednesday.toValidate, 1);
  assert.equal(wednesday.calm, false);
  assert.equal(thursday.calm, true, 'un jour annulé ne compte pas');
  assert.equal(thursday.calmText, 'Rien de prévu');
  assert.deepEqual(thursday.calmRun, { role: 'start', label: 'jeu. 18 au ven. 19 · Rien de prévu · 11 mm de pluie annoncés', days: 2, noteRainDate: null });
  assert.deepEqual(friday.calmRun, { role: 'member' }, 'un jour calme n’est jamais masqué : il est compté (F301)');
  assert.deepEqual(saturday.calmRun, { role: 'start', label: 'sam. 20 au dim. 21 · Rien de prévu', days: 2, noteRainDate: null }, 'une pluie annoncée nulle ne se dit pas');
  assert.deepEqual(sunday.calmRun, { role: 'member' });
  assert.deepEqual(view.lines.map((line) => line.fold), ['past', 'past', 'open', 'open', 'open', 'open', 'open']);
  assert.equal(view.pastCount, 2);
});

test('« Jour par jour » : un jour écoulé qui porte un arrosage planifié, jamais démarré, reste ouvert ; une autre semaine ne replie rien', () => {
  const base = { weekStart: '2026-06-15', today: '2026-06-17', now: NOW, days: WEEK.map((date) => day(date)), plan: null, rainMatters: true } as const;
  const late = weekDayLines({ ...base, state: 'current', events: [event('retard', WEEK[1], { status: 'planned', plannedStartAt: '2026-06-16T05:00:00.000Z' })] });
  assert.equal(late.lines[1].fold, 'open');
  assert.deepEqual(late.lines[1].facts, ['Planifié · 7 h, heure passée']);
  assert.equal(late.lines[0].fold, 'past');
  assert.equal(late.lines[0].calmText, 'Rien d’arrosé');
  assert.equal(late.pastCount, 1);
  const past = weekDayLines({ ...base, weekStart: '2026-06-08', state: 'past', today: '2026-06-17', days: weekDateKeys('2026-06-08').map((date) => day(date)), events: [] });
  assert.ok(past.lines.every((line) => line.fold === 'open'), 'les jours d’une semaine passée restent ouverts');
  assert.ok(past.lines.every((line) => line.toValidate === 0), 'aucun créneau à valider hors de la semaine en cours (S4-l)');
  assert.deepEqual(past.lines[0].calmRun, { role: 'start', label: 'lun. 8 au dim. 14 · Rien d’arrosé', days: 7, noteRainDate: '2026-06-14' }, 'la suite offre « Noter la pluie » sur son dernier jour à noter');
});

test('« Jour par jour » : une ferme toute sous abri ne dit pas la pluie ; une mesure du jour l’emporte sur l’annonce', () => {
  const days = WEEK.map((date) => day(date, { forecastRainMm: 4, manualRainMm: date === WEEK[2] ? 1.5 : null }));
  const sheltered = weekDayLines({ weekStart: '2026-06-15', today: '2026-06-17', now: NOW, state: 'current', days, events: [], plan: null, rainMatters: false });
  assert.ok(sheltered.lines.every((line) => line.facts.every((fact) => !fact.includes('pluie'))));
  const open = weekDayLines({ weekStart: '2026-06-15', today: '2026-06-17', now: NOW, state: 'current', days, events: [], plan: null, rainMatters: true });
  assert.deepEqual(open.lines[2].facts, ['pluie 1,5 mm, mesurée']);
  assert.deepEqual(open.lines[3].facts, ['pluie 4 mm, annoncée']);
  assert.deepEqual(open.lines[0].facts, ['pluie 4 mm, annoncée'], 'un jour passé sans mesure ni réanalyse garde la prévision, avec son mot (D-019)');
});

test('« Noter la pluie » sur la ligne d’un jour (8.3) : un jour passé de la fenêtre dont la pluie réelle manque, jamais aujourd’hui ni à l’abri', () => {
  const days = WEEK.map((date, index) => day(date, {
    manualRainMm: index === 0 ? 3 : null,
    reanalysisRainMm: index === 1 ? 2 : null,
  }));
  const base = { weekStart: '2026-06-15', today: '2026-06-18', now: new Date('2026-06-18T10:00:00.000Z'), state: 'current', days, events: [], plan: null } as const;
  const view = weekDayLines({ ...base, rainMatters: true });
  assert.deepEqual(view.lines.map((line) => line.noteRain), [false, false, true, false, false, false, false],
    'lundi mesuré, mardi estimé, mercredi sans pluie réelle ; jeudi est aujourd’hui ; la suite est à venir');
  assert.ok(weekDayLines({ ...base, rainMatters: false }).lines.every((line) => !line.noteRain), 'une ferme toute sous abri n’a pas ce geste (D-032)');
  // Plus de sept jours en arrière, la fenêtre ne propose plus le jour : « Pluie mesurée » du détail le prend.
  const old = weekDayLines({ ...base, today: '2026-06-24', now: new Date('2026-06-24T10:00:00.000Z'), state: 'past', rainMatters: true });
  assert.deepEqual(old.lines.map((line) => line.noteRain), [false, false, true, true, true, true, true]);
  // L'année change : la fenêtre ne remonte pas dans la saison d'avant.
  const newYear = weekDayLines({ weekStart: '2025-12-29', today: '2026-01-02', now: new Date('2026-01-02T10:00:00.000Z'), state: 'current', days: weekDateKeys('2025-12-29').map((date) => day(date)), events: [], plan: null, rainMatters: true });
  assert.deepEqual(newYear.lines.map((line) => line.noteRain), [false, false, false, true, false, false, false]);
});

test('les irrigations de la semaine, réduites pour « Jour par jour » : le jour de la ferme, les annulées écartées', () => {
  const record = (id: string, status: IrrigationEventRecord['status'], plannedStartAt: string, timerState: 'running' | null = null) => ({
    id, status, createdAt: plannedStartAt,
    equipment: { plannedStartAt, actualStartAt: status === 'completed' ? plannedStartAt : null, timerStartedAt: null, timerState, equipmentSnapshot: { name: `Matériel ${id}` } },
  }) as unknown as IrrigationEventRecord;
  const events = weekDayEvents([
    record('a', 'completed', '2026-06-14T22:30:00.000Z'),
    record('b', 'planned', '2026-06-21T21:59:00.000Z', 'running'),
    record('c', 'canceled', '2026-06-16T05:00:00.000Z'),
    record('d', 'planned', '2026-06-21T22:30:00.000Z'),
  ], '2026-06-15');
  assert.deepEqual(events.map((item) => [item.id, item.dateKey, item.running]), [['a', '2026-06-15', false], ['b', '2026-06-21', true]], 'minuit de Paris, pas de l’UTC (D-004)');
});

test('la ligne compacte d’un créneau à valider : l’heure, le matériel, la durée, la dose', () => {
  assert.equal(weekSlotText({ startAt: '2026-06-17T07:29:00.000Z', equipmentName: 'Abri des noues', durationSeconds: 81 * 60, doseMm: 8 }), '9 h 29 · Abri des noues · 1 h 21 · 8 mm');
  assert.equal(weekSlotText({ startAt: '2026-12-17T06:00:00.000Z', equipmentName: 'Rampe', durationSeconds: 1800, doseMm: 4.26 }), '7 h · Rampe · 30 min · 4,3 mm', 'l’heure de la ferme, l’hiver aussi (D-004)');
});

// « Le détail » (section 7).

test('« Le détail » : sa ligne dit ce qu’il contient, ses sections suivent les cases ; le minuteur en une ligne', () => {
  assert.equal(weekDetailSummary(weekSections(['materiel', 'arrosages', 'besoins', 'planning']), 3), '3 jardins · le besoin par planche · le plan · l’eau visée · la pluie · la météo · les jours · l’écart du prévu · les réglages');
  assert.equal(weekDetailSummary(weekSections(['materiel', 'arrosages', 'besoins']), 1), '1 jardin · le besoin par planche · l’eau visée · la pluie · la météo · les jours · les réglages');
  assert.equal(WEEK_SECTION_TITLES['reste-a-arroser'], SIMPLE_WORDS.leftToWater);
  assert.equal(WEEK_SECTION_TITLES['eau-visee'], SIMPLE_WORDS.weekGoal);
  assert.equal(timerAwaiting([{ estimatedOngoingCubicMeters: 0 }], { estimatedOngoingCubicMeters: 0.2 }), true);
  assert.equal(timerAwaiting([{ estimatedOngoingCubicMeters: 0 }], null), false);
  // Les lignes des sections qui n'en avaient pas (section 7.1) : des faits, comptés.
  assert.equal(needsDetailLine(3), '3 jardins, le besoin de chaque planche et son calcul');
  assert.equal(needsDetailLine(1), '1 jardin, le besoin de chaque planche et son calcul');
  assert.equal(needsDetailLine(0), 'Aucun jardin cette saison.');
  assert.equal(gapSectionLine(1), '1 planche s’écarte du prévu');
  assert.equal(gapSectionLine(2), '2 planches s’écartent du prévu');
  // Lu à l'ouverture de sa section (3.4, F918) : avant la lecture, ce qu'elle montrera ; sans signal, une ligne et pas de bloc (F735).
  assert.equal(gapSectionLine(null), GAP_SECTION_IDLE_LINE);
  assert.equal(gapSectionLine(0), 'Aucune planche ne s’écarte du prévu');
});
