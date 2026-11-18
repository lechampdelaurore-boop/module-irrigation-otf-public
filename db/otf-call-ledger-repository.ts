import { db } from './binding';
import { aEcritUneLigne } from './write-result';
import { OTF_CALL_WINDOW_MS, OTF_CALLS_PER_MINUTE } from '@/lib/domain/otf/call-pace';
import {
  OTF_AUTHENTICATION_BRAKE_FAILURES,
  OTF_AUTHENTICATION_BRAKE_PAUSE_MS,
  OTF_AUTHENTICATION_BRAKE_WINDOW_MS,
  OTF_CALL_ROWS_KEPT_MS,
  OTF_MODULE_PAUSE_SCOPE,
  OTF_READ_LEASE_MS,
  oldestKeptCountDay,
  parisDayOf,
  type OtfCallPause,
  type OtfPauseReason,
  type SharedPaceState,
} from '@/lib/domain/otf/shared-call-pace';

/**
 * Le compteur partagé des appels à Ouvre ta ferme (4.3, PR 1 ;
 * docs/tranche-4-contract.md, F359, F361 à F363). La base est la même pour
 * toutes les instances du serveur : chaque appel y prend sa place par une
 * seule écriture conditionnelle, qui n'aboutit que si la règle est tenue au
 * moment où la base l'exécute ; deux instances ne peuvent donc pas prendre la
 * même place. `paceKey` est la ferme (F381) : les appels de toutes ses clés
 * partagent ses places. Aucun jeton, aucune adresse, aucune personne n'y est
 * écrit : des fermes, des heures et des nombres.
 */

/** Les conditions communes d'un départ : aucune pause de la ferme ni du module. */
const NO_PAUSE = `NOT EXISTS (
  SELECT 1 FROM otf_call_pauses WHERE scope IN (?, '${OTF_MODULE_PAUSE_SCOPE}') AND paused_until_ms > ?)`;
/** … et le dernier départ réel de la ferme a au moins l'espacement. */
const SPACED = `NOT EXISTS (
  SELECT 1 FROM otf_call_starts WHERE pace_key = ? AND reserved = 0 AND started_at_ms > ?)`;
/** Les places de la minute glissante d'une ferme, départs et places réservées. */
const WINDOW_COUNT = '(SELECT COUNT(*) FROM otf_call_starts WHERE pace_key = ? AND started_at_ms > ?)';

export type OtfPlaceClaim = {
  paceKey: string;
  atMs: number;
  /** L'espacement du connecteur, marge comprise (255 ms : F361). */
  spacingMs: number;
  /** La lecture à laquelle l'appel appartient, ou `null` pour un appel isolé. */
  readId: string | null;
  /** L'appel prend une place réservée par sa lecture, plutôt qu'une place neuve. */
  fromReservation: boolean;
};

/**
 * La place d'un appel, par une seule écriture conditionnelle (F361) :
 * acceptée si aucune pause ne court, si le dernier départ de la ferme a au
 * moins l'espacement et si la minute glissante a la place. Une place réservée
 * par la lecture devient un départ ; elle comptait déjà dans la minute, sauf
 * si elle en est sortie (lecture de plus d'une minute) : elle se juge alors
 * comme une place neuve. Le départ s'ajoute au compte du jour de la ferme
 * (déclencheurs de la migration 0032).
 */
export async function claimOtfCallPlace(claim: OtfPlaceClaim): Promise<boolean> {
  const { paceKey, atMs, spacingMs, readId } = claim;
  const parisDay = parisDayOf(atMs);
  const windowStart = atMs - OTF_CALL_WINDOW_MS;
  const guards = [paceKey, atMs, paceKey, atMs - spacingMs];
  const statement = claim.fromReservation && readId !== null
    ? db.prepare(
        `UPDATE otf_call_starts SET started_at_ms = ?, paris_day = ?, reserved = 0
         WHERE id = (SELECT id FROM otf_call_starts WHERE pace_key = ? AND read_id = ? AND reserved = 1 ORDER BY id LIMIT 1)
           AND ${NO_PAUSE} AND ${SPACED}
           AND (started_at_ms > ? OR ${WINDOW_COUNT} < ?)`,
      ).bind(atMs, parisDay, paceKey, readId, ...guards, windowStart, paceKey, windowStart, OTF_CALLS_PER_MINUTE)
    : db.prepare(
        `INSERT INTO otf_call_starts (pace_key, started_at_ms, paris_day, read_id, reserved)
         SELECT ?, ?, ?, ?, 0
         WHERE ${NO_PAUSE} AND ${SPACED} AND ${WINDOW_COUNT} < ?`,
      ).bind(paceKey, atMs, parisDay, readId, ...guards, paceKey, windowStart, OTF_CALLS_PER_MINUTE);
  return aEcritUneLigne((await statement.run()).meta);
}

