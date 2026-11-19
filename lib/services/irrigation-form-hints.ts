import { listHydricGoalRevisionsThroughWeekForUser } from '@/db/water-management-repository';
import type { IrrigationSnapshot } from '../domain/domain';
import { dayDosesFromProposals, type IrrigationFormHints } from '../domain/irrigation-form-hints';
import { objectiveForBed } from '../domain/irrigation-needs';
import { addDaysToDateKey, weekStartDateKey } from '../domain/water-management';
import { readWeeklyPlanForUser } from './planning-service';

/**
 * Ce que le formulaire d'irrigation lit d'avance (lot G, n° 9, F409 et F410) :
 * les doses du plan enregistré, lu sans calcul, Planning coché seulement ; et
 * les objectifs adoptés de la semaine en cours et de la suivante, par planche.
 */
export async function getIrrigationFormHintsForUser({ ownerUserId, season, snapshot, now, planningEnabled }: {
  ownerUserId: string;
  season: number;
  snapshot: IrrigationSnapshot;
  now: Date;
  planningEnabled: boolean;
}): Promise<IrrigationFormHints> {
  const thisWeek = weekStartDateKey(now);
  const nextWeek = addDaysToDateKey(thisWeek, 7);
  const [plan, revisions] = await Promise.all([
    planningEnabled ? readWeeklyPlanForUser({ ownerUserId, season, now }) : null,
    listHydricGoalRevisionsThroughWeekForUser(ownerUserId, season, nextWeek),
  ]);
  const beds = snapshot.beds.filter((bed) => bed.seasons.includes(season));
  const weeks = [thisWeek, nextWeek].map((weekStart) => {
    const objectiveMmByBed: Record<string, number> = {};
    for (const bed of beds) {
      const objective = objectiveForBed(revisions, bed, weekStart, addDaysToDateKey(weekStart, 6)).value;
      if (objective !== null) objectiveMmByBed[bed.id] = objective;
    }
    return { weekStart, objectiveMmByBed };
  });
  return { doses: dayDosesFromProposals(plan?.proposals ?? []), weeks };
}
