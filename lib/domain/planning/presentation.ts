import type { EquipmentKind } from '../irrigation-domain.ts';
import { priorityLabel } from '../irrigation-feasibility.ts';
import { formatWaterVolumeForMessage } from '../irrigation-format.ts';
import type { IrrigationNeedPriority } from '../irrigation-needs.ts';
import { MINUTES_PER_HOUR, cubicMetersFromLiters, cubicMetersFromMillimeters, millisecondsFromSeconds } from '../units.ts';
import { FARM_TIME_ZONE, dateKeyInTimeZone, weekDateKeys } from '../water-management.ts';
import { isBedUnplaced } from './changes.ts';
import {
  effectiveProposalStatus,
  type DoseReason,
  type PlanArbitration,
  type PlanBedOutcome,
  type PlanCalculationTrigger,
  type PlanCalculationEvent,
  type PlanEventNotice,
  type PlanProposal,
  type ProposalStatus,
  type StoredPlanCalculation,
  type StoredProposal,
  type StoredWeeklyPlan,
  type SupplyBudget,
  type TimingReason,
  type UnplacedReason,
  type WeeklyPlan,
} from './contract.ts';
import { validatePlanningSettings, type PlanningSettings, type PlanningSettingsIssue, type TimeWindow } from './settings.ts';

/**
 * La présentation pure du planning (docs/planning-contract.md, « Interface »
 * et « Notes de mise en œuvre (3.6) ») : ce que l'écran calcule pour
 * s'afficher — regrouper par jour, compter, convertir un ajustement, lire et
 * écrire les réglages — sans y mettre une règle de placement. Les composants
 * n'ont que de l'affichage.
 */

export const PROPOSAL_STATUSES: readonly ProposalStatus[] = ['proposed', 'validated', 'refused', 'replaced', 'expired'];

export const PROPOSAL_STATUS_LABELS: Record<ProposalStatus, string> = {
  proposed: 'Proposée',
  validated: 'Validée',
  refused: 'Refusée',
  replaced: 'Remplacée',
  expired: 'Expirée',
};

/**
 * Une validée dont l'irrigation est annulée ne compte plus — ni parmi les
 * validées, ni dans le volume — : son besoin est revenu au plan, qui l'a
 * replacé ou le dit non placé (statuts du contrat : « l'irrigation validée a
 * vécu ; le plan lit le réel » ; recette réelle du 31 octobre 2026).
 */
function isCanceledValidation(proposal: Pick<StoredProposal, 'status' | 'irrigationStatus'>): boolean {
  return proposal.status === 'validated' && proposal.irrigationStatus === 'canceled';
}

/** Le statut lu sur la carte : une validée dont l'irrigation a vécu se lit « Réalisée », « Partielle » ou « Annulée ». */
export function proposalStatusLabel(proposal: Pick<StoredProposal, 'status' | 'endAt' | 'irrigationStatus'>, now: Date): string {
  const status = effectiveProposalStatus(proposal, now);
  if (status !== 'validated') return PROPOSAL_STATUS_LABELS[status];
  switch (proposal.irrigationStatus) {
    case 'canceled': return 'Annulée';
    case 'completed': return 'Réalisée';
    case 'partially_completed': return 'Partielle';
    default: return PROPOSAL_STATUS_LABELS.validated;
  }
}

/** La note sous une carte validée, selon ce que son irrigation est devenue. */
export function validatedProposalNote(irrigationStatus: StoredProposal['irrigationStatus']): string {
  switch (irrigationStatus) {
    case 'canceled': return 'Irrigation annulée : son besoin est revenu au plan, qui l’a replacé ou le dit non placé.';
    case 'completed': return 'Irrigation réalisée : elle se lit dans l’historique.';
    case 'partially_completed': return 'Irrigation faite en partie : le reste est revenu au plan.';
    default: return 'Irrigation planifiée : elle se démarre, se modifie ou s’annule dans « À venir ou à terminer ».';
  }
}

export const EQUIPMENT_KIND_LABELS: Record<EquipmentKind, string> = {
  sprinkler: 'Aspersion',
  drip: 'Goutte-à-goutte',
};

const TRIGGER_LABELS: Record<PlanCalculationTrigger, string> = {
  manual: 'à la demande',
  daily: 'recalcul du matin',
  event: 'sur événement',
};

/**
 * Le nom de chaque événement qui fait recalculer (3.7, docs/replanning-contract.md,
 * règles 4 et 7), tel que l'en-tête le dit : « recalculé le … après la pluie
 * saisie au pluviomètre », « plan antérieur à : une proposition refusée ».
 */
