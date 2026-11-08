import assert from 'node:assert/strict';
import test from 'node:test';
import {
  activeTimerSeconds,
  completedDurationSeconds,
  durationSecondsForTarget,
  isTimerAwaitingConfirmation,
  localDateTimeInputValue,
  millimetersForDurationSeconds,
  plannedStartKnown,
  previewSlot,
  remainingTimerSeconds,
  timerTheoreticalEndAt,
} from '../lib/domain/irrigation-timer.ts';

test('14 mm/h pour un objectif de 25 mm donne environ 1 h 47 min', () => {
  const seconds = durationSecondsForTarget(25, 14);

  assert.equal(seconds, 6429);
  assert.equal(Math.round(seconds / 60), 107);
});

test('14 mm/h pendant 2 h apporte 28 mm', () => {
  assert.equal(millimetersForDurationSeconds(14, 2 * 60 * 60), 28);
});

test('un arrêt après 1 h 35 à 14 mm/h enregistre environ 22,2 mm', () => {
  const amount = millimetersForDurationSeconds(14, (60 + 35) * 60);

  assert.equal(Math.round(amount * 10) / 10, 22.2);
});

test('le minuteur recalcule le temps après un passage en arrière-plan', () => {
  const timer = {
    state: 'running' as const,
    resumedAt: '2026-08-29T10:00:00.000Z',
    pausedAt: null,
    accumulatedSeconds: 120,
    targetDurationSeconds: 900,
  };

  assert.equal(
    activeTimerSeconds(timer, new Date('2026-08-29T10:05:00.000Z')),
    420,
  );
  assert.equal(
    remainingTimerSeconds(timer, new Date('2026-08-29T10:05:00.000Z')),
    480,
  );
});

test('une pause fige le temps actif même si la page est rouverte plus tard', () => {
  const timer = {
    state: 'paused' as const,
    resumedAt: null,
    pausedAt: '2026-08-29T10:05:00.000Z',
    accumulatedSeconds: 420,
    targetDurationSeconds: 900,
  };

  assert.equal(
    activeTimerSeconds(timer, new Date('2026-08-29T18:00:00.000Z')),
    420,
  );
  assert.equal(
    remainingTimerSeconds(timer, new Date('2026-08-29T18:00:00.000Z')),
    480,
  );
});

test('la reprise recalcule une heure théorique de fin depuis le reliquat', () => {
  assert.equal(
    timerTheoreticalEndAt(
      900,
      420,
      new Date('2026-08-29T11:00:00.000Z'),
    ),
    '2026-08-29T11:08:00.000Z',
  );
});

test('la confirmation de fin conserve les secondes après une reprise', () => {
  const value = localDateTimeInputValue(
    new Date('2026-08-29T11:08:37.456Z'),
    true,
  );

  assert.equal(value.length, 19);
  assert.equal(value.slice(-3), ':37');
  assert.ok(Number.isFinite(new Date(value).getTime()));
});

test('un minuteur expiré reste en attente de confirmation après rechargement', () => {
  const persistedTimer = {
    state: 'running' as const,
    resumedAt: '2026-08-31T20:00:00.000Z',
    pausedAt: null,
    accumulatedSeconds: 0,
    targetDurationSeconds: 60,
  };

  assert.equal(
    isTimerAwaitingConfirmation(
      persistedTimer,
      new Date('2026-08-31T20:01:00.000Z'),
    ),
    true,
  );
  assert.equal(
    isTimerAwaitingConfirmation(
      persistedTimer,
      new Date('2026-08-31T22:00:00.000Z'),
    ),
    true,
  );
  assert.equal(persistedTimer.state, 'running');
});

test('une irrigation en pause n’est jamais déclarée terminée automatiquement', () => {
  assert.equal(
    isTimerAwaitingConfirmation({
      state: 'paused',
      resumedAt: null,
      pausedAt: '2026-08-31T20:01:00.000Z',
      accumulatedSeconds: 60,
      targetDurationSeconds: 60,
    }),
    false,
  );
});

test('le créneau de l’aperçu reste lisible quand la date de début est vide ou incomplète (point ouvert 44)', () => {
  const now = Date.parse('2026-10-30T09:00:00.000Z');
  const end = Date.parse('2026-10-30T10:00:00.000Z');
  // Pendant la frappe au clavier, le champ passe par une date incomplète et sa
  // valeur devient vide : `Date.parse('')` vaut NaN. La page se fermait.
  assert.deepEqual(previewSlot(Number.NaN, end, now), {
    startsAt: '2026-10-30T09:00:00.000Z',
    endsAt: '2026-10-30T10:00:00.000Z',
  });
  assert.deepEqual(previewSlot(Number.NaN, Number.NaN, now), {
    startsAt: '2026-10-30T09:00:00.000Z',
    endsAt: '2026-10-30T09:00:01.000Z',
  });
  // Une fin avant le début ne donne pas un créneau à l'envers.
  assert.deepEqual(previewSlot(end, now, now), {
    startsAt: '2026-10-30T10:00:00.000Z',
    endsAt: '2026-10-30T10:00:01.000Z',
  });
});

test('la durée d’une irrigation déjà réalisée reste inconnue tant que ses dates ne se lisent pas (point ouvert 45)', () => {
  const start = Date.parse('2026-10-30T09:00:00.000Z');
  const end = Date.parse('2026-10-30T10:00:00.000Z');
  assert.equal(completedDurationSeconds(start, end), 3600);
  // Un champ vidé ou incomplet vaut NaN : la durée est inconnue, pas nulle,
  // sinon le volume estimé affichait « 0 L » (D-003).
  assert.equal(completedDurationSeconds(Number.NaN, end), null);
  assert.equal(completedDurationSeconds(start, Number.NaN), null);
  // Une fin qui ne suit pas le début ne donne pas non plus de durée.
  assert.equal(completedDurationSeconds(end, start), null);
  assert.equal(completedDurationSeconds(start, start), null);
});

test('une irrigation planifiée sans date de début lisible ne s’enregistre pas (point ouvert 46)', () => {
  assert.equal(plannedStartKnown('planned', Date.parse('2026-10-31T09:00')), true);
  // Un champ vidé ou incomplet, comme pendant la frappe, vaut NaN : le bouton
  // « Planifier l'irrigation » reste grisé, comme dans « Déjà réalisée ».
  assert.equal(plannedStartKnown('planned', Date.parse('')), false);
  assert.equal(plannedStartKnown('planned', Date.parse('2026-10-31T')), false);
  // Lancée maintenant ou déjà réalisée, une irrigation ne lit pas ce champ.
  assert.equal(plannedStartKnown('running', Number.NaN), true);
  assert.equal(plannedStartKnown('completed', Number.NaN), true);
});
