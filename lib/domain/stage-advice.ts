import { compareNamesNaturally } from './bed-order.ts';
import type { BedWaterDay } from './crop-water/proposal.ts';
import { sensitiveStageKey } from './crop-water/sensitive-stages.ts';
import type { AllocationStatus, IrrigationFeasibility } from './irrigation-feasibility.ts';
import type { BedIrrigationNeed, IrrigationNeedPriority } from './irrigation-needs.ts';
import { guessedStages } from './today/missing-by-bed.ts';

/**
 * La priorité conseillée selon le stade sensible (amélioration n° 4,
 * docs/ameliorations-4-5-contract.md, §3.2 et §3.3, F731 et F732) : en
 * pénurie, les planches qu'il vaut mieux servir d'abord parce qu'une de
 * leurs cultures est à un stade sensible au manque d'eau.
 *
 * Un conseil se calcule **après** la répartition (3.4), qu'il lit sans la
 * changer ; il n'entre dans aucun terme du besoin, de la répartition ni du
 * planning, et rien ne change sans le geste « Adopter » du maraîcher.
 */

/** Ce que la répartition ne sert pas en entier, quand une alimentation compatible existe (F731). */
const NOT_FULLY_SERVED: ReadonlySet<AllocationStatus> = new Set([
  'partial', 'unsatisfied', 'not_selected', 'arbitration_required', 'waiting_priority', 'below_threshold',
]);

/** Une culture de la planche à un stade sensible, ce jour-là. */
export type StageAdviceCrop = {
  seriesId: string;
  seriesName: string;
  plantName: string;
  stageLabel: string;
  /** Le stade vient du calendrier, aucune déclaration ne le place : « stade d'après le calendrier » (F711). */
  fromCalendar: boolean;
};

export type StageAdviceBed = {
  bedId: string;
  bedName: string;
  plotName: string;
  /** La priorité de la semaine, jamais « haute » : une planche déjà haute n'a rien à adopter. */
  priority: Exclude<IrrigationNeedPriority, 'high'>;
  /** Le déficit relatif du besoin de la semaine (3.3) ; `null` quand il n'est pas connu. */
  relativeDeficitPercent: number | null;
  /** Pourquoi le déficit relatif n'est pas connu (« Non calculable » se lit avec sa raison, F316) ; `null` quand il l'est. */
  deficitUnknownReason: string | null;
  crops: StageAdviceCrop[];
};

export type StageAdviceGroup = {
  referenceCropId: string;
  referenceCropName: string;
  beds: StageAdviceBed[];
};

export type StageAdvice = {
  groups: StageAdviceGroup[];
  /** Les planches conseillées, chacune une fois, même quand elle paraît dans deux groupes. */
  bedIds: string[];
};

/**
 * Ce que l'écran de répartition montre du conseil (F732) : les conseils, en
 * pénurie, quand au moins une planche est conseillée, avec la phrase du
 * planning à parts égales s'il y a lieu ; ou, en pénurie, la ligne qui dit
 * que la case « Besoin par culture » manque. Rien hors pénurie.
 */
export type StageAdviceScreen =
  | { kind: 'advice'; advice: StageAdvice; equalSharePlanning: boolean }
  | { kind: 'missing-part'; notice: string };

type ShortageReading = Pick<IrrigationFeasibility, 'forecastAvailableCubicMeters' | 'priorities'>;

/**
 * La répartition est en pénurie : l'eau disponible est connue (aucune
 * ressource sans prévision) et au moins un niveau de priorité ne peut pas
 * être servi en entier. Une eau inconnue n'est pas une pénurie (D-003).
 */
export function feasibilityInShortage(feasibility: ShortageReading): boolean {
  return feasibility.forecastAvailableCubicMeters !== null && feasibility.priorities.some((level) => level.shortage);
}

/**
 * Les conseils de la semaine, regroupés par culture de référence ; `null`
 * hors pénurie. Dans un groupe, les planches par déficit relatif
 * décroissant (inconnu en dernier, puis l'ordre naturel des noms) ; les
 * groupes par le plus fort déficit de leurs planches.
 */