export const PLAN_EVENT_LABELS: Record<PlanCalculationEvent, string> = {
  'irrigation-planned': 'une irrigation planifiée',
  'irrigation-updated': 'une irrigation planifiée modifiée',
  'irrigation-started': 'une irrigation démarrée',
  'irrigation-recorded': 'une irrigation saisie après coup',
  'irrigation-completed': 'une irrigation terminée',
  'irrigation-partially-completed': 'une irrigation terminée en partie',
  'irrigation-remaining-canceled': 'un reliquat annulé',
  'irrigation-canceled': 'une irrigation annulée',
  'rain-recorded': 'la pluie saisie au pluviomètre',
  'reservoir-level-observed': 'un niveau de réserve observé',
  'resource-flow-applied': 'un débit de ressource appliqué',
  'daily-limit-changed': 'une limite journalière changée',
  'objective-changed': 'un objectif hydrique changé',
  'threshold-changed': 'le seuil minimal changé',
  'bed-need-decided': 'une priorité ou un besoin fixé à la main',
  'arbitration-validated': 'un choix entre deux demandes d’eau validé',
  'equipment-placed': 'un matériel posé',
  'equipment-setting-changed': 'un réglage appliqué changé',
  'equipment-removed': 'un matériel retiré',
  'proposal-refused': 'une proposition refusée',
  'proposal-validated': 'une proposition validée',
  'features-changed': 'un changement des fonctionnalités',
};

/** Le déclencheur du dernier calcul, l'événement nommé quand c'en est un (3.7, règle 7). */
export function calculationTriggerLabel(calculation: Pick<StoredPlanCalculation, 'trigger' | 'triggerEvent'>): string {
  if (calculation.trigger === 'event' && calculation.triggerEvent) return `après ${PLAN_EVENT_LABELS[calculation.triggerEvent]}`;
  return TRIGGER_LABELS[calculation.trigger];
}

/**
 * L'avis quand un événement est postérieur au plan (3.7, règle 6) : le
 * recalcul est en cours, et la section relit le plan dès qu'il est prêt, ou
 * il a échoué, et c'est au maraîcher de recalculer. L'heure est déjà mise en
 * forme par l'écran.
 */
export function pendingEventNotice(event: Pick<PlanEventNotice, 'kind' | 'status'>, formattedOccurredAt: string): string {
  const before = `Plan antérieur à : ${PLAN_EVENT_LABELS[event.kind]}, le ${formattedOccurredAt}`;
  return event.status === 'failed' ? `${before} — le recalcul a échoué, recalculez.` : `${before} — recalcul en cours.`;
}

const UNPLACED_REASON_LABELS: Record<UnplacedReason, string> = {
  'no-objective': 'aucun objectif applicable',
  'no-equipment': 'aucun matériel ne l’arrose',
  'below-minimum-dose': 'besoin sous la dose minimale : attend qu’il grandisse',
  'water-budget': 'stock et ressources insuffisants d’ici dimanche',
  deferred: 'reportée : passe en tête après le prochain événement (conduite « report »)',
  'pump-time': 'temps de pompage insuffisant dans les plages horaires',
  'daily-limit': 'limite journalière d’irrigation atteinte',
  'withdrawal-limit': 'limite de prélèvement de la ressource atteinte',
  'reserve-timing': 'réserve au minimum de sécurité au moment voulu',
  'volume-unknown-under-limit': 'volume inconnu sous une limite journalière',
  'supply-unavailable': 'origine d’eau ou pompe indisponible',
  'no-time-left': 'plus de plage horaire d’ici dimanche',
  'insufficient-reach': 'réglage plus large que la planche : elle reçoit moins que la planche de référence du réglage',
  spacing: 'un arrosage par jour et espacement entre deux arrosages',
  'refused-slot': 'créneau refusé : ses seuls créneaux possibles ont été refusés cette semaine',
  'protected-slot': 'créneau protégé : ses seuls créneaux possibles tombent dans des créneaux protégés',
};

const DOSE_REASON_LABELS: Record<DoseReason, string> = {
  'remaining-need': 'le besoin restant de la planche la plus demandeuse',
  'maximum-dose': 'la dose maximale par arrosage',
  'window-fit': 'ce qui tient dans la plage horaire',
  'pump-gap': 'ce que la pompe laisse libre',
  'daily-limit': 'ce que la limite journalière laisse',
  'reserved-share': 'la part de la semaine réservée à ses planches',
  'reserve-level': 'ce que la réserve fournit sans passer sous son minimum',
  'last-day-below-minimum': 'le reste de la semaine, sous la dose minimale : c’est le dernier jour',
  'refused-slot-fit': 'ce qui tient avant un créneau refusé',
  'protected-slot-fit': 'ce qui tient avant un créneau protégé',
  'withdrawal-limit': 'ce que la limite de prélèvement laisse',
};

