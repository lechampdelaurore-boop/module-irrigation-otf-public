import { listOffSeasonRevisionsForUser } from '@/db/off-season-repository';
import { rememberedRead } from '@/db/request-memo';
import type { Bed, IrrigationSnapshot } from '../domain/domain';
import { offSeasonSchedule, type OffSeasonByBed, type OffSeasonDays, type OffSeasonSchedule } from '../domain/off-season';

/**
 * Le filtre « hors saison » d'une ferme (6 quaterdecies, B2,
 * docs/objectif-automatique-saison-contract.md, sections 4.6 et 7 ; D-337,
 * D-341, D-352) : ses gestes, lus une fois par requête et passés à chaque
 * lecteur de l'objectif — le besoin, et par lui le planning, la pénurie, la
 * faisabilité et « Aujourd'hui » ; l'historique, les séries, l'aide du
 * formulaire d'irrigation, les fiches d'une planche et d'une série, l'écart
 * entre prévu et réel — : aucun ne refait la règle (`offSeasonSchedule`).
 *
 * La pluie, la réserve du sol, l'ET0, la météo et ses alertes, l'archivage
 * des prévisions et la tâche du matin qui enregistre les semaines closes ne
 * le lisent jamais : il n'ignore que l'irrigation (section 4.2, test de
 * garde).
 */
export type OffSeasonSource = {
  schedule: OffSeasonSchedule;
  /**
   * La réponse pour une planche, jour par jour, avec le mode de son jardin
   * dans l'instantané : un jardin absent se lit comme un jardin à classer,
   * qu'aucune portée de mode ne couvre (D-003).
   */
  daysFor(bed: Bed): OffSeasonDays;
  /** Les réponses de plusieurs planches, par identifiant : pour les lecteurs qui composent l'objectif sur une période. */
  byBed(beds: readonly Bed[]): OffSeasonByBed;
};

/**
 * La source, ou `null` quand la ferme n'a fait aucun geste : rien n'est hors
 * saison, et chaque lecteur garde son calcul d'avant (filtre vide, rien ne
 * change).
 */
export async function readOffSeasonSourceForUser(input: { ownerUserId: string; snapshot: IrrigationSnapshot }): Promise<OffSeasonSource | null> {
  const revisions = await rememberedRead('off-season', [input.ownerUserId], () => listOffSeasonRevisionsForUser(input.ownerUserId));
  if (revisions.length === 0) return null;
  const schedule = offSeasonSchedule(revisions);
  const modes = new Map(input.snapshot.plots.map((plot) => [plot.id, plot.mode]));
  const daysFor = (bed: Bed): OffSeasonDays => schedule.daysOf({ id: bed.id, zoneId: bed.zoneId, plotId: bed.plotId, plotMode: modes.get(bed.plotId) ?? 'unclassified' });
  return { schedule, daysFor, byBed: (beds) => new Map(beds.map((bed) => [bed.id, daysFor(bed)])) };
}
