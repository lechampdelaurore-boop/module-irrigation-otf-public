import type { EquipmentPlacementRecord } from './equipment-placement-record.ts';
import type { IrrigationEventRecord } from './irrigation-event-record.ts';
import { dateKeyInTimeZone } from './irrigation-history/dates.ts';
import { FARM_TIME_ZONE } from './water-management.ts';
import { millisecondsFromMinutes } from './units.ts';

/**
 * Pose datée et stockage du matériel (sous-tranche 2.11,
 * docs/equipment-placement-periods-contract.md, D-043).
 *
 * Une pose est une période : posé à un endroit depuis une date, retiré à une
 * autre. Sans pose ouverte, le matériel est stocké : il existe, garde ses
 * réglages et n'arrose rien. Rien ne s'efface : une pose fermée reste lisible,
 * et une irrigation garde la copie de la position qu'elle a utilisée (D-006).
 *
 * Les dates sont des instants ISO ; leur jour et leur heure se lisent à la
 * ferme, en heure de Paris (D-004). La saison d'Ouvre ta ferme est l'année
 * civile : une date de pose ou de retrait tombe dans l'année de la saison de
 * la pose (règles 3 et 15).
 */

/** Les dates d'une pose. `placedAt` nul : pose antérieure à la 2.11, date inconnue (règle 7). */
export type PlacementDates = {
  placedAt: string | null;
  removedAt: string | null;
};

/** Une pose et ce qui la décrit : l'endroit, les planches, le réglage appliqué. */
export type PlacementPose = EquipmentPlacementRecord & PlacementDates;

export type EquipmentPoseState =
  | { kind: 'posed'; placedAt: string | null }
  | { kind: 'stored'; removedAt: string }
  | { kind: 'never' };

/**
 * L'état d'un matériel pour une saison, d'après sa pose courante : posé tant
 * qu'elle n'a pas de date de retrait, stocké ensuite, jamais posé sans pose.
 */
export function equipmentPoseState(current: PlacementDates | null): EquipmentPoseState {
  if (!current) return { kind: 'never' };
  if (current.removedAt === null) return { kind: 'posed', placedAt: current.placedAt };
  return { kind: 'stored', removedAt: current.removedAt };
}

/** Une pose ouverte : le seul état dans lequel un matériel arrose (règles 10 et 11). */
function isPosed(dates: PlacementDates | null): boolean {
  return dates !== null && dates.removedAt === null;
}

/** Les poses ouvertes d'une liste : ce que voient les besoins, la faisabilité et le planning. */
export function posedPlacements<T extends PlacementDates>(placements: readonly T[]): T[] {
  return placements.filter((placement) => placement.removedAt === null);
}

/**
 * L'avance tolérée d'une date saisie sur l'heure du serveur : les dates se
 * saisissent à la minute, et l'horloge d'un appareil peut avancer de quelques
 * secondes sur celle du serveur (règle 3, point ouvert 47).
 */
const POSE_DATE_CLOCK_TOLERANCE_MS = millisecondsFromMinutes(2);

/**
 * La date de pose, de repose, de déplacement ou de retrait à contrôler puis à
 * enregistrer : une date qui ne dépasse l'heure du serveur que de deux minutes
 * au plus vaut maintenant, à l'heure du serveur ; toute autre reste telle
 * quelle, et les règles 3 à 5 la jugent (point ouvert 47).
 */
export function poseDateAt(value: string, now: Date): string {
  const ahead = instant(value) - now.getTime();
  return ahead > 0 && ahead <= POSE_DATE_CLOCK_TOLERANCE_MS ? now.toISOString() : value;
}

export type PoseDateRefusal =
  | { code: 'invalid_date' }
  | { code: 'future'; now: string }
  | { code: 'outside_season'; season: number }
  | { code: 'before_previous_removal'; previousRemovedAt: string }
  | { code: 'before_placement'; placedAt: string }
  | { code: 'before_last_irrigation'; irrigationEndAt: string }
  | { code: 'irrigation_in_progress' }
  | { code: 'already_stored' }
  | { code: 'already_posed' };

/**
 * Une date de pose : jamais dans le futur, dans la saison, jamais avant le
 * retrait de la pose précédente du même matériel (règles 3 et 4). Le matériel
 * doit être stocké ou jamais posé : une seule pose ouverte à la fois (règle 1).
 */
