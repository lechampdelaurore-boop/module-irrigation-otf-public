import { db } from './binding';
import { SPACE_FILTER, spaceParams } from './workspace-scope';
import { aEcritUneLigne } from './write-result';

/**
 * Le raccordement de chaque ferme à Ouvre ta ferme, côté base (4.3, PR 2 ;
 * docs/tranche-4-contract.md, F351, F355, F356, F397 à F403). Ce dépôt ne
 * voit que des chiffrés : il ne connaît ni la clé maîtresse ni un jeton en
 * clair, que seul le coffre (`lib/services/otf-token-vault.ts`) manipule.
 *
 * Un raccordement se retrouve par l'espace (F365) : sa personne et sa ferme
 * ensemble, par le filtre de tous les espaces (`SPACE_FILTER`). Un espace sans
 * ferme n'a pas de raccordement ; l'espace d'une autre personne ne lit jamais
 * celui-ci.
 */

/** Les jetons d'un raccordement, chiffrés, et l'échéance du jeton d'accès. */
export type SealedFarmTokens = {
  accessTokenSealed: string;
  refreshTokenSealed: string;
  accessExpiresAtMs: number;
};

export type FarmConnectionToKeep = {
  /** L'espace de la personne qui a autorisé, pour la ferme que désigne l'autorisation (F353). */
  spaceKey: string;
  farmName: string;
  sealed: SealedFarmTokens;
  connectedAt: string;
};

/**
 * Range un raccordement « relié », par une seule écriture conditionnelle
 * (F351) : une ferme sans raccordement le reçoit ; la même personne qui la
 * relie de nouveau remplace ses jetons ; si une autre personne la relie déjà,
 * rien ne change et la réponse est `false`.
 */
export async function keepFarmConnection(connection: FarmConnectionToKeep): Promise<boolean> {
  const { ownerUserId, otfFarmId } = farmOf(connection.spaceKey);
  const { accessTokenSealed, refreshTokenSealed, accessExpiresAtMs } = connection.sealed;
  const result = await db.prepare(
    `INSERT INTO otf_farm_connections (otf_farm_id, owner_user_id, farm_name, state, state_reason,
       access_token_sealed, access_expires_at_ms, refresh_token_sealed, connected_at, updated_at)
     VALUES (?, ?, ?, 'linked', NULL, ?, ?, ?, ?, ?)
     ON CONFLICT (otf_farm_id) DO UPDATE SET farm_name = excluded.farm_name, state = 'linked', state_reason = NULL,
       access_token_sealed = excluded.access_token_sealed, access_expires_at_ms = excluded.access_expires_at_ms,
       refresh_token_sealed = excluded.refresh_token_sealed, connected_at = excluded.connected_at, updated_at = excluded.updated_at
     WHERE otf_farm_connections.owner_user_id = excluded.owner_user_id`,
  ).bind(otfFarmId, ownerUserId, connection.farmName, accessTokenSealed, accessExpiresAtMs, refreshTokenSealed, connection.connectedAt, new Date().toISOString())
    .run();
  return aEcritUneLigne(result.meta);
}

type SealedRow = { access_token_sealed: string; refresh_token_sealed: string; access_expires_at_ms: number };

/** Les jetons chiffrés du raccordement de cet espace, s'il en garde ; `null` sinon. */
export async function readSealedFarmTokens(spaceKey: string): Promise<SealedFarmTokens | null> {
  const row = await db.prepare(
    `SELECT access_token_sealed, refresh_token_sealed, access_expires_at_ms FROM otf_farm_connections
     WHERE ${SPACE_FILTER} AND access_token_sealed IS NOT NULL`,
  ).bind(...spaceParams(spaceKey)).first<SealedRow>();
  return row ? sealedOf(row) : null;
}

export type SealedFarmConnection = SealedFarmTokens & { otfFarmId: string };

/** Tous les raccordements qui gardent des jetons, pour la rotation du matin (F356) : la ferme et ses chiffrés. */
export async function listSealedFarmConnections(): Promise<SealedFarmConnection[]> {
  const { results } = await db.prepare(
    `SELECT otf_farm_id, access_token_sealed, refresh_token_sealed, access_expires_at_ms FROM otf_farm_connections
     WHERE access_token_sealed IS NOT NULL ORDER BY otf_farm_id`,
  ).all<SealedRow & { otf_farm_id: string }>();
  return results.map((row) => ({ otfFarmId: row.otf_farm_id, ...sealedOf(row) }));
}

/**
 * Remplace les deux chiffrés d'une ferme par ceux de la clé courante, si la
 * ligne garde encore ceux qui ont été lus (F356). Un renouvellement rangé
 * entre-temps a déjà écrit avec la clé courante : il n'est jamais écrasé.
 */
export async function replaceSealedFarmTokens(
  otfFarmId: string,
  read: { accessTokenSealed: string; refreshTokenSealed: string },
  resealed: { accessTokenSealed: string; refreshTokenSealed: string },
): Promise<boolean> {
  const result = await db.prepare(
    `UPDATE otf_farm_connections SET access_token_sealed = ?, refresh_token_sealed = ?, updated_at = ?
     WHERE otf_farm_id = ? AND access_token_sealed = ? AND refresh_token_sealed = ?`,
  ).bind(resealed.accessTokenSealed, resealed.refreshTokenSealed, new Date().toISOString(), otfFarmId, read.accessTokenSealed, read.refreshTokenSealed)
    .run();
  return aEcritUneLigne(result.meta);
}

function sealedOf(row: SealedRow): SealedFarmTokens {
  return { accessTokenSealed: row.access_token_sealed, refreshTokenSealed: row.refresh_token_sealed, accessExpiresAtMs: row.access_expires_at_ms };
}

/** La personne et la ferme d'un espace qui en a une ; un espace sans ferme n'a pas de raccordement. */
function farmOf(spaceKey: string): { ownerUserId: string; otfFarmId: string } {
  const [ownerUserId, otfFarmId] = spaceParams(spaceKey);
  if (otfFarmId === null) throw new Error('Un raccordement à Ouvre ta ferme se range pour une ferme, jamais pour un espace sans ferme.');
  return { ownerUserId, otfFarmId };
}
