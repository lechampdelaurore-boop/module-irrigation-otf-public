import type { CorrespondenceEntry } from './species.ts';
import type { CropWaterDay, Et0Nature } from './etm.ts';
import type { BedWaterDay, WeekProposal } from './proposal.ts';
import { decimalText, fixedTwoText, mmText } from '../figure-origin.ts';
import type { KcSource, StageAnchor } from './reference.ts';

/**
 * Les libellés du besoin par culture et par stade, en français, pour l'écran
 * (docs/crop-water-need-contract.md, « L'écran ») : la source d'une culture
 * de référence, le début d'un stade, les mois d'un jeu de saison, le
 * rattachement d'une espèce. Des phrases, jamais des codes.
 */

const MONTHS_PER_YEAR = 12;
const MONTH_NAMES = [
  'janvier', 'février', 'mars', 'avril', 'mai', 'juin',
  'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre',
] as const;

export function kcSourceLabel(source: KcSource): string {
  if (source === 'criiam') return 'CRIIAM Sud';
  if (source === 'fao56') return 'FAO-56';
  return 'Saisie de la ferme';
}

/** Le début d'un stade, dit comme le contrat le dit : « 15 j après l'implantation », « à la mi-récolte ». */
export function stageAnchorLabel(anchor: StageAnchor): string {
  switch (anchor.from) {
    case 'implantation':
      return anchor.days === 0 ? 'dès l’implantation' : `${anchor.days} j après l’implantation`;
    case 'emergence':
      return anchor.days === 0 ? 'dès la levée' : `${anchor.days} j après la levée`;
    case 'before-harvest':
      return `${anchor.days} j avant la dernière récolte`;
    case 'first-harvest':
      return 'à la première récolte';
    case 'mid-harvest':
      return 'à la mi-récolte';
  }
}

/**
 * Les mois d'un jeu de saison, regroupés en suites : « toute l'année »,
 * « mars à août », « septembre à février » (une suite peut passer la fin de
 * l'année), « avril, juin ».
 */
export function monthsLabel(months: readonly number[]): string {
  const set = new Set(months.filter((month) => Number.isInteger(month) && month >= 1 && month <= MONTHS_PER_YEAR));
  if (set.size === 0) return 'aucun mois';
  if (set.size === MONTHS_PER_YEAR) return 'toute l’année';
  // On commence par un mois dont le précédent n'est pas dans la liste : une suite qui passe décembre reste entière.
  const start = [...set].sort((a, b) => a - b).find((month) => !set.has(previousMonth(month))) ?? 1;
  const runs: number[][] = [];
  for (let offset = 0; offset < MONTHS_PER_YEAR; offset += 1) {
    const month = ((start - 1 + offset) % MONTHS_PER_YEAR) + 1;
    if (!set.has(month)) continue;
    const last = runs.at(-1);
    if (last && last.at(-1) === previousMonth(month)) last.push(month);
    else runs.push([month]);
  }
  return runs.map((run) => {
    const first = MONTH_NAMES[run[0] - 1];
    if (run.length === 1) return first;
    const end = MONTH_NAMES[(run.at(-1) ?? run[0]) - 1];
    return run.length === 2 ? `${first}, ${end}` : `${first} à ${end}`;
  }).join(', ');
}

/** Ce à quoi une espèce est rattachée, en clair ; `cropName` nomme une culture de référence par sa clé. */
export function correspondenceTargetLabel(
  target: CorrespondenceEntry['target'] | null,
  cropName: (id: string) => string | null,
): string {
  if (target === null) return 'Non rattachée';
  if (target.kind === 'without-reference') return 'Sans référence Kc';
  if (target.kind === 'surface-state') return 'Engrais vert : état de la surface du sol';
  const name = cropName(target.referenceCropId) ?? `culture inconnue (${target.referenceCropId})`;
  return target.analogy ? `${name}, par analogie` : name;
}