type PaceRow = { started_at_ms: number; reserved: number };
type PauseRow = { scope: string; paused_until_ms: number; reason: OtfPauseReason };
type ReadRow = { lease_id: string | null; lease_until_ms: number; reserve_basis: number | null };

/** Ce que la base sait d'une ferme à `atMs` : sa minute glissante, ses pauses, sa lecture en cours et sa réserve. */
export type OtfFarmPace = { state: SharedPaceState; leaseHeld: boolean; reserveBasis: number | null };

export async function readOtfFarmPace(paceKey: string, atMs: number): Promise<OtfFarmPace> {
  const [places, pauses, read] = await db.batch([
    db.prepare('SELECT started_at_ms, reserved FROM otf_call_starts WHERE pace_key = ? AND started_at_ms > ? ORDER BY started_at_ms, id')
      .bind(paceKey, atMs - OTF_CALL_WINDOW_MS),
    db.prepare(`SELECT scope, paused_until_ms, reason FROM otf_call_pauses WHERE scope IN (?, '${OTF_MODULE_PAUSE_SCOPE}') AND paused_until_ms > ?`)
      .bind(paceKey, atMs),
    db.prepare('SELECT lease_id, lease_until_ms, reserve_basis FROM otf_farm_reads WHERE pace_key = ?').bind(paceKey),
  ]);
  const placeRows = places.results as PaceRow[];
  const starts = placeRows.filter((row) => Number(row.reserved) === 0).map((row) => Number(row.started_at_ms));
  const readRow = (read.results as ReadRow[])[0];
  return {
    state: {
      lastStartedAtMs: starts.length > 0 ? Math.max(...starts) : null,
      windowPlacesMs: placeRows.map((row) => Number(row.started_at_ms)),
      pauses: (pauses.results as PauseRow[]).map((row) => ({
        scope: row.scope === OTF_MODULE_PAUSE_SCOPE ? 'module' : 'farm',
        untilMs: Number(row.paused_until_ms),
        reason: row.reason,
      })),
    },
    leaseHeld: readRow !== undefined && readRow.lease_id !== null && Number(readRow.lease_until_ms) > atMs,
    reserveBasis: readRow?.reserve_basis === null || readRow?.reserve_basis === undefined ? null : Number(readRow.reserve_basis),
  };
}

/** Une pause pour toutes les instances ; une pause plus courte ne raccourcit pas celle qui court. */
export async function holdOtfCalls(paceKey: string, pause: OtfCallPause): Promise<void> {
  await db.prepare(
    `INSERT INTO otf_call_pauses (scope, paused_until_ms, reason) VALUES (?, ?, ?)
     ON CONFLICT (scope) DO UPDATE SET paused_until_ms = excluded.paused_until_ms, reason = excluded.reason
     WHERE excluded.paused_until_ms > otf_call_pauses.paused_until_ms`,
  ).bind(pause.scope === 'module' ? OTF_MODULE_PAUSE_SCOPE : paceKey, pause.untilMs, pause.reason).run();
}

/**
 * Un échec d'authentification (`401`), compté pour tout le module (F359) : au
 * dixième en quinze minutes, plus aucun appel ne part vers OTF pendant quinze
 * minutes. Rend la pause du frein quand elle court, sinon `null`.
 */
export async function recordOtfAuthenticationFailure(atMs: number): Promise<OtfCallPause | null> {
  const [, , brake] = await db.batch([
    db.prepare('INSERT INTO otf_authentication_failures (failed_at_ms) VALUES (?)').bind(atMs),
    db.prepare(
      `INSERT INTO otf_call_pauses (scope, paused_until_ms, reason)
       SELECT '${OTF_MODULE_PAUSE_SCOPE}', ?, 'authentication-brake'
       WHERE (SELECT COUNT(*) FROM otf_authentication_failures WHERE failed_at_ms > ?) >= ?
       ON CONFLICT (scope) DO UPDATE SET paused_until_ms = excluded.paused_until_ms, reason = excluded.reason
       WHERE excluded.paused_until_ms > otf_call_pauses.paused_until_ms`,
    ).bind(atMs + OTF_AUTHENTICATION_BRAKE_PAUSE_MS, atMs - OTF_AUTHENTICATION_BRAKE_WINDOW_MS, OTF_AUTHENTICATION_BRAKE_FAILURES),
    db.prepare(`SELECT paused_until_ms FROM otf_call_pauses WHERE scope = '${OTF_MODULE_PAUSE_SCOPE}' AND reason = 'authentication-brake' AND paused_until_ms > ?`)
      .bind(atMs),
  ]);
  const row = (brake.results as { paused_until_ms: number }[])[0];
  return row ? { scope: 'module', untilMs: Number(row.paused_until_ms), reason: 'authentication-brake' } : null;
}