const TIMING_REASON_LABELS: Record<TimingReason, string> = {
  earliest: 'au plus tôt',
  'after-forecast-rain': 'après la pluie prévue',
  spacing: 'après l’espacement entre deux arrosages',
  window: 'à l’ouverture de la plage horaire',
  'pump-capacity': 'dès que la pompe est libre',
  'reserve-inflow': 'dès que la réserve a l’eau nécessaire',
  'daily-limit': 'un jour où la limite journalière le permet',
  'after-refused-slot': 'après un créneau refusé',
  'after-protected-slot': 'après un créneau protégé',
  'withdrawal-limit': 'un jour où la limite de prélèvement le permet',
};

/**
 * Les règles et décisions derrière chaque motif, pour les experts (audit
 * ergonomique, lot 3, point 5, précision F48) : les libellés visibles sont en
 * mots simples, les identifiants des règles restent dans les registres et dans
 * l'infobulle de la cellule.
 */
const UNPLACED_REASON_REFERENCES: Partial<Record<UnplacedReason, string>> = {
  'below-minimum-dose': 'R4',
  deferred: 'R9, R10',
  'no-time-left': 'R8',
  'insufficient-reach': 'R13, D-025',
  spacing: 'R6, R7',
  'refused-slot': 'D-030',
  'protected-slot': 'D-062',
  'withdrawal-limit': 'D-085',
};

/** « Pour les experts : R13, D-025 » ; nul quand le motif ne renvoie à aucune règle numérotée. */
export function unplacedReasonsExpertNote(reasons: readonly UnplacedReason[]): string | null {
  const references = [...new Set(reasons.flatMap((reason) => UNPLACED_REASON_REFERENCES[reason] ?? []))];
  return references.length === 0 ? null : `Pour les experts : ${references.join(' ; ')}`;
}

export const SHORTAGE_STRATEGY_LABELS: Record<PlanningSettings['shortageStrategy'], string> = {
  'priority-then-equal-share': 'prioritaires d’abord, puis part égale',
  'equal-share': 'part égale pour toutes',
  defer: 'report des planches non servies',
};

export const COLLECTIVE_DOSE_RULE_LABELS: Record<PlanningSettings['collectiveDoseRule'], string> = {
  'highest-need': 'le besoin le plus élevé des planches couvertes',
  'lowest-need': 'le besoin le plus faible des planches couvertes',
};

const PRIORITY_RANK: Record<IrrigationNeedPriority, number> = { high: 0, normal: 1, low: 2 };

export function unplacedReasonLabel(reason: UnplacedReason): string {
  return UNPLACED_REASON_LABELS[reason];
}

/**
 * Les motifs d'une planche non servie, en mots : le motif « créneau protégé »
 * nomme ses créneaux — « créneau protégé : Lavage des légumes » (D-062,
 * règle 5) —, les autres gardent leur libellé.
 */
export function bedReasonLabels(bed: Pick<PlanBedOutcome, 'reasons' | 'protectedSlotNames'>): string[] {
  const names = bed.protectedSlotNames ?? [];
  return bed.reasons.map((reason) => {
    if (reason !== 'protected-slot' || names.length === 0) return unplacedReasonLabel(reason);
    return names.length === 1 ? `créneau protégé : ${names[0]}` : `créneaux protégés : ${names.join(', ')}`;
  });
}

export function doseReasonLabel(reason: DoseReason): string {
  return DOSE_REASON_LABELS[reason];
}

export function timingReasonLabel(reason: TimingReason): string {
  return TIMING_REASON_LABELS[reason];
}

const WATER_DEFICIT_DETAIL = 'Ce que le stock et les ressources ne couvrent pas';
/** Un manque sous un millième de litre est un résidu d'arrondi, pas une part à nommer. */
const NEGLIGIBLE_CUBIC_METERS = 1e-6;

/**
 * Le sous-titre du manque d'eau du résumé : nomme la limite journalière
 * quand c'est elle qui coupe, en tout ou en partie (docs/planning-contract.md,
 * « Pénurie », point ouvert 35, corrigé le 9 octobre 2026).
 */
