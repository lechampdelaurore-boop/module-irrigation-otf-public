'use server';

import { getAuthenticatedUser } from '@/app/access-auth';
import type { IrrigationSnapshot } from '@/lib/domain/domain';
import {
  offSeasonPlannedLines,
  offSeasonPutText,
  offSeasonResumeText,
  offSeasonScopeKey,
  offSeasonScopeLabel,
  offSeasonToday,
  offSeasonView,
  parsedOffSeasonScope,
  stillOffSeasonAfterResume,
  type OffSeasonPlannedLine,
  type OffSeasonView,
} from '@/lib/domain/off-season-view';
import { getIrrigationSnapshot } from '@/lib/services/irrigation-service';
import { listPlannedIrrigationsUnderOffSeasonForUser, OffSeasonScopeError, saveOffSeasonScopeForUser } from '@/lib/services/off-season-service';
import { readOffSeasonSourceForUser } from '@/lib/services/off-season-source';
import { recalculatePlanAfterEvent } from '@/lib/services/planning-recalculation';

/**
 * Les gestes du bloc « Hors saison » (6 quaterdecies, B3,
 * docs/objectif-automatique-saison-contract.md, sections 4.4, 4.5 et 10 ;
 * D-337, D-352, D-353) : lire les arrosages qu'une mise hors saison
 * toucherait, mettre hors saison, reprendre. L'annulation d'un arrosage
 * passe par le geste du planning (`cancelPlannedIrrigationAction`), appelé
 * par l'écran arrosage par arrosage, jamais d'ici.
 */

export type OffSeasonActionResult =
  | { ok: true; message: string; view: OffSeasonView }
  | { ok: false; message: string };

export type OffSeasonPlannedResult =
  | { ok: true; planned: OffSeasonPlannedLine[] }
  | { ok: false; message: string };

const INVALID_SCOPE = 'L’endroit choisi est invalide : rien n’a été changé.';

/** Les arrosages planifiés ou validés, pas démarrés, que la mise hors saison de cet endroit toucherait (F1072). */
export async function readOffSeasonPlannedAction(input: { season: number; scope: unknown }): Promise<OffSeasonPlannedResult> {
  const context = await loadContext(input.season);
  if (!context.ok) return context;
  const scope = parsedOffSeasonScope(input.scope);
  if (!scope) return { ok: false, message: INVALID_SCOPE };
  try {
    const list = await listPlannedIrrigationsUnderOffSeasonForUser({ ownerUserId: context.ownerUserId, season: input.season, snapshot: context.snapshot, scope, now: new Date() });
    return { ok: true, planned: offSeasonPlannedLines(list, context.snapshot.beds) };
  } catch (error) {
    return failure(error);
  }
}

/**
 * « Mettre hors saison » (`offSeason` vrai) ou « Reprendre » un endroit,
 * maintenant : un geste daté, au journal ; s'il a changé quelque chose, le
 * plan se recalcule comme pour un objectif (`objective-changed`, durable).
 * Un geste sans effet n'écrit rien et le dit (section 4.5).
 */
export async function saveOffSeasonAction(input: { season: number; scope: unknown; offSeason: boolean }): Promise<OffSeasonActionResult> {
  const context = await loadContext(input.season);
  if (!context.ok) return context;
  const scope = parsedOffSeasonScope(input.scope);
  if (!scope || typeof input.offSeason !== 'boolean') return { ok: false, message: INVALID_SCOPE };
  const now = new Date();
  try {
    const changed = await saveOffSeasonScopeForUser({ ownerUserId: context.ownerUserId, snapshot: context.snapshot, scope, offSeason: input.offSeason, now });
    if (changed) await recalculatePlanAfterEvent(context.ownerUserId, { kind: 'objective-changed', season: input.season, at: now, lasting: true });
    const source = await readOffSeasonSourceForUser({ ownerUserId: context.ownerUserId, snapshot: context.snapshot });
    const schedule = source?.schedule ?? null;
    const today = offSeasonToday(now);
    const view = offSeasonView({ schedule, places: context.snapshot, season: input.season, today });
    const label = offSeasonScopeLabel(scope, context.snapshot);
    const message = input.offSeason
      ? offSeasonPutText(label, changed, view.chips.find((chip) => chip.key === offSeasonScopeKey(scope))?.beds ?? 0)
      : offSeasonResumeText(label, changed, stillOffSeasonAfterResume({ scope, schedule, places: context.snapshot, season: input.season, today }));
    return { ok: true, message, view };
  } catch (error) {
    if (error instanceof OffSeasonScopeError) return { ok: false, message: error.message };
    return failure(error);
  }
}

async function loadContext(season: number): Promise<{ ok: true; ownerUserId: string; snapshot: IrrigationSnapshot } | { ok: false; message: string }> {
  const user = await getAuthenticatedUser();
  if (!user) return { ok: false, message: 'Votre session a expiré.' };
  if (!Number.isInteger(season) || season < 1900 || season > 9999) return { ok: false, message: 'Saison invalide.' };
  try {
    return { ok: true, ownerUserId: user.userId, snapshot: await getIrrigationSnapshot(user.userId, { season }) };
  } catch (error) {
    return failure(error);
  }
}

function failure(error: unknown): { ok: false; message: string } {
  return { ok: false, message: error instanceof Error ? error.message : 'L’opération a échoué.' };
}
