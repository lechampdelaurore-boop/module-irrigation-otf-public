import assert from 'node:assert/strict';
import test from 'node:test';
import { notifyFeasibilityChanged, notifyWaterSourcesChanged, WATER_SOURCES_CHANGED } from '../lib/domain/feasibility-notifications.ts';

// La page « Ressources et pompes » : quand une ressource ou une réserve change,
// le panneau des ressources le signale, et la gestion des pompes relit son
// tableau au serveur pour que la fiche d'une pompe la voie sans recharger la
// page (point ouvert 60, D-093). Le parcours P32 le prouve dans le navigateur.

function withWindow(run: (target: EventTarget) => void) {
  const target = new EventTarget();
  Object.defineProperty(globalThis, 'window', { value: target, configurable: true, writable: true });
  try { run(target); } finally { Reflect.deleteProperty(globalThis, 'window'); }
}

test('le panneau des ressources signale un changement de ressource ou de réserve, sans rien d’autre que ce signal', () => withWindow((target) => {
  const received: unknown[] = [];
  target.addEventListener(WATER_SOURCES_CHANGED, (event) => received.push(event instanceof CustomEvent ? event.detail : undefined));
  notifyWaterSourcesChanged();
  assert.deepEqual(received, [null], 'un seul signal, sans données : la gestion des pompes relit le serveur');
}));

test('une pompe enregistrée prévient la faisabilité, sans faire relire à la gestion des pompes son propre tableau', () => withWindow((target) => {
  let received = 0;
  target.addEventListener(WATER_SOURCES_CHANGED, () => { received += 1; });
  notifyFeasibilityChanged();
  assert.equal(received, 0);
}));
