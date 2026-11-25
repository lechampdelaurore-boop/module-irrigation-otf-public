import { db } from './binding';
import { ensureWorkspaceForUser, findWorkspaceIdForUser } from './workspace-repository';
import { aEcritUneLigne } from './write-result';
import { eveningReminderJournal, morningMessageJournal, quietHoursJournal } from './change-journal/settings';
import { DEFAULT_QUIET_HOURS, isValidQuietHours, type QuietHoursSettings } from '@/lib/domain/notification-quiet-hours';
import { EVENING_REMINDER_DEFAULT, EVENING_REMINDER_DEFAULT_TIME, isEveningTime } from '@/lib/domain/today/evening-reminder';
import { MORNING_MESSAGE_DEFAULT } from '@/lib/domain/today/morning-message';
import { millisecondsFromMinutes } from '@/lib/domain/units';

/**
 * Les messages du téléphone d'une ferme (améliorations n° 3 et n° 2,
 * docs/ameliorations-6-2-3-7-contract.md, sections 4.1 à 4.3, F702 à F705,
 * F712, F714) : le réglage de la ferme et la prise du jour de chaque message.
 * Une colonne vide du réglage vaut le défaut, jamais écrit en base. Les heures
 * de silence (6 undecies, docs/heures-de-silence-contract.md, section 4)
 * vivent dans la même ligne.
 */

export type PhoneNoticeKind = 'morning' | 'evening';

export type PhoneNoticeSettings = {
  morningMessage: boolean;
  eveningReminder: boolean;
  /** « 19:00 » : de 17 h à 22 h, au quart d'heure, heure de Paris. */
  eveningTime: string;
  /**
   * Les heures de silence, défauts compris. Le début et la fin sont lus tels
   * qu'écrits : un réglage hors des bornes, que la contrainte refuse à
   * l'écriture, est ignoré comme éteint par la règle, qui dit le défaut (S17).
   */
  quietHours: QuietHoursSettings;
};

type SettingsRow = {
  morning_message: number | null;
  evening_reminder: number | null;
  evening_time: string | null;
  quiet_hours: number | null;
  quiet_start: string | null;
  quiet_end: string | null;
  quiet_frost_passes: number | null;
};

const SETTINGS_COLUMNS = 'morning_message, evening_reminder, evening_time, quiet_hours, quiet_start, quiet_end, quiet_frost_passes';

function flag(value: number | null | undefined, fallback: boolean): boolean {
  return value === null || value === undefined ? fallback : value === 1;
}

function settingsOf(row: SettingsRow | null): PhoneNoticeSettings {
  return {
    morningMessage: flag(row?.morning_message, MORNING_MESSAGE_DEFAULT),
    eveningReminder: flag(row?.evening_reminder, EVENING_REMINDER_DEFAULT),
    eveningTime: isEveningTime(row?.evening_time) ? row.evening_time : EVENING_REMINDER_DEFAULT_TIME,
    quietHours: {
      enabled: flag(row?.quiet_hours, DEFAULT_QUIET_HOURS.enabled),
      start: row?.quiet_start ?? DEFAULT_QUIET_HOURS.start,
      end: row?.quiet_end ?? DEFAULT_QUIET_HOURS.end,
      frostPasses: flag(row?.quiet_frost_passes, DEFAULT_QUIET_HOURS.frostPasses),
    },
  };
}

/** Le réglage d'un espace, défauts compris : une ferme sans ligne reçoit les défauts. */
export async function readPhoneNoticeSettingsForWorkspace(workspaceId: string): Promise<PhoneNoticeSettings> {
  const row = await db.prepare(`SELECT ${SETTINGS_COLUMNS} FROM irrigation_phone_notice_settings WHERE workspace_id = ?`)
    .bind(workspaceId)
    .first<SettingsRow>();
  return settingsOf(row ?? null);
}

