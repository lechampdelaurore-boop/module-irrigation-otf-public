import { isValidDateKey } from '../water-management.ts';
import type { CropWaterDay, Et0Nature } from './etm.ts';
import type { KcOverride } from './kc.ts';
import type { BedWaterDay } from './proposal.ts';
import { curveStages, kcBoundsProblem, referenceCropProblems, type KcCurve, type KcSource, type ReferenceCrop } from './reference.ts';
import type { CorrespondenceEntry } from './species.ts';
import type { StageDeclaration } from './stage.ts';

/**
 * Ce que la persistance enregistre du besoin par culture et par stade
 * (docs/crop-water-need-contract.md, « Les données », PR 2) : ce qui empêche
 * d'enregistrer une saisie de la ferme, et la ligne d'ETM d'un jour de
 * planche. Les dépôts de `db/` appellent ces règles ; ils n'en ajoutent pas.
 */

/** Ce qu'une ferme change dans une culture commune : tout sauf la source, la forme et les Kc. */
const COMMON_KC_MESSAGE = "les Kc d'une culture commune se changent par une surcharge datée, jamais dans sa table";

/**
 * Ce qui empêche d'enregistrer la version d'une ferme d'une culture de
 * référence. Version d'une culture commune (`common` donné) : ses dates, ses
 * jeux de saison, ses délais de levée, son calendrier et son coefficient
 * d'abattement changent ; sa source, sa forme et ses Kc restent ceux de la
 * table commune, la valeur d'origine restant lisible (« Le jeu de référence
 * est une donnée »). Culture saisie par la ferme : sa source est la saisie
 * locale.
 */
export function farmReferenceCropProblems(crop: ReferenceCrop, common: ReferenceCrop | null): string[] {
  const problems = referenceCropProblems(crop);
  if (common === null) {
    if (crop.source !== 'local') problems.push(`${crop.name} : une culture saisie par la ferme est de source « saisie locale ».`);
    return problems;
  }
  if (crop.source !== common.source || crop.curve.shape !== common.curve.shape || kcSignature(crop.curve) !== kcSignature(common.curve)) {
    problems.push(`${crop.name} : ${COMMON_KC_MESSAGE}.`);
  }
  return problems;
}

/** Ce qui empêche d'enregistrer une surcharge de Kc : une culture inconnue, un stade absent, un Kc hors bornes, un jour invalide. */
export function kcOverrideProblem(crop: ReferenceCrop | undefined, override: Omit<KcOverride, 'recordedAt'>): string | null {
  if (crop === undefined) return `Culture de référence inconnue : ${override.referenceCropId}.`;
  if (!isValidDateKey(override.effectiveFrom)) return `Jour de la surcharge invalide : ${override.effectiveFrom}.`;
  const trapezoid = crop.curve.shape === 'trapezoid';
  if (trapezoid !== ('fao' in override.target)) {
    return trapezoid
      ? `${crop.name} : une culture de la FAO se surcharge par ses Kc de début, de pleine saison et de fin.`
      : `${crop.name} : une surcharge porte sur un stade.`;
  }
  if ('rank' in override.target) {
    const rank = override.target.rank;
    if (!curveStages(crop.curve).some((stage) => stage.rank === rank)) return `${crop.name} : le stade ${rank} n'existe pas.`;
  }
  return override.kc === null ? null : kcBoundsProblem(override.kc, crop.name);
}

/** Ce qui empêche d'enregistrer un stade déclaré : une culture inconnue, un stade absent de sa table, un jour invalide. */
export function stageDeclarationProblem(
  crop: ReferenceCrop | undefined,
  declaration: Pick<StageDeclaration, 'referenceCropId' | 'rank' | 'date'>,
): string | null {
  if (crop === undefined) return `Culture de référence inconnue : ${declaration.referenceCropId}.`;
  if (!isValidDateKey(declaration.date)) return `Jour du stade invalide : ${declaration.date}.`;
  if (!curveStages(crop.curve).some((stage) => stage.rank === declaration.rank)) {
    return `${crop.name} : le stade ${declaration.rank} n'existe pas.`;
  }
  return null;
}

