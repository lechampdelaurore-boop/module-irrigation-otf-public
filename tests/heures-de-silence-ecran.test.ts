import assert from 'node:assert/strict';
import test from 'node:test';
import { DEFAULT_QUIET_HOURS, QUIET_END_TIMES, QUIET_START_TIMES, type QuietHoursSettings } from '../lib/domain/notification-quiet-hours.ts';
import {
  eveningReminderSilencedAt,
  eveningReminderSilencedText,
  quietHoursFoldText,
  quietHoursHint,
  quietRangeText,
} from '../lib/domain/quiet-hours-screen.ts';
import { EVENING_TIMES } from '../lib/domain/today/evening-reminder.ts';

/**
 * Les phrases de l'écran des heures de silence (6 undecies, PR H3,
 * docs/heures-de-silence-contract.md, section 4 et section 13 ; D-326) : la
 * ligne du pli, ce qui passe et ce qui attend, et l'avertissement du rappel
 * du soir, jugé au passage horaire qui l'enverrait (F806, F819).
 */

const quiet = (start: string, end: string, frostPasses = true): QuietHoursSettings => ({ enabled: true, start, end, frostPasses });
const on = (time: string) => ({ enabled: true, time });

test('la ligne du pli dit la plage enregistrée, ou qu’elle est coupée', () => {
  assert.equal(quietHoursFoldText(quiet('22:00', '06:00')), 'Silence de 22 h à 6 h.');
  assert.equal(quietHoursFoldText(quiet('21:30', '07:15')), 'Silence de 21 h 30 à 7 h 15.');
  assert.equal(quietHoursFoldText(DEFAULT_QUIET_HOURS), 'Heures de silence coupées.');
  assert.equal(quietRangeText(quiet('23:45', '04:00')), 'de 23 h 45 à 4 h');
});

test('la phrase dit ce qui passe toujours et ce qui attend : la fin d’un arrosage, le gel tant que sa case est cochée (S3, S4)', () => {
  const frost = quietHoursHint(quiet('22:00', '06:00'));
  assert.match(frost, /la fin d’un arrosage et les alertes de gel partent toujours/);
  assert.match(frost, /attendent la fin des heures de silence/);
  const noFrost = quietHoursHint(quiet('22:00', '06:00', false));
  assert.match(noFrost, /seule la fin d’un arrosage part/);
  assert.match(noFrost, /gel compris/);
  assert.match(quietHoursHint(DEFAULT_QUIET_HOURS), /sauf la fin d’un arrosage/);
});

test('F806, F819 : le rappel du soir se juge au premier passage (hh:05) qui suit son heure ; réglé à 21 h 30, il part à 22 h 05 et ne part donc pas avec une plage dès 22 h', () => {
  assert.equal(eveningReminderSilencedAt(quiet('22:00', '06:00'), on('21:30')), '22:05');
  assert.equal(eveningReminderSilencedAt(quiet('22:00', '06:00'), on('22:00')), '22:05', 'scénario 10 : réglé à l’heure du début');
  assert.equal(eveningReminderSilencedAt(quiet('22:00', '06:00'), on('21:00')), null, 'part à 21 h 05, avant la plage');
  assert.equal(eveningReminderSilencedAt(quiet('22:00', '06:00'), on('19:00')), null);
  assert.equal(eveningReminderSilencedAt(quiet('22:15', '06:00'), on('21:45')), null, 'part à 22 h 05, avant un début à 22 h 15');
  assert.equal(eveningReminderSilencedAt(quiet('22:00', '06:00'), on('21:05' as string)), null, 'une heure hors des quarts d’heure ne se juge pas');
  assert.equal(eveningReminderSilencedAt(quiet('20:00', '06:00'), on('20:00')), '20:05', 'début inclus');
  assert.equal(eveningReminderSilencedAt(quiet('20:00', '06:00'), on('19:45')), '20:05');
  assert.equal(eveningReminderSilencedAt(quiet('20:15', '06:00'), on('19:45')), null);
});

test('l’avertissement du rappel ne se dit que plage allumée, rappel activé et réglage dans les bornes (S2, S17)', () => {
  assert.equal(eveningReminderSilencedAt({ ...quiet('22:00', '06:00'), enabled: false }, on('22:00')), null);
  assert.equal(eveningReminderSilencedAt(quiet('22:00', '06:00'), { enabled: false, time: '22:00' }), null);
  assert.equal(eveningReminderSilencedAt(quiet('15:00', '06:00'), on('22:00')), null, 'un début hors des bornes : la plage est ignorée');
  assert.equal(eveningReminderSilencedAt(quiet('22:00', '12:00'), on('22:00')), null);
});

test('chaque heure du rappel contre chaque début : silencieux exactement quand son passage est au début ou après', () => {
  for (const start of QUIET_START_TIMES) {
    for (const time of EVENING_TIMES) {
      const [hour, minute] = time.split(':').map(Number);
      const pass = (minute === 0 ? hour : hour + 1) * 60 + 5;
      const [startHour, startMinute] = start.split(':').map(Number);
      const expected = pass >= startHour * 60 + startMinute;
      assert.equal(eveningReminderSilencedAt(quiet(start, QUIET_END_TIMES[0]), on(time)) !== null, expected, `${time} contre ${start}`);
    }
  }
});

test('le texte de l’avertissement dit l’heure réglée et celle du passage', () => {
  assert.equal(
    eveningReminderSilencedText('21:30', '22:05'),
    'Le rappel du soir (21 h 30) ne partira pas : son envoi, à 22 h 05, tombe dans les heures de silence.',
  );
});
