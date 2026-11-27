import assert from 'node:assert/strict';
import test from 'node:test';
import { TECHNICAL_WORDS } from '../lib/domain/simple-words.ts';
import { addDaysToDateKey } from '../lib/domain/water-management.ts';
import {
  dailyLineText,
  ESTIMATED_RAIN_RESERVE_TEXT,
  FORECAST_RELIABILITY_MINIMUM_PAIRS,
  forecastPairs,
  forecastReliability,
  forecastReliabilityHeadline,
  forecastReliabilityWindow,
  rainDaysText,
  thirstReserveText,
  weekLineText,
  weekPairs,
  type ForecastReliabilityInput,
  type ReliabilityArchiveRow,
  type ReliabilityRealisedRow,
} from '../lib/domain/weather/forecast-reliability.ts';

/**
 * La météo prévue contre la météo réalisée, le domaine
 * (docs/forecast-reliability-contract.md, section 8, tests 1 à 7, 9 et 10 ;
 * D-338, PR 1). Le test 8 (deux fermes au même lieu) se joue sur la base de
 * test, dans tests/db/forecast-reliability.test.ts ; le test 12 (aucun calcul
 * changé) est la suite entière, rejouée sans qu'aucun test existant ne soit
 * modifié.
 */

const VANNES = 'custom:vannes:56000';
const AURAY = 'custom:auray:56400';
/** Jeudi 31 décembre 2026 : la fenêtre va du 2 octobre au 30 décembre. */
const TODAY = '2026-12-31';

function forecast(issuedOn: string, horizonDays: number, rain: number | null, et0: number | null = null, locationKey = VANNES): ReliabilityArchiveRow {
  return { locationKey, issuedOn, targetDate: addDaysToDateKey(issuedOn, horizonDays), horizonDays, precipitationMm: rain, et0Mm: et0 };
}

function reanalysis(date: string, rain: number | null, et0: number | null = null, locationKey = VANNES): ReliabilityRealisedRow {
  return { locationKey, date, dataKind: 'reanalysis', precipitationMm: rain, et0Mm: et0 };
}

function measured(date: string, rain: number): ReliabilityRealisedRow {
  return { locationKey: 'farm:manual', date, dataKind: 'manual_precipitation', precipitationMm: rain, et0Mm: null };
}

function input(archive: ReliabilityArchiveRow[], realised: ReliabilityRealisedRow[], extra: Partial<ForecastReliabilityInput> = {}): ForecastReliabilityInput {
  return { today: TODAY, locationKey: VANNES, archive, realised, ...extra };
}

/**
 * `days` jours visés consécutifs à partir de `firstTarget`, chacun annoncé à
 * tous les horizons de `horizons` ; la prévision vaut `rain(horizon)`, le
 * réalisé `realisedRain`.
 */
function series(firstTarget: string, days: number, horizons: readonly number[], rain: (horizon: number) => number, realisedRain: number, et0 = { forecast: 2, realised: 1.5 }) {
  const archive: ReliabilityArchiveRow[] = [];
  const realised: ReliabilityRealisedRow[] = [];
  for (let index = 0; index < days; index += 1) {
    const target = addDaysToDateKey(firstTarget, index);
    for (const horizon of horizons) archive.push(forecast(addDaysToDateKey(target, -horizon), horizon, rain(horizon), et0.forecast));
    realised.push(reanalysis(target, realisedRain, et0.realised));
  }
  return { archive, realised };
}

test('test 1 : la prévision émise le 1er pour le 3 est comparée au réalisé du 3, à l’horizon 2, jamais à un autre jour', () => {
  const pairs = forecastPairs(input(
    [forecast('2026-12-01', 2, 6)],
    [reanalysis('2026-12-02', 9), reanalysis('2026-12-03', 4), reanalysis('2026-12-04', 0)],
  ), 'rainEstimated');
  assert.deepEqual(pairs, [{ targetDate: '2026-12-03', issuedOn: '2026-12-01', horizonDays: 2, forecastMm: 6, realisedMm: 4 }]);
  const incoherent = forecastPairs(input([{ ...forecast('2026-12-01', 2, 6), horizonDays: 3 }], [reanalysis('2026-12-03', 4), reanalysis('2026-12-04', 4)]), 'rainEstimated');
  assert.deepEqual(incoherent, [], 'une ligne dont l’horizon ne mène pas au jour visé n’entre pas');
});