export function checkPlacementDate(input: {
  placedAt: string;
  now: Date;
  season: number;
  current: PlacementDates | null;
}): PoseDateRefusal | null {
  if (isPosed(input.current)) return { code: 'already_posed' };
  const common = checkCommonDate(input.placedAt, input.now, input.season);
  if (common) return common;
  const previousRemovedAt = input.current?.removedAt ?? null;
  if (previousRemovedAt !== null && instant(input.placedAt) < instant(previousRemovedAt)) {
    return { code: 'before_previous_removal', previousRemovedAt };
  }
  return null;
}

/**
 * Une date de retrait : jamais dans le futur, dans la saison, jamais avant la
 * date de pose, jamais avant la fin de la dernière irrigation de la pose ; et
 * aucun retrait pendant une irrigation en cours (règles 3 à 6).
 */
export function checkRemovalDate(input: {
  removedAt: string;
  now: Date;
  season: number;
  current: PlacementDates | null;
  irrigations: IrrigationUseOfPlacement;
}): PoseDateRefusal | null {
  if (!isPosed(input.current)) return { code: 'already_stored' };
  if (input.irrigations.inProgress) return { code: 'irrigation_in_progress' };
  const common = checkCommonDate(input.removedAt, input.now, input.season);
  if (common) return common;
  const placedAt = input.current?.placedAt ?? null;
  if (placedAt !== null && instant(input.removedAt) < instant(placedAt)) {
    return { code: 'before_placement', placedAt };
  }
  const lastEndAt = input.irrigations.lastEndAt;
  if (lastEndAt !== null && instant(input.removedAt) < instant(lastEndAt)) {
    return { code: 'before_last_irrigation', irrigationEndAt: lastEndAt };
  }
  return null;
}

/** Ce que les irrigations disent d'une pose : la fin de la dernière, une irrigation en cours. */
export type IrrigationUseOfPlacement = {
  lastEndAt: string | null;
  inProgress: boolean;
};

/**
 * Ce qu'il faut d'une irrigation pour juger un retrait : la pose utilisée,
 * la fin réelle enregistrée et l'état du minuteur. Une irrigation lue en
 * entier convient ; le dépôt n'en lit que ces champs.
 */
export type PlacementIrrigationUse = {
  equipment: Pick<IrrigationEventRecord['equipment'], 'placementId' | 'actualEndAt' | 'timerState'>;
};

/**
 * Les irrigations d'une pose, lues pour son retrait : la fin de la dernière
 * réalisée, partielle ou arrêtée avant la fin, et la présence d'une irrigation
 * en cours, minuteur en marche ou en pause. Le minuteur seul dit qu'une
 * irrigation est en cours : démarrée depuis une irrigation planifiée, elle
 * n'a pas encore de début réel enregistré, et reprise après une partie, elle
 * garde la fin de cette partie. Une irrigation planifiée non démarrée ou
 * annulée avant de commencer n'arrose pas : elle ne compte pas (règle 13 pour
 * la suite qui lui est donnée).
 */
export function irrigationUseOfPlacement(
  events: readonly PlacementIrrigationUse[],
  placementId: string,
): IrrigationUseOfPlacement {
  let lastEndAt: string | null = null;
  let inProgress = false;
  for (const event of events) {
    const use = event.equipment;
    if (use.placementId !== placementId) continue;
    if (use.timerState !== null) inProgress = true;
    if (use.actualEndAt !== null && (lastEndAt === null || instant(use.actualEndAt) > instant(lastEndAt))) {
      lastEndAt = use.actualEndAt;
    }
  }
  return { lastEndAt, inProgress };
}

/**
 * La pose ouverte à un instant, parmi les poses d'un matériel pour une
 * saison, fermées et courante (règle 12). Une pose sans date de pose connue
 * vaut depuis toujours ; une pose couvre l'instant de sa pose jusqu'à
 * l'instant de son retrait, exclu.
 */
export function poseAt<T extends PlacementDates>(poses: readonly T[], at: string): T | null {
  const moment = instant(at);
  return poses.find((pose) => {
    const placed = pose.placedAt === null || instant(pose.placedAt) <= moment;
    const notYetRemoved = pose.removedAt === null || moment < instant(pose.removedAt);
    return placed && notYetRemoved;
  }) ?? null;
}

/** Le matériel était stocké à cet instant : le retrait qui précède, la pose qui suit. */
export type StoredGap = { removedAt: string | null; nextPlacedAt: string | null };

/**
 * Quand aucune pose ne couvre l'instant, les dates qui l'entourent : le
 * dernier retrait avant lui et la première pose après, pour le message qui
 * refuse une irrigation saisie après coup (règle 12).
 */
