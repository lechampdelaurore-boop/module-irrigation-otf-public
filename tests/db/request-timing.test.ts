import assert from 'node:assert/strict';
import test, { afterEach, beforeEach, mock } from 'node:test';
import { db } from '../../db/binding';
import { ensureWorkspaceForUser, findWorkspaceIdForUser } from '../../db/workspace-repository';
import { installRequestTiming, timeRequest, uninstallRequestTiming } from '../../lib/services/request-timing';
import { installTestDatabase, type TestDatabase } from '../support/d1-sqlite';
import { ALICE } from '../support/spaces';

/**
 * Le chronomètre des requêtes du Worker (accélérer le site, A1, D-358 ;
 * docs/acceleration-du-site-contract.md, section 3, F1101 à F1106) : pendant
 * une requête mesurée, chaque appel à la base (lecture, écriture, lot) et
 * chaque appel sortant est compté pour elle seule ; la réponse repart telle
 * quelle, avec l'en-tête `Server-Timing` ; le journal reçoit une ligne sans
 * adresse ni identifiant. Hors d'une requête mesurée, rien n'est compté.
 *
 * L'horloge est celle du test : elle n'avance que quand un appel sortant
 * simulé la fait avancer.
 */

let database: TestDatabase;
let now = 0;
const clock = () => now;

type Call = { input: RequestInfo | URL; init?: RequestInit };

/** Un `fetch` simulé : chaque appel dure 30 ms à l'horloge du test ; une adresse en `.invalid` échoue. */
function fakeHost() {
  const calls: Call[] = [];
  const host = {
    fetch: (async (input: RequestInfo | URL, init?: RequestInit) => {
      calls.push({ input, init });
      now += 30;
      const url = input instanceof URL ? input.href : typeof input === 'string' ? input : input.url;
      if (url.includes('.invalid')) throw new TypeError('fetch failed');
      return new Response('{"ok":true}', { status: 200, headers: { 'content-type': 'application/json' } });
    }) as typeof fetch,
  };
  return { host, calls };
}

/** Les entrées de l'en-tête, par nom : leur durée et leur description. */
function entries(response: Response): Record<string, { dur: number | null; desc: string | null }> {
  const header = response.headers.get('Server-Timing');
  assert.ok(header, 'la réponse porte l’en-tête Server-Timing');
  const found: Record<string, { dur: number | null; desc: string | null }> = {};
  for (const part of header.split(', ')) {
    const [name, ...params] = part.split(';');
    const dur = params.find((item) => item.startsWith('dur='));
    const desc = params.find((item) => item.startsWith('desc='));
    found[name] = { dur: dur ? Number(dur.slice(4)) : null, desc: desc ? desc.slice(6, -1) : null };
  }
  return found;
}

function request(path = '/irrigation/aujourdhui?saison=2026&code=secret', headers: Record<string, string> = {}): Request {
  return new Request(`https://irrigation.local${path}`, { headers });
}

beforeEach(() => {
  database = installTestDatabase();
  now = 0;
});
afterEach(() => {
  uninstallRequestTiming();
  mock.restoreAll();
  database.dispose();
});

test('pendant une requête, chaque appel à la base compte : lecture, écriture, lot ; la réponse repart telle quelle (F1101, F1102)', async () => {
  const { host } = fakeHost();
  installRequestTiming(host, clock);
  const answered = new Response('la page', { status: 203, headers: { 'x-page': 'aujourdhui' } });

  const response = await timeRequest(request(), async () => {
    await ensureWorkspaceForUser(ALICE); // une lecture, puis une écriture : l'espace n'existe pas encore
    await db.prepare('SELECT 1 AS un').first();
    await db.batch([db.prepare('SELECT 1 AS un'), db.prepare('SELECT 2 AS deux')]);
    return answered;
  });

  assert.equal(response, answered, 'la même réponse, sans copie');
  assert.equal(response.status, 203);
  assert.equal(response.headers.get('x-page'), 'aujourdhui');
  assert.equal(await response.text(), 'la page');
  const timings = entries(response);
  assert.deepEqual(Object.keys(timings), ['app', 'd1', 'otf', 'meteo', 'autres', 'instance']);
  assert.equal(timings.d1.desc, '4 appels', 'deux pour l’espace, un pour la lecture, un pour le lot');
  assert.equal(timings.otf.desc, '0 appel');
  assert.equal(timings.instance.desc, 'neuve', 'la première requête de l’instance');
});