export function waterDeficitDetail(deficit: Pick<WeeklyPlan['deficit'], 'waterCubicMeters' | 'byReason'>): string {
  const byLimit = deficit.byReason['daily-limit'] ?? 0;
  if (byLimit <= NEGLIGIBLE_CUBIC_METERS) return WATER_DEFICIT_DETAIL;
  if (byLimit >= deficit.waterCubicMeters - NEGLIGIBLE_CUBIC_METERS) return 'Ce que la limite journalière ne laisse pas placer';
  return `${WATER_DEFICIT_DETAIL}, dont ${formatWaterVolumeForMessage(byLimit)} m³ par la limite journalière`;
}

/** Un écart sous un litre est un arrondi, pas une note à écrire. */
const ONE_LITER_CUBIC_METERS = cubicMetersFromLiters(1);
/** Un reste sous un centième de millimètre est un résidu d'arrondi, pas un manque (notes 3.5). */
const NEGLIGIBLE_MM = 0.01;

/**
 * Le résidu d'arrondi des secondes que la note tolère : le moteur coupe chaque
 * créneau à la seconde entière et tient pour reçu un reste sous un centième
 * de millimètre, soit au plus ce centième par planche et par créneau qui
 * l'arrose, au prix de la surface mouillée de l'application (D-040, point
 * ouvert 41).
 */
function roundingResidueCubicMeters(proposals: StoredWeeklyPlan['proposals']): number {
  let residue = 0;
  for (const proposal of proposals) {
    for (const application of proposal.bedApplications) {
      if (application.appliedMm <= 0 || application.wettedAreaSquareMeters === null) continue;
      residue += cubicMetersFromMillimeters(NEGLIGIBLE_MM, application.wettedAreaSquareMeters);
    }
  }
  return residue;
}

/**
 * La note sous les cartes quand le manque d'eau diffère de « demandé moins
 * placé » (docs/planning-contract.md, « Interface (3.6) », D-038, point
 * ouvert 36) : l'eau placée sans couvrir de besoin compté, et ce qui manque
 * pour une autre raison que l'eau, chiffrés sur le plan enregistré. Nulle
 * quand l'identité tient — au résidu d'arrondi des secondes près, et au
 * moins au litre près (D-040) —, qu'un volume est inconnu ou que le budget
 * est absent (arbitrage).
 */
export function waterDeficitExplanation(plan: StoredWeeklyPlan): string | null {
  const { budgets, deficit } = plan.calculation.summary;
  if (budgets.length === 0) return null;
  const demanded = budgets.reduce((sum, budget) => sum + budget.demandCubicMeters, 0);
  const own = plan.proposals.filter((proposal) => proposal.calculationId === plan.calculation.id);
  let placed = 0;
  for (const proposal of own) {
    if (proposal.volumeCubicMeters === null) return null;
    placed += proposal.volumeCubicMeters;
  }
  const counted = Object.values(deficit.byReason).reduce((sum, value) => sum + (value ?? 0), 0);
  const beside = placed - (demanded - counted);
  const otherwise = counted - deficit.waterCubicMeters;
  const tolerance = Math.max(ONE_LITER_CUBIC_METERS, roundingResidueCubicMeters(own));
  const parts: string[] = [];
  if (beside > tolerance) {
    parts.push(`${formatWaterVolumeForMessage(beside)} m³ placés sans couvrir de besoin compté — à côté des planches, au-delà de leur besoin, ou sur une surface plus large que celle de leur propre matériel${otherwise > ONE_LITER_CUBIC_METERS ? ' —' : ''}`);
  } else if (beside < -tolerance) {
    parts.push(`${formatWaterVolumeForMessage(-beside)} m³ de besoin couverts par une eau comptée sur une surface plus petite que celle de leur propre matériel`);
  }
  if (otherwise > ONE_LITER_CUBIC_METERS) parts.push(`${formatWaterVolumeForMessage(otherwise)} m³ qui manquent pour une autre raison que l’eau (temps de pompage, espacement, dose minimale)`);
  if (parts.length === 0) return null;
  return `Demandés ${formatWaterVolumeForMessage(demanded)} m³, placés ${formatWaterVolumeForMessage(placed)} m³, manque d’eau ${formatWaterVolumeForMessage(deficit.waterCubicMeters)} m³ : l’écart tient à ${parts.join(', et à ')}. Le manque se compte planche par planche, sur la surface que son propre matériel mouille.`;
}

/**
 * La note sous les cartes quand un arbitrage 3.4 validé s'impose au plan
 * (décision 1 de la 3.9, D-052) : l'eau allouée, réservée à chaque planche ;
 * sa réduction quand une chaîne ne peut pas tout fournir ; l'eau allouée que
 * les planches ne peuvent pas recevoir, qui reste non attribuée. Chaque
 * ajout passe le litre. Nulle sans arbitrage.
 */
