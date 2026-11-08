import type { Bed } from '../domain.ts';
import type { EquipmentListItem } from '../equipment-record.ts';
import type { EquipmentPlacementRecord } from '../equipment-placement-record.ts';
import type { PlannedStartBlock } from '../equipment-placement-periods.ts';
import type { BedIrrigationCoverage } from '../irrigation-coverage.ts';
import type { EquipmentKind } from '../irrigation-domain.ts';
import type { IrrigationBedApplicationDraft, IrrigationEventRecord } from '../irrigation-event-record.ts';
import type { BedIrrigationNeed, IrrigationNeedPriority } from '../irrigation-needs.ts';
import type { PlannedIrrigationState } from '../planned-irrigation.ts';
import type { EquipmentPumpDefault, IrrigationPump } from '../pumps.ts';
import type { DailyWaterLimit } from '../water-management.ts';
import type { WaterInfrastructure } from '../water-resources.ts';
import type { PlanChanges } from './changes.ts';
import type { ProtectedSlot } from './protected-slots.ts';
import type { PlanningSettings } from './settings.ts';

/**
 * Le contrat du moteur de planning hebdomadaire (`docs/planning-contract.md`,
 * D-024). Le moteur est une fonction pure : il reçoit ce que les sous-tranches
 * 2.7, 2.8, 3.1, 3.2 et 3.3 savent déjà, et rend des propositions de créneaux
 * du moment du calcul à dimanche minuit, avec leur justification et, planche
 * par planche, ce qu'il n'a pas pu placer et pourquoi.
 */

export type PlanningInputs = {
  season: number;
  /** L'instant du calcul : rien n'est proposé avant. */
  now: Date;
  /** Lundi et dimanche de la semaine, `AAAA-MM-JJ` (D-004). */
  weekStart: string;
  weekEnd: string;
  timeZone: string;
  /** Les besoins de la 3.3, une ligne par planche qui en a une. */
  needs: readonly BedIrrigationNeed[];
  beds: readonly Bed[];
  /** Les jours de la semaine avec leur pluie prévue et leur ET0, pour la règle R3 et la réserve. */
  days: readonly { date: string; forecastRainMm: number | null; et0Mm: number | null }[];
  /** La couverture des planches par le matériel positionné (2.x). */
  coverage: readonly BedIrrigationCoverage[];
  equipment: readonly EquipmentListItem[];
  placements: readonly EquipmentPlacementRecord[];
  pumpDefaults: readonly EquipmentPumpDefault[];
  pumps: readonly IrrigationPump[];
  infrastructure: WaterInfrastructure;
  dailyLimits: readonly DailyWaterLimit[];
  /** Les irrigations de la semaine : réelles, en cours et planifiées, validées comprises. */
  events: readonly IrrigationEventRecord[];
  /**
   * Un arbitrage 3.4 validé pour la semaine : le volume alloué à chaque planche.
   * Absent ou vide, la conduite en pénurie du réglage R9 s'applique.
   */
  arbitration?: readonly { bedId: string; allocatedCubicMeters: number }[] | null;
  /** Planches reportées par le calcul précédent (R9 « report ») : servies en premier. */
  deferredBedIds?: readonly string[];
  /**
   * Les créneaux refusés de la semaine du plan (D-030) : aucun créneau de ce
   * matériel ne recouvre ces heures, même en partie, quelle que soit la dose ;
   * le besoin se place ailleurs ou se lit « non placé ». Absent ou vide : aucun refus.
   */
  refusedSlots?: readonly RefusedSlot[];
  /**
   * Les créneaux protégés nommés de l'exploitation (docs/protected-slots-contract.md,
   * D-062) : aucun créneau planifié, de quelque matériel, ne commence, ne se
   * poursuit ni ne se termine dedans, même prioritaire, même en pénurie ; le
   * besoin se place ailleurs ou se lit « non placé ». Un arrosage validé qui y
   * tombe reçoit « Annuler » ou « Réduire » (règles 9 et 10). Absent ou vide :
   * aucun créneau protégé, et le plan est exactement celui d'avant.
   */
  protectedSlots?: readonly ProtectedSlot[];
  /**
   * Les irrigations planifiées de la semaine que la 2.11 empêche de démarrer :
   * matériel stocké, ou reposé ailleurs (D-044). Elles ne comptent plus et ne
   * sont pas dans `events` ; le moteur suggère de les annuler (règle 16).
   */
  blockedIrrigations?: readonly BlockedPlannedIrrigation[];
};

