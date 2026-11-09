import { millisecondsFromMinutes } from '../units.ts';
import { effectiveProposalStatus, type PlanBedOutcome, type PlanProposal, type PlanSuggestion, type StoredProposal, type StoredWeeklyPlan, type WeeklyPlan } from './contract.ts';

/**
 * « Ce qui a changé » (docs/replanning-contract.md, règle 25 ;
 * docs/planning-contract.md, « Ce qui a changé ») : la comparaison d'un
 * calcul avec le précédent de la même semaine — les propositions apparues,
 * retirées, déplacées ou de dose changée, les suggestions nouvelles sur les
 * arrosages validés, les planches entrées dans « Non placé » ou sorties,
 * l'écart du manque d'eau. Une lecture : rien n'y est modifiable, et rien
 * ici ne place un créneau. Le service la calcule après le moteur et
 * l'enregistre avec le calcul.
 */

type ProposalChangeKind = 'appeared' | 'removed' | 'moved' | 'dose-changed' | 'moved-and-dose-changed';

/** Un créneau tel qu'il se compare : ses heures, sa dose de référence et ses planches. */
type ProposalSlot = { startAt: string; endAt: string; doseMm: number; bedNames: string[] };

type ProposalChange = {
  change: ProposalChangeKind;
  equipmentId: string;
  equipmentName: string;
  settingName: string;
  /** Le créneau d'avant ; nul pour une proposition apparue. */
  before: ProposalSlot | null;
  /** Le créneau d'après ; nul pour une proposition retirée. */
  after: ProposalSlot | null;
  /** Le numéro local dans le nouveau calcul (`p-3`), celui que la carte porte ; nul pour une retirée. */
  proposalId: string | null;
};

/** Une suggestion que le calcul précédent ne faisait pas, telle quelle ou avec cette dose. */
type SuggestionChange = Pick<PlanSuggestion, 'eventId' | 'eventEquipmentId' | 'equipmentName' | 'plannedStartAt' | 'suggestion' | 'doseMm'>;

type BedPlacementChange = Pick<PlanBedOutcome, 'bedId' | 'bedName' | 'plotName' | 'priority' | 'deficitMm' | 'reasons'>;

export type PlanChanges = {
  /** Le calcul comparé : le précédent de la semaine. */
  previousCalculationId: string;
  previousComputedAt: string;
  /** Dans l'ordre du temps, puis par matériel ; une proposition reproduite à l'identique n'y figure pas. */
  proposals: ProposalChange[];
  newSuggestions: SuggestionChange[];
  bedsNowUnplaced: BedPlacementChange[];
  bedsNowPlaced: BedPlacementChange[];
  /** Le manque d'eau de la semaine (m³) avant et après : l'écart se lit de l'un à l'autre. */
  waterDeficitBeforeCubicMeters: number;
  waterDeficitAfterCubicMeters: number;
  /**
   * Les chaînes servies à l'eau inconnue du calcul précédent et du nouveau : leur manque n'est pas chiffré, et le pli
   * l'écrit comme la carte, sans écart (point ouvert 59, D-090). Absentes quand toute l'eau est connue, et d'une
   * comparaison enregistrée avant.
   */
  unknownWaterChainsBefore?: number;
  unknownWaterChainsAfter?: number;
};

const NEGLIGIBLE_MM = 0.01;

/** Une planche de « Non placé » : que le moteur n'a pas servie en entier, ou pas du tout avec un motif. */
export function isBedUnplaced(bed: Pick<PlanBedOutcome, 'deficitMm' | 'reasons' | 'placedMm'>): boolean {
  return bed.deficitMm > NEGLIGIBLE_MM || (bed.reasons.length > 0 && bed.placedMm <= NEGLIGIBLE_MM);
}

/**
 * La comparaison du nouveau calcul avec le précédent ; nulle au premier calcul
 * de la semaine. Seules les propositions encore proposées du calcul précédent
 * se comparent : une validée est devenue un arrosage, une refusée ne revient
 * pas (D-030), une expirée ne peut plus l'être ; le maraîcher en a décidé,
 * le moteur n'y a rien changé.
 */