export function arbitrationNote(summary: { arbitration?: PlanArbitration }): string | null {
  const { arbitration } = summary;
  if (!arbitration) return null;
  const sentences = [`Votre choix entre les demandes d’eau s’impose : ${formatWaterVolumeForMessage(arbitration.allocatedCubicMeters)} m³ alloués, chaque allocation réservée à sa planche.`];
  if (arbitration.allocatedCubicMeters - arbitration.reservedCubicMeters > ONE_LITER_CUBIC_METERS) {
    sentences.push(`Le moteur ne peut en placer que ${formatWaterVolumeForMessage(arbitration.reservedCubicMeters)} m³ d’ici dimanche : chaque allocation est réduite dans la même proportion.`);
  }
  if (arbitration.unreceivedCubicMeters > ONE_LITER_CUBIC_METERS) {
    const beds = `${arbitration.unreceivedBedCount} planche${arbitration.unreceivedBedCount > 1 ? 's' : ''}`;
    sentences.push(`${formatWaterVolumeForMessage(arbitration.unreceivedCubicMeters)} m³ alloués à ${beds} ne peuvent pas être reçus : ils restent non attribués, sans redistribution entre planches.`);
  }
  return sentences.join(' ');
}

const PRIORITY_LEVELS: readonly IrrigationNeedPriority[] = ['high', 'normal', 'low'];
const budgetPercent = new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 0 });

/**
 * Les niveaux de priorité d'une ligne de budget (décision 2 de la 3.9,
 * D-052) : pour chacun, la part visée — la fraction de la conduite, celle
 * des parts réservées au départ — et la part placée — l'eau utile placée sur
 * ses planches, rapportée à sa demande — ; « — » pour un niveau sans
 * demande. Un calcul enregistré avant, sans les demandes par niveau, garde sa
 * ligne d'avant, les seules parts réservées.
 */
export function budgetLevelsText(budget: SupplyBudget): string {
  const percent = (fraction: number) => `${budgetPercent.format(fraction * PERCENT)} %`;
  const label = (level: IrrigationNeedPriority) => priorityLabel(level).toLocaleLowerCase('fr-FR');
  const { demandByLevelCubicMeters: demand, placedByLevelCubicMeters: placed } = budget;
  if (!demand || !placed) return `part réservée : ${PRIORITY_LEVELS.map((level) => `${label(level)} ${percent(budget.fractions[level])}`).join(', ')}`;
  return PRIORITY_LEVELS.map((level) => (demand[level] > 0
    ? `${label(level)} ${percent(budget.fractions[level])} visés, ${percent(placed[level] / demand[level])} placés`
    : `${label(level)} —`)).join(' · ');
}

// ---------------------------------------------------------------------------
// La semaine en jours
// ---------------------------------------------------------------------------

export type PlanDay = {
  /** `AAAA-MM-JJ` à la ferme (D-004). */
  dateKey: string;
  /** Écoulé avant le calcul : aucun créneau ne s'y place plus. */
  beforeHorizon: boolean;
  /** Dans l'ordre des débuts ; une plage qui passe minuit appartient au jour où elle commence. */
  proposals: StoredProposal[];
  counts: Record<ProposalStatus, number>;
  /** Volume des propositions proposées et validées, en m³ ; les volumes inconnus sont comptés à part. */
  volumeCubicMeters: number;
  unknownVolumeCount: number;
};

function emptyCounts(): Record<ProposalStatus, number> {
  return { proposed: 0, validated: 0, refused: 0, replaced: 0, expired: 0 };
}

function countsAndVolume(proposals: readonly StoredProposal[], now: Date) {
  const counts = emptyCounts();
  let volumeCubicMeters = 0;
  let unknownVolumeCount = 0;
  for (const proposal of proposals) {
    if (isCanceledValidation(proposal)) continue;
    const status = effectiveProposalStatus(proposal, now);
    counts[status] += 1;
    if (status !== 'proposed' && status !== 'validated') continue;
    if (proposal.volumeCubicMeters === null) unknownVolumeCount += 1;
    else volumeCubicMeters += proposal.volumeCubicMeters;
  }
  return { counts, volumeCubicMeters, unknownVolumeCount };
}