test('un lot compte pour un appel, une écriture aussi ; rien n’est compté hors d’une requête mesurée', async () => {
  const { host } = fakeHost();
  installRequestTiming(host, clock);
  // Hors d'une requête : la base répond comme toujours, et rien n'est compté nulle part.
  await ensureWorkspaceForUser(ALICE);
  assert.equal(await findWorkspaceIdForUser(ALICE) !== null, true);

  const response = await timeRequest(request(), async () => {
    await db.batch([
      db.prepare('SELECT 1 AS un'),
      db.prepare('SELECT 2 AS deux'),
      db.prepare('SELECT 3 AS trois'),
    ]);
    await db.prepare("UPDATE irrigation_workspaces SET updated_at = updated_at WHERE owner_user_id = ?").bind('personne').run();
    return new Response(null, { status: 204 });
  });

  assert.equal(entries(response).d1.desc, '2 appels');
});

test('les appels sortants se comptent par sorte, d’après leur hôte, et leur temps est celui de l’horloge (F1103)', async () => {
  const { host, calls } = fakeHost();
  installRequestTiming(host, clock);

  const response = await timeRequest(request(), async () => {
    const otf = await host.fetch('https://api.ouvretaferme.org/0.1beta/zoneList?season=2026');
    assert.equal(otf.status, 200, 'la réponse de l’appel revient telle quelle');
    await host.fetch(new URL('https://api.open-meteo.com/v1/forecast?latitude=47.1&longitude=-1.6'));
    await host.fetch(new Request('https://weather.visualcrossing.com/VisualCrossingWebServices/rest/services/timeline/47.1,-1.6?key=cle'));
    await host.fetch('https://damp-wind-3566.cloudflareaccess.com/cdn-cgi/access/certs');
    await assert.rejects(host.fetch('https://hote.invalid/'), TypeError, 'une erreur de l’appel revient telle quelle');
    return new Response('ok');
  });

  assert.equal(calls.length, 5, 'chaque appel est parti, une fois');
  assert.equal(calls[0].input, 'https://api.ouvretaferme.org/0.1beta/zoneList?season=2026', 'l’adresse part telle quelle');
  const timings = entries(response);
  assert.deepEqual(timings.otf, { dur: 30, desc: '1 appel' });
  assert.deepEqual(timings.meteo, { dur: 60, desc: '2 appels' });
  assert.deepEqual(timings.autres, { dur: 60, desc: '2 appels' }, 'l’appel en échec compte, jusqu’à son échec');
  assert.equal(timings.app.dur, 150);
  const header = response.headers.get('Server-Timing') ?? '';
  assert.doesNotMatch(header, /ouvretaferme|open-meteo|visualcrossing|cloudflareaccess|latitude|cle|zoneList/, 'aucune adresse dans l’en-tête');

  // Hors d'une requête, le fetch chronométré part tel quel, et rien ne compte.
  const outside = await host.fetch('https://api.ouvretaferme.org/0.1beta/plantList');
  assert.equal(outside.status, 200);
  assert.equal(calls.length, 6);
});