export function describePlanChanges(previous: StoredWeeklyPlan | null, plan: WeeklyPlan): PlanChanges | null {
  if (!previous) return null;
  const computedAt = new Date(plan.computedAt);
  const before = previous.proposals.filter((proposal) => proposal.calculationId === previous.calculation.id && effectiveProposalStatus(proposal, computedAt) === 'proposed');
  return {
    previousCalculationId: previous.calculation.id,
    previousComputedAt: previous.calculation.computedAt,
    proposals: proposalChanges(before, plan.proposals),
    newSuggestions: newSuggestions(previous.calculation.summary.suggestions, plan.suggestions),
    ...bedPlacementChanges(previous.calculation.summary.beds, plan.beds),
    waterDeficitBeforeCubicMeters: previous.calculation.summary.deficit.waterCubicMeters,
    waterDeficitAfterCubicMeters: plan.deficit.waterCubicMeters,
  };
}

// ---------------------------------------------------------------------------
// Les propositions
// ---------------------------------------------------------------------------

/**
 * Les propositions d'avant et d'après s'apparient par matériel et réglage, la
 * plus proche en heure d'abord ; chaque ancienne ne sert qu'une fois. Une
 * paire aux mêmes heures — à la minute, comme l'écran les montre — et à la
 * même dose — au dixième de millimètre — n'a pas changé : une durée qui bouge
 * de quelques secondes avec la dose n'est pas un déplacement (recette réelle
 * du 31 octobre 2026). Sans paire, la proposition est apparue ou retirée.
 */
function proposalChanges(before: readonly StoredProposal[], after: readonly PlanProposal[]): ProposalChange[] {
  const changes: ProposalChange[] = [];
  const groups = new Set([...before, ...after].map(groupKey));
  for (const key of groups) {
    const previous = before.filter((proposal) => groupKey(proposal) === key);
    const current = after.filter((proposal) => groupKey(proposal) === key);
    const { pairs, unpairedBefore, unpairedAfter } = pairByNearestHours(previous, current);
    for (const [old, now] of pairs) {
      const moved = minuteOf(old.startAt) !== minuteOf(now.startAt) || minuteOf(old.endAt) !== minuteOf(now.endAt);
      const doseChanged = tenthOfMillimeter(old.doseMm) !== tenthOfMillimeter(now.doseMm);
      if (!moved && !doseChanged) continue;
      changes.push(change(moved && doseChanged ? 'moved-and-dose-changed' : moved ? 'moved' : 'dose-changed', old, now));
    }
    for (const old of unpairedBefore) changes.push(change('removed', old, null));
    for (const now of unpairedAfter) changes.push(change('appeared', null, now));
  }
  return changes.sort((left, right) => Date.parse(slotOf(left).startAt) - Date.parse(slotOf(right).startAt)
    || left.equipmentName.localeCompare(right.equipmentName, 'fr')
    || left.settingName.localeCompare(right.settingName, 'fr')
    || left.change.localeCompare(right.change));
}

function groupKey(proposal: Pick<PlanProposal, 'equipmentId' | 'settingId'>): string {
  return `${proposal.equipmentId}\u0000${proposal.settingId}`;
}

/** L'instant à la minute, comme l'écran l'affiche. */
function minuteOf(iso: string): number {
  return Math.floor(Date.parse(iso) / millisecondsFromMinutes(1));
}

function pairByNearestHours(previous: readonly StoredProposal[], current: readonly PlanProposal[]): {
  pairs: [StoredProposal, PlanProposal][];
  unpairedBefore: StoredProposal[];
  unpairedAfter: PlanProposal[];
} {
  const candidates = previous.flatMap((old, i) => current.map((now, j) => ({
    i, j,
    startGap: Math.abs(Date.parse(old.startAt) - Date.parse(now.startAt)),
    endGap: Math.abs(Date.parse(old.endAt) - Date.parse(now.endAt)),
  }))).sort((left, right) => left.startGap - right.startGap || left.endGap - right.endGap || left.i - right.i || left.j - right.j);
  const usedBefore = new Set<number>();
  const usedAfter = new Set<number>();
  const pairs: [StoredProposal, PlanProposal][] = [];
  for (const candidate of candidates) {
    if (usedBefore.has(candidate.i) || usedAfter.has(candidate.j)) continue;
    usedBefore.add(candidate.i);
    usedAfter.add(candidate.j);
    pairs.push([previous[candidate.i]!, current[candidate.j]!]);
  }
  return {
    pairs,
    unpairedBefore: previous.filter((_, i) => !usedBefore.has(i)),
    unpairedAfter: current.filter((_, j) => !usedAfter.has(j)),
  };
}