/** Un créneau refusé par le maraîcher : ce matériel, de ce début à cette fin, pour la semaine de son plan (D-030). */
export type RefusedSlot = {
  equipmentId: string;
  startAt: string;
  endAt: string;
};

/** Une irrigation planifiée qu'une pose empêche de démarrer, avec le blocage que la 2.11 nomme. */
export type BlockedPlannedIrrigation = { event: IrrigationEventRecord; block: PlannedStartBlock };

export type PlanBedApplication = {
  bedId: string;
  bedName: string;
  /** Besoin restant avant ce créneau, en mm. */
  needBeforeMm: number;
  /** Ce que la planche reçoit de ce créneau, en mm, selon son propre taux. */
  appliedMm: number;
  needAfterMm: number;
  /** Ce qu'elle reçoit au-delà de son besoin : affiché, jamais fondu (R11). */
  surplusMm: number;
  wettedAreaSquareMeters: number | null;
};

/** `reserved-share` : raccourci à ce que les parts de ses planches paient, le reste du budget étant réservé aux autres (D-037). */
export type DoseReason = 'remaining-need' | 'maximum-dose' | 'window-fit' | 'pump-gap' | 'daily-limit' | 'reserved-share' | 'reserve-level' | 'last-day-below-minimum'
  /** Raccourci pour finir avant un créneau refusé (D-030). */
  | 'refused-slot-fit'
  /** Raccourci pour finir avant un créneau protégé (D-062, règle 6). */
  | 'protected-slot-fit';
export type TimingReason = 'earliest' | 'after-forecast-rain' | 'spacing' | 'window' | 'pump-capacity' | 'reserve-inflow' | 'daily-limit'
  /** Commencé à la fin d'un créneau refusé (D-030). */
  | 'after-refused-slot'
  /** Commencé à la fin d'un créneau protégé (D-062, règle 6). */
  | 'after-protected-slot';

type ProposalJustification = {
  priority: IrrigationNeedPriority;
  doseReason: DoseReason;
  timingReason: TimingReason;
  /** Ce qui a borné le créneau, s'il a été borné : « pompe saturée de 21 h à 23 h ». */
  limitingConstraint: string | null;
  pump: { pumpId: string; pumpName: string; flowCubicMetersPerHour: number | null; alreadyEngagedCubicMetersPerHour: number } | null;
  /** L'eau : la réserve ou la ressource d'où vient le créneau, et son niveau projeté à la fin. */
  supply: { originKey: string; originName: string; projectedLevelAfterCubicMeters: number | null } | null;
  hydraulicallyVerified: boolean;
};

export type PlanProposal = {
  /** Identifiant stable dans le calcul : `p-1`, `p-2`… dans l'ordre de placement. */
  id: string;
  equipmentId: string;
  equipmentName: string;
  kind: EquipmentKind;
  settingId: string;
  settingName: string;
  placementId: string;
  startAt: string;
  endAt: string;
  durationSeconds: number;
  /** La dose de référence : celle de la planche la plus demandeuse. */
  doseMm: number;
  applications: IrrigationBedApplicationDraft[];
  bedApplications: PlanBedApplication[];
  /** Nul quand une planche arrosée n'a pas de surface mouillée connue. */
  volumeCubicMeters: number | null;
  flowCubicMetersPerHour: number | null;
  pumpId: string | null;
  pumpOriginId: string | null;
  justification: ProposalJustification;
};

export type UnplacedReason =
  | 'no-objective'
  | 'no-equipment'
  | 'below-minimum-dose'
  | 'water-budget'
  | 'deferred'
  | 'pump-time'
  | 'daily-limit'
  | 'reserve-timing'
  | 'volume-unknown-under-limit'
  | 'supply-unavailable'
  | 'no-time-left'
  /** Arrosée sous la part R13 de son matériel, ou moins vite que sa planche de référence (D-025). */
  | 'insufficient-reach'
  /** Un arrosage par jour (R6) ou l'espacement (R7) n'ont laissé aucune plage. */
  | 'spacing'
  /** Ses seuls créneaux possibles ont été refusés cette semaine (D-030) ; une autre contrainte qui aurait suffi se nomme à sa place. */
  | 'refused-slot'
  /** Ses seuls créneaux possibles tombent dans des créneaux protégés (D-062, règle 5) ; une autre contrainte qui aurait suffi se nomme à sa place. */
  | 'protected-slot';

