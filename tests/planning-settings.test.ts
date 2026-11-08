import assert from 'node:assert/strict';
import test from 'node:test';
import { DEFAULT_PLANNING_SETTINGS, minutesOfDay, validatePlanningSettings } from '../lib/domain/planning/settings.ts';
import { windowIntervalForDay, windowIntervals, windowLengthMinutes } from '../lib/domain/planning/windows.ts';

test('les valeurs de départ sont celles tranchées le 29 septembre 2026 (D-024) et se valident', () => {
  const s = DEFAULT_PLANNING_SETTINGS;
  assert.equal('dailyRecalculation' in s, false, 'R1 retiré le 5 octobre 2026 (D-029)');
  assert.equal(s.forecastRainShare, 1, 'R2 : 100 %');
  assert.equal(s.waitForForecastRainAboveMm, 5, 'R3');
  assert.deepEqual(s.doses.sprinkler, { minimumMm: 5, maximumMm: 15, irrigationsPerDay: 1, spacingDays: 1 }, 'R4 à R7, aspersion');
  assert.deepEqual(s.doses.drip, { minimumMm: 3, maximumMm: 10, irrigationsPerDay: 1, spacingDays: 1 }, 'R4 à R7, goutte-à-goutte');
  assert.deepEqual(s.windows.sprinkler, { startMinute: minutesOfDay(21), endMinute: minutesOfDay(8) }, 'R8 : 21 h – 8 h');
  assert.deepEqual(s.windows.drip, { startMinute: minutesOfDay(6), endMinute: minutesOfDay(22) }, 'R8 : 6 h – 22 h');
  assert.equal(s.shortageStrategy, 'priority-then-equal-share', 'R9');
  assert.equal(s.carryOverDeficit, false, 'R10');
  assert.equal(s.collectiveDoseRule, 'highest-need', 'R11');
  assert.equal(s.preferredKindWhenBoth, 'drip', 'R12');
  assert.deepEqual(validatePlanningSettings(s), { settings: s, issues: [] });
});

test('un réglage enregistré avant le retrait de R1 (D-029) se valide encore, son heure de recalcul ignorée', () => {
  const stored = { ...DEFAULT_PLANNING_SETTINGS, forecastRainShare: 0.5, dailyRecalculation: { hour: 6, minute: 30 } };
  const result = validatePlanningSettings(stored);
  assert.notEqual(result.settings, null, 'l’ancienne clé n’est pas une erreur');
  assert.equal(result.settings?.forecastRainShare, 0.5, 'les autres réglages sont lus');
  const absurd = validatePlanningSettings({ ...DEFAULT_PLANNING_SETTINGS, dailyRecalculation: { hour: 99, minute: -1 } });
  assert.notEqual(absurd.settings, null, 'l’ancienne clé n’est plus lue, même absurde');
});

test('un réglage absurde est refusé avec son chemin, jamais corrigé en silence', () => {
  const broken = {
    ...DEFAULT_PLANNING_SETTINGS,
    forecastRainShare: 1.5,
    doses: { ...DEFAULT_PLANNING_SETTINGS.doses, sprinkler: { minimumMm: 20, maximumMm: 15, irrigationsPerDay: 1, spacingDays: 1 } },
    windows: { ...DEFAULT_PLANNING_SETTINGS.windows, drip: { startMinute: 600, endMinute: 600 } },
    shortageStrategy: 'au-hasard',
  };
  const result = validatePlanningSettings(broken);
  assert.equal(result.settings, null);
  assert.deepEqual(result.issues.map((issue) => issue.path), ['forecastRainShare', 'doses.sprinkler', 'windows.drip', 'shortageStrategy']);
  assert.equal(validatePlanningSettings(null).settings, null);
});

test('une plage qui passe minuit appartient à la nuit qui commence, aux heures de la ferme', () => {
  const night = windowIntervalForDay(DEFAULT_PLANNING_SETTINGS.windows.sprinkler, '2026-09-29');
  assert.equal(night.startAt.toISOString(), '2026-09-29T19:00:00.000Z', 'mardi 21 h, heure d’été');
  assert.equal(night.endAt.toISOString(), '2026-09-30T06:00:00.000Z', 'mercredi 8 h');
  const day = windowIntervalForDay(DEFAULT_PLANNING_SETTINGS.windows.drip, '2026-09-29');
  assert.equal(day.startAt.toISOString(), '2026-09-29T04:00:00.000Z');
  assert.equal(day.endAt.toISOString(), '2026-09-29T20:00:00.000Z');
  // La nuit du changement d'heure dure une heure de plus : 21 h → 8 h le 25 octobre.
  const longNight = windowIntervalForDay(DEFAULT_PLANNING_SETTINGS.windows.sprinkler, '2026-10-24');
  assert.equal((longNight.endAt.getTime() - longNight.startAt.getTime()) / 3_600_000, 12);
  assert.equal(windowLengthMinutes(DEFAULT_PLANNING_SETTINGS.windows.sprinkler), 11 * 60);
  assert.equal(windowLengthMinutes(DEFAULT_PLANNING_SETTINGS.windows.drip), 16 * 60);
});

test('les plages d’une semaine entamée commencent à l’instant du calcul et finissent dimanche minuit', () => {
  const now = new Date('2026-09-29T10:52:00.000Z'); // mardi 12 h 52 à la ferme
  const weekEnd = new Date('2026-10-04T22:00:00.000Z'); // lundi 00 h 00, heure d'été
  const days = ['2026-09-29', '2026-09-30', '2026-10-01', '2026-10-02', '2026-10-03', '2026-10-04'];
  const drip = windowIntervals(DEFAULT_PLANNING_SETTINGS.windows.drip, days, { notBefore: now, notAfter: weekEnd });
  assert.equal(drip.length, 6);
  assert.equal(drip[0].startAt.toISOString(), '2026-09-29T10:52:00.000Z', 'mardi : à partir de maintenant');
  assert.equal(drip[5].endAt.toISOString(), '2026-10-04T20:00:00.000Z', 'dimanche 22 h');
  const sprinkler = windowIntervals(DEFAULT_PLANNING_SETTINGS.windows.sprinkler, days, { notBefore: now, notAfter: weekEnd });
  assert.equal(sprinkler.length, 6);
  assert.equal(sprinkler[0].startAt.toISOString(), '2026-09-29T19:00:00.000Z', 'mardi 21 h');
  assert.equal(sprinkler[5].endAt.toISOString(), '2026-10-04T22:00:00.000Z', 'la nuit de dimanche s’arrête à minuit, fin de semaine');
  const afternoon = windowIntervals(DEFAULT_PLANNING_SETTINGS.windows.drip, ['2026-09-29'], { notBefore: new Date('2026-09-29T21:00:00.000Z'), notAfter: weekEnd });
  assert.deepEqual(afternoon, [], 'une plage déjà passée est écartée');
});
