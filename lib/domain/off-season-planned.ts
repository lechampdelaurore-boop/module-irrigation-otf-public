import type { Plot } from './domain.ts';
import type { IrrigationEventRecord } from './irrigation-event-record.ts';
import { offSeasonScopeCovers, type OffSeasonScope } from './off-season.ts';

/**
 * Les arrosages planifiés ou validés qu'une mise hors saison touche (6
 * quaterdecies, docs/objectif-automatique-saison-contract.md, section 10,
 * question 2 ; D-337, D-352) : ce que la fenêtre de B3 compte, avant de
 * proposer « Les annuler » ou « Les garder » (le défaut). Rien n'est annulé
 * ici, rien n'est réécrit : l'annulation passe par le geste existant du
 * planning, arrosage par arrosage (`cancelPlannedIrrigationForUser`), et
 * jamais sans le choix de la personne (« Le cycle »,
 * docs/planning-contract.md).
 *
 * Un arrosage compte quand il est planifié et pas démarré — ni minuteur, ni
 * début réel, ni annulé —, qu'il commence le jour du geste ou après, et
 * qu'il donne de l'eau à au moins une planche que la portée couvre. Un
 * arrosage déjà démarré ne compte pas : il se termine. Les propositions du
 * plan qui ne sont pas encore validées n'en sont pas : le calcul qui suit le
 * geste ne les refait pas pour une planche hors saison.
 */
export type OffSeasonPlannedIrrigation = {
  eventId: string;
  eventEquipmentId: string;
  equipmentName: string;
  plannedStartAt: string;
  plannedEndAt: string | null;
  /** Les planches qu'il arrose et que la portée couvre. */
  coveredBedIds: string[];
  /** Les autres planches qu'il arrose : l'annuler les prive aussi de cette eau, l'écran doit le dire. */
  otherBedIds: string[];
};

export function plannedIrrigationsUnderOffSeason(input: {
  scope: OffSeasonScope;
  events: readonly IrrigationEventRecord[];
  /** Le mode de chaque jardin, au moment du geste : un jardin absent se lit comme à classer, qu'aucune portée de mode ne couvre (D-003). */
  plots: readonly Pick<Plot, 'id' | 'mode'>[];
  /** Le début du jour du geste, en heure de Paris : le premier jour hors saison. */
  from: Date;
}): OffSeasonPlannedIrrigation[] {
  const modes = new Map(input.plots.map((plot) => [plot.id, plot.mode]));
  const listed: OffSeasonPlannedIrrigation[] = [];
  for (const event of input.events) {
    const equipment = event.equipment;
    if (event.status !== 'planned' || equipment.status !== 'planned') continue;
    if (equipment.actualStartAt !== null || equipment.timerState !== null || equipment.canceledAt !== null || equipment.remainingCanceledAt !== null) continue;
    const startMs = Date.parse(equipment.plannedStartAt ?? '');
    if (!Number.isFinite(startMs) || startMs < input.from.getTime()) continue;
    const watered = [...new Map(equipment.applications
      .filter((application) => application.plannedAmountMm > 0)
      .map((application) => [application.otfBedId, application])).values()];
    const covers = (application: (typeof watered)[number]) => offSeasonScopeCovers(input.scope, {
      id: application.otfBedId,
      zoneId: application.otfZoneId,
      plotId: application.otfPlotId,
      plotMode: modes.get(application.otfPlotId) ?? 'unclassified',
    });
    const coveredBedIds = watered.filter(covers).map((application) => application.otfBedId).sort();
    if (coveredBedIds.length === 0) continue;
    listed.push({
      eventId: event.id,
      eventEquipmentId: equipment.id,
      equipmentName: equipment.equipmentSnapshot.name,
      plannedStartAt: equipment.plannedStartAt ?? '',
      plannedEndAt: equipment.plannedEndAt,
      coveredBedIds,
      otherBedIds: watered.filter((application) => !covers(application)).map((application) => application.otfBedId).sort(),
    });
  }
  return listed.sort((left, right) => Date.parse(left.plannedStartAt) - Date.parse(right.plannedStartAt) || left.eventEquipmentId.localeCompare(right.eventEquipmentId));
}