export type PlanBedOutcome = {
  bedId: string;
  bedName: string;
  plotName: string;
  priority: IrrigationNeedPriority;
  /** Besoin restant à placer au départ du calcul, en mm. */
  needMm: number;
  /** Cible après la conduite en pénurie (R9) ou l'arbitrage 3.4, relevée par les parts libérées en fin de tour (D-037). */
  targetMm: number;
  placedMm: number;
  surplusMm: number;
  deficitMm: number;
  reasons: UnplacedReason[];
  proposalIds: string[];
  equipmentId: string | null;
  /**
   * Les créneaux protégés que nomme son motif « créneau protégé » (D-062,
   * règle 5), dans l'ordre du temps. Absent quand ce motif manque : une
   * planche, et un plan, sans créneau protégé restent ceux d'avant.
   */
  protectedSlotNames?: string[];
};

type PlanDeficit = {
  /** Le manque d'eau : ce que le budget hebdomadaire ne couvre pas, en m³. */
  waterCubicMeters: number;
  /** Le manque de temps de pompage : ce qui n'a pas tenu dans les plages, en m³. */
  pumpTimeCubicMeters: number;
  byReason: Partial<Record<UnplacedReason, number>>;
  bedCount: number;
};

/**
 * Les suggestions sur les arrosages validés (docs/replanning-contract.md,
 * règles 11 à 17). Le moteur ne modifie ni n'annule jamais une irrigation
 * validée : il suggère, avec sa raison, et le maraîcher décide (D-028).
 */
export type PlanSuggestionKind = 'cancel' | 'reduce';

/** Sur quoi une suggestion repose : les termes du besoin de la planche de référence, ou ce qui empêche l'arrosage. */
export type PlanSuggestionCause =
  | {
    kind: 'useful-dose';
    bedId: string;
    bedName: string;
    /** L'objectif de la semaine, ou le besoin posé à la main quand il en tient lieu (`manual`). */
    objectiveMm: number;
    manual: boolean;
    actualRainMm: number;
    /** La part de la pluie prévue déduite (R2). */
    forecastRainMm: number;
    actualIrrigationMm: number;
    /** Les arrosages planifiés qui précèdent celui-ci, pour cette planche. */
    earlierPlannedMm: number;
    needBeforeMm: number;
    usefulMm: number;
    plannedMm: number;
    minimumMm: number;
    /** Le dernier jour de la semaine tolère une dose sous le minimum. */
    lastDay: boolean;
  }
  | { kind: 'equipment-stored'; equipmentName: string; removedAt: string }
  | { kind: 'equipment-moved'; equipmentName: string }
  | { kind: 'daily-limit'; date: string; limitCubicMeters: number; committedCubicMeters: number }
  | { kind: 'volume-unknown'; date: string }
  | {
    /** L'arrosage tombe dans un créneau protégé, posé après coup ou validé avant (docs/protected-slots-contract.md, règles 9 et 10). */
    kind: 'protected-slot';
    /** Les créneaux protégés où il tombe, dans l'ordre du temps, sans doublon. */
    slotNames: string[];
    /** La dose de la partie avant le premier d'entre eux, en mm ; nulle quand l'arrosage commence dedans. */
    partBeforeMm: number | null;
    minimumMm: number;
  };

export type PlanSuggestion = {
  /** L'irrigation planifiée : l'événement et sa ligne de matériel, que les gestes désignent. */
  eventId: string;
  eventEquipmentId: string;
  equipmentId: string;
  equipmentName: string;
  kind: EquipmentKind;
  /** La plus haute priorité de ses planches. */
  priority: IrrigationNeedPriority;
  plannedStartAt: string;
  plannedEndAt: string;
  plannedDurationSeconds: number;
  /** La dose prévue de la planche de référence, en mm. */
  plannedDoseMm: number;
  suggestion: PlanSuggestionKind;
  /** « Réduire à X mm » : la dose, la durée au prorata et la fin qui suit le début ; nuls pour « Annuler ». */
  doseMm: number | null;
  durationSeconds: number | null;
  endAt: string | null;
  causes: PlanSuggestionCause[];
};

/** Un jour dont les irrigations dépassent une limite journalière posée après coup : elles seront refusées au démarrage (règle 16). */
export type OvercommittedDay = { date: string; limitCubicMeters: number; committedCubicMeters: number };

