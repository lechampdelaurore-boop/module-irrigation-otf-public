import { db } from '../binding';
import { ensureWorkspaceForUser } from '../workspace-repository';
import { listReferenceCropsForWorkspace, type CropWaterWriteResult } from './references';
import {
  sensitiveStageChoicesFor,
  type SensitiveStageChoice,
  type SensitiveStageConfidence,
  type SensitiveStageReference,
} from '@/lib/domain/crop-water/sensitive-stages';

/**
 * Persistance des stades sensibles au manque d'eau (amélioration n° 4,
 * docs/ameliorations-4-5-contract.md, §3.1, F730 ; migration 0045) : la
 * liste préremplie commune, que seule une migration écrit, et les choix de
 * chaque ferme, qui ne valent que pour elle. La règle (ce qui est en vigueur,
 * ce qu'un geste enregistre) vit dans `lib/domain/crop-water/sensitive-stages.ts`.
 */

type CommonRow = { crop_key: string; stage_rank: number; stage_label: string; confidence: SensitiveStageConfidence; source: string };
type ChoiceRow = { crop_key: string; stage_rank: number; stage_label: string; sensitive: number };

/** La liste préremplie commune, la même pour toutes les fermes. */
export async function listSensitiveStageReferences(): Promise<SensitiveStageReference[]> {
  const rows = await db.prepare(
    `SELECT crop_key, stage_rank, stage_label, confidence, source
     FROM irrigation_crop_sensitive_stage_common
     ORDER BY crop_key, stage_rank`,
  ).all<CommonRow>();
  return rows.results.map((row) => ({
    cropKey: row.crop_key, rank: Number(row.stage_rank), label: row.stage_label, confidence: row.confidence, source: row.source,
  }));
}

/** Les choix d'une exploitation ; aucun pour une exploitation qui n'existe pas encore. */
export async function listSensitiveStageChoicesForWorkspace(workspaceId: string | null): Promise<SensitiveStageChoice[]> {
  if (workspaceId === null) return [];
  const rows = await db.prepare(
    `SELECT crop_key, stage_rank, stage_label, sensitive
     FROM irrigation_crop_sensitive_stages
     WHERE workspace_id = ?
     ORDER BY crop_key, stage_rank`,
  ).bind(workspaceId).all<ChoiceRow>();
  return rows.results.map(choiceOf);
}

/**
 * Enregistre les stades sensibles d'une culture pour la ferme : les choix
 * que la règle en tire remplacent ceux qu'elle avait pour cette culture. Un
 * choix qui ne change pas garde sa personne et sa date ; un choix qui revient
 * à la liste préremplie est retiré. Une culture qui ne sert pas cette ferme
 * (celle d'une autre ferme, par exemple) est refusée, et rien n'est écrit.
 */
export async function saveSensitiveStagesForUser(
  ownerUserId: string,
  input: { cropKey: string; sensitiveRanks: readonly number[] },
  now = new Date(),
): Promise<CropWaterWriteResult<{ cropName: string; choices: SensitiveStageChoice[] }>> {
  const workspaceId = await ensureWorkspaceForUser(ownerUserId);
  const [crops, references, current] = await Promise.all([
    listReferenceCropsForWorkspace(workspaceId),
    listSensitiveStageReferences(),
    listSensitiveStageChoicesForWorkspace(workspaceId),
  ]);
  const crop = crops.find((stored) => stored.crop.id === input.cropKey)?.crop;
  const result = sensitiveStageChoicesFor({ cropKey: input.cropKey, crop, references, sensitiveRanks: input.sensitiveRanks });
  if (!result.ok) return result;
  const before = current.filter((choice) => choice.cropKey === input.cropKey);
  const same = (left: SensitiveStageChoice, right: SensitiveStageChoice) =>
    left.rank === right.rank && left.label === right.label && left.sensitive === right.sensitive;
  const removed = before.filter((choice) => !result.choices.some((wanted) => wanted.rank === choice.rank));
  const written = result.choices.filter((wanted) => !before.some((choice) => same(choice, wanted)));
  const updatedAt = now.toISOString();
  const statements = [
    ...removed.map((choice) => db.prepare(
      'DELETE FROM irrigation_crop_sensitive_stages WHERE workspace_id = ? AND crop_key = ? AND stage_rank = ?',
    ).bind(workspaceId, input.cropKey, choice.rank)),
    ...written.map((choice) => db.prepare(
      `INSERT INTO irrigation_crop_sensitive_stages (workspace_id, crop_key, stage_rank, stage_label, sensitive, actor_user_id, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(workspace_id, crop_key, stage_rank) DO UPDATE SET
         stage_label = excluded.stage_label, sensitive = excluded.sensitive,
         actor_user_id = excluded.actor_user_id, updated_at = excluded.updated_at`,
    ).bind(workspaceId, input.cropKey, choice.rank, choice.label, choice.sensitive ? 1 : 0, ownerUserId, updatedAt)),
  ];
  if (statements.length > 0) await db.batch(statements);
  return { ok: true, value: { cropName: result.cropName, choices: result.choices } };
}

function choiceOf(row: ChoiceRow): SensitiveStageChoice {
  return { cropKey: row.crop_key, rank: Number(row.stage_rank), label: row.stage_label, sensitive: Number(row.sensitive) === 1 };
}