/** Le réglage de chaque espace qui en a écrit un, en une lecture : le passage du soir lit toutes les fermes à la fois. */
export async function listPhoneNoticeSettings(): Promise<Map<string, PhoneNoticeSettings>> {
  const result = await db.prepare(`SELECT workspace_id, ${SETTINGS_COLUMNS} FROM irrigation_phone_notice_settings`)
    .all<SettingsRow & { workspace_id: string }>();
  return new Map(result.results.map((row) => [row.workspace_id, settingsOf(row)]));
}

/** Les défauts d'une ferme qui n'a rien écrit. */
export const DEFAULT_PHONE_NOTICE_SETTINGS: PhoneNoticeSettings = settingsOf(null);

/** Le réglage d'une ferme, sans rien créer : une ferme sans espace a les défauts. */
export async function readPhoneNoticeSettingsForUser(ownerUserId: string): Promise<PhoneNoticeSettings> {
  const workspaceId = await findWorkspaceIdForUser(ownerUserId);
  return workspaceId ? readPhoneNoticeSettingsForWorkspace(workspaceId) : settingsOf(null);
}

/** Active ou coupe le message du matin, avec la personne qui le change et l'heure ; les autres colonnes ne bougent pas. */
export async function saveMorningMessageForUser(ownerUserId: string, actorUserId: string, enabled: boolean, at: string): Promise<PhoneNoticeSettings> {
  const workspaceId = await ensureWorkspaceForUser(ownerUserId);
  // Le journal des modifications d'abord : l'avant est le réglage en vigueur, défaut compris (amélioration n° 7, D-286).
  await db.batch([morningMessageJournal('message-du-matin', { workspaceId, actorUserId, at }, enabled), db.prepare(
    `INSERT INTO irrigation_phone_notice_settings (workspace_id, morning_message, actor_user_id, updated_at) VALUES (?, ?, ?, ?)
     ON CONFLICT (workspace_id) DO UPDATE SET morning_message = excluded.morning_message, actor_user_id = excluded.actor_user_id, updated_at = excluded.updated_at`,
  ).bind(workspaceId, enabled ? 1 : 0, actorUserId, at)]);
  return readPhoneNoticeSettingsForWorkspace(workspaceId);
}

/** Active ou coupe le rappel du soir et règle son heure, avec la personne et l'heure du geste ; le matin ne bouge pas. */
export async function saveEveningReminderForUser(
  ownerUserId: string,
  actorUserId: string,
  setting: { enabled: boolean; time: string },
  at: string,
): Promise<PhoneNoticeSettings> {
  if (!isEveningTime(setting.time)) throw new InvalidEveningTimeError();
  const workspaceId = await ensureWorkspaceForUser(ownerUserId);
  // Le journal des modifications d'abord : l'avant est le réglage en vigueur, défauts compris (amélioration n° 7, D-286).
  await db.batch([eveningReminderJournal('rappel-du-soir', { workspaceId, actorUserId, at }, setting), db.prepare(
    `INSERT INTO irrigation_phone_notice_settings (workspace_id, evening_reminder, evening_time, actor_user_id, updated_at) VALUES (?, ?, ?, ?, ?)
     ON CONFLICT (workspace_id) DO UPDATE SET evening_reminder = excluded.evening_reminder, evening_time = excluded.evening_time,
       actor_user_id = excluded.actor_user_id, updated_at = excluded.updated_at`,
  ).bind(workspaceId, setting.enabled ? 1 : 0, setting.time, actorUserId, at)]);
  return readPhoneNoticeSettingsForWorkspace(workspaceId);
}

export class InvalidEveningTimeError extends Error {
  constructor() {
    super('Choisissez une heure de 17 h à 22 h, au quart d’heure.');
    this.name = 'InvalidEveningTimeError';
  }
}

/**
 * Allume ou éteint les heures de silence et règle leur plage et la case du gel
 * (6 undecies, contrat section 4), avec la personne qui le change et l'heure ;
 * le matin et le soir ne bougent pas. Les quatre valeurs s'écrivent ensemble :
 * éteinte, la plage garde ses heures pour le prochain allumage.
 */
