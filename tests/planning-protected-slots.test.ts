import assert from 'node:assert/strict';
import test from 'node:test';
import { protectedIntervalsBetween, validateProtectedSlotDraft, weekdayOfDateKey, withoutProtectedIntervals, type ProtectedSlot } from '../lib/domain/planning/protected-slots.ts';
import { DEFAULT_PLANNING_SETTINGS, minutesOfDay } from '../lib/domain/planning/settings.ts';
import { windowIntervals } from '../lib/domain/planning/windows.ts';
import { localDateStartUtc } from '../lib/domain/water-management.ts';

/**
 * Le module des créneaux protégés nommés (docs/protected-slots-contract.md,
 * D-062, lot 1 de la section 11) : la saisie d'un créneau (règles 1 et 3),
 * sa traduction en instants chaque semaine, passage de minuit et changement
 * d'heure compris (règle 3, cas 5 et 16), l'union des créneaux qui se
 * chevauchent (règle 4, cas 6), et le découpage d'une plage R8 autour d'eux
 * (règle 6). La semaine de test est celle du planning, du lundi 28 septembre
 * au dimanche 4 octobre 2026, en heure d'été (UTC+2).
 */

const TZ = 'Europe/Paris';
const WEEK_START = localDateStartUtc('2026-09-28', TZ);
const WEEK_END = localDateStartUtc('2026-10-05', TZ);
const WEEK_DAYS = ['2026-09-28', '2026-09-29', '2026-09-30', '2026-10-01', '2026-10-02', '2026-10-03', '2026-10-04'];
const SPRINKLER = DEFAULT_PLANNING_SETTINGS.windows.sprinkler;

const slot = (name: string, weekdays: ProtectedSlot['weekdays'], start: number, end: number, id = name): ProtectedSlot => ({ id, name, weekdays, startMinute: start, endMinute: end });
const iso = (ms: number) => new Date(ms).toISOString();
const spans = (intervals: readonly { startMs: number; endMs: number; names: readonly string[] }[]) => intervals.map((interval) => [iso(interval.startMs), iso(interval.endMs), [...interval.names]]);
const clock = new Intl.DateTimeFormat('fr-FR', { weekday: 'long', hour: '2-digit', minute: '2-digit', timeZone: TZ });

test('un créneau saisi se vérifie : nom nettoyé, jours rangés dans l’ordre de la semaine, journée entière en 00 h 00 – 23 h 59 (règles 1 et 3)', () => {
  assert.deepEqual(validateProtectedSlotDraft({ name: '  Lavage   des légumes ', weekdays: ['friday', 'tuesday', 'tuesday'], startMinute: minutesOfDay(21), endMinute: minutesOfDay(23) }), {
    value: { name: 'Lavage des légumes', weekdays: ['tuesday', 'friday'], startMinute: 1260, endMinute: 1380 },
    errors: [],
  });
  const wholeDay = validateProtectedSlotDraft({ name: 'Marché', weekdays: ['saturday'], startMinute: 0, endMinute: minutesOfDay(23, 59) });
  assert.deepEqual(wholeDay.value, { name: 'Marché', weekdays: ['saturday'], startMinute: 0, endMinute: 1439 });
  const overnight = validateProtectedSlotDraft({ name: 'Nuit calme', weekdays: ['friday'], startMinute: minutesOfDay(22), endMinute: minutesOfDay(2) });
  assert.equal(overnight.value?.endMinute, 120, 'une fin avant le début passe minuit : permis');
});