/** « Garder » : la suggestion tue, avec sa dose ; elle ne revient que si un calcul en fait une autre (règle 17). */
export type KeptSuggestion = { eventEquipmentId: string; suggestion: PlanSuggestionKind; doseMm: number | null };

export type StoredPlanSuggestion = PlanSuggestion & { kept: boolean };

export type WeeklyPlan = {
  weekStart: string;
  weekEnd: string;
  computedAt: string;
  horizonStartAt: string;
  horizonEndAt: string;
  proposals: PlanProposal[];
  beds: PlanBedOutcome[];
  deficit: PlanDeficit;
  /** Le budget d'eau retenu pour la pénurie, chaîne par chaîne. */
  budgets: SupplyBudget[];
  /** Un arbitrage 3.4 validé, tel que le plan l'applique ; absent sans arbitrage, un plan sans arbitrage restant celui d'avant. */
  arbitration?: PlanArbitration;
  /** Les suggestions sur les arrosages validés, dans l'ordre du temps, et les jours qu'une limite posée après coup met en défaut (3.7). */
  suggestions: PlanSuggestion[];
  overcommittedDays: OvercommittedDay[];
  settings: PlanningSettings;
  assumptions: {
    forecastDays: number;
    reservoirsObservedAt: { reservoirId: string; name: string; observedAt: string | null; currentCubicMeters: number | null }[];
  };
};

/**
 * Un arbitrage 3.4 validé dans le plan (décision 1 de la 3.9, D-052) :
 * chaque allocation est une part réservée, sans redistribution entre
 * planches. Les volumes se comptent sur la surface que le propre matériel de
 * chaque planche mouille.
 */
export type PlanArbitration = {
  /** Les allocations, chacune bornée au besoin de sa planche, en m³. */
  allocatedCubicMeters: number;
  /** Les parts réservées : les allocations, réduites dans la même proportion là où une chaîne ne peut pas toutes les fournir. */
  reservedCubicMeters: number;
  /** Ce que les planches allouées ne reçoivent pas de leur part, hors résidu d'arrondi : de l'eau qui reste non attribuée. */
  unreceivedCubicMeters: number;
  unreceivedBedCount: number;
};

export type SupplyBudget = {
  originKey: string;
  originName: string;
  /** Eau mobilisable d'ici dimanche : stock hors sécurité, apports, pluie, moins l'évaporation et le planifié. */
  availableCubicMeters: number | null;
  /**
   * Ce que la limite journalière d'irrigation laisse encore d'ici dimanche, tous jours confondus ; `null` quand
   * elle ne borne pas la semaine : aucune limite, ou un jour de l'horizon sans limite (point ouvert 35).
   */
  dailyLimitRemainingCubicMeters: number | null;
  demandCubicMeters: number;
  /** Part servie de chaque niveau de priorité, de 0 à 1. */
  fractions: Record<IrrigationNeedPriority, number>;
};

/** Les cinq statuts d'une proposition (docs/planning-contract.md, « Les statuts »). */
export type ProposalStatus = 'proposed' | 'validated' | 'refused' | 'replaced' | 'expired';

export type PlanCalculationTrigger = 'manual' | 'daily' | 'event';

/**
 * Les événements qui font recalculer le plan de la semaine courante, liste
 * fermée (docs/replanning-contract.md, règle 4) : un enregistrement du
 * maraîcher, ou du logiciel pour lui, qui change ce que le moteur doit savoir.
 * Un réglage du planning, la pause d'un minuteur, la météo actualisée ou le
 * passage du temps n'en sont pas (règle 5).
 */
export const PLAN_EVENT_KINDS = [
  'irrigation-planned', 'irrigation-updated', 'irrigation-started', 'irrigation-recorded', 'irrigation-completed',
  'irrigation-partially-completed', 'irrigation-remaining-canceled', 'irrigation-canceled',
  'rain-recorded', 'reservoir-level-observed', 'resource-flow-applied', 'daily-limit-changed',
  'objective-changed', 'threshold-changed', 'bed-need-decided', 'arbitration-validated',
  'equipment-placed', 'equipment-setting-changed', 'equipment-removed',
  'proposal-refused', 'proposal-validated',
] as const;

export type PlanEventKind = (typeof PLAN_EVENT_KINDS)[number];