export function storedGapAround(poses: readonly PlacementDates[], at: string): StoredGap {
  const moment = instant(at);
  let removedAt: string | null = null;
  let nextPlacedAt: string | null = null;
  for (const pose of poses) {
    if (pose.removedAt !== null && instant(pose.removedAt) <= moment) {
      if (removedAt === null || instant(pose.removedAt) > instant(removedAt)) removedAt = pose.removedAt;
    }
    if (pose.placedAt !== null && instant(pose.placedAt) > moment) {
      if (nextPlacedAt === null || instant(pose.placedAt) < instant(nextPlacedAt)) nextPlacedAt = pose.placedAt;
    }
  }
  return { removedAt, nextPlacedAt };
}

export type CompletedIrrigationPoseRefusal =
  | { code: 'stored_at_start'; gap: StoredGap }
  | { code: 'removed_before_end'; removedAt: string };

/**
 * La pose d'une irrigation saisie après coup : celle qui était ouverte à son
 * heure de début, même fermée depuis (règle 12) ; ses planches font les
 * apports. Stocké à cette heure, le matériel n'a pas arrosé : refusé, avec les
 * dates qui entourent l'heure. Une irrigation commencée sur une pose ne se
 * termine pas après son retrait : la règle 5 veut qu'un retrait ne précède
 * jamais la fin d'une irrigation de sa pose ; la fin à l'instant même du
 * retrait est admise.
 */
export function poseForCompletedIrrigation<T extends PlacementDates>(
  poses: readonly T[],
  startAt: string,
  endAt: string,
): { ok: true; pose: T } | { ok: false; refusal: CompletedIrrigationPoseRefusal } {
  const pose = poseAt(poses, startAt);
  if (pose === null) return { ok: false, refusal: { code: 'stored_at_start', gap: storedGapAround(poses, startAt) } };
  if (pose.removedAt !== null && instant(endAt) > instant(pose.removedAt)) {
    return { ok: false, refusal: { code: 'removed_before_end', removedAt: pose.removedAt } };
  }
  return { ok: true, pose };
}

/** Le message qui refuse une irrigation saisie après coup (règles 5 et 12). */
export function completedIrrigationPoseRefusalMessage(refusal: CompletedIrrigationPoseRefusal): string {
  if (refusal.code === 'stored_at_start') return storedGapMessage(refusal.gap);
  return `Ce matériel a été retiré le ${formatFarmMoment(refusal.removedAt)} : `
    + 'une irrigation commencée avant ne peut pas se terminer après. '
    + 'Corrigez l’heure de fin de l’irrigation.';
}

export type PlannedStartBlock =
  | { code: 'equipment_stored'; removedAt: string }
  | { code: 'equipment_moved' };

/**
 * Une irrigation planifiée sur un matériel retiré n'est jamais supprimée,
 * mais elle ne démarre pas tant qu'il est stocké ; reposé sur les mêmes
 * planches, elle redevient démarrable ; reposé ailleurs, elle reste bloquée
 * (règle 13).
 */
export function plannedIrrigationStartBlock(
  planned: Pick<EquipmentPlacementRecord, 'anchor' | 'selectedBeds'>,
  current: (Pick<EquipmentPlacementRecord, 'anchor' | 'selectedBeds'> & PlacementDates) | null,
): PlannedStartBlock | null {
  if (current === null) return { code: 'equipment_moved' };
  if (current.removedAt !== null) return { code: 'equipment_stored', removedAt: current.removedAt };
  return samePlace(planned, current) ? null : { code: 'equipment_moved' };
}

/** Ce qu'il faut d'une irrigation pour savoir si elle compte dans les calculs. */
export type CountableIrrigation = {
  season: number;
  status: IrrigationEventRecord['status'];
  equipment: Pick<IrrigationEventRecord['equipment'], 'equipmentId' | 'placementSnapshot' | 'timerState'>;
};

/**
 * Les irrigations que comptent les calculs — besoins, faisabilité, planning,
 * limite journalière, pompe, réserves (D-044, décision du porteur du 29
 * octobre 2026). Une irrigation planifiée, pas encore démarrée, que la règle
 * 13 empêche de démarrer — matériel stocké, ou reposé ailleurs — n'arrosera
 * pas : elle reste affichée et signalée, mais ne compte plus. Reposé au même
 * endroit, le matériel la fait recompter. `poses` : les poses courantes,
 * posées ou stockées, de chaque saison concernée. Une copie de position sans
 * ancrage ne dit pas où l'irrigation était prévue : elle compte, comme elle
 * démarre (règle 13).
 */
export function irrigationsThatCount<T extends CountableIrrigation>(
  events: readonly T[],
  poses: readonly PlacementPose[],
): T[] {
  const currentByEquipment = currentPosesByEquipment(poses);
  return events.filter((event) => countingBlock(event, currentByEquipment) === null);
}