test('un créneau saisi absurde est refusé avec son message, jamais corrigé en silence (règles 1 et 3)', () => {
  assert.deepEqual(validateProtectedSlotDraft({ name: '   ', weekdays: [], startMinute: 600, endMinute: 600 }).errors, [
    'Donnez un nom au créneau protégé.',
    'Choisissez au moins un jour de la semaine.',
    'Le début et la fin doivent être différents ; pour une journée entière, déclarez 00 h 00 – 23 h 59.',
  ]);
  assert.deepEqual(validateProtectedSlotDraft({ name: 'x'.repeat(81), weekdays: ['monday', 'lundi'], startMinute: -1, endMinute: 1440 }).errors, [
    'Le nom du créneau ne peut pas dépasser 80 caractères.',
    'Un jour de la semaine est inconnu.',
    'L’heure de début est une heure de la journée, à la minute.',
    'L’heure de fin est une heure de la journée, à la minute.',
  ]);
  assert.deepEqual(validateProtectedSlotDraft({ name: 'Pause', weekdays: ['monday'], startMinute: 600.5, endMinute: 660 }).errors, ['L’heure de début est une heure de la journée, à la minute.']);
  assert.equal(validateProtectedSlotDraft({ name: 'x'.repeat(80), weekdays: ['sunday'], startMinute: 0, endMinute: 1 }).value?.name.length, 80, 'quatre-vingts caractères passent');
});

