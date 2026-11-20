import assert from 'node:assert/strict';
import test, { afterEach, beforeEach, mock } from 'node:test';
import { OtfReadClient, resetOtfRatePacer, type OtfSharedCallPace } from '../lib/adapters/otf/read-client.ts';
import { guardedLineCount, takeLogFindings } from './support/log-guard.mjs';
import { SENSITIVE_LOG_PATTERNS, sensitiveValuesIn } from './support/log-safety.mjs';

/**
 * Les journaux, sans donnée sensible (4.5, PR 2 ; docs/tranche-4-contract.md,
 * F564, et 10 bis.13, F617) : l'essai témoin du garde des journaux. Le garde
 * (`tests/support/log-guard.mjs`) lit chaque ligne écrite pendant les essais,
 * y compris celles d'une console remplacée, et fait échouer le fichier qui
 * en écrit une sensible. Ici : chaque motif trouve sa valeur piégée, les
 * lignes réelles du module passent, le garde voit les lignes d'une console
 * remplacée, et les chemins sensibles du connecteur, nourris de valeurs
 * piégées, n'en écrivent aucune.
 */

const CANARIES: Record<string, string> = {
  'jeton JWT': 'session eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiJjYW5hcmkifQ.c2lnbmF0dXJlLWNhbmFyaQ',
  'en-tête d’autorisation': 'Authorization: Bearer jeton-canari-42',
  'paramètre d’autorisation': 'https://connexion.example/authorize?client_id=module&code_verifier=canari',
  'champ secret': '{"refresh_token":"renouvellement-canari"}',
  'adresse de retour': 'GET /api/otf/oauth/retour?code=canari&state=canari',
  'adresse électronique': 'envoyé à personne.canari@example.org',
  'nom de ferme': 'lecture de la Ferme des Hirondelles terminée',
  'chaîne opaque': 'clé a1B2c3D4e5F6g7H8i9J0k1L2m3N4o5P6q7R8s9T0',
};

/** Des lignes que le module écrit vraiment : aucune ne doit passer pour sensible. */
const MODULE_LINES = [
  JSON.stringify({ event: 'otf_call_failed', route: '/bedList', attempt: 2, outcome: 'timeout', durationMs: 8001 }),
  JSON.stringify({ event: 'task_run_failed', task: 'weather-reanalysis', summary: '1 lieu sur 1 sans pluie estimée (réseau)' }),
  JSON.stringify({ event: 'operator_watch_failed', notice: 'alert', problems: 1, summary: 'ferme du déploiement inconnue : aucun exploitant à prévenir' }),
  JSON.stringify({ event: 'otf_farm_read_finished', outcome: 'complete', calls: 12, reserved: 14 }),
  JSON.stringify({ event: 'otf_authentication_brake', pausedUntil: '2026-11-18T20:15:00.000Z' }),
  JSON.stringify({ event: 'otf_vault_morning', sealed: 2, resealed: 0, unreadable: 0, previousKey: false }),
  JSON.stringify({ event: 'irrigation_workspace_attached', sameFarmAsKey: true, fromCache: false }),
  JSON.stringify({ event: 'planning_calculation_completed', trigger: 'daily', season: 2026, weekStart: '2026-11-16', snapshotSource: 'live', beds: 42 }),
  JSON.stringify({ event: 'push_alarm', notificationId: 'operator-watch-2026-11-20', alarmId: '0b9f0c0e-2f6c-4a8e-9a43-3f2d8f1c6a11' }),
  '[irrigation-sync] lecture-live { name: \'OtfApiError\', message: \'Lecture OTF impossible (statut 503).\', status: 503 }',
  'La ferme de la clé du déploiement a changé : Ferme n° est absent, aucun nom.',
];

let logs: string[] = [];

beforeEach(() => {
  resetOtfRatePacer();
  logs = [];
});

afterEach(() => mock.restoreAll());

