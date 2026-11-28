import { listHydricGoalRevisionsThroughWeekForUser } from '@/db/water-management-repository';
import type { IrrigationSnapshot } from '../domain/domain';
import { dayDosesFromProposals, type IrrigationFormHints } from '../domain/irrigation-form-hints';
import { objectiveForBed } from '../domain/irrigation-needs';
import { addDaysToDateKey, weekStartDateKey } from '../domain/water-management';
import { readWeeklyPlanForUser } from './planning-service';
import { readAutomaticObjectiveSourceForUser } from './automatic-objective-source';
import { readOffSeasonSourceForUser } from './off-season-source';

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
  const [plan, revisions, automatic, offSeason] = await Promise.all([
    planningEnabled ? readWeeklyPlanForUser({ ownerUserId, season, now }) : null,
    listHydricGoalRevisionsThroughWeekForUser(ownerUserId, season, nextWeek),
    // L'objectif automatique, quand la ferme l'a allumé (D-309) : la règle du besoin, les deux semaines.
    readAutomaticObjectiveSourceForUser({ ownerUserId, season, snapshot, from: thisWeek, to: addDaysToDateKey(nextWeek, 6), now }),
    // Le filtre « hors saison » (D-337, D-352) : une planche hors saison n'a pas d'objectif à rappeler.
    readOffSeasonSourceForUser({ ownerUserId, snapshot }),
  ]);
  const beds = snapshot.beds.filter((bed) => bed.seasons.includes(season));
  const weeks = [thisWeek, nextWeek].map((weekStart) => {
    const objectiveMmByBed: Record<string, number> = {};
    for (const bed of beds) {
      const objective = objectiveForBed(revisions, bed, weekStart, addDaysToDateKey(weekStart, 6), automatic?.inputFor(bed), offSeason?.daysFor(bed)).value;
      if (objective !== null) objectiveMmByBed[bed.id] = objective;
    }
    return { weekStart, objectiveMmByBed };
  });
  return { doses: dayDosesFromProposals(plan?.proposals ?? []), weeks };
}