export async function saveQuietHoursForUser(
  ownerUserId: string,
  actorUserId: string,
  setting: QuietHoursSettings,
  at: string,
): Promise<PhoneNoticeSettings> {
  if (!isValidQuietHours(setting)) throw new InvalidQuietHoursError();
  const workspaceId = await ensureWorkspaceForUser(ownerUserId);
  // Le journal des modifications d'abord : l'avant est le réglage en vigueur, défauts compris (amélioration n° 7, D-286).
  await db.batch([quietHoursJournal('heures-de-silence', { workspaceId, actorUserId, at }, setting), db.prepare(
    `INSERT INTO irrigation_phone_notice_settings (workspace_id, quiet_hours, quiet_start, quiet_end, quiet_frost_passes, actor_user_id, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT (workspace_id) DO UPDATE SET quiet_hours = excluded.quiet_hours, quiet_start = excluded.quiet_start, quiet_end = excluded.quiet_end,
       quiet_frost_passes = excluded.quiet_frost_passes, actor_user_id = excluded.actor_user_id, updated_at = excluded.updated_at`,
  ).bind(workspaceId, setting.enabled ? 1 : 0, setting.start, setting.end, setting.frostPasses ? 1 : 0, actorUserId, at)]);
  return readPhoneNoticeSettingsForWorkspace(workspaceId);
}

export class InvalidQuietHoursError extends Error {
  constructor() {
    super('Choisissez un début de 20 h à 23 h 45 et une fin de 4 h à 9 h, au quart d’heure.');
    this.name = 'InvalidQuietHoursError';
  }
}

/**
 * Une prise sans envoi plus vieille que ceci est celle d'un calcul ou d'un
 * passage coupé en route : un calcul relancé le même jour la reprend.
 */
const STALE_CLAIM_MILLISECONDS = millisecondsFromMinutes(5);

/**
 * Prend le message de ce jour de Paris avant de l'envoyer (§4.2.4) : `false`
 * s'il est déjà parti, ou s'il part en ce moment. La ligne de la veille est
 * réécrite : une seule ligne par espace et par genre.
 */
export async function claimPhoneNotice(workspaceId: string, kind: PhoneNoticeKind, parisDay: string, at: string): Promise<boolean> {
  const staleBefore = new Date(Date.parse(at) - STALE_CLAIM_MILLISECONDS).toISOString();
  const result = await db.prepare(
    `INSERT INTO irrigation_phone_notices (workspace_id, kind, paris_day, claimed_at) VALUES (?, ?, ?, ?)
     ON CONFLICT (workspace_id, kind) DO UPDATE SET paris_day = excluded.paris_day, claimed_at = excluded.claimed_at, sent_at = NULL
     WHERE irrigation_phone_notices.paris_day < excluded.paris_day
        OR (irrigation_phone_notices.paris_day = excluded.paris_day AND irrigation_phone_notices.sent_at IS NULL AND irrigation_phone_notices.claimed_at <= ?)`,
  ).bind(workspaceId, kind, parisDay, at, staleBefore).run();
  return aEcritUneLigne(result.meta);
}

/** Le message de ce jour est parti vers le Worker de notification. */
export async function markPhoneNoticeSent(workspaceId: string, kind: PhoneNoticeKind, parisDay: string, at: string): Promise<void> {
  await db.prepare('UPDATE irrigation_phone_notices SET sent_at = ? WHERE workspace_id = ? AND kind = ? AND paris_day = ? AND sent_at IS NULL')
    .bind(at, workspaceId, kind, parisDay)
    .run();
}

/** Rend le message de ce jour, qui n'est pas parti : un calcul relancé réessaiera. */
export async function releasePhoneNotice(workspaceId: string, kind: PhoneNoticeKind, parisDay: string): Promise<void> {
  await db.prepare('DELETE FROM irrigation_phone_notices WHERE workspace_id = ? AND kind = ? AND paris_day = ? AND sent_at IS NULL')
    .bind(workspaceId, kind, parisDay)
    .run();
}