/**
 * Le départ d'une lecture complète (F362), en un seul lot : le ménage des
 * lignes échues (F387), puis le bail de lecture de la ferme, pris seulement
 * s'il est libre, si aucune pause ne court et si la minute glissante a la
 * place des `places` réservées ; puis ces places, écrites seulement si le bail
 * est à cette lecture. Rend `true` si la lecture peut partir.
 */
export async function beginOtfFarmRead({ paceKey, readId, atMs, places }: { paceKey: string; readId: string; atMs: number; places: number }): Promise<boolean> {
  const leaseUntil = atMs + OTF_READ_LEASE_MS;
  const results = await db.batch([
    db.prepare('DELETE FROM otf_call_starts WHERE started_at_ms < ?').bind(atMs - OTF_CALL_ROWS_KEPT_MS),
    db.prepare('DELETE FROM otf_daily_calls WHERE paris_day < ?').bind(oldestKeptCountDay(atMs)),
    db.prepare('DELETE FROM otf_authentication_failures WHERE failed_at_ms <= ?').bind(atMs - OTF_AUTHENTICATION_BRAKE_WINDOW_MS),
    db.prepare('DELETE FROM otf_call_pauses WHERE paused_until_ms <= ?').bind(atMs),
    db.prepare(
      `INSERT INTO otf_farm_reads (pace_key, lease_id, lease_until_ms, updated_at)
       SELECT ?, ?, ?, ?
       WHERE ${NO_PAUSE} AND ${WINDOW_COUNT} + ? <= ?
       ON CONFLICT (pace_key) DO UPDATE SET lease_id = excluded.lease_id, lease_until_ms = excluded.lease_until_ms, updated_at = excluded.updated_at
       WHERE otf_farm_reads.lease_id IS NULL OR otf_farm_reads.lease_until_ms <= ?`,
    ).bind(paceKey, readId, leaseUntil, new Date(atMs).toISOString(), paceKey, atMs, paceKey, atMs - OTF_CALL_WINDOW_MS, places, OTF_CALLS_PER_MINUTE, atMs),
    db.prepare(
      `INSERT INTO otf_call_starts (pace_key, started_at_ms, paris_day, read_id, reserved)
       WITH RECURSIVE place(n) AS (SELECT 1 UNION ALL SELECT n + 1 FROM place WHERE n < ?)
       SELECT ?, ?, ?, ?, 1 FROM place
       WHERE EXISTS (SELECT 1 FROM otf_farm_reads WHERE pace_key = ? AND lease_id = ? AND lease_until_ms = ?)`,
    ).bind(places, paceKey, atMs, parisDayOf(atMs), readId, paceKey, readId, leaseUntil),
    db.prepare('SELECT lease_id FROM otf_farm_reads WHERE pace_key = ? AND lease_id = ? AND lease_until_ms = ?').bind(paceKey, readId, leaseUntil),
  ]);
  return (results.at(-1)?.results ?? []).length === 1;
}

/**
 * La fin d'une lecture : ses places réservées et inutilisées sont rendues, le
 * bail libéré s'il est encore à elle, et la base de la réserve suivante
 * gardée (F362). Une lecture dont le bail a été repris ne touche à rien de la
 * suivante.
 */
export async function endOtfFarmRead({ paceKey, readId, reserveBasis, atMs }: { paceKey: string; readId: string; reserveBasis: number | null; atMs: number }): Promise<void> {
  await db.batch([
    db.prepare('DELETE FROM otf_call_starts WHERE pace_key = ? AND read_id = ? AND reserved = 1').bind(paceKey, readId),
    db.prepare(
      `UPDATE otf_farm_reads SET lease_id = NULL, lease_until_ms = 0, reserve_basis = ?, updated_at = ?
       WHERE pace_key = ? AND lease_id = ?`,
    ).bind(reserveBasis, new Date(atMs).toISOString(), paceKey, readId),
  ]);
}

/** Les appels d'une ferme jour par jour, du plus récent au plus ancien (F363 ; « Réglages » les montrera, F367). */
export async function readOtfDailyCalls(paceKey: string): Promise<{ parisDay: string; calls: number }[]> {
  const rows = await db.prepare('SELECT paris_day, calls FROM otf_daily_calls WHERE pace_key = ? ORDER BY paris_day DESC')
    .bind(paceKey)
    .all<{ paris_day: string; calls: number }>();
  return rows.results.map((row) => ({ parisDay: row.paris_day, calls: Number(row.calls) }));
}