/**
 * Le complément : les irrigations planifiées qu'une pose empêche de démarrer,
 * avec leur blocage, pour que le planning suggère de les annuler (3.7,
 * docs/replanning-contract.md, règle 16).
 */
export function blockedPlannedIrrigations<T extends CountableIrrigation>(
  events: readonly T[],
  poses: readonly PlacementPose[],
): { event: T; block: PlannedStartBlock }[] {
  const currentByEquipment = currentPosesByEquipment(poses);
  return events.flatMap((event) => {
    const block = countingBlock(event, currentByEquipment);
    return block === null ? [] : [{ event, block }];
  });
}

function currentPosesByEquipment(poses: readonly PlacementPose[]): ReadonlyMap<string, PlacementPose> {
  return new Map(poses.map((pose) => [`${pose.season}:${pose.equipmentId}`, pose]));
}

/** Ce qui empêche une irrigation de compter, ou rien. */
function countingBlock(event: CountableIrrigation, currentByEquipment: ReadonlyMap<string, PlacementPose>): PlannedStartBlock | null {
  if (event.status !== 'planned' || event.equipment.timerState !== null) return null;
  const planned = event.equipment.placementSnapshot as Partial<EquipmentPlacementRecord> | null;
  if (!planned?.anchor) return null;
  const current = currentByEquipment.get(`${event.season}:${event.equipment.equipmentId}`) ?? null;
  return plannedIrrigationStartBlock({ anchor: planned.anchor, selectedBeds: planned.selectedBeds ?? [] }, current);
}

/**
 * Même endroit. Un goutte-à-goutte est posé sur ses planches sélectionnées,
 * son ancrage n'étant que la première cochée : on compare les planches, dans
 * n'importe quel ordre. Une aspersion n'a pas de planches sélectionnées : on
 * compare son ancrage, centre d'une planche ou espace entre deux.
 *
 * Enregistrer un matériel posé au même endroit ne le déplace pas : la pose
 * reste ouverte et garde sa date ; ailleurs, la pose se ferme et une autre
 * s'ouvre (« Déplacer », règle 8).
 */
export function samePlace(
  left: Pick<EquipmentPlacementRecord, 'anchor' | 'selectedBeds'>,
  right: Pick<EquipmentPlacementRecord, 'anchor' | 'selectedBeds'>,
): boolean {
  if (left.selectedBeds.length === 0 && right.selectedBeds.length === 0) {
    return anchorKey(left.anchor) === anchorKey(right.anchor);
  }
  const leftBeds = [...new Set(left.selectedBeds.map((bed) => bed.otfBedId))].sort();
  const rightBeds = [...new Set(right.selectedBeds.map((bed) => bed.otfBedId))].sort();
  return leftBeds.length === rightBeds.length
    && leftBeds.every((bedId, index) => bedId === rightBeds[index]);
}

export type ProposalValidationBlock =
  | { code: 'removed_since_calculation'; equipmentName: string; removedAt: string; calculatedAt: string }
  | { code: 'moved_since_calculation'; equipmentName: string; placedAt: string; calculatedAt: string };

/**
 * Une proposition du planning dont le matériel a été retiré, ou reposé
 * ailleurs, depuis le calcul ne se valide pas, et le refus s'explique
 * toujours (règle 14, exigence du porteur du 27 octobre 2026). Un matériel
 * posé avant le calcul, ou dont la date de pose n'est pas connue, ne bloque
 * rien.
 */
export function proposalValidationBlock(input: {
  equipmentName: string;
  calculatedAt: string;
  current: PlacementDates | null;
}): ProposalValidationBlock | null {
  const { equipmentName, calculatedAt, current } = input;
  if (current === null) return null;
  if (current.removedAt !== null) {
    return { code: 'removed_since_calculation', equipmentName, removedAt: current.removedAt, calculatedAt };
  }
  if (current.placedAt !== null && instant(current.placedAt) > instant(calculatedAt)) {
    return { code: 'moved_since_calculation', equipmentName, placedAt: current.placedAt, calculatedAt };
  }
  return null;
}

/** Le message qui explique le refus de valider une proposition (règle 14). */
export function proposalValidationBlockMessage(block: ProposalValidationBlock): string {
  const calcul = `${formatFarmDay(block.calculatedAt)}, ${formatFarmTime(block.calculatedAt)}`;
  const changement = block.code === 'removed_since_calculation'
    ? `a été retiré et stocké le ${formatFarmMoment(block.removedAt)}`
    : `a été déplacé ou reposé le ${formatFarmMoment(block.placedAt)}`;
  return `Validation impossible : le matériel « ${block.equipmentName} » ${changement}, `
    + `après le calcul de ce plan (${calcul}). `
    + 'Recalculez le plan pour obtenir des propositions à jour.';
}

