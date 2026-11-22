import { readIrrigationNeedSettingsForUser, saveIrrigationBedNeedDecisionForUser } from '@/db/irrigation-need-repository';
import { getIrrigationFeasibilityScreenForUser, type FeasibilityScreen } from './irrigation-feasibility-service';
import { recalculatePlanAfterEvent } from './planning-recalculation';

/**
 * « Adopter » un conseil selon le stade sensible (amélioration n° 4,
 * docs/ameliorations-4-5-contract.md, §3.3, point 4, F732) : la priorité
 * haute de la planche pour la semaine en cours seulement, par le chemin d'un
 * changement de priorité à la main (`irrigation_bed_need_decisions` est par
 * semaine : la semaine suivante reprend sa propre priorité). Le besoin
 * manuel de la semaine, sa raison et le besoin calculé qu'il remplaçait sont
 * gardés ; le journal des décisions garde l'origine du geste ; le plan se
 * recalcule comme après tout changement de priorité (3.7, règle 4).
 *
 * Le conseil est d'abord vérifié sur la répartition du moment : s'il ne
 * tient plus, rien n'est écrit, et la réponse le dit avec la répartition à
 * jour. Une semaine changée entre l'écran et le geste est refusée.
 */
export async function adoptStageAdviceForUser(input: {
  ownerUserId: string;
  season: number;
  weekStart: string;
  bedId: string;
  now?: Date;
}): Promise<{ message: string } & FeasibilityScreen> {
  const context = { ownerUserId: input.ownerUserId, season: input.season, now: input.now };
  const screen = await getIrrigationFeasibilityScreenForUser(context);
  const weekStart = screen.dashboard.weekStart;
  if (weekStart !== input.weekStart) throw new Error('La semaine a changé. Rechargez la faisabilité.');
  const need = screen.dashboard.priorities.flatMap((level) => level.beds).find((row) => row.need.bedId === input.bedId)?.need;
  if (need?.priority === 'high') return { message: `${need.bedName} est déjà en priorité haute cette semaine.`, ...screen };
  if (!need || screen.stageAdvice?.kind !== 'advice' || !screen.stageAdvice.advice.bedIds.includes(input.bedId)) {
    return { message: 'Ce conseil ne tient plus : rien n’a été changé. Voici la répartition à jour.', ...screen };
  }
  const decision = (await readIrrigationNeedSettingsForUser(input.ownerUserId, input.season, weekStart)).decisions
    .find((item) => item.otfBedId === input.bedId);
  await saveIrrigationBedNeedDecisionForUser(input.ownerUserId, {
    season: input.season, weekStart, otfZoneId: need.zoneId, otfPlotId: need.plotId, otfBedId: need.bedId, priority: 'high',
    manualOverrideMm: decision?.manualOverrideMm ?? null, overrideReason: decision?.overrideReason ?? null,
    calculatedNeedAtOverrideMm: decision?.calculatedNeedAtOverrideMm ?? null, origin: 'stage-advice',
  });
  await recalculatePlanAfterEvent(input.ownerUserId, { kind: 'bed-need-decided', season: input.season, at: weekStart, lasting: true }, input.now ? { now: input.now } : {});
  return {
    message: `Priorité haute enregistrée pour ${need.bedName}, pour cette semaine seulement. Les quantités ont été recalculées.`,
    ...await getIrrigationFeasibilityScreenForUser(context),
  };
}