test('test 2 : une valeur absente ne fait pas de couple et n’est jamais lue comme 0 ; une pluie réelle de 0 mm, si', () => {
  const pairs = forecastPairs(input(
    [forecast('2026-12-01', 1, null), forecast('2026-12-02', 1, 3), forecast('2026-12-03', 1, 3), forecast('2026-12-04', 1, 3)],
    [reanalysis('2026-12-02', 5), reanalysis('2026-12-03', null, 1.2), reanalysis('2026-12-05', 0)],
  ), 'rainEstimated');
  assert.deepEqual(pairs.map((pair) => [pair.targetDate, pair.forecastMm, pair.realisedMm]), [['2026-12-05', 3, 0]],
    'le 2 : prévision absente ; le 3 : réalisé absent (la soif seule) ; le 4 : aucun réalisé ; le 5 : 0 mm réels');
  const thirst = forecastPairs(input([forecast('2026-12-02', 1, 3, null)], [reanalysis('2026-12-03', 2, 1.2)]), 'thirst');
  assert.deepEqual(thirst, [], 'la soif annoncée absente');
});

test('test 3 : l’écart moyen garde son signe, l’écart absolu non ; un jour de pluie commence à 1 mm, les deux erreurs comptées à part', () => {
  const { archive, realised } = series('2026-12-01', 14, [1], () => 5, 1);
  const result = forecastReliability(input(archive, realised));
  const line = result.rainEstimated.daily[0];
  assert.equal(line.pairCount, 14);
  assert.deepEqual(line.gaps, { meanGapMm: 4, meanAbsoluteGapMm: 4 }, 'prévu 5, réalisé 1 : +4');
  assert.match(dailyLineText('rainEstimated', line), /elle était trop pluvieuse, de 4 mm par jour en moyenne\./);

  const mixed = series('2026-11-01', 7, [1], () => 3, 1);
  const lower = series('2026-11-08', 7, [1], () => 1, 3);
  const both = forecastReliability(input([...mixed.archive, ...lower.archive], [...mixed.realised, ...lower.realised]));
  assert.deepEqual(both.rainEstimated.daily[0].gaps, { meanGapMm: 0, meanAbsoluteGapMm: 2 }, '+2 et −2 : en moyenne 0, en valeur absolue 2');

  const threshold = (rain: number, real: number, from: string) => series(from, 7, [1], () => rain, real);
  const dryAnnounced = threshold(1, 0.9, '2026-11-01');
  const wetMissed = threshold(0.9, 1, '2026-11-08');
  const misses = forecastReliability(input([...dryAnnounced.archive, ...wetMissed.archive], [...dryAnnounced.realised, ...wetMissed.realised]));
  assert.deepEqual(misses.rainEstimated.daily[0].rainDays, { announcedButDryDays: 7, fellButUnannouncedDays: 7 },
    '1,0 mm annoncé et 0,9 mm tombé : annoncée mais pas tombée ; l’inverse : tombée sans être annoncée');
  assert.equal(rainDaysText(misses.rainEstimated.daily[0]), 'Pluie annoncée mais pas tombée : 7 jours ; tombée sans être annoncée : 7 jours, sur 14 jours comparés.');
  assert.equal(misses.thirst.daily[0].rainDays, null, 'la soif ne compte pas de jours de pluie');
});

test('test 4 : la semaine se lit sur la prévision du dimanche, lundi à dimanche ; un jour manquant, et elle n’entre pas', () => {
  // Dimanche 6 décembre : l'annonce de la semaine du lundi 7 au dimanche 13.
  const archive = [1, 2, 3, 4, 5, 6, 7].map((horizon) => forecast('2026-12-06', horizon, horizon, 2));
  const realised = [0, 1, 2, 3, 4, 5, 6].map((index) => reanalysis(addDaysToDateKey('2026-12-07', index), 1, 1.5));
  // Une prévision d'un autre jour d'émission pour la même semaine n'y entre pas.
  const other = forecast('2026-12-07', 1, 40, 2);
  assert.deepEqual(weekPairs(input([...archive, other], realised), 'rainEstimated'), [{ weekStart: '2026-12-07', forecastMm: 28, realisedMm: 7 }]);
  assert.deepEqual(weekPairs(input([...archive, other], realised), 'thirst'), [{ weekStart: '2026-12-07', forecastMm: 14, realisedMm: 10.5 }]);
  assert.deepEqual(weekPairs(input(archive, realised.slice(0, 6)), 'rainEstimated'), [], 'le dimanche 13 sans réalisé');
  assert.deepEqual(weekPairs(input(archive.filter((row) => row.horizonDays !== 4), realised), 'rainEstimated'), [], 'le jeudi sans ligne d’archive');
});