test('chaque motif trouve sa valeur piégée, et dit sa nature sans recopier la valeur', () => {
  assert.deepEqual(Object.keys(CANARIES).sort(), [...new Set(SENSITIVE_LOG_PATTERNS.map(({ kind }) => kind))].sort(), 'un témoin par nature');
  for (const [kind, line] of Object.entries(CANARIES)) {
    const found = sensitiveValuesIn(line);
    assert.ok(found.includes(kind), `${kind} : ${line}`);
    for (const word of found) assert.ok(!line.includes(word) || !word.includes('canari'), 'la nature, jamais la valeur');
  }
  for (const name of ['Ferme 17', 'Ferme d’Alice', 'Ferme du Moulin', 'Ferme de démonstration', 'Ferme des essais']) {
    assert.ok(sensitiveValuesIn(`ouverture de ${name}`).includes('nom de ferme'), name);
  }
  assert.ok(sensitiveValuesIn('{"accessToken": "canari-acces"}').includes('champ secret'));
});

test('les lignes réelles du module passent : des noms d’événements, des nombres, des dates, des résumés écrits par lui', () => {
  for (const line of MODULE_LINES) assert.deepEqual(sensitiveValuesIn(line), [], line);
  assert.deepEqual(sensitiveValuesIn('{"accessToken":null,"refresh_token":undefined}'), [], 'un champ vide n’est pas un secret');
});

test('le garde voit les lignes d’une console remplacée par un essai : la ligne sensible est trouvée, l’essai lit encore la sienne', () => {
  const before = guardedLineCount();
  mock.method(console, 'warn', (line: string) => { logs.push(line); });
  console.warn(JSON.stringify({ event: 'otf_token_refreshed', access_token: 'jeton-canari-de-la-console' }));
  console.warn(JSON.stringify({ event: 'otf_call_failed', outcome: 'timeout' }));
  mock.restoreAll();
  assert.equal(guardedLineCount(), before + 2);
  assert.equal(logs.length, 2, 'l’essai reçoit toujours ses lignes');
  const findings = takeLogFindings();
  assert.equal(findings.length, 1);
  assert.deepEqual(findings[0].kinds, ['champ secret']);
});

test('les chemins sensibles du connecteur, nourris de valeurs piégées, n’écrivent aucune valeur sensible au journal', async () => {
  const token = 'eyJhbGciOiJIUzI1NiJ9.eyJmZXJtZSI6IkZlcm1lIGRlcyBIaXJvbmRlbGxlcyJ9.c2lnbmF0dXJlLXBpZWdlZQ';
  const pace: OtfSharedCallPace = {
    claimPlace: async () => true,
    placeRefusal: async (atMs) => ({ kind: 'retry-at', atMs }),
    holdCalls: async () => { throw new Error(`D1 indisponible pour Bearer ${token}`); },
    recordAuthenticationFailure: async () => { throw new Error('D1 indisponible : personne.canari@example.org'); },
    recordOutcome: async () => { throw new Error(`D1 indisponible : Ferme des Hirondelles, ${token}`); },
  };
  const fetchFailure = Object.assign(new TypeError(`fetch failed for https://api.ouvretaferme.org/0.1beta/me?access_token=${token}`), {
    cause: { code: 'ECONNRESET' },
  });
  const answers: (Response | Error)[] = [
    new Response(JSON.stringify({ error: 'rate_limit_day', farm: 'Ferme des Hirondelles' }), { status: 429 }),
    new Response(JSON.stringify({ message: `token ${token} expired` }), { status: 401 }),
    fetchFailure,
    new DOMException('The operation was aborted.', 'AbortError'),
    new Response(`Ferme des Hirondelles : ${token}`, { status: 503 }),
  ];
  const before = guardedLineCount();
  let nowMs = 1_000_000;
  const client = new OtfReadClient({
    baseUrl: 'https://api.ouvretaferme.org/0.1beta',
    token,
    farmKey: 'ferme-piegee',
    clock: { now: () => nowMs, sleep: async (durationMs: number) => { nowMs += Math.max(0, durationMs); } },
    sharedPace: pace,
    fetchImpl: async () => {
      const answer = answers.shift() ?? Response.json({});
      if (answer instanceof Error) throw answer;
      return answer;
    },
  });
  for (let call = 0; call < 3; call += 1) await client.getCurrentStructures().catch(() => undefined);

  assert.ok(guardedLineCount() - before >= 8, 'les échecs ont bien été journalisés, et vus par le garde');
  assert.deepEqual(takeLogFindings(), []);
});
