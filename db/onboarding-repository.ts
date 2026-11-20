import { db } from './binding';
import { findWorkspaceIdForUser } from './workspace-repository';
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
export function confirmOnboardingStepStatement(workspaceId: string, step: 'location', value: unknown, at: string) {
  return db.prepare(
    `INSERT INTO irrigation_onboarding_steps (workspace_id, step, state, origin, proposed_value, confirmed_at, updated_at)
     VALUES (?, ?, 'confirmed', 'onboarding', ?, ?, ?)
     ON CONFLICT (workspace_id, step) DO UPDATE SET
       state = 'confirmed', origin = 'onboarding', proposed_value = excluded.proposed_value,
       confirmed_at = excluded.confirmed_at, updated_at = excluded.updated_at
     WHERE irrigation_onboarding_steps.origin = 'onboarding'`,
  ).bind(workspaceId, step, JSON.stringify(value), at, at);
}