/** Pourquoi une culture n'a pas d'ETM, en clair. */
export function noEtmReasonLabel(reason: Extract<CropWaterDay, { status: 'no-etm' }>['reason']): string {
  if (reason === 'missing-correspondence') return 'espèce non rattachée à une culture de référence';
  if (reason === 'without-reference') return 'espèce sans référence Kc';
  return 'hors de son calendrier';
}

/** La nature d'une ET0, jamais confondue avec une autre (D-006). */
export function et0NatureLabel(nature: Et0Nature): string {
  if (nature === 'reanalysis') return 'réanalyse';
  if (nature === 'estimated') return 'prévision reprise pour un jour passé';
  return 'prévision';
}

/** L'état de la proposition de la semaine, en une phrase. */
export function proposalStatusLabel(status: WeekProposal['status']): string {
  if (status === 'complete') return 'Complète : chaque jour est connu.';
  if (status === 'partial') return 'Partielle : un jour ou une culture manque, elle ne s’adopte pas.';
  if (status === 'no-crop') return 'Aucune culture à Kc cette semaine : rien à proposer.';
  return 'Indisponible : aucun jour n’a d’ETM, l’objectif saisi reste seul.';
}

function previousMonth(month: number): number {
  return month === 1 ? MONTHS_PER_YEAR : month - 1;
}

/**
 * La bulle « d'où vient ce chiffre » de l'ETM du jour d'une planche (3.8,
 * docs/feature-selection-contract.md, section 6) : l'ET0, le Kc et les
 * facteurs que le calcul a gardés pour chaque culture, et la plus forte.
 */
export function bedEtmOrigin(day: Pick<BedWaterDay, 'etmMm' | 'status' | 'crops'>): string | null {
  if (day.etmMm === null) return null;
  if (day.status === 'no-crop') return 'Aucune culture à Kc sur la planche aujourd’hui : elle compte 0 mm.';
  const lines = day.crops.flatMap((crop) => {
    if (crop.status !== 'computed') return [];
    const { trace } = crop;
    const factors = [
      trace.shelterFactor === 1 ? null : `K_abri ${decimalText(trace.shelterFactor)}`,
      trace.mulchFactor === 1 ? null : `paillage ${decimalText(trace.mulchFactor)}`,
      trace.shadeFactor === 1 ? null : `ombrage ${decimalText(trace.shadeFactor)}`,
    ].filter((item): item is string => item !== null);
    return [`${crop.plantName} : ET0 ${mmText(crop.et0.mm)} × Kc ${fixedTwoText(trace.kc.kc)}${factors.map((item) => ` × ${item}`).join('')} = ${mmText(crop.etmMm)}`];
  });
  const head = lines.length > 1 ? `ETM de la planche ${mmText(day.etmMm)} : la plus forte de ses cultures.` : `ETM de la planche ${mmText(day.etmMm)} : celle de sa culture.`;
  const partial = day.status === 'partial' ? ' Les cultures sans ETM ne comptent pas.' : '';
  return `${head} ${lines.join(' ; ')}.${partial}`;
}

const NATURE_TERMS: Record<Et0Nature, string> = { reanalysis: 'de réanalyse', estimated: 'estimés', forecast: 'prévus' };

/** La bulle de l'objectif proposé d'une semaine : la somme des ETM du jour, par nature d'ET0. */
export function proposedObjectiveOrigin(week: Pick<WeekProposal, 'proposedMm' | 'byNature' | 'missingDays'>): string | null {
  if (week.proposedMm === null) return null;
  const terms = (['reanalysis', 'estimated', 'forecast'] as const)
    .filter((nature) => week.byNature[nature] > 0)
    .map((nature) => `${mmText(week.byNature[nature])} ${NATURE_TERMS[nature]}`);
  const sum = terms.length > 1 ? `${terms.join(' + ')} = ${mmText(week.proposedMm)}` : mmText(week.proposedMm);
  const missing = week.missingDays.length === 0 ? '' : ` ${week.missingDays.length} jour${week.missingDays.length > 1 ? 's' : ''} sans ET0, non compté${week.missingDays.length > 1 ? 's' : ''}.`;
  return `La somme des ETM de la planche, du lundi au dimanche : ${sum}.${missing}`;
}
