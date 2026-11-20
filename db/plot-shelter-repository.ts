import { db } from './binding';
import { ensureWorkspaceForUser, findWorkspaceIdForUser } from './workspace-repository';
import { confirmOnboardingStepStatement, reopenOnboardingStepStatement } from './onboarding-repository';
import type { StoredPlotShelter } from '@/lib/domain/onboarding/plots';

/**
 * Le classement des jardins d'un espace, abri ou plein champ, confirmé par la
 * personne (4.4, docs/tranche-4-contract.md, F420, F583, migration 0035).
 * Lire ne crée rien : une personne sans espace n'a rien classé.
 */
export async function listPlotSheltersForUser(spaceKey: string): Promise<StoredPlotShelter[]> {
  const workspaceId = await findWorkspaceIdForUser(spaceKey);
  if (workspaceId === null) return [];
  const result = await db.prepare(
    `SELECT otf_plot_id, sheltered, proposed_sheltered, confirmed_at
     FROM irrigation_plot_shelters WHERE workspace_id = ? ORDER BY otf_plot_id`,
  ).bind(workspaceId).all<{ otf_plot_id: string; sheltered: number; proposed_sheltered: number | null; confirmed_at: string }>();
  return result.results.map((row) => ({
    plotId: row.otf_plot_id,
    sheltered: row.sheltered === 1,
    proposedSheltered: row.proposed_sheltered === null ? null : row.proposed_sheltered === 1,
    confirmedAt: row.confirmed_at,
  }));
}

/** Une réponse de la personne pour un jardin : abri, plein champ, ou `null` (« je ne sais pas », à classer). */
export type PlotShelterAnswer = { plotId: string; sheltered: boolean | null; proposedSheltered: boolean };

/**
 * La personne classe un ou plusieurs jardins, ou en remet un « à classer ».
 * L'étape « Parcelles et abris » suit dans le même lot : confirmée quand
 * chaque jardin du plan est classé, avec le compte de ses abris et de ses
 * jardins de plein champ ; rouverte sinon.
 */
export async function savePlotSheltersForUser(spaceKey: string, input: {
  answers: readonly PlotShelterAnswer[];
  /** Les jardins du plan lu, pour savoir si tous sont classés après ce geste. */
  planPlotIds: readonly string[];
  at: string;
}): Promise<void> {
  const workspaceId = await ensureWorkspaceForUser(spaceKey);
  const existing = await listPlotSheltersForUser(spaceKey);
  const after = new Map(existing.map((row) => [row.plotId, row.sheltered]));
  const writes = input.answers.map((answer) => {
    if (answer.sheltered === null) {
      after.delete(answer.plotId);
      return db.prepare('DELETE FROM irrigation_plot_shelters WHERE workspace_id = ? AND otf_plot_id = ?').bind(workspaceId, answer.plotId);
    }
    after.set(answer.plotId, answer.sheltered);
    return db.prepare(
      `INSERT INTO irrigation_plot_shelters (workspace_id, otf_plot_id, sheltered, proposed_sheltered, confirmed_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?)
       ON CONFLICT (workspace_id, otf_plot_id) DO UPDATE SET
         sheltered = excluded.sheltered, proposed_sheltered = excluded.proposed_sheltered,
         confirmed_at = excluded.confirmed_at, updated_at = excluded.updated_at`,
    ).bind(workspaceId, answer.plotId, answer.sheltered ? 1 : 0, answer.proposedSheltered ? 1 : 0, input.at, input.at);
  });
  const classified = input.planPlotIds.filter((plotId) => after.has(plotId));
  const complete = input.planPlotIds.length > 0 && classified.length === input.planPlotIds.length;
  const step = complete
    ? confirmOnboardingStepStatement(workspaceId, 'plots', {
      sheltered: classified.filter((plotId) => after.get(plotId)).length,
      openField: classified.filter((plotId) => !after.get(plotId)).length,
    }, input.at)
    : reopenOnboardingStepStatement(workspaceId, 'plots');
  await db.batch([...writes, step]);
}