/** Le message qui explique le refus d'une date de pose ou de retrait. */
export function poseDateRefusalMessage(refusal: PoseDateRefusal): string {
  switch (refusal.code) {
    case 'invalid_date':
      return 'La date saisie n’est pas valide.';
    case 'future':
      return 'Une date de pose ou de retrait ne peut pas être dans le futur.';
    case 'outside_season':
      return `La date doit tomber dans la saison ${refusal.season}.`;
    case 'before_previous_removal':
      return `Ce matériel a été retiré le ${formatFarmMoment(refusal.previousRemovedAt)} : `
        + 'il ne peut pas être reposé avant.';
    case 'before_placement':
      return `Ce matériel a été posé le ${formatFarmMoment(refusal.placedAt)} : `
        + 'il ne peut pas être retiré avant.';
    case 'before_last_irrigation':
      return `Une irrigation sur ce matériel s’est terminée le ${formatFarmMoment(refusal.irrigationEndAt)} : `
        + 'il ne peut pas avoir été retiré avant.';
    case 'irrigation_in_progress':
      return 'Une irrigation est en cours sur ce matériel : arrêtez-la ou terminez-la avant de le retirer.';
    case 'already_stored':
      return 'Ce matériel est déjà stocké.';
    case 'already_posed':
      return 'Ce matériel est déjà posé : retirez-le ou déplacez-le.';
  }
}

/** Le message qui refuse de démarrer une irrigation planifiée sur un matériel retiré (règle 13). */
export function plannedStartBlockMessage(block: PlannedStartBlock): string {
  if (block.code === 'equipment_stored') {
    return `Matériel stocké depuis le ${formatFarmMoment(block.removedAt)} : `
      + 'reposez-le ou annulez cette irrigation.';
  }
  return 'Matériel reposé ailleurs : annulez cette irrigation et planifiez-en une nouvelle.';
}

/** Le message qui refuse une irrigation saisie après coup sur une période de stockage (règle 12). */
export function storedGapMessage(gap: StoredGap): string {
  const { removedAt, nextPlacedAt } = gap;
  const repose = nextPlacedAt === null ? 'pas reposé depuis' : `reposé le ${formatFarmMoment(nextPlacedAt)}`;
  if (removedAt !== null) return storedAtThatTime(`retiré le ${formatFarmMoment(removedAt)}, ${repose}`);
  if (nextPlacedAt !== null) return storedAtThatTime(`posé seulement le ${formatFarmMoment(nextPlacedAt)}`);
  return 'Ce matériel n’a jamais été posé cette saison : posez-le avant de saisir une irrigation.';
}

function storedAtThatTime(dates: string): string {
  return `Ce matériel était stocké à cette heure (${dates}) : `
    + 'corrigez l’heure de l’irrigation ou les dates de pose.';
}

function checkCommonDate(value: string, now: Date, season: number): PoseDateRefusal | null {
  if (!Number.isFinite(instant(value))) return { code: 'invalid_date' };
  if (instant(value) > now.getTime()) return { code: 'future', now: now.toISOString() };
  if (Number(dateKeyInTimeZone(new Date(value)).slice(0, 4)) !== season) {
    return { code: 'outside_season', season };
  }
  return null;
}

function anchorKey(anchor: EquipmentPlacementRecord['anchor']): string {
  return anchor.type === 'bed_center'
    ? `centre:${anchor.anchorBedOtfId}`
    : `entre:${anchor.beforeBedOtfId}:${anchor.afterBedOtfId}`;
}

function instant(value: string): number {
  return Date.parse(value);
}

/** « 28 octobre à 18 h 40 », à l'heure de la ferme. */
export function formatFarmMoment(value: string): string {
  return `${formatFarmDay(value)} à ${formatFarmTime(value)}`;
}

function formatFarmDay(value: string): string {
  return new Intl.DateTimeFormat('fr-FR', {
    day: 'numeric', month: 'long', timeZone: FARM_TIME_ZONE,
  }).format(new Date(value));
}

function formatFarmTime(value: string): string {
  const parts = Object.fromEntries(new Intl.DateTimeFormat('fr-FR', {
    hour: '2-digit', minute: '2-digit', hourCycle: 'h23', timeZone: FARM_TIME_ZONE,
  }).formatToParts(new Date(value)).map((part) => [part.type, part.value]));
  return `${Number(parts.hour)} h ${parts.minute}`;
}