test('deux requêtes en même temps ne mêlent pas leurs comptes ; la suivante repart de zéro (F1105)', async () => {
  const { host } = fakeHost();
  installRequestTiming(host, clock);
  await ensureWorkspaceForUser(ALICE);
  let release!: () => void;
  const gate = new Promise<void>((resolve) => { release = resolve; });

  const slow = timeRequest(request(), async () => {
    await db.prepare('SELECT 1 AS un').first();
    await gate;
    await db.prepare('SELECT 2 AS deux').first();
    return new Response('lente');
  });
  const quick = timeRequest(request('/irrigation/semaine'), async () => {
    await host.fetch('https://api.open-meteo.com/v1/forecast');
    for (let index = 0; index < 5; index += 1) await db.prepare('SELECT 1 AS un').first();
    release();
    return new Response('rapide');
  });
  const [ofSlow, ofQuick] = await Promise.all([slow, quick]);

  assert.equal(entries(ofSlow).d1.desc, '2 appels');
  assert.equal(entries(ofSlow).meteo.desc, '0 appel');
  assert.equal(entries(ofQuick).d1.desc, '5 appels');
  assert.equal(entries(ofQuick).meteo.desc, '1 appel');
  assert.equal(entries(ofSlow).instance.desc, 'neuve');
  assert.equal(entries(ofQuick).instance.desc, 'chaude', 'seule la première requête de l’instance est « neuve »');

  const next = await timeRequest(request(), async () => new Response('suivante'));
  assert.equal(entries(next).d1.desc, '0 appel');
  assert.equal(entries(next).meteo.desc, '0 appel');
  assert.equal(entries(next).instance.desc, 'chaude');
});

test('une réponse aux en-têtes figés repart en copie : même statut, mêmes en-têtes, même corps', async () => {
  const { host } = fakeHost();
  installRequestTiming(host, clock);
  const frozen = Response.redirect('https://irrigation.local/irrigation/aujourdhui', 302);
  assert.throws(() => frozen.headers.append('x-essai', '1'), TypeError, 'les en-têtes d’une redirection sont figés');

  const response = await timeRequest(request('/irrigation'), async () => frozen);

  assert.notEqual(response, frozen);
  assert.equal(response.status, 302);
  assert.equal(response.headers.get('location'), 'https://irrigation.local/irrigation/aujourdhui');
  assert.ok(entries(response).app);
});

test('le journal reçoit une ligne par requête : des nombres et des mots, le chemin sans rien après lui (F1104, F1106)', async () => {
  const { host } = fakeHost();
  installRequestTiming(host, clock);
  const lines: string[] = [];
  mock.method(console, 'info', (line: string) => {
    lines.push(line);
  });

  await timeRequest(request('/irrigation/aujourdhui?saison=2026&code=secret', { RSC: '1' }), async () => {
    await host.fetch('https://api.ouvretaferme.org/0.1beta/zoneList?season=2026');
    await db.prepare('SELECT 1 AS un').first();
    return new Response('ok', { status: 200 });
  });
  await assert.rejects(timeRequest(request('/wp-login.php?user=quelqu-un'), async () => {
    throw new Error('panne simulée');
  }), /panne simulée/, 'l’erreur repart telle quelle');

  const logged = lines.map((line) => JSON.parse(line) as Record<string, unknown>).filter((line) => line.event === 'irrigation_request_timing');
  assert.equal(logged.length, 2);
  assert.deepEqual(logged[0], {
    event: 'irrigation_request_timing',
    kind: 'rsc',
    method: 'GET',
    path: '/irrigation/aujourdhui',
    status: 200,
    instance: 'neuve',
    servedByInstance: 1,
    appMs: 30,
    d1Calls: 1,
    d1Ms: 0,
    otfCalls: 1,
    otfMs: 30,
    weatherCalls: 0,
    weatherMs: 0,
    otherCalls: 0,
    otherMs: 0,
  });
  assert.equal(logged[1].path, '(autre)');
  assert.equal(logged[1].status, null, 'une requête en erreur n’a pas de statut');
  assert.equal(logged[1].instance, 'chaude');
  assert.doesNotMatch(lines.join('\n'), /secret|saison=|quelqu-un|ouvretaferme|zoneList/, 'ni paramètre ni adresse au journal');
});