test('le jour de la semaine se lit au calendrier de la ferme, du lundi au dimanche', () => {
  assert.deepEqual(WEEK_DAYS.map(weekdayOfDateKey), ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday']);
  assert.equal(weekdayOfDateKey('2026-10-25'), 'sunday', 'le dimanche du changement d’heure');
});

test('un créneau se répète chaque semaine aux jours choisis, et ces jours seulement (règles 1 et 2)', () => {
  const intervals = protectedIntervalsBetween([slot('Lavage des légumes', ['tuesday', 'thursday'], minutesOfDay(21), minutesOfDay(23))], WEEK_START, WEEK_END, TZ);
  assert.deepEqual(spans(intervals), [
    ['2026-09-29T19:00:00.000Z', '2026-09-29T21:00:00.000Z', ['Lavage des légumes']],
    ['2026-10-01T19:00:00.000Z', '2026-10-01T21:00:00.000Z', ['Lavage des légumes']],
  ]);
  assert.deepEqual(protectedIntervalsBetween([], WEEK_START, WEEK_END, TZ), [], 'aucun créneau : rien de protégé');
  assert.deepEqual(protectedIntervalsBetween(undefined, WEEK_START, WEEK_END, TZ), []);
});

test('cas 5 : « Nuit calme », vendredi 22 h – 2 h, protège vendredi 22 h → samedi 2 h ; samedi 2 h – 8 h reste utilisable, dimanche 0 h – 2 h n’est pas protégé', () => {
  const protectedIntervals = protectedIntervalsBetween([slot('Nuit calme', ['friday'], minutesOfDay(22), minutesOfDay(2))], WEEK_START, WEEK_END, TZ);
  assert.deepEqual(spans(protectedIntervals), [['2026-10-02T20:00:00.000Z', '2026-10-03T00:00:00.000Z', ['Nuit calme']]], 'rattaché au vendredi, son jour de début');
  const nights = windowIntervals(SPRINKLER, ['2026-10-02', '2026-10-03'], { notBefore: WEEK_START, notAfter: WEEK_END }, TZ);
  const usable = withoutProtectedIntervals(nights, protectedIntervals);
  assert.deepEqual(usable.map((piece) => [piece.dateKey, clock.format(piece.startAt), clock.format(piece.endAt)]), [
    ['2026-10-02', 'vendredi 21:00', 'vendredi 22:00'],
    ['2026-10-02', 'samedi 02:00', 'samedi 08:00'],
    ['2026-10-03', 'samedi 21:00', 'dimanche 08:00'],
  ], 'la nuit de samedi, dimanche 0 h – 2 h compris, est entière');
});

test('cas 6 : deux créneaux qui se chevauchent, 21 h – 23 h et 22 h – 24 h, protègent leur union, 21 h – 24 h, sous leurs deux noms (règle 4)', () => {
  const intervals = protectedIntervalsBetween([
    slot('Lavage', ['tuesday'], minutesOfDay(21), minutesOfDay(23)),
    slot('Passage', ['tuesday'], minutesOfDay(22), 0),
  ], WEEK_START, WEEK_END, TZ);
  assert.deepEqual(spans(intervals), [['2026-09-29T19:00:00.000Z', '2026-09-29T22:00:00.000Z', ['Lavage', 'Passage']]]);
  const touching = protectedIntervalsBetween([
    slot('Lavage', ['tuesday'], minutesOfDay(21), minutesOfDay(22)),
    slot('Lavage', ['tuesday'], minutesOfDay(22), minutesOfDay(23), 'second'),
  ], WEEK_START, WEEK_END, TZ);
  assert.deepEqual(spans(touching), [['2026-09-29T19:00:00.000Z', '2026-09-29T21:00:00.000Z', ['Lavage']]], 'deux créneaux qui se touchent n’en font qu’un ; deux créneaux de même nom sont permis');
});

test('un créneau de dimanche qui passe minuit protège le lundi de la semaine suivante, et la période rogne ses bords', () => {
  const sundayNight = [slot('Nuit du dimanche', ['sunday'], minutesOfDay(22), minutesOfDay(2))];
  assert.deepEqual(spans(protectedIntervalsBetween(sundayNight, WEEK_START, WEEK_END, TZ)), [
    ['2026-09-27T22:00:00.000Z', '2026-09-28T00:00:00.000Z', ['Nuit du dimanche']],
    ['2026-10-04T20:00:00.000Z', '2026-10-04T22:00:00.000Z', ['Nuit du dimanche']],
  ], 'lundi 0 h – 2 h, venu du dimanche d’avant ; dimanche 22 h – 24 h, rogné à la fin de la semaine');
});

test('cas 16 : le jour du changement d’heure d’octobre, les heures murales sont respectées, aucun créneau n’est décalé d’une heure', () => {
  const from = localDateStartUtc('2026-10-19', TZ);
  const to = localDateStartUtc('2026-11-02', TZ);
  const evening = protectedIntervalsBetween([slot('Lavage', ['sunday'], minutesOfDay(21), minutesOfDay(23))], from, to, TZ);
  assert.deepEqual(spans(evening), [
    ['2026-10-25T20:00:00.000Z', '2026-10-25T22:00:00.000Z', ['Lavage']],
    ['2026-11-01T20:00:00.000Z', '2026-11-01T22:00:00.000Z', ['Lavage']],
  ], '21 h – 23 h à la ferme, en heure d’hiver (UTC+1)');
  const summer = protectedIntervalsBetween([slot('Lavage', ['sunday'], minutesOfDay(21), minutesOfDay(23))], localDateStartUtc('2026-10-12', TZ), from, TZ);
  assert.deepEqual(spans(summer), [['2026-10-18T19:00:00.000Z', '2026-10-18T21:00:00.000Z', ['Lavage']]], 'le dimanche d’avant, en heure d’été (UTC+2)');

  // La nuit du changement : 0 h – 4 h à l'horloge dure cinq heures ; la plage d'aspersion de samedi reprend à 4 h, heure d'hiver.
  const night = protectedIntervalsBetween([slot('Nuit calme', ['sunday'], 0, minutesOfDay(4))], from, to, TZ);
  assert.deepEqual(spans(night).at(0), ['2026-10-24T22:00:00.000Z', '2026-10-25T03:00:00.000Z', ['Nuit calme']]);
  const saturdayNight = windowIntervals(SPRINKLER, ['2026-10-24'], { notBefore: from, notAfter: to }, TZ);
  const usable = withoutProtectedIntervals(saturdayNight, night);
  assert.deepEqual(usable.map((piece) => [clock.format(piece.startAt), clock.format(piece.endAt)]), [['samedi 21:00', 'dimanche 00:00'], ['dimanche 04:00', 'dimanche 08:00']]);
  assert.equal(usable[1].endAt.getTime() - usable[1].startAt.getTime(), 4 * 3_600_000, 'dimanche 4 h – 8 h : quatre heures réelles');
});

test('une plage se découpe autour des créneaux protégés : coupée en deux, rognée, retirée, ou laissée entière quand le créneau ne fait que la toucher (règle 6)', () => {
  const tuesdayNight = windowIntervals(SPRINKLER, ['2026-09-29'], { notBefore: WEEK_START, notAfter: WEEK_END }, TZ);
  const cut = (slots: ProtectedSlot[]) => withoutProtectedIntervals(tuesdayNight, protectedIntervalsBetween(slots, WEEK_START, WEEK_END, TZ));

  const middle = cut([slot('Lavage', ['tuesday'], minutesOfDay(22), minutesOfDay(23))]);
  assert.deepEqual(middle.map((piece) => [iso(piece.startAt.getTime()), iso(piece.endAt.getTime()), piece.afterProtected?.names ?? null, piece.beforeProtected?.names ?? null]), [
    ['2026-09-29T19:00:00.000Z', '2026-09-29T20:00:00.000Z', null, ['Lavage']],
    ['2026-09-29T21:00:00.000Z', '2026-09-30T06:00:00.000Z', ['Lavage'], null],
  ]);
  assert.ok(middle.every((piece) => piece.dateKey === '2026-09-29' && piece.rangeEndAt.toISOString() === '2026-09-30T06:00:00.000Z'), 'chaque morceau garde son jour de planning et la fin de sa plage');
  assert.equal(middle[0].beforeProtected?.atMs, Date.parse('2026-09-29T20:00:00.000Z'), 'le morceau finit là où le créneau commence');
  assert.equal(middle[1].afterProtected?.atMs, Date.parse('2026-09-29T21:00:00.000Z'), 'et le suivant commence là où il finit');

  // Cas 2 : « Lavage », mardi 21 h – 23 h, en travers du soir : la plage commence à 23 h.
  const evening = cut([slot('Lavage', ['tuesday'], minutesOfDay(21), minutesOfDay(23))]);
  assert.deepEqual(evening.map((piece) => [clock.format(piece.startAt), clock.format(piece.endAt), piece.afterProtected?.names ?? null]), [['mardi 23:00', 'mercredi 08:00', ['Lavage']]]);

  // Cas 3 : « Lavage », mardi 21 h – 8 h, toute la plage : rien ne reste.
  assert.deepEqual(cut([slot('Lavage', ['tuesday'], minutesOfDay(21), minutesOfDay(8))]), []);

  const touching = cut([slot('Avant', ['tuesday'], minutesOfDay(19), minutesOfDay(21)), slot('Après', ['wednesday'], minutesOfDay(8), minutesOfDay(10))]);
  assert.deepEqual(touching.map((piece) => [iso(piece.startAt.getTime()), iso(piece.endAt.getTime()), piece.afterProtected, piece.beforeProtected]), [['2026-09-29T19:00:00.000Z', '2026-09-30T06:00:00.000Z', null, null]], 'un créneau qui finit quand la plage commence, ou commence quand elle finit, ne l’entame pas');

  const twice = cut([slot('Lavage', ['tuesday'], minutesOfDay(22), minutesOfDay(23)), slot('Passage', ['wednesday'], minutesOfDay(1), minutesOfDay(2))]);
  assert.deepEqual(twice.map((piece) => [clock.format(piece.startAt), clock.format(piece.endAt)]), [['mardi 21:00', 'mardi 22:00'], ['mardi 23:00', 'mercredi 01:00'], ['mercredi 02:00', 'mercredi 08:00']], 'deux créneaux, trois morceaux, jamais un morceau qui en saute un');
  assert.deepEqual(withoutProtectedIntervals(tuesdayNight, []), [{ ...tuesdayNight[0], afterProtected: null, beforeProtected: null, rangeEndAt: tuesdayNight[0].endAt }], 'sans créneau, la plage reste entière');
});

test('un créneau impossible, que la saisie et la base refusent, n’exclut rien et ne bloque pas le calcul', () => {
  assert.deepEqual(protectedIntervalsBetween([
    slot('Vide', ['tuesday'], 600, 600),
    slot('Hors de la journée', ['tuesday'], -60, 1500),
  ], WEEK_START, WEEK_END, TZ), []);
});
