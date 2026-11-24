import assert from 'node:assert/strict';
import test, { afterEach, beforeEach } from 'node:test';
import { listChangeJournalForUser } from '../../db/change-journal/read';
import { requestFarmErasure } from '../../db/farm-erasure-repository';
import {
  DEFAULT_PHONE_NOTICE_SETTINGS,
  InvalidQuietHoursError,
  readPhoneNoticeSettingsForUser,
  saveEveningReminderForUser,
  saveMorningMessageForUser,
  saveQuietHoursForUser,
} from '../../db/phone-notice-repository';
import { ensureWorkspaceForUser, findWorkspaceIdForUser } from '../../db/workspace-repository';
import type { ChangeJournalEntry } from '../../lib/domain/change-journal/entry';
import {
  DEFAULT_QUIET_HOURS,
  isQuietEndTime,
  isQuietStartTime,
  quietHoursDecision,
  type QuietHoursNotification,
  type QuietHoursSettings,
} from '../../lib/domain/notification-quiet-hours';
import { runDueFarmErasures } from '../../lib/services/farm-erasure';
import { fieldsWithoutWords } from '../support/change-journal-words';
import { installTestDatabase, type TestDatabase } from '../support/d1-sqlite';
import { ALICE, BOB } from '../support/spaces';

/**
 * Les heures de silence des notifications, le réglage (6 undecies, PR H1 ;
 * docs/heures-de-silence-contract.md, section 4 ; D-320) : quatre colonnes de
 * la ligne des messages du téléphone de chaque ferme (migration 0049), vides
 * tant que la ferme n'a rien réglé ; une contrainte qui tient les bornes de la
 * règle ; le geste écrit au journal des modifications sous « heures de
 * silence » ; deux fermes, deux réglages ; l'effacement de la ferme les
 * emporte. Aucun envoyeur ne lit encore le réglage (H2) et aucun écran ne
 * l'allume (H3).
 */

let database: TestDatabase;
beforeEach(() => {
  database = installTestDatabase();
});
afterEach(() => {
  database.dispose();
});

const NOW = '2026-11-24T21:00:00.000Z';
const LATER = '2026-11-24T21:05:00.000Z';
const EVENING_A: QuietHoursSettings = { enabled: true, start: '21:30', end: '07:00', frostPasses: false };
const EVENING_B: QuietHoursSettings = { enabled: true, start: '23:00', end: '05:00', frostPasses: true };
const HEAT: QuietHoursNotification = { kind: 'weather-alert', criterion: { field: 'maximum-temperature', direction: 'above' } };
/** Mardi 24 novembre 2026, 23 h à Paris. */
const AT_23_00 = new Date('2026-11-24T22:00:00.000Z');

function rowCount(table: string): number {
  return Number((database.sqlite.prepare(`SELECT COUNT(*) AS n FROM ${table}`).get() as { n: number }).n);
}

async function journal(spaceKey: string): Promise<Pick<ChangeJournalEntry, 'family' | 'subject' | 'action' | 'before' | 'after' | 'actorUserId'>[]> {
  const order = (database.sqlite.prepare('SELECT id FROM irrigation_change_journal ORDER BY rowid').all() as { id: string }[]).map(({ id }) => id);
  const entries = (await listChangeJournalForUser(spaceKey, { limit: 200 })).sort((left, right) => order.indexOf(left.id) - order.indexOf(right.id));
  // Chaque champ écrit a ses mots à l'écran du journal (D-288, F722).
  assert.deepEqual(fieldsWithoutWords(entries), []);
  return entries.map(({ family, subject, action, before, after, actorUserId }) => ({ family, subject, action, before, after, actorUserId }));
}

test('sans rien écrit, la plage est éteinte, de 22 h à 6 h, le gel qui passe ; lire ne crée rien (choix 2, 3 et 5)', async () => {
  assert.deepEqual((await readPhoneNoticeSettingsForUser(ALICE)).quietHours, DEFAULT_QUIET_HOURS);
  assert.deepEqual(DEFAULT_PHONE_NOTICE_SETTINGS.quietHours, DEFAULT_QUIET_HOURS);
  assert.equal(await findWorkspaceIdForUser(ALICE), null, 'lire le réglage ne crée pas d’espace');
  // Une ferme qui a réglé son message du matin avant H1 : ses colonnes des heures de silence sont vides, la plage est éteinte.
  await saveMorningMessageForUser(ALICE, ALICE, false, NOW);
  assert.deepEqual({ ...database.sqlite.prepare('SELECT quiet_hours, quiet_start, quiet_end, quiet_frost_passes FROM irrigation_phone_notice_settings').get() }, {
    quiet_hours: null, quiet_start: null, quiet_end: null, quiet_frost_passes: null,
  });
  assert.deepEqual((await readPhoneNoticeSettingsForUser(ALICE)).quietHours, DEFAULT_QUIET_HOURS);
});

