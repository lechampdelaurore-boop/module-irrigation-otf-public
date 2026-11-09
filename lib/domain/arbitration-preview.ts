import type { IrrigationNeedPriority } from './irrigation-needs.ts';
import { allocateIrrigationWater, type IrrigationArbitration, type IrrigationFeasibility, type PriorityFeasibility } from './irrigation-feasibility.ts';

/**
 * L'écran d'arbitrage façon plan d'assolement (docs/shortage-contract.md,
 * 2 bis, D-083) : ce qu'un choix de planches donnerait, recalculé dans le
 * navigateur à chaque case, par le calcul même du serveur. Aucune règle de
 * plus : la part d'une planche cochée reste celle de la faisabilité (3.4).
 */

const EPS = 1e-7;

/** Un niveau qui demande un choix : à faire, à valider de nouveau, ou enregistré (3.4). */
export function isArbitrationEditable(level: Pick<PriorityFeasibility, 'arbitration'>): boolean {
  return level.arbitration === 'required' || level.arbitration === 'revalidation_required' || level.arbitration === 'validated';
}

/**
 * Les planches cochées à l'ouverture de l'écran : le choix enregistré quand il
 * vaut toujours ; sinon la proposition, toutes les planches à choisir. Un choix
 * devenu caduc repart de la proposition : ses exclusions ne ressuscitent pas.
 */
export function initialArbitrationSelection(level: PriorityFeasibility): string[] {
  const decision = level.arbitration === 'validated' ? level.decision : null;
  return decision ? level.candidates.filter((id) => decision.selectedBedIds.includes(id)) : [...level.candidates];
}

export type ArbitrationPreview = {
  /** Le niveau tel que le serveur le calculerait avec ce choix enregistré. */
  level: PriorityFeasibility;
  /** Tous les niveaux avec ce choix : ceux d'avant inchangés, ceux d'après avec ce qu'il leur laisse. */
  priorities: PriorityFeasibility[];
  /** La part du besoin que reçoit chaque planche cochée, de 0 à 1, la même pour toutes ; `null` sans planche cochée qui ait un besoin. */
  share: number | null;
  availableCubicMeters: number;
  selectedNeedCubicMeters: number;
  allocatedCubicMeters: number;
  /** Les planches dont la part tombe sous leur seuil : elle n'est pas transmise au planning. */
  belowThresholdBedIds: string[];
  belowThresholdCubicMeters: number;
  /** L'eau du niveau qui reste, ni attribuée ni sous le seuil. */
  leftoverCubicMeters: number;
};

/**
 * Ce que le serveur calculerait si ce choix était enregistré maintenant : la
 * faisabilité reçue, recalculée par `allocateIrrigationWater` avec ce choix à
 * la place de celui du niveau, les autres niveaux et leurs décisions tels
 * quels. La validation retrouve ces chiffres tant que rien n'a changé ; si
 * quelque chose a changé, la garde du serveur refuse et demande de recalculer.
 */
export function previewArbitration(
  feasibility: IrrigationFeasibility,
  priority: IrrigationNeedPriority,
  selectedBedIds: readonly string[],
): ArbitrationPreview {
  const current = feasibility.priorities.find((item) => item.priority === priority);
  if (!current) throw new Error(`Niveau de priorité inconnu : ${priority}.`);
  const tentative: IrrigationArbitration = {
    priority, selectedBedIds: [...selectedBedIds], candidateBedIds: [...current.candidates],
    decidedAt: feasibility.calculatedAt, invalidatedAt: null,
  };
  const decisions = feasibility.priorities.flatMap((item) => item.priority === priority ? [tentative] : item.decision ? [item.decision] : []);
  const result = allocateIrrigationWater({
    needs: {
      season: feasibility.season, weekStart: feasibility.weekStart, weekEnd: feasibility.weekEnd,
      timeZone: feasibility.timeZone, calculatedAt: feasibility.calculatedAt,
      gardens: [{ beds: feasibility.priorities.flatMap((item) => item.beds.map((row) => row.need)) }],
    },
    pools: feasibility.pools,
    decisions,
    reservedUnassignedCubicMeters: feasibility.reservedUnassignedCubicMeters,
    reservedPlannedCubicMeters: feasibility.reservedPlannedCubicMeters,
  });
  const level = result.priorities.find((item) => item.priority === priority)!;
  const selected = level.beds.filter((row) => selectedBedIds.includes(row.need.bedId) && (row.need.effectiveVolumeCubicMeters ?? 0) > EPS);
  const below = level.beds.filter((row) => row.status === 'below_threshold');
  const belowThresholdCubicMeters = below.reduce((sum, row) => sum + (row.proposedCubicMeters ?? 0), 0);
  const first = selected.find((row) => row.proposedCubicMeters !== null);
  return {
    level,
    priorities: result.priorities,
    share: first ? first.proposedCubicMeters! / first.need.effectiveVolumeCubicMeters! : null,
    availableCubicMeters: level.availableCubicMeters,
    selectedNeedCubicMeters: selected.reduce((sum, row) => sum + row.need.effectiveVolumeCubicMeters!, 0),
    allocatedCubicMeters: level.allocatedCubicMeters,
    belowThresholdBedIds: below.map((row) => row.need.bedId),
    belowThresholdCubicMeters,
    leftoverCubicMeters: Math.max(0, level.availableCubicMeters - level.allocatedCubicMeters - belowThresholdCubicMeters),
  };
}