/** Une espèce ne se rattache qu'à une culture de référence connue de la ferme. */
export function correspondenceProblem(entry: CorrespondenceEntry, crops: readonly ReferenceCrop[]): string | null {
  const target = entry.target;
  if (target.kind !== 'reference' || crops.some((crop) => crop.id === target.referenceCropId)) return null;
  return `Culture de référence inconnue : ${target.referenceCropId}.`;
}

/** Ce qui a produit l'ETM retenue pour la planche : la culture qui a le plus soif, ou celle dont l'ET0 manque. */
export type EtmDayTrace = {
  seriesId: string;
  cultivationId: string;
  plantId: string;
  referenceCropId: string;
  source: KcSource;
  stageRank: number;
  stageOrigin: 'calculated' | 'observed';
  kc: number;
  referenceKc: number;
  kcOverridden: boolean;
  abatement: number;
  kcSmoothed: boolean;
  shelterFactor: number;
  mulchFactor: number;
  shadeFactor: number;
  shadeNetRate: number | null;
};

/** La ligne d'ETM d'un jour de planche (« La traçabilité ») ; un jour bloqué n'en a pas. */
export type EtmDayRecord = {
  bedId: string;
  date: string;
  status: Exclude<BedWaterDay['status'], 'blocked'>;
  etmMm: number | null;
  et0Mm: number | null;
  et0Nature: Et0Nature | null;
  irrigationStop: boolean;
  trace: EtmDayTrace | null;
};

/**
 * La ligne à enregistrer pour un jour de planche. Un jour bloqué par une
 * valeur hors bornes n'en donne pas : la dernière valeur valide n'est pas
 * écrasée (« Les garde-fous »). La trace est celle de la culture retenue :
 * l'ETM la plus élevée, la première à égalité ; un jour inconnu garde celle
 * de la première culture dont l'ET0 manque.
 */
export function etmDayRecord(bedId: string, day: BedWaterDay): EtmDayRecord | null {
  if (day.status === 'blocked') return null;
  return {
    bedId,
    date: day.date,
    status: day.status,
    etmMm: day.etmMm,
    et0Mm: day.status === 'unknown' ? null : day.et0?.mm ?? null,
    et0Nature: day.status === 'unknown' ? null : day.et0?.nature ?? null,
    irrigationStop: day.irrigationStop,
    trace: retainedTrace(day),
  };
}

function retainedTrace(day: BedWaterDay): EtmDayTrace | null {
  let retained: Extract<CropWaterDay, { status: 'computed' | 'unknown' }> | null = null;
  for (const crop of day.crops) {
    if (crop.status === 'unknown') {
      if (day.status === 'unknown' && retained === null) retained = crop;
    } else if (crop.status === 'computed' && day.status !== 'unknown') {
      if (retained === null || (retained.status === 'computed' && crop.etmMm > retained.etmMm)) retained = crop;
    }
  }
  if (retained === null) return null;
  const { trace } = retained;
  return {
    seriesId: retained.seriesId,
    cultivationId: retained.cultivationId,
    plantId: retained.plantId,
    referenceCropId: trace.referenceCropId,
    source: trace.source,
    stageRank: trace.stage.rank,
    stageOrigin: trace.stage.origin,
    kc: trace.kc.kc,
    referenceKc: trace.kc.referenceKc,
    kcOverridden: trace.kc.overridden,
    abatement: trace.kc.abatement,
    kcSmoothed: trace.kc.smoothed,
    shelterFactor: trace.shelterFactor,
    mulchFactor: trace.mulchFactor,
    shadeFactor: trace.shadeFactor,
    shadeNetRate: trace.shadeNetRate,
  };
}

/** Les Kc d'une courbe, rang par rang ou point par point : ce qu'une version de ferme ne change pas. */
function kcSignature(curve: KcCurve): string {
  if (curve.shape === 'trapezoid') return JSON.stringify([curve.kcInitial, curve.kcMid, curve.kcEnd]);
  const stages = curve.shape === 'calendar' && curve.establishment ? [curve.establishment, ...curve.stages] : curve.stages;
  return JSON.stringify(stages.map((stage) => [stage.rank, stage.label, stage.kc]).sort((a, b) => Number(a[0]) - Number(b[0])));
}
