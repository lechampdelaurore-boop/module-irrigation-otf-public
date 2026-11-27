import { listIrrigationEventsForUser } from '@/db/irrigation-event/read';
import { saveOffSeasonForUser } from '@/db/off-season-repository';
import type { IrrigationSnapshot } from '../domain/domain';
import type { OffSeasonScope } from '../domain/off-season';
import { plannedIrrigationsUnderOffSeason, type OffSeasonPlannedIrrigation } from '../domain/off-season-planned';
import { FARM_TIME_ZONE, dateKeyInTimeZone, localDateStartUtc } from '../domain/water-management';

/**
 * Les deux gestes « hors saison » et la liste qu'ils montrent (6
 * quaterdecies, B2, docs/objectif-automatique-saison-contract.md, sections
 * 4.5 et 10 ; D-337, D-352) : ce que l'écran de B3 appellera. Aucun écran
 * ne les appelle encore : en ligne, le filtre reste vide.
 *
 * Après un geste qui a changé quelque chose, l'action de l'écran recalcule
 * le plan, comme pour un objectif (`objective-changed`, durable) ; la
 * faisabilité est déjà à refaire par les déclencheurs de la migration.
 */

/** Une portée que l'instantané ne connaît pas : on ne la met pas hors saison. */
export class OffSeasonScopeError extends Error {
  constructor() {
    super('Ce lieu n’est pas dans la ferme : rien n’a été mis hors saison.');
    this.name = 'OffSeasonScopeError';
  }
}

/** La planche, le jardin ou la parcelle est dans l'instantané ; tout le plein champ et tout le sous-abri le sont toujours. */
function knownScope(scope: OffSeasonScope, snapshot: IrrigationSnapshot): boolean {
  switch (scope.level) {
    case 'bed': return snapshot.beds.some((bed) => bed.id === scope.bedId);
    case 'plot': return snapshot.plots.some((plot) => plot.id === scope.plotId);
    case 'zone': return snapshot.zones.some((zone) => zone.id === scope.zoneId);
    case 'mode': return true;
  }
}

/**
 * Met une portée hors saison ou la reprend, maintenant. Seule une portée que
 * la ferme connaît se met hors saison ; toute portée se reprend, même un lieu
 * qu'Ouvre ta ferme ne montre plus, pour que rien ne reste hors saison sans
 * pouvoir en sortir. Rend `true` quand l'état de la portée a changé ; `false`
 * pour un geste sans effet, qui n'a rien écrit (section 4.5).
 */
export async function saveOffSeasonScopeForUser(input: {
  ownerUserId: string;
  snapshot: IrrigationSnapshot;
  scope: OffSeasonScope;
  offSeason: boolean;
  now: Date;
}): Promise<boolean> {
  if (input.offSeason && !knownScope(input.scope, input.snapshot)) throw new OffSeasonScopeError();
  return saveOffSeasonForUser(input.ownerUserId, input.scope, input.offSeason, input.now);
}

/**
 * Les arrosages planifiés de la saison, pas démarrés, que la mise hors
 * saison de cette portée toucherait à partir d'aujourd'hui, en heure de
 * Paris (section 10, question 2) : la fenêtre de B3 les compte et propose de
 * les annuler, un par un, par le geste du planning.
 */
export async function listPlannedIrrigationsUnderOffSeasonForUser(input: {
  ownerUserId: string;
  season: number;
  snapshot: IrrigationSnapshot;
  scope: OffSeasonScope;
  now: Date;
}): Promise<OffSeasonPlannedIrrigation[]> {
  const events = await listIrrigationEventsForUser(input.ownerUserId, input.season);
  return plannedIrrigationsUnderOffSeason({
    scope: input.scope,
    events,
    plots: input.snapshot.plots,
    from: localDateStartUtc(dateKeyInTimeZone(input.now, FARM_TIME_ZONE), FARM_TIME_ZONE),
  });
}