/**
 * Ce qu'un calcul « sur événement » retient et que l'en-tête nomme : un
 * événement de la 3.7, ou un changement des fonctionnalités qui touche le plan
 * (3.8, docs/feature-selection-contract.md, R9), recalculé sans passer par le
 * registre des événements.
 */
export type PlanCalculationEvent = PlanEventKind | 'features-changed';

/**
 * Un événement enregistré après le dernier calcul et dont le recalcul n'a pas
 * abouti : en cours, ou échoué (règle 6). L'écran dit alors que le plan lui
 * est antérieur, et « recalculez » quand il a échoué.
 */
export type PlanEventNotice = {
  kind: PlanEventKind;
  /** L'heure de l'enregistrement, pas celle de ce que l'événement rapporte. */
  occurredAt: string;
  status: 'pending' | 'failed';
};

/** L'état réel de l'irrigation planifiée qu'une proposition validée est devenue (2.7). */
export type ValidatedIrrigationStatus = 'planned' | 'partially_completed' | 'completed' | 'canceled';

/** Une proposition telle que le registre la garde, avec le calcul qui l'a produite et sa décision. */
export type StoredProposal = PlanProposal & {
  /** L'identifiant du registre, celui que les décisions désignent ; `id` reste le numéro local du calcul. */
  storedId: string;
  calculationId: string;
  /** La date du calcul qui l'a produite : relue avec un calcul plus récent, la carte s'en date (« Interface (3.6) »). */
  calculatedAt: string;
  status: ProposalStatus;
  validatedEventId: string | null;
  /**
   * L'état réel de l'irrigation d'une proposition validée (statuts du contrat :
   * « l'irrigation validée a vécu ; le plan lit le réel, jamais l'inverse ») :
   * planifiée, faite en partie, réalisée ou annulée. Nul quand la proposition
   * n'est pas validée, ou que son irrigation n'est pas retrouvée. Une annulée
   * ne compte plus parmi les validées : son besoin est revenu au plan
   * (recette réelle du 31 octobre 2026).
   */
  irrigationStatus: ValidatedIrrigationStatus | null;
  /**
   * L'irrigation qu'une proposition validée est devenue, telle que la règle du
   * retard la lit (heures prévues, peut-être modifiées depuis, minuteur,
   * annulations) : le planning compte « En retard » comme la page des
   * arrosages (audit ergonomique, lot 3, point 5). Absente ou nulle quand la
   * proposition n'est pas validée ou que l'irrigation n'est pas retrouvée.
   */
  irrigation?: PlannedIrrigationState | null;
  replacedByCalculationId: string | null;
  decidedAt: string | null;
  actorUserId: string | null;
};

export type StoredPlanCalculation = {
  id: string;
  season: number;
  weekStart: string;
  trigger: PlanCalculationTrigger;
  /** L'événement qui a déclenché un calcul « sur événement » (règle 7) ; nul autrement. */
  triggerEvent: PlanCalculationEvent | null;
  computedAt: string;
  horizonStartAt: string;
  horizonEndAt: string;
  settings: PlanningSettings;
  summary: Pick<WeeklyPlan, 'beds' | 'deficit' | 'budgets' | 'arbitration' | 'assumptions' | 'weekEnd' | 'suggestions' | 'overcommittedDays'> & {
    /** « Ce qui a changé » depuis le calcul précédent de la semaine (règle 25) ; nul au premier calcul. */
    changes: PlanChanges | null;
  };
};

export type StoredWeeklyPlan = {
  calculation: StoredPlanCalculation;
  proposals: StoredProposal[];
  /** Les suggestions du calcul, avec celles que « Garder » a tues (règle 17). */
  suggestions: StoredPlanSuggestion[];
  /** L'événement postérieur au calcul dont le recalcul n'a pas abouti ; nul quand le plan est à jour. */
  pendingEvent: PlanEventNotice | null;
};

/**
 * Le statut tel qu'il se lit : une proposition jamais décidée dont le
 * créneau est passé est « expirée », sans qu'on l'ait écrit — le registre
 * garde ce que le calcul a proposé.
 */
export function effectiveProposalStatus(proposal: Pick<StoredProposal, 'status' | 'endAt'>, now: Date): ProposalStatus {
  if (proposal.status === 'proposed' && Date.parse(proposal.endAt) <= now.getTime()) return 'expired';
  return proposal.status;
}