/** Les sept jours de la semaine du plan, chacun avec ses propositions. */
export function planDays(plan: StoredWeeklyPlan, now: Date, timeZone = FARM_TIME_ZONE): PlanDay[] {
  const horizonDateKey = dateKeyInTimeZone(new Date(plan.calculation.horizonStartAt), timeZone);
  const byDay = new Map<string, StoredProposal[]>();
  for (const proposal of plan.proposals) {
    const dateKey = dateKeyInTimeZone(new Date(proposal.startAt), timeZone);
    byDay.set(dateKey, [...(byDay.get(dateKey) ?? []), proposal]);
  }
  return weekDateKeys(plan.calculation.weekStart).map((dateKey) => {
    const proposals = [...(byDay.get(dateKey) ?? [])].sort(compareProposalsByStart);
    return { dateKey, beforeHorizon: dateKey < horizonDateKey, proposals, ...countsAndVolume(proposals, now) };
  });
}

function compareProposalsByStart(left: StoredProposal, right: StoredProposal): number {
  return left.startAt.localeCompare(right.startAt) || left.id.localeCompare(right.id);
}

// ---------------------------------------------------------------------------
// Le résumé et les planches non servies
// ---------------------------------------------------------------------------

export type PlanSummary = {
  counts: Record<ProposalStatus, number>;
  /** Volume des propositions proposées et validées, en m³. */
  volumeCubicMeters: number;
  unknownVolumeCount: number;
  /** Propositions proposées ou validées dont la faisabilité hydraulique n'est pas vérifiée. */
  unverifiedCount: number;
};

export function summarizePlan(plan: StoredWeeklyPlan, now: Date): PlanSummary {
  const unverifiedCount = plan.proposals.filter((proposal) => {
    if (isCanceledValidation(proposal)) return false;
    const status = effectiveProposalStatus(proposal, now);
    return (status === 'proposed' || status === 'validated') && !proposal.justification.hydraulicallyVerified;
  }).length;
  return { ...countsAndVolume(plan.proposals, now), unverifiedCount };
}

/** Les planches que le moteur n'a pas servies en entier, prioritaires d'abord, puis par nom. */
export function unplacedBeds(plan: StoredWeeklyPlan): PlanBedOutcome[] {
  return plan.calculation.summary.beds
    .filter(isBedUnplaced)
    .sort((left, right) => PRIORITY_RANK[left.priority] - PRIORITY_RANK[right.priority]
      || left.bedName.localeCompare(right.bedName, 'fr')
      || left.bedId.localeCompare(right.bedId));
}

/**
 * La date dont une carte se date : celle de son calcul quand ce n'est pas le
 * dernier — validée ou refusée, elle se relit avec le calcul courant, dont une
 * proposition peut porter le même numéro —, rien quand elle en est.
 */
export function earlierCalculationDate(proposal: Pick<StoredProposal, 'calculationId' | 'calculatedAt'>, currentCalculationId: string): string | null {
  return proposal.calculationId === currentCalculationId ? null : proposal.calculatedAt;
}

/** Les propositions proposées d'une liste, dans l'ordre donné : ce que « valider le jour » ou « toute la semaine » désigne. */
export function proposedIds(proposals: readonly StoredProposal[], now: Date): string[] {
  return proposals
    .filter((proposal) => effectiveProposalStatus(proposal, now) === 'proposed')
    .map((proposal) => proposal.storedId);
}

// ---------------------------------------------------------------------------
// L'ajustement d'une proposition
// ---------------------------------------------------------------------------

export type ProposalAdjustment = {
  /** Le nouveau début, instant ISO. */
  startAt: string;
  /** La nouvelle dose de référence, en mm. */
  doseMm: number;
};

export type AdjustedTiming = {
  startAt: string;
  endAt: string;
  durationSeconds: number;
  doseMm: number;
};

/**
 * Le créneau qu'un ajustement donne : la durée suit la dose au prorata,
 * arrondie à la seconde ; la fin suit le début. Ni le matériel, ni le
 * réglage, ni les planches ne changent. `null` quand la dose ou le début
 * n'est pas lisible.
 */
export function adjustProposalTiming(
  proposal: Pick<PlanProposal, 'startAt' | 'durationSeconds' | 'doseMm'>,
  adjustment: ProposalAdjustment,
): AdjustedTiming | null {
  const startMs = Date.parse(adjustment.startAt);
  if (!Number.isFinite(startMs)) return null;
  if (!Number.isFinite(adjustment.doseMm) || adjustment.doseMm <= 0) return null;
  if (!(proposal.doseMm > 0) || !(proposal.durationSeconds > 0)) return null;
  const durationSeconds = Math.max(1, Math.round(proposal.durationSeconds * adjustment.doseMm / proposal.doseMm));
  return {
    startAt: new Date(startMs).toISOString(),
    endAt: new Date(startMs + millisecondsFromSeconds(durationSeconds)).toISOString(),
    durationSeconds,
    doseMm: adjustment.doseMm,
  };
}

