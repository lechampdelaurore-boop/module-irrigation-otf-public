import type { IrrigationSnapshot } from './domain.ts';
import { millisecondsFromHours } from './units.ts';

/**
 * La ligne de lecture d'Ouvre ta ferme, en tête de chaque page (simplification,
 * lot S1, PR 1, docs/simplification-s1-contract.md, section 3, règle 2) :
 * elle ne se montre que pour dire un problème.
 *
 * - La lecture a échoué : la ferme tourne sur sa dernière lecture réussie et
 *   le service le dit (`warning`).
 * - La dernière lecture réussie date de plus de 24 heures (F822) : la lecture
 *   du matin a manqué au moins une fois. Une date illisible compte comme
 *   ancienne : on ne tait pas ce qu'on ne sait pas (D-003).
 * - Les données de démonstration ne viennent d'aucune lecture d'Ouvre ta
 *   ferme (F829) : rien à dire, la ligne ne s'y montre jamais.
 *
 * Sinon la ligne disparaît ; « Actualiser » reste dans le menu du compte
 * (F823).
 */
export const OTF_READ_LINE_AFTER_HOURS = 24;

export type OtfReadLineReason = 'failed' | 'old';

export function otfReadLineReason(
  read: Pick<IrrigationSnapshot, 'source' | 'lastSuccessfulReadAt' | 'warning'>,
  now: Date,
): OtfReadLineReason | null {
  if (read.source === 'mock') return null;
  if (read.warning) return 'failed';
  const readAt = Date.parse(read.lastSuccessfulReadAt);
  if (!Number.isFinite(readAt)) return 'old';
  return now.getTime() - readAt > millisecondsFromHours(OTF_READ_LINE_AFTER_HOURS) ? 'old' : null;
}
