import assert from 'node:assert/strict';
import test from 'node:test';
import { validateProtectedSlotDraft, type ProtectedSlot } from '../lib/domain/planning/protected-slots.ts';
import {
  manualSlotProtectedWarning,
  protectedSlotDaysLabel,
  protectedSlotDraftFromForm,
  protectedSlotForm,
  protectedSlotHoursLabel,
  protectedSlotLine,
  protectedSlotVersionLine,
} from '../lib/domain/planning/protected-slots-view.ts';
import { minutesOfDay } from '../lib/domain/planning/settings.ts';

/**
 * L'écran des créneaux protégés (docs/protected-slots-contract.md, section 7,
 * règle 12, cas 14, précisions de la PR 5) : la ligne d'un créneau, son
 * formulaire aller et retour, la ligne de son journal, et l'avertissement
 * d'un arrosage planifié à la main. La semaine de test est celle du planning,
 * du lundi 28 septembre au dimanche 4 octobre 2026, en heure d'été (UTC+2).
 */

const TZ = 'Europe/Paris';
const slot = (name: string, weekdays: ProtectedSlot['weekdays'], start: number, end: number): ProtectedSlot => ({ id: name, name, weekdays, startMinute: start, endMinute: end });
const at = (iso: string) => Date.parse(iso);

test('la ligne d’un créneau : son nom, ses jours dans l’ordre de la semaine, de H à H, « le lendemain » quand il passe minuit', () => {
  assert.equal(protectedSlotDaysLabel(['tuesday']), 'mardi');
  assert.equal(protectedSlotDaysLabel(['thursday', 'tuesday']), 'mardi et jeudi');
  assert.equal(protectedSlotDaysLabel(['friday', 'monday', 'wednesday']), 'lundi, mercredi et vendredi');
  assert.equal(protectedSlotDaysLabel(['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday']), 'tous les jours');
  assert.equal(protectedSlotHoursLabel({ startMinute: minutesOfDay(21), endMinute: minutesOfDay(23) }), 'de 21:00 à 23:00');
  assert.equal(protectedSlotHoursLabel({ startMinute: minutesOfDay(22), endMinute: minutesOfDay(2) }), 'de 22:00 à 02:00 le lendemain', 'règle 3, cas 5');
  assert.equal(protectedSlotHoursLabel({ startMinute: 0, endMinute: minutesOfDay(23, 59) }), 'de 00:00 à 23:59', 'une journée entière');
  assert.equal(protectedSlotLine(slot('Lavage', ['tuesday', 'thursday'], minutesOfDay(21), minutesOfDay(23))), 'Lavage · mardi et jeudi · de 21:00 à 23:00');
  assert.equal(
    protectedSlotVersionLine({ ...slot('Nuit calme', ['friday'], minutesOfDay(22), minutesOfDay(2)), change: 'updated' }),
    'Modifié : Nuit calme · vendredi · de 22:00 à 02:00 le lendemain',
  );
  assert.equal(protectedSlotVersionLine({ ...slot('Lavage', ['tuesday'], minutesOfDay(21), minutesOfDay(23)), change: 'deleted' }), 'Supprimé : Lavage · mardi · de 21:00 à 23:00');
});

test('le formulaire d’un créneau existant redonne le même créneau ; un créneau nouveau ne devine rien et la vérification le dit', () => {
  const lavage = slot('Lavage des légumes', ['tuesday', 'friday'], minutesOfDay(12), minutesOfDay(14, 30));
  const form = protectedSlotForm(lavage);
  assert.deepEqual(form, {
    name: 'Lavage des légumes',
    weekdays: { monday: false, tuesday: true, wednesday: false, thursday: false, friday: true, saturday: false, sunday: false },
    start: '12:00',
    end: '14:30',
  });
  assert.deepEqual(protectedSlotDraftFromForm(form), { name: 'Lavage des légumes', weekdays: ['tuesday', 'friday'], startMinute: minutesOfDay(12), endMinute: minutesOfDay(14, 30) });

  const empty = protectedSlotForm();
  assert.equal(empty.name, '');
  assert.ok(Object.values(empty.weekdays).every((checked) => !checked), 'aucun jour coché d’avance');
  assert.deepEqual([empty.start, empty.end], ['', '']);
  const draft = protectedSlotDraftFromForm(empty);
  assert.ok(Number.isNaN(draft.startMinute) && Number.isNaN(draft.endMinute), 'une heure absente n’est pas minuit');
  assert.deepEqual(validateProtectedSlotDraft(draft).errors, [
    'Donnez un nom au créneau protégé.',
    'Choisissez au moins un jour de la semaine.',
    'L’heure de début est une heure de la journée, à la minute.',
    'L’heure de fin est une heure de la journée, à la minute.',
  ]);
  assert.ok(Number.isNaN(protectedSlotDraftFromForm({ ...form, start: '25:00' }).startMinute), 'une heure illisible est refusée, jamais corrigée');
});

test('cas 14 : un arrosage planifié à la main dans un créneau protégé est averti, jamais bloqué ; hors créneau, rien (règle 12)', () => {
  const slots = [slot('Lavage', ['tuesday'], minutesOfDay(21), minutesOfDay(23)), slot('Nuit calme', ['friday'], minutesOfDay(22), minutesOfDay(2))];
  // Mardi 29 septembre, 22 h – 23 h à la ferme.
  assert.equal(
    manualSlotProtectedWarning(slots, at('2026-09-29T20:00:00.000Z'), at('2026-09-29T21:00:00.000Z'), TZ),
    'Cet arrosage tombe dans le créneau protégé « Lavage » : le planning n’y propose jamais d’arrosage. Vous pouvez l’enregistrer quand même.',
  );
  // En partie : 20 h 30 – 21 h 30.
  assert.match(manualSlotProtectedWarning(slots, at('2026-09-29T18:30:00.000Z'), at('2026-09-29T19:30:00.000Z'), TZ) ?? '', /« Lavage »/);
  // Il finit quand le créneau commence : il n'y tombe pas.
  assert.equal(manualSlotProtectedWarning(slots, at('2026-09-29T18:00:00.000Z'), at('2026-09-29T19:00:00.000Z'), TZ), null);
  // Samedi 1 h : le créneau de vendredi passe minuit (règle 3).
  assert.match(manualSlotProtectedWarning(slots, at('2026-10-02T23:00:00.000Z'), at('2026-10-02T23:30:00.000Z'), TZ) ?? '', /« Nuit calme »/);
  // Mardi 22 h à samedi 1 h : les deux, au pluriel.
  assert.match(manualSlotProtectedWarning(slots, at('2026-09-29T20:00:00.000Z'), at('2026-10-02T23:00:00.000Z'), TZ) ?? '', /^Cet arrosage tombe dans les créneaux protégés « Lavage », « Nuit calme » :/);
  // Ni créneau, ni début lisible, ni durée : rien.
  assert.equal(manualSlotProtectedWarning([], at('2026-09-29T20:00:00.000Z'), at('2026-09-29T21:00:00.000Z'), TZ), null);
  assert.equal(manualSlotProtectedWarning(slots, Number.NaN, Number.NaN, TZ), null);
  assert.equal(manualSlotProtectedWarning(slots, at('2026-09-29T20:00:00.000Z'), at('2026-09-29T20:00:00.000Z'), TZ), null);
});