test('test 5 : 13 couples, rien que « 13 sur 14 » ; 14, les nombres paraissent ; trois semaines, rien ; quatre, le cumul', () => {
  const thirteen = series('2026-12-01', 13, [1], () => 2, 1);
  const short = forecastReliability(input(thirteen.archive, thirteen.realised));
  assert.equal(short.rainEstimated.daily[0].pairCount, 13);
  assert.equal(short.rainEstimated.daily[0].gaps, null);
  assert.equal(short.rainEstimated.daily[0].rainDays, null);
  assert.equal(dailyLineText('rainEstimated', short.rainEstimated.daily[0]), 'Demain et après-demain : Pas encore assez de jours : 13 sur 14.');
  assert.equal(short.status, 'collecting');
  const fourteen = series('2026-12-01', 14, [1], () => 2, 1);
  const enough = forecastReliability(input(fourteen.archive, fourteen.realised));
  assert.notEqual(enough.rainEstimated.daily[0].gaps, null);
  assert.equal(enough.status, 'ready');
  assert.equal(FORECAST_RELIABILITY_MINIMUM_PAIRS, 14);

  // Des semaines complètes, annoncées le dimanche d'avant : 23 novembre à 20 décembre, quatre lundis.
  const weeks = (count: number) => series('2026-11-23', count * 7, [1, 2, 3, 4, 5, 6, 7], (horizon) => horizon === 1 ? 2 : 3, 1);
  const three = forecastReliability(input(weeks(3).archive, weeks(3).realised));
  assert.deepEqual(three.rainEstimated.week, { weekCount: 3, gaps: null });
  assert.equal(weekLineText('rainEstimated', three.rainEstimated.week), 'Cumul de la semaine : Pas encore assez de semaines : 3 sur 4.');
  const four = forecastReliability(input(weeks(4).archive, weeks(4).realised));
  assert.equal(four.rainEstimated.week.weekCount, 4);
  // Lundi à l'horizon 1 (2 mm), mardi à dimanche aux horizons 2 à 7 (3 mm) : 20 mm annoncés, 7 tombés.
  assert.deepEqual(four.rainEstimated.week.gaps, { meanGapMm: 13, meanAbsoluteGapMm: 13, meanGapPercentOfRealised: 13 / 7 * 100 });
  assert.equal(weekLineText('rainEstimated', four.rainEstimated.week),
    'Sur la semaine, la pluie annoncée le dimanche était trop pluvieuse, de 13 mm en moyenne ; l’écart, dans un sens ou dans l’autre, est de 13 mm en moyenne.');
  // La soif : 14 mm annoncés (2 mm par jour), 10,5 mm estimés : 3,5 mm de trop, soit 33 %.
  assert.equal(weekLineText('thirst', four.thirst.week),
    'Sur la semaine, la soif annoncée le dimanche était trop forte, de 3,5 mm en moyenne, soit 33 % de la soif estimée ; l’écart, dans un sens ou dans l’autre, est de 3,5 mm en moyenne.');
});