/** Vrai quand l'ajustement change quelque chose à la proposition. */
export function isAdjusted(proposal: Pick<PlanProposal, 'startAt' | 'durationSeconds' | 'doseMm'>, timing: AdjustedTiming): boolean {
  return Date.parse(timing.startAt) !== Date.parse(proposal.startAt) || timing.durationSeconds !== proposal.durationSeconds || timing.doseMm !== proposal.doseMm;
}

// ---------------------------------------------------------------------------
// Les réglages à l'écran
// ---------------------------------------------------------------------------

type DoseForm = { minimumMm: string; maximumMm: string; irrigationsPerDay: string; spacingDays: string };
type WindowForm = { start: string; end: string };

/** Les réglages tels que le formulaire les tient : des textes, pour que la saisie reste celle du maraîcher jusqu'à l'enregistrement. */
export type PlanningSettingsForm = {
  /** R2, en pour cent. */
  forecastRainSharePercent: string;
  waitForForecastRainAboveMm: string;
  doses: Record<EquipmentKind, DoseForm>;
  /** R8, `HH:MM` chacune. */
  windows: Record<EquipmentKind, WindowForm>;
  shortageStrategy: PlanningSettings['shortageStrategy'];
  carryOverDeficit: boolean;
  collectiveDoseRule: PlanningSettings['collectiveDoseRule'];
  preferredKindWhenBoth: EquipmentKind;
  /** R13, en pour cent. */
  commandingRateSharePercent: string;
  /** R14, en minutes. */
  lateToleranceMinutes: string;
};

const PERCENT = 100;

function twoDigits(value: number): string {
  return String(value).padStart(2, '0');
}

/** Minutes depuis minuit → `HH:MM`. */
export function timeInputFromMinutes(minutes: number): string {
  const safe = Number.isFinite(minutes) ? Math.max(0, Math.round(minutes)) : 0;
  return `${twoDigits(Math.floor(safe / MINUTES_PER_HOUR))}:${twoDigits(safe % MINUTES_PER_HOUR)}`;
}

/** `HH:MM` → minutes depuis minuit ; `null` si la saisie n'est pas une heure. */
export function minutesFromTimeInput(value: string): number | null {
  const match = /^(\d{1,2}):(\d{2})$/.exec(value.trim());
  if (!match) return null;
  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  if (hours > 23 || minutes > 59) return null;
  return hours * MINUTES_PER_HOUR + minutes;
}

/** Un nombre saisi à la française ou non : la virgule vaut le point ; vide ou illisible → `NaN`, que la validation refuse avec son chemin. */
export function decimalFromInput(value: string): number {
  const trimmed = value.trim().replace(',', '.');
  return trimmed === '' ? Number.NaN : Number(trimmed);
}

function formatDecimal(value: number): string {
  return String(value).replace('.', ',');
}

export function planningSettingsForm(settings: PlanningSettings): PlanningSettingsForm {
  const dose = (kind: EquipmentKind): DoseForm => ({
    minimumMm: formatDecimal(settings.doses[kind].minimumMm),
    maximumMm: formatDecimal(settings.doses[kind].maximumMm),
    irrigationsPerDay: String(settings.doses[kind].irrigationsPerDay),
    spacingDays: String(settings.doses[kind].spacingDays),
  });
  const window = (kind: EquipmentKind): WindowForm => ({
    start: timeInputFromMinutes(settings.windows[kind].startMinute),
    end: timeInputFromMinutes(settings.windows[kind].endMinute),
  });
  return {
    forecastRainSharePercent: formatDecimal(settings.forecastRainShare * PERCENT),
    waitForForecastRainAboveMm: formatDecimal(settings.waitForForecastRainAboveMm),
    doses: { sprinkler: dose('sprinkler'), drip: dose('drip') },
    windows: { sprinkler: window('sprinkler'), drip: window('drip') },
    shortageStrategy: settings.shortageStrategy,
    carryOverDeficit: settings.carryOverDeficit,
    collectiveDoseRule: settings.collectiveDoseRule,
    preferredKindWhenBoth: settings.preferredKindWhenBoth,
    commandingRateSharePercent: formatDecimal(settings.commandingRateShare * PERCENT),
    lateToleranceMinutes: String(settings.lateToleranceMinutes),
  };
}

/**
 * Les réglages que le formulaire décrit, vérifiés comme le seraient des
 * réglages venus du cache : une saisie illisible est refusée avec le chemin
 * du réglage, rien n'est corrigé en silence.
 */