export function stageAdvice(input: {
  feasibility: ShortageReading;
  /** Les cultures de chaque planche, jour par jour (5 quater) ; le jour `today` sert. */
  days: readonly { bedId: string; days: readonly BedWaterDay[] }[];
  today: string;
  /** Les stades sensibles en vigueur (`sensitiveStageKeys`). */
  sensitive: ReadonlySet<string>;
}): StageAdvice | null {
  if (!feasibilityInShortage(input.feasibility)) return null;
  const daysByBed = new Map(input.days.map((bed) => [bed.bedId, bed.days.find((day) => day.date === input.today)]));
  const calendar = new Set(guessedStages(input.days, input.today).map((stage) => JSON.stringify([stage.bedId, stage.seriesId, stage.stageLabel])));
  const groups = new Map<string, StageAdviceGroup>();
  for (const row of input.feasibility.priorities.flatMap((level) => level.beds)) {
    const need = row.need;
    if (need.priority === 'high' || !NOT_FULLY_SERVED.has(row.status) || row.hydraulicQuality === 'incompatible') continue;
    for (const crop of daysByBed.get(need.bedId)?.crops ?? []) {
      // Un stade inconnu ne donne aucun conseil (réponse 4) : seules comptent les cultures dont le stade et le Kc sont connus.
      if (crop.status !== 'computed' && crop.status !== 'unknown') continue;
      const { referenceCropId, referenceCropName, stage } = crop.trace;
      if (!input.sensitive.has(sensitiveStageKey(referenceCropId, stage.rank, stage.label))) continue;
      const group = groups.get(referenceCropId) ?? { referenceCropId, referenceCropName, beds: [] };
      groups.set(referenceCropId, group);
      let bed = group.beds.find((candidate) => candidate.bedId === need.bedId);
      if (!bed) {
        bed = {
          bedId: need.bedId, bedName: need.bedName, plotName: need.plotName, priority: need.priority,
          relativeDeficitPercent: need.relativeDeficitPercent, deficitUnknownReason: deficitUnknownReason(need), crops: [],
        };
        group.beds.push(bed);
      }
      if (bed.crops.some((known) => known.seriesId === crop.seriesId && known.stageLabel === stage.label)) continue;
      bed.crops.push({
        seriesId: crop.seriesId,
        seriesName: crop.seriesName,
        plantName: crop.plantName,
        stageLabel: stage.label,
        fromCalendar: calendar.has(JSON.stringify([need.bedId, crop.seriesId, stage.label])),
      });
    }
  }
  const sorted = [...groups.values()].map((group) => ({ ...group, beds: [...group.beds].sort(byDeficitThenName) }));
  sorted.sort((left, right) => compareDeficits(left.beds[0]?.relativeDeficitPercent ?? null, right.beds[0]?.relativeDeficitPercent ?? null)
    || compareNamesNaturally(left.referenceCropName, right.referenceCropName));
  return { groups: sorted, bedIds: [...new Set(sorted.flatMap((group) => group.beds.map((bed) => bed.bedId)))] };
}

/**
 * Le déficit relatif n'est inconnu que faute d'objectif adopté : une pluie
 * inconnue est remplacée et listée (D-019), le besoin réel reste calculable.
 */
function deficitUnknownReason(need: Pick<BedIrrigationNeed, 'relativeDeficitPercent' | 'objectiveMm'>): string | null {
  if (need.relativeDeficitPercent !== null) return null;
  return need.objectiveMm === null ? 'aucun objectif adopté' : 'besoin réel inconnu';
}

/** Le plus fort déficit d'abord ; un déficit inconnu après tous les déficits connus. */
function compareDeficits(left: number | null, right: number | null): number {
  if (left === right) return 0;
  if (left === null) return 1;
  if (right === null) return -1;
  return right - left;
}

function byDeficitThenName(left: StageAdviceBed, right: StageAdviceBed): number {
  return compareDeficits(left.relativeDeficitPercent, right.relativeDeficitPercent)
    || compareNamesNaturally(left.bedName, right.bedName)
    || compareNamesNaturally(left.plotName, right.plotName);
}
