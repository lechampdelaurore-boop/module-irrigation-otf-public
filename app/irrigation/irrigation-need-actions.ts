'use server';

import { getAuthenticatedUser } from '@/app/access-auth';
import { saveIrrigationBedNeedDecisionForUser, saveIrrigationNeedThresholdForUser } from '@/db/irrigation-need-repository';
import { getIrrigationSnapshot } from '@/lib/services/irrigation-service';
import { IRRIGATION_NEED_PRIORITIES, resolveIrrigationNeedsWeekStart, type IrrigationNeedPriority, type IrrigationNeedsDashboard } from '@/lib/domain/irrigation-needs';
import { getIrrigationNeedsDashboardForUser } from '@/lib/services/irrigation-needs-service';
import { recalculatePlanAfterEvent } from '@/lib/services/planning-recalculation';

export type IrrigationNeedActionResult =
  | { ok: true; message: string; dashboard: IrrigationNeedsDashboard }
  | { ok: false; message: string };

export async function loadIrrigationNeedsAction(input: { season: number; weekStart: string }): Promise<IrrigationNeedActionResult> {
  return withContext(input.season, async (context) => ({
    ok: true, message: 'Les besoins ont été recalculés.',
    dashboard: await getIrrigationNeedsDashboardForUser({ ...context, weekStart: input.weekStart }),
  }));
}

export async function saveIrrigationNeedThresholdAction(input: { season: number; weekStart: string; thresholdMm: number }): Promise<IrrigationNeedActionResult> {
  return withContext(input.season, async (context) => {
    if (!Number.isFinite(input.thresholdMm) || input.thresholdMm < 0 || input.thresholdMm > 500) throw new Error('Le seuil doit être compris entre 0 et 500 mm.');
    const weekStart = resolveIrrigationNeedsWeekStart({ selectedWeekStart: input.weekStart, now: new Date() });
    await saveIrrigationNeedThresholdForUser(context.ownerUserId, input.season, weekStart, input.thresholdMm);
    // Le seuil change ce que le moteur doit placer : le plan se recalcule (3.7, règle 4).
    await recalculatePlanAfterEvent(context.ownerUserId, { kind: 'threshold-changed', season: input.season, at: weekStart, lasting: true });
    return { ok: true, message: 'Le seuil minimal a été enregistré.', dashboard: await getIrrigationNeedsDashboardForUser({ ...context, weekStart }) };
  });
}

export async function saveIrrigationBedNeedDecisionAction(input: {
  season: number; weekStart: string; bedId: string; priority: IrrigationNeedPriority;
  manualOverrideMm: number | null; overrideReason: string; calculatedNeedMm: number | null;
}): Promise<IrrigationNeedActionResult> {
  return withContext(input.season, async (context) => {
    const bed = context.snapshot.beds.find((candidate) => candidate.id === input.bedId && candidate.seasons.includes(input.season));
    const plot = bed && context.snapshot.plots.find((candidate) => candidate.id === bed.plotId && candidate.zoneId === bed.zoneId);
    if (!bed || !plot) throw new Error('La planche OTF sélectionnée est invalide pour cette saison.');
    if (!IRRIGATION_NEED_PRIORITIES.includes(input.priority)) throw new Error('La priorité choisie est invalide.');
    if (input.manualOverrideMm !== null && (!Number.isFinite(input.manualOverrideMm) || input.manualOverrideMm < 0 || input.manualOverrideMm > 500)) throw new Error('Le besoin manuel doit être compris entre 0 et 500 mm.');
    if (input.calculatedNeedMm !== null && (!Number.isFinite(input.calculatedNeedMm) || input.calculatedNeedMm < 0)) throw new Error('Le besoin calculé de référence est invalide.');
    const weekStart = resolveIrrigationNeedsWeekStart({ selectedWeekStart: input.weekStart, now: new Date() });
    await saveIrrigationBedNeedDecisionForUser(context.ownerUserId, {
      season: input.season, weekStart,
      otfZoneId: bed.zoneId, otfPlotId: bed.plotId, otfBedId: bed.id,
      priority: input.priority, manualOverrideMm: input.manualOverrideMm,
      overrideReason: input.manualOverrideMm === null ? null : input.overrideReason.trim().slice(0, 500) || null,
      calculatedNeedAtOverrideMm: input.manualOverrideMm === null ? null : input.calculatedNeedMm,
    });
    await recalculatePlanAfterEvent(context.ownerUserId, { kind: 'bed-need-decided', season: input.season, at: weekStart, lasting: true });
    return { ok: true, message: input.manualOverrideMm === null ? 'La priorité et le calcul automatique sont enregistrés.' : 'Le besoin manuel a été enregistré.', dashboard: await getIrrigationNeedsDashboardForUser({ ...context, weekStart }) };
  });
}

async function withContext(season: number, operation: (context: { ownerUserId: string; season: number; snapshot: Awaited<ReturnType<typeof getIrrigationSnapshot>> }) => Promise<IrrigationNeedActionResult>): Promise<IrrigationNeedActionResult> {
  const user = await getAuthenticatedUser();
  if (!user) return { ok: false, message: 'Votre session a expiré.' };
  if (!Number.isInteger(season) || season < 1900 || season > 9999) return { ok: false, message: 'Saison invalide.' };
  try {
    const snapshot = await getIrrigationSnapshot(user.userId, { season });
    return await operation({ ownerUserId: user.userId, season, snapshot });
  } catch (error) {
    return { ok: false, message: error instanceof Error ? error.message : 'Le besoin n’a pas pu être enregistré.' };
  }
}