test('test 6 : la pluie estimée et la pluie mesurée à la ferme donnent deux jeux de chiffres, jamais mêlés', () => {
  const estimated = series('2026-10-02', 60, [1], () => 4, 2);
  const notes = Array.from({ length: 20 }, (_, index) => measured(addDaysToDateKey('2026-10-02', index), 3));
  const both = forecastReliability(input(estimated.archive, [...estimated.realised, ...notes]));
  assert.equal(both.rainEstimated.daily[0].pairCount, 60);
  assert.deepEqual(both.rainEstimated.daily[0].gaps, { meanGapMm: 2, meanAbsoluteGapMm: 2 }, '4 annoncés, 2 estimés');
  assert.equal(both.rainMeasured.measuredDays, 20);
  assert.equal(both.rainMeasured.result?.daily[0].pairCount, 20);
  assert.deepEqual(both.rainMeasured.result?.daily[0].gaps, { meanGapMm: 1, meanAbsoluteGapMm: 1 }, '4 annoncés, 3 notés : les 20 jours notés seulement');
  assert.match(dailyLineText('rainMeasured', both.rainMeasured.result!.daily[0]), /de celle mesurée à la ferme/);

  const few = forecastReliability(input(estimated.archive, [...estimated.realised, ...notes.slice(0, 10)]));
  assert.equal(few.rainMeasured.measuredDays, 10);
  assert.equal(few.rainMeasured.result, null, '10 jours notés : pas encore assez');
  assert.deepEqual(few.rainEstimated.daily[0].gaps, { meanGapMm: 2, meanAbsoluteGapMm: 2 }, 'la lecture de base ne change pas');
});

test('test 7 : après un changement de commune, les couples de l’ancien lieu n’entrent pas', () => {
  const vannes = series('2026-11-01', 14, [1], () => 9, 1);
  const auray = { archive: [forecast('2026-12-01', 1, 2, null, AURAY)], realised: [reanalysis('2026-12-02', 1, null, AURAY)] };
  const atAuray = forecastReliability(input([...vannes.archive, ...auray.archive], [...vannes.realised, ...auray.realised], { locationKey: AURAY }));
  assert.equal(atAuray.rainEstimated.daily[0].pairCount, 1, 'seul le couple d’Auray');
  const crossed = forecastPairs(input([forecast('2026-12-01', 1, 2, null, AURAY)], [reanalysis('2026-12-02', 1)], { locationKey: AURAY }), 'rainEstimated');
  assert.deepEqual(crossed, [], 'la prévision d’Auray face à la réanalyse de Vannes : aucun couple');
  const measuredAtAuray = forecastPairs(input([forecast('2026-12-01', 1, 2, null, AURAY)], [measured('2026-12-02', 1)], { locationKey: AURAY }), 'rainMeasured');
  assert.equal(measuredAtAuray.length, 1, 'le pluviomètre appartient à la ferme, quel que soit le lieu');
});

test('test 9 : la fenêtre, 90 jours visés jusqu’à hier ; 91 jours, exclu ; 89, compris', () => {
  assert.deepEqual(forecastReliabilityWindow(TODAY), { startDate: '2026-10-02', endDate: '2026-12-30' });
  const at = (age: number) => {
    const target = addDaysToDateKey(TODAY, -age);
    return forecastPairs(input([forecast(addDaysToDateKey(target, -1), 1, 2)], [reanalysis(target, 1)]), 'rainEstimated').length;
  };
  assert.equal(at(91), 0);
  assert.equal(at(90), 1);
  assert.equal(at(89), 1);
  assert.equal(at(1), 1);
  assert.equal(at(0), 0, 'aujourd’hui n’est pas encore réalisé');
});

