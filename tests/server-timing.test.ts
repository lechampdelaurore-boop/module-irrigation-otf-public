import assert from 'node:assert/strict';
import test from 'node:test';
import {
  loggedPath,
  outboundWaitKind,
  requestKind,
  serverTimingHeader,
  startRequestTiming,
  summarizeRequestTiming,
  waitStarted,
} from '../lib/domain/server-timing.ts';

/**
 * Le temps d'une requête, côté serveur (accélérer le site, A1, D-358 ;
 * docs/acceleration-du-site-contract.md, section 3, F1101 à F1104) : le
 * décompte des attentes, l'en-tête `Server-Timing`, la sorte d'un appel
 * sortant d'après son hôte, et ce que le journal garde du chemin.
 */

test('chaque appel compte ; deux appels qui se recouvrent ne comptent pas deux fois le même instant (F1101)', () => {
  const timing = startRequestTiming(100, 'chaude');
  const first = waitStarted(timing, 'd1', 100);
  const second = waitStarted(timing, 'd1', 105);
  first(110);
  second(120);
  const third = waitStarted(timing, 'd1', 150);
  third(160);
  // Un second appel de la fin ne retire rien.
  third(400);
  const fetchOtf = waitStarted(timing, 'otf', 120);
  fetchOtf(370);

  const summary = summarizeRequestTiming(timing, 400);
  assert.deepEqual(summary.waits.d1, { calls: 3, ms: 30 }, 'de 100 à 120, puis de 150 à 160');
  assert.deepEqual(summary.waits.otf, { calls: 1, ms: 250 });
  assert.deepEqual(summary.waits.meteo, { calls: 0, ms: 0 });
  assert.deepEqual(summary.waits.autres, { calls: 0, ms: 0 });
  assert.equal(summary.appMs, 300);
  assert.equal(summary.instance, 'chaude');
});

test('un appel encore en cours au départ de la réponse compte jusqu’à ce départ ; les millisecondes sont entières', () => {
  const timing = startRequestTiming(0.4, 'neuve');
  waitStarted(timing, 'meteo', 10.2);
  const summary = summarizeRequestTiming(timing, 50.9);
  assert.deepEqual(summary.waits.meteo, { calls: 1, ms: 41 });
  assert.equal(summary.appMs, 51);
});

test('l’en-tête dit app, les quatre attentes et l’instance, toujours dans cet ordre, en ASCII (F1102)', () => {
  const timing = startRequestTiming(0, 'neuve');
  waitStarted(timing, 'd1', 0)(12);
  waitStarted(timing, 'd1', 20)(25);
  waitStarted(timing, 'autres', 30)(64);
  const header = serverTimingHeader(summarizeRequestTiming(timing, 812));
  assert.equal(
    header,
    'app;dur=812, d1;dur=17;desc="2 appels", otf;dur=0;desc="0 appel", meteo;dur=0;desc="0 appel", autres;dur=34;desc="1 appel", instance;desc="neuve"',
  );
  assert.match(header, /^[\x20-\x7e]+$/, 'rien que des caractères ASCII imprimables');
  assert.match(serverTimingHeader(summarizeRequestTiming(startRequestTiming(0, 'chaude'), 3)), /instance;desc="chaude"$/);
});

test('un appel sortant se range d’après le seul nom de son hôte, sous-domaines compris (F1103)', () => {
  assert.equal(outboundWaitKind('api.ouvretaferme.org'), 'otf');
  assert.equal(outboundWaitKind('www.ouvretaferme.org'), 'otf');
  assert.equal(outboundWaitKind('ouvretaferme.org'), 'otf');
  assert.equal(outboundWaitKind('API.OuvreTaFerme.org'), 'otf');
  assert.equal(outboundWaitKind('api.open-meteo.com'), 'meteo');
  assert.equal(outboundWaitKind('archive-api.open-meteo.com'), 'meteo');
  assert.equal(outboundWaitKind('geocoding-api.open-meteo.com'), 'meteo');
  assert.equal(outboundWaitKind('weather.visualcrossing.com'), 'meteo');
  assert.equal(outboundWaitKind('damp-wind-3566.cloudflareaccess.com'), 'autres');
  assert.equal(outboundWaitKind('irrigation-otf-push.lechampdelaurore.workers.dev'), 'autres');
  // Un nom qui ne fait que ressembler n'est pas celui du domaine.
  assert.equal(outboundWaitKind('pasouvretaferme.org'), 'autres');
  assert.equal(outboundWaitKind('ouvretaferme.org.exemple.net'), 'autres');
  assert.equal(outboundWaitKind('open-meteo.com.exemple.net'), 'autres');
  assert.equal(outboundWaitKind(null), 'autres');
  assert.equal(outboundWaitKind(''), 'autres');
});

test('la sorte de la requête : une action d’abord, puis un changement de page, une route d’API, une page', () => {
  assert.equal(requestKind({ method: 'POST', path: '/irrigation/aujourdhui', rsc: true, action: true }), 'action');
  assert.equal(requestKind({ method: 'GET', path: '/irrigation/aujourdhui', rsc: true, action: false }), 'rsc');
  assert.equal(requestKind({ method: 'GET', path: '/api/internal/weather-sync', rsc: false, action: false }), 'route');
  assert.equal(requestKind({ method: 'get', path: '/irrigation/aujourdhui', rsc: false, action: false }), 'page');
  assert.equal(requestKind({ method: 'POST', path: '/irrigation/aujourdhui', rsc: false, action: false }), 'autre');
});

test('le journal garde le chemin d’une page ou d’une route du module, jamais un autre (F1104)', () => {
  assert.equal(loggedPath('/irrigation/aujourdhui'), '/irrigation/aujourdhui');
  assert.equal(loggedPath('/irrigation'), '/irrigation');
  assert.equal(loggedPath('/irrigation/historique.csv'), '/irrigation/historique.csv');
  assert.equal(loggedPath('/api/otf/oauth/retour'), '/api/otf/oauth/retour');
  assert.equal(loggedPath('/'), '/');
  assert.equal(loggedPath('/wp-login.php'), '(autre)');
  assert.equal(loggedPath('/irrigationx'), '(autre)');
  assert.equal(loggedPath('/irrigation/%40exemple'), '(autre)');
  assert.equal(loggedPath(`/irrigation/${'a'.repeat(130)}`), '(autre)');
});
