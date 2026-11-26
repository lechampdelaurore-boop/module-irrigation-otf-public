import { farmObjectiveText } from '../farm-objective.ts';
import { mmText } from '../figure-origin.ts';
import type { ReliabilityLine } from './reliability.ts';
import { countText } from './today-text.ts';
import type { TodayWaterBlock } from './water.ts';
import type { TodayTileLink, TodayWeek } from './week.ts';
import type { TodayWeatherDay } from './weather-days.ts';

/**
 * La page « Aujourd'hui » à l'essentiel (simplification, lot S2, PR 5,
 * docs/simplification-s2-contract.md, sections 8 et 9) : ce que le premier
 * niveau garde de chaque bloc, le reste allant dans un seul pli « Le
 * détail », fermé. Rien ne se calcule de nouveau : chaque fonction choisit
 * parmi ce que les blocs disent déjà, avec leurs mots ; aucun bloc ne
 * disparaît, il change seulement d'étage.
 */

/** Les millimètres de la barre, à la décimale, comme les tuiles. */
function mm(value: number): string {
  return mmText(Math.round(value * 10) / 10);
}

/** Ce que dit la barre « La semaine » au premier niveau. */
export type TodayWeekBar =
  | {
      kind: 'bar';
      /** « 23,4 mm visés, ferme entière : 12 mm reçus. Il manque encore 11 mm d’ici dimanche. » */
      sentence: string;
      /** L'origine de l'eau reçue, avec le mot de la pluie (« dont 2,4 mm de pluie prévue, non mesurée », F429). */
      detail: string | null;
      bars: TodayWeek['farm']['bars'];
      link: TodayTileLink;
    }
  | { kind: 'no-objective'; sentence: string; link: TodayTileLink };

export const NO_WEEK_OBJECTIVE = 'Aucun objectif posé pour cette semaine.';
/** Vers « Semaine » (lot S4, PR 4), à la ligne de la ferme d'« Eau de la semaine ». */
export const SEE_THE_WEEK = 'Voir la semaine';

/**
 * Une barre pour la ferme entière (section 8, point 5) : l'objectif dit par
 * la phrase unique de S1 (`farmObjectiveText`), l'eau reçue et ce qui
 * manque, jamais négatif ; une valeur inconnue se dit inconnue, jamais zéro
 * (D-003). Sans objectif : pas de barre, « Poser un objectif ».
 */
export function weekBar(week: TodayWeek): TodayWeekBar {
  const { farm } = week;
  if (farm.objectiveMm === null) return { kind: 'no-objective', sentence: NO_WEEK_OBJECTIVE, link: week.links.objective };
  const objective = farmObjectiveText({ objectiveMm: farm.objectiveMm, ...farm.objectiveBeds });
  const received = farm.receivedMm === null ? 'eau reçue inconnue' : `${mm(farm.receivedMm)} reçus`;
  const remaining = farm.remainingMm === null
    ? 'Ce qui manque est inconnu.'
    : farm.remainingMm > 0 ? `Il manque encore ${mm(farm.remainingMm)} d’ici dimanche.` : 'L’objectif de la semaine est atteint.';
  return {
    kind: 'bar',
    sentence: `${objective.charAt(0).toLocaleUpperCase('fr-FR')}${objective.slice(1)} : ${received}. ${remaining}`,
    detail: week.tiles.receivedDetail,
    bars: farm.bars,
    link: { label: SEE_THE_WEEK, page: 'semaine', anchor: farm.anchor },
  };
}

/**
 * L'ordre de la ligne « Calcul approximatif » (section 8, point 6) : la
 * pluie mesurée d'abord, puis l'objectif automatique, les espèces, le sol,
 * les réserves, le plan.
 */
const APPROXIMATE_ORDER: readonly ReliabilityLine['kind'][] = ['actual-rain', 'automatic-objective', 'species', 'soil', 'reservoir-volume', 'plan'];

export const APPROXIMATE_TITLE = 'Calcul approximatif';

export type TodayApproximate = {
  /** La première donnée qui manque, avec sa phrase et son geste existants. */
  line: ReliabilityLine;
  /** « + 2 autres », qui ouvre « Fiabilité du calcul » dans le pli ; `null` quand elle est seule. */
  othersLabel: string | null;
};