test('deux fermes, deux plages : ALICE allume et règle la sienne, BOB garde la sienne ; éteinte, la plage garde ses heures (S10)', async () => {
  assert.deepEqual((await saveQuietHoursForUser(ALICE, ALICE, EVENING_A, NOW)).quietHours, EVENING_A);
  assert.deepEqual((await readPhoneNoticeSettingsForUser(ALICE)).quietHours, EVENING_A);
  assert.deepEqual((await readPhoneNoticeSettingsForUser(BOB)).quietHours, DEFAULT_QUIET_HOURS, 'BOB n’a rien réglé');

  await saveQuietHoursForUser(BOB, BOB, EVENING_B, NOW);
  assert.deepEqual((await readPhoneNoticeSettingsForUser(BOB)).quietHours, EVENING_B);
  assert.deepEqual((await readPhoneNoticeSettingsForUser(ALICE)).quietHours, EVENING_A, 'le réglage de BOB ne touche pas celui d’ALICE');

  // La même alerte, la même nuit : retenue chez ALICE jusqu'à 7 h, chez BOB jusqu'à 5 h (scénario 13).
  assert.deepEqual(quietHoursDecision((await readPhoneNoticeSettingsForUser(ALICE)).quietHours, HEAT, AT_23_00), { action: 'hold', until: '2026-11-25T06:00:00.000Z' });
  assert.deepEqual(quietHoursDecision((await readPhoneNoticeSettingsForUser(BOB)).quietHours, HEAT, AT_23_00), { action: 'hold', until: '2026-11-25T04:00:00.000Z' });

  const off = { ...EVENING_A, enabled: false };
  assert.deepEqual((await saveQuietHoursForUser(ALICE, ALICE, off, LATER)).quietHours, off, 'éteinte, la plage garde ses heures pour le prochain allumage');
  assert.deepEqual(quietHoursDecision((await readPhoneNoticeSettingsForUser(ALICE)).quietHours, HEAT, AT_23_00), { action: 'send', defect: null }, 'éteinte : rien ne change (S2)');
  assert.deepEqual((await readPhoneNoticeSettingsForUser(BOB)).quietHours, EVENING_B);
});

test('les heures de silence ne touchent ni au message du matin ni au rappel du soir, et l’inverse', async () => {
  await saveMorningMessageForUser(ALICE, ALICE, false, NOW);
  await saveEveningReminderForUser(ALICE, ALICE, { enabled: true, time: '20:30' }, NOW);
  const after = await saveQuietHoursForUser(ALICE, ALICE, EVENING_A, LATER);
  assert.deepEqual(after, { morningMessage: false, eveningReminder: true, eveningTime: '20:30', quietHours: EVENING_A });
  await saveMorningMessageForUser(ALICE, ALICE, true, LATER);
  await saveEveningReminderForUser(ALICE, ALICE, { enabled: false, time: '21:00' }, LATER);
  assert.deepEqual(await readPhoneNoticeSettingsForUser(ALICE), { morningMessage: true, eveningReminder: false, eveningTime: '21:00', quietHours: EVENING_A });
});

test('un réglage hors des bornes est refusé avant toute écriture : ni espace, ni ligne, ni journal', async () => {
  for (const refused of [
    { ...EVENING_A, start: '19:45' },
    { ...EVENING_A, start: '22:10' },
    { ...EVENING_A, end: '09:15' },
    { ...EVENING_A, end: '03:45' },
    { ...EVENING_A, start: '15:00' },
    { ...EVENING_A, enabled: 'oui' as unknown as boolean },
    { ...EVENING_A, frostPasses: null as unknown as boolean },
  ]) {
    await assert.rejects(saveQuietHoursForUser(ALICE, ALICE, refused, NOW), (error: unknown) => {
      assert.ok(error instanceof InvalidQuietHoursError);
      assert.equal(error.message, 'Choisissez un début de 20 h à 23 h 45 et une fin de 4 h à 9 h, au quart d’heure.');
      return true;
    }, JSON.stringify(refused));
  }
  assert.equal(await findWorkspaceIdForUser(ALICE), null);
  assert.equal(rowCount('irrigation_phone_notice_settings'), 0);
  assert.equal(rowCount('irrigation_change_journal'), 0);
});

test('la contrainte de la base tient les bornes de S1, quart d’heure par quart d’heure, comme la règle', async () => {
  const workspaceId = await ensureWorkspaceForUser(ALICE);
  database.sqlite.prepare('INSERT INTO irrigation_phone_notice_settings (workspace_id, actor_user_id, updated_at) VALUES (?, ?, ?)').run(workspaceId, ALICE, NOW);
  const accepts = (column: string, value: string | number | null): boolean => {
    try {
      database.sqlite.prepare(`UPDATE irrigation_phone_notice_settings SET ${column} = ? WHERE workspace_id = ?`).run(value, workspaceId);
      return true;
    } catch (error) {
      assert.match(String(error), /CHECK constraint failed: chk_phone_notice_settings_quiet/);
      return false;
    }
  };
  // Chaque minute de la journée : la base accepte exactement les heures que la règle offre.
  for (let minutes = 0; minutes < 24 * 60; minutes += 1) {
    const time = `${String(Math.floor(minutes / 60)).padStart(2, '0')}:${String(minutes % 60).padStart(2, '0')}`;
    assert.equal(accepts('quiet_start', time), isQuietStartTime(time), `début ${time}`);
    assert.equal(accepts('quiet_end', time), isQuietEndTime(time), `fin ${time}`);
  }
  for (const value of ['22:00:00', '2200', ' 22:00', 'nuit', '']) {
    assert.equal(accepts('quiet_start', value), false, value);
    assert.equal(accepts('quiet_end', value), false, value);
  }
  for (const column of ['quiet_hours', 'quiet_frost_passes']) {
    for (const value of [0, 1, null]) assert.equal(accepts(column, value), true, `${column} = ${value}`);
    for (const value of [2, -1, 'oui']) assert.equal(accepts(column, value), false, `${column} = ${value}`);
  }
  assert.equal(accepts('quiet_start', null) && accepts('quiet_end', null), true, 'vide vaut le défaut');
});

