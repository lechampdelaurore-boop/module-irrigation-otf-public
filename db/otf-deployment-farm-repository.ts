import { db } from './binding';

/**
 * La ferme de la clé du déploiement (4.1, docs/tranche-4-contract.md, F330 et
 * F339) : la dernière ferme que `GET /me` a désignée, et l'heure de cette
 * observation. Une seule ligne ; une observation plus ancienne ne remplace
 * jamais une plus récente.
 */

export type DeploymentFarm = { otfFarmId: string; observedAt: string };

const SINGLE_ROW_ID = 1;

export async function readDeploymentFarm(): Promise<DeploymentFarm | null> {
  const row = await db.prepare('SELECT otf_farm_id, observed_at FROM otf_deployment_farm WHERE id = ?')
    .bind(SINGLE_ROW_ID)
    .first<{ otf_farm_id: string; observed_at: string }>();
  return row ? { otfFarmId: row.otf_farm_id, observedAt: row.observed_at } : null;
}

/** Garde la ferme observée, sauf si une observation plus récente est déjà gardée. */
export async function saveDeploymentFarm(otfFarmId: string, observedAt: string): Promise<void> {
  await db.prepare(
    `INSERT INTO otf_deployment_farm (id, otf_farm_id, observed_at, updated_at) VALUES (?, ?, ?, ?)
     ON CONFLICT (id) DO UPDATE SET otf_farm_id = excluded.otf_farm_id, observed_at = excluded.observed_at, updated_at = excluded.updated_at
     WHERE excluded.observed_at >= otf_deployment_farm.observed_at`,
  ).bind(SINGLE_ROW_ID, otfFarmId, observedAt, new Date().toISOString()).run();
}
