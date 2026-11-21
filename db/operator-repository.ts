import { db } from './binding';
import type { OperatorNotice } from '@/lib/domain/operations/operator-watch';
import { millisecondsFromMinutes } from '@/lib/domain/units';

/**
 * Ce que la veille de l'exploitant lit et garde (4.5, PR 2 ;
 * docs/tranche-4-contract.md, F566, F608 à F610).
 *
 * L'exploitant n'a pas d'adresse à part au service de notification : ses
 * appareils sont inscrits sous ses espaces, ceux de la ferme du déploiement
 * (F608). La notification du jour est gardée par jour de Paris, une au plus.
 */

/** Les espaces d'une ferme, par leur identifiant : ceux où les appareils de l'exploitant sont inscrits. */
export async function listWorkspaceIdsOfFarm(otfFarmId: string): Promise<string[]> {
  const result = await db.prepare('SELECT id FROM irrigation_workspaces WHERE otf_farm_id = ? ORDER BY id')
    .bind(otfFarmId)
    .all<{ id: string }>();
  return result.results.map((row) => row.id);
}

export type StoredOperatorNotice = {
  parisDay: string;
  kind: OperatorNotice['kind'];
  problems: number;
  sentAt: string;
};

/**
 * Une prise sans envoi plus vieille que ceci est celle d'une veille coupée
 * en route (la route a 30 secondes) : une veille relancée la reprend.
 */
const STALE_CLAIM_MILLISECONDS = millisecondsFromMinutes(5);

/**
 * Prend la notification de ce jour avant de l'envoyer : `false` si une autre
 * veille l'a déjà envoyée, ou l'envoie en ce moment (une panne qui dure ne
 * la renvoie pas).
 */
export async function claimOperatorNotice(parisDay: string, notice: Pick<OperatorNotice, 'kind' | 'problems'>, at: string): Promise<boolean> {
  const staleBefore = new Date(Date.parse(at) - STALE_CLAIM_MILLISECONDS).toISOString();
  const result = await db.prepare(
    `INSERT INTO irrigation_operator_notices (paris_day, kind, problems, claimed_at) VALUES (?, ?, ?, ?)
     ON CONFLICT (paris_day) DO UPDATE SET kind = excluded.kind, problems = excluded.problems, claimed_at = excluded.claimed_at
     WHERE irrigation_operator_notices.sent_at IS NULL AND irrigation_operator_notices.claimed_at <= ?`,
  ).bind(parisDay, notice.kind, notice.problems, at, staleBefore).run();
  return Number(result.meta.changes ?? 0) === 1;
}

/** La notification de ce jour est partie vers un appareil. */
export async function markOperatorNoticeSent(parisDay: string, at: string): Promise<void> {
  await db.prepare('UPDATE irrigation_operator_notices SET sent_at = ? WHERE paris_day = ? AND sent_at IS NULL')
    .bind(at, parisDay)
    .run();
}

/** Rend la notification de ce jour, qui n'est pas partie : une veille relancée réessaiera. */
export async function releaseOperatorNotice(parisDay: string): Promise<void> {
  await db.prepare('DELETE FROM irrigation_operator_notices WHERE paris_day = ? AND sent_at IS NULL')
    .bind(parisDay)
    .run();
}

/** La dernière notification partie vers l'exploitant, pour la page d'état. */
export async function readLatestOperatorNotice(): Promise<StoredOperatorNotice | null> {
  const row = await db.prepare(
    `SELECT paris_day, kind, problems, sent_at FROM irrigation_operator_notices
     WHERE sent_at IS NOT NULL ORDER BY paris_day DESC LIMIT 1`,
  ).first<{ paris_day: string; kind: OperatorNotice['kind']; problems: number; sent_at: string }>();
  return row ? { parisDay: row.paris_day, kind: row.kind, problems: Number(row.problems), sentAt: row.sent_at } : null;
}