export function settingsFromForm(form: PlanningSettingsForm): { settings: PlanningSettings; issues: [] } | { settings: null; issues: PlanningSettingsIssue[] } {
  const dose = (kind: EquipmentKind) => ({
    minimumMm: decimalFromInput(form.doses[kind].minimumMm),
    maximumMm: decimalFromInput(form.doses[kind].maximumMm),
    irrigationsPerDay: decimalFromInput(form.doses[kind].irrigationsPerDay),
    spacingDays: decimalFromInput(form.doses[kind].spacingDays),
  });
  const window = (kind: EquipmentKind): TimeWindow => ({
    startMinute: minutesFromTimeInput(form.windows[kind].start) ?? Number.NaN,
    endMinute: minutesFromTimeInput(form.windows[kind].end) ?? Number.NaN,
  });
  const candidate = {
    forecastRainShare: decimalFromInput(form.forecastRainSharePercent) / PERCENT,
    waitForForecastRainAboveMm: decimalFromInput(form.waitForForecastRainAboveMm),
    doses: { sprinkler: dose('sprinkler'), drip: dose('drip') },
    windows: { sprinkler: window('sprinkler'), drip: window('drip') },
    shortageStrategy: form.shortageStrategy,
    carryOverDeficit: form.carryOverDeficit,
    collectiveDoseRule: form.collectiveDoseRule,
    preferredKindWhenBoth: form.preferredKindWhenBoth,
    commandingRateShare: decimalFromInput(form.commandingRateSharePercent) / PERCENT,
    lateToleranceMinutes: decimalFromInput(form.lateToleranceMinutes),
  };
  return validatePlanningSettings(candidate);
}

const SETTINGS_ISSUE_LABELS: Record<string, string> = {
  '': 'Réglages',
  forecastRainShare: 'R2, part de la pluie prévue',
  waitForForecastRainAboveMm: 'R3, seuil de pluie prévue',
  'doses.sprinkler': 'R4 à R7, aspersion',
  'doses.drip': 'R4 à R7, goutte-à-goutte',
  'windows.sprinkler': 'R8, plage de l’aspersion',
  'windows.drip': 'R8, plage du goutte-à-goutte',
  shortageStrategy: 'R9, conduite en pénurie',
  carryOverDeficit: 'R10, report du déficit',
  collectiveDoseRule: 'R11, dose collective',
  preferredKindWhenBoth: 'R12, matériel préféré',
  commandingRateShare: 'R13, part du débit qui commande',
  lateToleranceMinutes: 'R14, tolérance du retard',
};

/** Le réglage qu'un chemin de validation désigne, pour dire au maraîcher où est la valeur refusée. */
export function settingsIssueLabel(path: string): string {
  return SETTINGS_ISSUE_LABELS[path] ?? path;
}

/** « 21:00 – 08:00 ». */
export function windowLabel(window: TimeWindow): string {
  return `${timeInputFromMinutes(window.startMinute)} – ${timeInputFromMinutes(window.endMinute)}`;
}

/** Les réglages en une ligne, pour l'historique. */
export function summarizeSettings(settings: PlanningSettings): string {
  const dose = (kind: EquipmentKind) => {
    const value = settings.doses[kind];
    return `${EQUIPMENT_KIND_LABELS[kind].toLocaleLowerCase('fr-FR')} ${formatDecimal(value.minimumMm)} à ${formatDecimal(value.maximumMm)} mm, ${value.irrigationsPerDay} par jour, ${value.spacingDays} j d’espacement, ${windowLabel(settings.windows[kind])}`;
  };
  return [
    `pluie prévue déduite à ${formatDecimal(settings.forecastRainShare * PERCENT)} %, attendue au-dessus de ${formatDecimal(settings.waitForForecastRainAboveMm)} mm`,
    dose('sprinkler'),
    dose('drip'),
    `pénurie : ${SHORTAGE_STRATEGY_LABELS[settings.shortageStrategy]}`,
    `report du déficit : ${settings.carryOverDeficit ? 'oui' : 'non'}`,
    `dose collective : ${COLLECTIVE_DOSE_RULE_LABELS[settings.collectiveDoseRule]}`,
    `matériel préféré : ${EQUIPMENT_KIND_LABELS[settings.preferredKindWhenBoth].toLocaleLowerCase('fr-FR')}`,
    `portée : une planche commande dès ${formatDecimal(settings.commandingRateShare * PERCENT)} % du débit le plus fort`,
    `retard : ${settings.lateToleranceMinutes} min après l’heure prévue`,
  ].join(' · ');
}
