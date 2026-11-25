import type { TodayStart, TodayValidation } from '@/lib/domain/today/card-action';

/**
 * Les gestes de la carte d'« Aujourd'hui » qui composent des actions
 * existantes (simplification, lot S2, docs/simplification-s2-contract.md,
 * sections 5 et 11) : valider une seule proposition, et « Démarrer tout de
 * suite », qui valide puis démarre, l'un après l'autre, sans règle nouvelle.
 * Les actions sont passées en paramètre : les tests jouent la composition
 * sur les vrais services, sans session.
 */

/** Ce que rend l'action de validation du planning (`ProposalsActionResult`), réduit à ce que la carte lit. */
type ProposalsResult =
  | { ok: true; results: readonly ({ ok: true; eventEquipmentId: string; warning?: string } | { ok: false; message: string })[] }
  | { ok: false; message: string };

export function oneValidation(result: ProposalsResult): TodayValidation {
  if (!result.ok) return { ok: false, message: result.message };
  const [first] = result.results;
  if (!first) return { ok: false, message: 'Choisissez une proposition.' };
  return first.ok ? { ok: true, eventEquipmentId: first.eventEquipmentId, warning: first.warning } : { ok: false, message: first.message };
}

/**
 * Valider, puis démarrer l'irrigation créée. Un démarrage refusé laisse la
 * validation en place : rien n'est annulé (S2-c). Sans validation, aucun
 * démarrage n'est tenté (`start` vaut `null`).
 */
export async function validateThenStart(steps: {
  validate: () => Promise<ProposalsResult>;
  start: (eventEquipmentId: string) => Promise<TodayStart>;
}): Promise<{ validation: TodayValidation; start: TodayStart | null }> {
  const validation = oneValidation(await steps.validate());
  if (!validation.ok) return { validation, start: null };
  return { validation, start: await steps.start(validation.eventEquipmentId) };
}
