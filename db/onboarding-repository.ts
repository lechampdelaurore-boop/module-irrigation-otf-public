import { db } from './binding';
import { ensureWorkspaceForUser, findWorkspaceIdForUser } from './workspace-repository';
import type { StoredOnboardingStep } from '@/lib/domain/onboarding/steps';

/**
 * L'état de l'accueil d'un espace (4.4, docs/tranche-4-contract.md, F417,
 * F581). Ce dépôt n'interprète rien : il rend les lignes de l'espace, lues
 * par sa clé (la personne et la ferme ensemble), et le domaine
 * (`resolveOnboarding`) en tire chaque étape. Lire ne crée rien : une
 * personne sans espace n'a encore rien confirmé.
 */
export async function readOnboardingStepsForUser(spaceKey: string): Promise<StoredOnboardingStep[]> {
  const workspaceId = await findWorkspaceIdForUser(spaceKey);
  if (workspaceId === null) return [];
  const result = await db.prepare(
    `SELECT step, state, origin, proposed_value, confirmed_at
     FROM irrigation_onboarding_steps WHERE workspace_id = ? ORDER BY step`,
  ).bind(workspaceId).all<{ step: string; state: string; origin: string; proposed_value: string | null; confirmed_at: string | null }>();
  return result.results.map((row) => ({
    step: row.step,
    state: row.state,
    origin: row.origin,
    confirmedAt: row.confirmed_at,
    proposedValue: parseValue(row.proposed_value),
  }));
}

function parseValue(value: string | null): unknown {
  if (value === null) return null;
  try {
    return JSON.parse(value) as unknown;
  } catch {
    return null;
  }
}

/**
 * La personne confirme une étape de l'accueil, d'un geste (F417) : la ligne
 * de l'étape, confirmée à l'accueil, avec la valeur qu'elle a confirmée.
 * Placée dans le même lot que l'écriture de la valeur elle-même : l'une ne
 * va jamais sans l'autre.
 *
 * Une étape d'avant l'accueil n'est jamais réécrite (F426) : la ferme qui
 * change sa commune dans Réglages reste « d'avant l'accueil », sans quoi ses
 * jardins redeviendraient « à classer » et son besoin ne serait plus calculé.
 */
export function confirmOnboardingStepStatement(workspaceId: string, step: 'location' | 'plots' | 'soil' | 'crops', value: unknown, at: string) {
  return db.prepare(
    `INSERT INTO irrigation_onboarding_steps (workspace_id, step, state, origin, proposed_value, confirmed_at, updated_at)
     VALUES (?, ?, 'confirmed', 'onboarding', ?, ?, ?)
     ON CONFLICT (workspace_id, step) DO UPDATE SET
       state = 'confirmed', origin = 'onboarding', proposed_value = excluded.proposed_value,
       confirmed_at = excluded.confirmed_at, updated_at = excluded.updated_at
     WHERE irrigation_onboarding_steps.origin = 'onboarding'`,
  ).bind(workspaceId, step, JSON.stringify(value), at, at);
}

/**
 * Une étape confirmée à l'accueil redevient « à faire » (un jardin remis
 * « à classer ») : sa ligne s'efface. Une étape d'avant l'accueil n'est
 * jamais touchée (F426).
 */
export function reopenOnboardingStepStatement(workspaceId: string, step: 'plots') {
  return db.prepare(
    `DELETE FROM irrigation_onboarding_steps WHERE workspace_id = ? AND step = ? AND origin = 'onboarding'`,
  ).bind(workspaceId, step);
}

/**
 * La personne confirme l'étape « Cultures » d'un geste (F587), avec le compte
 * des espèces rattachées : celles qui ne le sont pas restent « à rattacher ».
 */
export async function confirmSpeciesStepForUser(spaceKey: string, value: { linked: number; total: number }, now = new Date()): Promise<void> {
  const workspaceId = await ensureWorkspaceForUser(spaceKey);
  await confirmOnboardingStepStatement(workspaceId, 'crops', value, now.toISOString()).run();
}

/**
 * Une réponse à un groupe des « Réglages à relire » (F588) : la ligne de
 * l'étape garde les réponses de chaque groupe ; elle est « proposée » tant
 * qu'un groupe à relire reste sans réponse, « confirmée » quand chacun est
 * validé ou passé. Lue puis écrite : une étape d'avant l'accueil n'est
 * jamais réécrite (F426).
 */
export async function answerSettingsGroupForUser(
  spaceKey: string,
  answers: (current: unknown) => { value: unknown; complete: boolean },
  now = new Date(),
): Promise<void> {
  const workspaceId = await ensureWorkspaceForUser(spaceKey);
  const row = await db.prepare(
    `SELECT proposed_value FROM irrigation_onboarding_steps WHERE workspace_id = ? AND step = 'settings'`,
  ).bind(workspaceId).first<{ proposed_value: string | null }>();
  const { value, complete } = answers(parseValue(row?.proposed_value ?? null));
  const at = now.toISOString();
  await db.prepare(
    `INSERT INTO irrigation_onboarding_steps (workspace_id, step, state, origin, proposed_value, confirmed_at, updated_at)
     VALUES (?, 'settings', ?, 'onboarding', ?, ?, ?)
     ON CONFLICT (workspace_id, step) DO UPDATE SET
       state = excluded.state, proposed_value = excluded.proposed_value,
       confirmed_at = excluded.confirmed_at, updated_at = excluded.updated_at
     WHERE irrigation_onboarding_steps.origin = 'onboarding'`,
  ).bind(workspaceId, complete ? 'confirmed' : 'proposed', JSON.stringify(value), complete ? at : null, at).run();
}
