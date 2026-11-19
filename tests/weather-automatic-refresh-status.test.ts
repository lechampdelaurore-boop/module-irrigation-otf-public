import assert from 'node:assert/strict';
import test from 'node:test';
import {
  AUTOMATIC_REFRESH_LATE_AFTER_HOURS,
  automaticRefreshStatus,
} from '../lib/domain/weather/automatic-refresh-status.ts';

const NOW = new Date('2026-11-19T09:25:00.000Z');

test('une réussite de moins de 36 heures reste fraîche (D-165)', () => {
  assert.equal(AUTOMATIC_REFRESH_LATE_AFTER_HOURS, 36);
  assert.deepEqual(automaticRefreshStatus({
    lastAutomaticRefreshAttemptAt: '2026-11-19T05:15:00.000Z',
    lastAutomaticRefreshSuccessAt: '2026-11-19T05:15:09.000Z',
    lastAutomaticRefreshError: null,
  }, NOW), { kind: 'fresh', succeededAt: '2026-11-19T05:15:09.000Z' });
  // Pile 36 heures : encore fraîche ; une minute de plus : en retard.
  const boundary = { lastAutomaticRefreshAttemptAt: null, lastAutomaticRefreshSuccessAt: '2026-11-17T21:25:00.000Z', lastAutomaticRefreshError: null };
  assert.equal(automaticRefreshStatus(boundary, NOW).kind, 'fresh');
  assert.equal(automaticRefreshStatus(boundary, new Date('2026-11-19T09:26:00.000Z')).kind, 'late');
});

test('la ferme du 19 novembre 2026 : six jours sans réussite, le retard dit la dernière erreur (D-165)', () => {
  assert.deepEqual(automaticRefreshStatus({
    lastAutomaticRefreshAttemptAt: '2026-11-19T05:15:05.000Z',
    lastAutomaticRefreshSuccessAt: '2026-11-13T05:15:00.000Z',
    lastAutomaticRefreshError: 'Le service météo ne répond pas. ',
  }, NOW), {
    kind: 'late',
    succeededAt: '2026-11-13T05:15:00.000Z',
    lastError: 'Le service météo ne répond pas.',
  });
});

test('des tentatives sans aucune réussite sont en retard ; aucune tentative, rien à dire (D-165)', () => {
  assert.deepEqual(automaticRefreshStatus({
    lastAutomaticRefreshAttemptAt: '2026-11-19T05:15:05.000Z',
    lastAutomaticRefreshSuccessAt: null,
    lastAutomaticRefreshError: null,
  }, NOW), { kind: 'late', succeededAt: null, lastError: null });
  assert.deepEqual(automaticRefreshStatus({
    lastAutomaticRefreshAttemptAt: null,
    lastAutomaticRefreshSuccessAt: null,
    lastAutomaticRefreshError: null,
  }, NOW), { kind: 'none' });
  // Une date illisible ne vaut pas une réussite (D-003).
  assert.equal(automaticRefreshStatus({
    lastAutomaticRefreshAttemptAt: '2026-11-19T05:15:05.000Z',
    lastAutomaticRefreshSuccessAt: 'pas une date',
    lastAutomaticRefreshError: null,
  }, NOW).kind, 'late');
});