test('test 10 : une phrase par cas, le signe en mots, sans mot du calcul', () => {
  const line = (rain: number, real: number) => {
    const { archive, realised } = series('2026-12-01', 14, [3, 4], () => rain, real);
    return forecastReliability(input(archive, realised)).rainEstimated.daily[1];
  };
  assert.equal(dailyLineText('rainEstimated', line(3.1, 1)),
    'À 3 ou 4 jours, la pluie annoncée s’écarte en moyenne de 2,1 mm par jour de celle estimée ; elle était trop pluvieuse, de 2,1 mm par jour en moyenne.');
  assert.equal(dailyLineText('rainEstimated', line(0, 2)),
    'À 3 ou 4 jours, la pluie annoncée s’écarte en moyenne de 2 mm par jour de celle estimée ; elle n’était pas assez pluvieuse, de 2 mm par jour en moyenne.');
  assert.equal(dailyLineText('rainEstimated', line(1.02, 1)),
    'À 3 ou 4 jours, la pluie annoncée s’écarte en moyenne de 0 mm par jour de celle estimée ; elle tombait juste en moyenne.');
  const thirst = (() => {
    const { archive, realised } = series('2026-12-01', 14, [1], () => 0, 0, { forecast: 1, realised: 1.4 });
    return forecastReliability(input(archive, realised)).thirst;
  })();
  assert.equal(dailyLineText('thirst', thirst.daily[0]),
    'À un ou deux jours, la soif annoncée s’écarte en moyenne de 0,4 mm par jour de celle estimée ; elle était trop faible, de 0,4 mm par jour en moyenne.');
  assert.equal(thirstReserveText(thirst),
    'La soif annoncée et la soif estimée ne se calculent pas de la même façon. Même la veille, elles s’écartent de 0,4 mm par jour en moyenne : '
    + 'cette part vient de la façon de calculer ; seul ce qui s’y ajoute plus loin vient de l’annonce.');
  const empty = forecastReliability(input([], []));
  assert.match(thirstReserveText(empty.thirst), /Une partie de l’écart vient de là, pas de l’annonce\.$/);

  const texts = [
    dailyLineText('rainEstimated', line(3.1, 1)), dailyLineText('thirst', thirst.daily[0]), thirstReserveText(thirst),
    ESTIMATED_RAIN_RESERVE_TEXT, weekLineText('thirst', thirst.week), forecastReliabilityHeadline(empty),
  ];
  for (const text of texts) {
    for (const word of [...TECHNICAL_WORDS, 'ET0', 'réanalyse', 'horizon', 'couple', 'J+']) {
      assert.ok(!text.toLowerCase().includes(word.toLowerCase()), `« ${word} » dans « ${text} »`);
    }
    assert.ok(!/[+−-]\s?\d/.test(text), `un signe seul dans « ${text} »`);
  }
});

test('les états : sans lieu, sans archive, en attente avec la date des premiers chiffres, prêt', () => {
  const noLocation = forecastReliability(input([forecast('2026-12-01', 1, 2)], [reanalysis('2026-12-02', 1)], { locationKey: null }));
  assert.equal(noLocation.status, 'noLocation');
  assert.equal(noLocation.rainEstimated.daily[0].pairCount, 0);
  assert.equal(forecastReliabilityHeadline(noLocation), 'La commune de la météo n’est pas encore choisie : sans elle, il n’y a rien à comparer.');

  // L'archive écrit depuis le 22 novembre 2026 ; le 26, rien n'est encore réalisé.
  const archive = [1, 2, 3, 4, 5, 6, 7].flatMap((horizon) => ['2026-11-22', '2026-11-23', '2026-11-24', '2026-11-25', '2026-11-26'].map((issuedOn) => forecast(issuedOn, horizon, 1, 1)));
  const waiting = forecastReliability(input(archive, [], { today: '2026-11-26' }));
  assert.equal(waiting.status, 'collecting');
  assert.equal(waiting.firstFiguresAround, '2026-12-05', 'le 30 novembre complète 14 couples à un ou deux jours, la réanalyse cinq jours après');
  assert.equal(forecastReliabilityHeadline(waiting), 'Pas encore assez de jours : 0 sur 14 pour comparer. Premiers chiffres vers le 5 décembre.');

  const none = forecastReliability(input([], [], { today: '2026-11-26' }));
  assert.equal(none.status, 'noArchive');
  assert.equal(none.firstFiguresAround, '2026-12-09', 'sans archive, à partir de demain');
  assert.match(forecastReliabilityHeadline(none), /rien n’est encore gardé pour cette commune\. Premiers chiffres vers le 9 décembre\.$/);

  const late = forecastReliability(input([forecast('2026-10-01', 1, 1)], [], { today: TODAY }));
  assert.equal(late.status, 'collecting');
  assert.equal(late.firstFiguresAround, null, 'des jours manquent : on ne sait pas dire quand');

  const { archive: full, realised } = series('2026-12-01', 14, [1], () => 2, 1);
  const ready = forecastReliability(input(full, realised));
  assert.equal(ready.status, 'ready');
  assert.equal(ready.firstFiguresAround, null);
  assert.equal(forecastReliabilityHeadline(ready), 'Sur les 90 derniers jours, voici de combien la météo annoncée s’est écartée de ce qui s’est passé.');
});