function change(kind: ProposalChangeKind, old: StoredProposal | null, now: PlanProposal | null): ProposalChange {
  const reference = (now ?? old)!;
  return {
    change: kind,
    equipmentId: reference.equipmentId,
    equipmentName: reference.equipmentName,
    settingName: reference.settingName,
    before: old ? slot(old) : null,
    after: now ? slot(now) : null,
    proposalId: now?.id ?? null,
  };
}

function slot(proposal: PlanProposal): ProposalSlot {
  return { startAt: proposal.startAt, endAt: proposal.endAt, doseMm: proposal.doseMm, bedNames: proposal.bedApplications.map((application) => application.bedName) };
}

function slotOf(item: ProposalChange): ProposalSlot {
  return (item.after ?? item.before)!;
}

function tenthOfMillimeter(doseMm: number): number {
  return Math.round(doseMm * 10);
}

// ---------------------------------------------------------------------------
// Les suggestions et les planches
// ---------------------------------------------------------------------------

/** Les suggestions que le calcul précédent ne faisait pas : même arrosage, même nature et, pour « Réduire », même dose au dixième. */
function newSuggestions(before: readonly PlanSuggestion[], after: readonly PlanSuggestion[]): SuggestionChange[] {
  const known = new Set(before.map(suggestionKey));
  return after
    .filter((suggestion) => !known.has(suggestionKey(suggestion)))
    .map(({ eventId, eventEquipmentId, equipmentName, plannedStartAt, suggestion, doseMm }) => ({ eventId, eventEquipmentId, equipmentName, plannedStartAt, suggestion, doseMm }));
}

function suggestionKey(suggestion: Pick<PlanSuggestion, 'eventEquipmentId' | 'suggestion' | 'doseMm'>): string {
  return `${suggestion.eventEquipmentId}\u0000${suggestion.suggestion}\u0000${suggestion.doseMm === null ? '' : tenthOfMillimeter(suggestion.doseMm)}`;
}

/** Les planches entrées dans « Non placé » et celles qui en sont sorties, servies ou sans besoin désormais, par nom. */
function bedPlacementChanges(before: readonly PlanBedOutcome[], after: readonly PlanBedOutcome[]): Pick<PlanChanges, 'bedsNowUnplaced' | 'bedsNowPlaced'> {
  const unplacedBefore = new Set(before.filter(isBedUnplaced).map((bed) => bed.bedId));
  const now = new Map(after.map((bed) => [bed.bedId, bed]));
  const bedsNowUnplaced = after.filter((bed) => isBedUnplaced(bed) && !unplacedBefore.has(bed.bedId)).map(placement);
  const bedsNowPlaced = before
    .filter((bed) => unplacedBefore.has(bed.bedId) && !isBedUnplaced(now.get(bed.bedId) ?? { deficitMm: 0, reasons: [], placedMm: 0 }))
    .map((bed) => placement(now.get(bed.bedId) ?? { ...bed, deficitMm: 0, reasons: [] }));
  return { bedsNowUnplaced: bedsNowUnplaced.sort(byName), bedsNowPlaced: bedsNowPlaced.sort(byName) };
}

function placement(bed: PlanBedOutcome): BedPlacementChange {
  return { bedId: bed.bedId, bedName: bed.bedName, plotName: bed.plotName, priority: bed.priority, deficitMm: bed.deficitMm, reasons: bed.reasons };
}

function byName(left: BedPlacementChange, right: BedPlacementChange): number {
  return left.bedName.localeCompare(right.bedName, 'fr') || left.bedId.localeCompare(right.bedId);
}