/** Une seule ligne quand des données manquent ; `null` sinon : jamais de « tout va bien » dessiné sans donnée. */
export function approximateLine(lines: readonly ReliabilityLine[]): TodayApproximate | null {
  const ordered = [...lines].sort((a, b) => APPROXIMATE_ORDER.indexOf(a.kind) - APPROXIMATE_ORDER.indexOf(b.kind));
  const first = ordered[0];
  if (!first) return null;
  const others = ordered.length - 1;
  return { line: first, othersLabel: others === 0 ? null : `+ ${countText(others, 'autre', 'autres')}` };
}

export type TodayWaterAlert = {
  /** La phrase du bloc « Eau disponible » de la première réserve ou ressource à regarder. */
  label: string;
  anchor: string;
  /** « + 1 autre », vers « Eau disponible » dans le pli ; `null` quand elle est seule. */
  othersLabel: string | null;
};

/**
 * La ligne d'eau du premier niveau (section 8, point 7, S2-h) : seulement
 * quand elle dit quelque chose. Une réserve sous son minimum de sécurité, un
 * relevé de plus de sept jours, sans date ou un volume jamais saisi (la cuve
 * grisée du bloc), une limite de prélèvement atteinte. Sinon, l'eau reste
 * dans le pli.
 */
export function waterAlert(block: TodayWaterBlock | null): TodayWaterAlert | null {
  if (!block) return null;
  const alerting = [
    ...block.reservoirs.filter((reservoir) => reservoir.belowMinimumText !== null || reservoir.stale),
    ...block.limits.filter((limit) => limit.remainingCubicMeters <= 0),
  ];
  const first = alerting[0];
  if (!first) return null;
  const others = alerting.length - 1;
  return { label: first.label, anchor: first.anchor, othersLabel: others === 0 ? null : `+ ${countText(others, 'autre', 'autres')}` };
}

export type TodayWeatherAlert = {
  /** Les jours en alerte, en carte, chacun avec le lien de son alerte. */
  days: TodayWeatherDay[];
  /** « Prévision indisponible : à vérifier. », la phrase du bloc ; `null` quand la prévision est là. */
  unavailable: string | null;
};

/**
 * « Gel ou chaleur » au premier niveau (section 8, point 4) : seulement un
 * jour en alerte, ou la prévision qui manque ; un jour calme reste dans le
 * pli, la phrase de l'en-tête le dit. Le gel annoncé sans alerte posée (J14)
 * se lit à part, avec son lien.
 */
export function weatherAlert(block: { tone: 'alert' | 'unknown' | 'calm'; lines: readonly string[]; days: readonly TodayWeatherDay[] } | null): TodayWeatherAlert | null {
  if (!block || block.tone === 'calm') return null;
  const days = block.days.filter((day) => day.tone === 'alert');
  const unavailable = block.lines.find((line) => line.startsWith('Prévision indisponible')) ?? null;
  if (days.length === 0 && unavailable === null) return null;
  return { days, unavailable };
}

/**
 * La ligne de résumé du pli « Le détail » : ce qu'il contient, compté
 * (« 4 chiffres · 3 jardins · 2 données à rafraîchir ») ; `null` quand le
 * pli n'a rien à montrer.
 */
export function detailSummary(input: {
  tiles: number;
  gardens: number;
  weatherDays: number;
  reservoirs: number;
  limits: number;
  toRefresh: number;
  reliability: boolean;
}): string | null {
  const parts = [
    input.tiles > 0 ? countText(input.tiles, 'chiffre', 'chiffres') : null,
    input.gardens > 0 ? countText(input.gardens, 'jardin', 'jardins') : null,
    input.weatherDays > 0 ? `${countText(input.weatherDays, 'jour', 'jours')} de météo` : null,
    input.reservoirs > 0 ? countText(input.reservoirs, 'réserve', 'réserves') : null,
    input.limits > 0 ? countText(input.limits, 'limite de prélèvement', 'limites de prélèvement') : null,
    input.toRefresh > 0
      ? countText(input.toRefresh, 'donnée à rafraîchir', 'données à rafraîchir')
      : input.reliability ? 'données à jour' : null,
  ].filter((part): part is string => part !== null);
  return parts.length === 0 ? null : parts.join(' · ');
}

export type TodayEssential = {
  /** `null` sans « La semaine » (« Objectifs et besoins » décochée, ou aucune planche de la saison). */
  week: TodayWeekBar | null;
  approximate: TodayApproximate | null;
  water: TodayWaterAlert | null;
  weather: TodayWeatherAlert | null;
  /** La ligne de résumé de « Le détail » ; `null` : pas de pli. */
  detail: string | null;
};
