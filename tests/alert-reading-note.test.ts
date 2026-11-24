import assert from 'node:assert/strict';
import test from 'node:test';
import { ALERT_TIMING_EXPLANATION, alertReadingNote } from '../lib/domain/weather/alert-reading-note.ts';

/**
 * Les pages d'alertes disent la dernière lecture de la météo et pourquoi une
 * alerte peut tarder (alertes sur le téléphone, C5, D-307).
 */

/** Mardi 24 novembre 2026, 13 h à Paris. */
const NOW = new Date('2026-11-24T12:00:00.000Z');

test('C5 (D-307) : une lecture de moins de 3 heures se dit en vert, avec son heure de Paris', () => {
  assert.deepEqual(alertReadingNote('2026-11-24T11:30:00.000Z', NOW), { tone: 'ok', text: 'Dernière lecture de la météo : le 24/11/2026 à 12 h 30.' });
  assert.equal(alertReadingNote('2026-11-24T09:00:00.000Z', NOW).tone, 'ok', 'à 3 heures tout juste, encore à l’heure');
});

test('C5 (D-307) : au-delà de 3 heures, la ligne passe en orange et dit qu’une alerte apparue depuis n’a pas pu partir', () => {
  assert.deepEqual(alertReadingNote('2026-11-24T05:15:00.000Z', NOW), {
    tone: 'warn',
    text: 'Dernière lecture de la météo : le 24/11/2026 à 6 h 15, il y a plus de 3 heures. Une alerte apparue depuis dans les prévisions n’a pas encore pu partir.',
  });
});

test('C5 (D-307) : avant que la page soit prête, l’heure seule, la même au serveur et au navigateur ; sans lecture, orange', () => {
  assert.deepEqual(alertReadingNote('2026-11-24T05:15:00.000Z', null), { tone: 'ok', text: 'Dernière lecture de la météo : le 24/11/2026 à 6 h 15.' });
  assert.deepEqual(alertReadingNote(null, NOW), { tone: 'warn', text: 'Aucune lecture de la météo enregistrée : les alertes se calculeront à la première.' });
});

test('C5 (D-307) : l’explication nomme chaque lecture, celles de la journée (C1) et la règle des 3 heures', () => {
  for (const moment of ['6 h 15', '9 h 30', '12 h 30', '15 h 30', '18 h 30', '21 h 30', 'plus de 3 heures']) {
    assert.ok(ALERT_TIMING_EXPLANATION.includes(moment), moment);
  }
});