test('scénario 17 : un réglage corrompu en base, que la contrainte aurait refusé, est lu tel quel et la règle l’ignore comme éteint', async () => {
  await saveQuietHoursForUser(ALICE, ALICE, EVENING_A, NOW);
  const workspaceId = await findWorkspaceIdForUser(ALICE);
  database.sqlite.exec('PRAGMA ignore_check_constraints = ON');
  try {
    database.sqlite.prepare("UPDATE irrigation_phone_notice_settings SET quiet_start = '15:00' WHERE workspace_id = ?").run(workspaceId);
  } finally {
    database.sqlite.exec('PRAGMA ignore_check_constraints = OFF');
  }
  const read = (await readPhoneNoticeSettingsForUser(ALICE)).quietHours;
  assert.equal(read.start, '15:00', 'lu tel quel, jamais remplacé en silence par le défaut');
  assert.deepEqual(quietHoursDecision(read, HEAT, AT_23_00), { action: 'send', defect: 'invalid-setting' });
  assert.deepEqual((await readPhoneNoticeSettingsForUser(BOB)).quietHours, DEFAULT_QUIET_HOURS);
});

test('le journal des modifications : chaque geste qui change dit l’avant et l’après de ses seuls champs ; un geste sans changement n’écrit rien ; chaque ferme lit le sien', async () => {
  await saveQuietHoursForUser(ALICE, ALICE, { ...DEFAULT_QUIET_HOURS, enabled: true }, NOW);
  await saveQuietHoursForUser(ALICE, ALICE, { ...DEFAULT_QUIET_HOURS, enabled: true }, LATER);
  await saveQuietHoursForUser(ALICE, ALICE, { enabled: true, start: '21:00', end: '06:30', frostPasses: false }, LATER);
  await saveQuietHoursForUser(ALICE, ALICE, { enabled: false, start: '21:00', end: '06:30', frostPasses: false }, LATER);
  const line = (before: Record<string, unknown>, after: Record<string, unknown>) =>
    ({ family: 'reglage', subject: 'heures-de-silence', action: 'modifie', before, after, actorUserId: ALICE });
  assert.deepEqual(await journal(ALICE), [
    line({ enabled: 0 }, { enabled: 1 }),
    line({ start: '22:00', end: '06:00', frostPasses: 1 }, { start: '21:00', end: '06:30', frostPasses: 0 }),
    line({ enabled: 1 }, { enabled: 0 }),
  ]);
  assert.deepEqual(await journal(BOB), [], 'BOB ne lit rien du journal d’ALICE');

  // Une ferme qui a déjà une ligne (son message du matin) : l'avant est le défaut des colonnes vides.
  await saveMorningMessageForUser(BOB, BOB, false, NOW);
  await saveQuietHoursForUser(BOB, BOB, EVENING_B, LATER);
  assert.deepEqual((await journal(BOB)).map(({ subject, before, after }) => ({ subject, before, after })), [
    { subject: 'message-du-matin', before: { enabled: 1 }, after: { enabled: 0 } },
    { subject: 'heures-de-silence', before: { enabled: 0, start: '22:00', end: '06:00' }, after: { enabled: 1, start: '23:00', end: '05:00' } },
  ]);
});

test('l’effacement de la ferme emporte ses heures de silence ; celles de la ferme voisine restent', async () => {
  await saveQuietHoursForUser(ALICE, ALICE, EVENING_A, NOW);
  await saveQuietHoursForUser(BOB, BOB, EVENING_B, NOW);
  const aliceWorkspace = await findWorkspaceIdForUser(ALICE);
  assert.ok(await requestFarmErasure(ALICE, new Date('2026-11-20T10:00:00.000Z')));
  const report = await runDueFarmErasures({ now: new Date('2026-11-28T05:15:00.000Z'), log: () => undefined });
  assert.deepEqual(report, { due: 1, erased: 1, unfinished: 0, failures: [] });
  assert.equal(Number((database.sqlite.prepare('SELECT COUNT(*) AS n FROM irrigation_phone_notice_settings WHERE workspace_id = ?').get(aliceWorkspace) as { n: number }).n), 0);
  assert.deepEqual((await readPhoneNoticeSettingsForUser(BOB)).quietHours, EVENING_B);
});
