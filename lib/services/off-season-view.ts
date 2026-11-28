import type { IrrigationSnapshot } from '../domain/domain';
import { offSeasonToday, offSeasonView, type OffSeasonView } from '../domain/off-season-view';
import { readOffSeasonSourceForUser } from './off-season-source';

/**
 * Le bloc « Hors saison » d'une ferme (6 quaterdecies, B3, D-353) : ses
 * portées actives aujourd'hui, lues par la même source que les besoins, une
 * fois par requête (la page des besoins l'a déjà lue : aucune lecture de
 * plus).
 */
export async function readOffSeasonViewForUser(input: { ownerUserId: string; snapshot: IrrigationSnapshot; season: number; now: Date }): Promise<OffSeasonView> {
  const source = await readOffSeasonSourceForUser({ ownerUserId: input.ownerUserId, snapshot: input.snapshot });
  return offSeasonView({ schedule: source?.schedule ?? null, places: input.snapshot, season: input.season, today: offSeasonToday(input.now) });
}
