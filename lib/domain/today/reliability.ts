import type { FeatureId } from '../features/catalogue.ts';
import type { IrrigationPageId } from '../features/pages.ts';
import type { FeatureSelection } from '../features/selection.ts';
import type { SoilGaugeZone } from '../soil-reserve/gauge-view.ts';
import { millisecondsFromHours } from '../units.ts';
import { addDaysToDateKey } from '../water-management.ts';
import { countText, dateWithYearText, daysBetween, farmDateKey, farmHourText, namesText, shortDayText, sortedNames } from './today-text.ts';

/**
 * La zone « Fiabilité du calcul » (audit ergonomique, point 3, 3.8 quater
 * lot 2, docs/audit-ergonomie-lot2-contract.md, section 6, précisions F5,
 * F8, F9) : une liste fermée de cinq données dont l'état dégrade le plan,
 * calculée ici et nulle part ailleurs. Pour chacune : si elle est à
 * rafraîchir, la phrase, la conséquence en clair et le geste qui la corrige.
 * Une donnée dont la case n'est pas cochée ne compte pas. Les seuils sont des
 * réglages d'affichage du module, non agronomiques : aucun ne touche le
 * moteur, et chacun est écrit dans le « ? » de la zone.
 */

/** Les cinq données, dans l'ordre de leur effet sur le plan (section 6, tableau). */
export const RELIABILITY_KINDS = ['reservoir-volume', 'actual-rain', 'soil', 'species', 'plan'] as const;
type ReliabilityKind = (typeof RELIABILITY_KINDS)[number];

/** La case dont chaque donnée dépend : décochée, la donnée ne compte pas (F3, F5). */
const RELIABILITY_FEATURE: Record<ReliabilityKind, FeatureId> = {
  'reservoir-volume': 'ressources',
  'actual-rain': 'besoins',
  soil: 'sol',
  species: 'cultures',
  plan: 'planning',
};

/** F8 : le volume d'une réserve est à rafraîchir après plus de sept jours. */
export const RESERVOIR_VOLUME_MAX_AGE_DAYS = 7;
/** F8 : la pluie réelle se regarde sur les sept derniers jours, aujourd'hui exclu. */
const ACTUAL_RAIN_LOOKBACK_DAYS = 7;
/** F8 : le plan est à recalculer après quarante-huit heures. */
const PLAN_MAX_AGE_HOURS = 48;
/** Les lignes affichées d'emblée ; les autres derrière « Voir les n autres ». */
const RELIABILITY_LINES_SHOWN = 5;

/** Le geste qui corrige une donnée : un lien vers son formulaire, ou l'action existante « Recalculer le plan ». */
type ReliabilityAction =
  | { kind: 'link'; label: string; page: IrrigationPageId; anchor: string | null }
  | { kind: 'recalculate-plan'; label: string };

export type ReliabilityLine = {
  kind: ReliabilityKind;
  /** Unique dans la zone : la donnée et, pour une réserve, laquelle. */
  key: string;
  text: string;
  action: ReliabilityAction;
};

/** Une réserve ou une cuve active de la ferme, avec la date de sa dernière observation du volume. */
type ReliabilityReservoir = { id: string; name: string; observedAt: string | null };

/** Un jardin ou un abri dont la jauge du sol est inconnue faute d'avoir jamais été observée. */
export type ReliabilitySoilGarden = { plotId: string; name: string };

/**
 * F25 : les jardins et abris de la jauge du sol qui n'ont jamais été
 * observés — ni eux, ni leur parcelle pour un jardin de plein champ — et dont
 * aucune planche n'est connue. Un jardin observé ne compte pas, même inconnu
 * depuis un jour de pluie manquante : la ligne de la pluie le dit déjà.
 */
export function neverObservedSoilGardens(zones: readonly Pick<SoilGaugeZone, 'plots'>[]): ReliabilitySoilGarden[] {
  return zones.flatMap((zone) => zone.plots
    .filter((plot) => plot.observation === null && plot.garden.percent === null && plot.garden.unknownBeds > 0)
    .map((plot) => ({ plotId: plot.plotId, name: plot.name })));
}

export type ReliabilityInputs = {
  enabled: FeatureSelection;
  now: Date;
  /** Les réserves et cuves actives (Ressources et pompes). */
  reservoirs: readonly ReliabilityReservoir[];
  /**
   * Les jours des sept derniers où la pluie réelle (saisie ou réanalyse)
   * manque ; `null` quand la pluie ne compte pour aucune planche (une ferme
   * tout sous abri) : rien à rafraîchir.
   */
  actualRainMissingDates: readonly string[] | null;
  /** Les jardins dont le sol n'a jamais été observé et dont la jauge est inconnue. */
  soilGardensNeverObserved: readonly ReliabilitySoilGarden[];
  /** Les espèces plantées de la saison qui n'ont aucun rattachement à une culture de référence. */
  speciesWithoutReference: readonly string[];
  /** Le dernier calcul du plan de la semaine ; `null` : aucun. */
  planComputedAt: string | null;
};

/** Les sept jours regardés pour la pluie réelle : de J−7 à J−1. */
export function actualRainLookbackDates(today: string): string[] {
  return Array.from({ length: ACTUAL_RAIN_LOOKBACK_DAYS }, (_, index) => addDaysToDateKey(today, index - ACTUAL_RAIN_LOOKBACK_DAYS));
}

/** L'ancre de la réserve sur la page « Ressources et pompes » : sa carte porte « Corriger le volume ». */
export function reservoirAnchor(reservoirId: string): string {
  return `reservoir-${reservoirId}`;
}

/** L'ancre du jardin sur la page « Réserve du sol » : sa jauge porte « Observer le jardin ». */
export function soilGardenAnchor(plotId: string): string {
  return `soil-garden-${plotId}`;
}

/**
 * La conséquence d'une pluie réelle manquante, dans les mêmes mots partout
 * (F9) : la zone et l'avertissement du tableau des besoins la disent.
 */
export const ACTUAL_RAIN_CONSEQUENCE = 'Sans elle, le besoin est surévalué.';

/** Le bloc « Pluie mesurée » de « Objectifs et besoins », celui que l'historique ouvre déjà (lot 1, point 11). */
const MEASURED_RAIN_ANCHOR = 'manual-rain';
/** La correspondance des espèces, dans Réglages. */
const SPECIES_CORRESPONDENCE_ANCHOR = 'species-correspondence-title';

/** Les lignes de la zone, dans l'ordre du tableau ; vide quand tout est à jour. */
export function reliabilityLines(input: ReliabilityInputs): ReliabilityLine[] {
  const today = farmDateKey(input.now);
  const on = (kind: ReliabilityKind) => input.enabled.includes(RELIABILITY_FEATURE[kind]);
  const lines: ReliabilityLine[] = [];
  if (on('reservoir-volume')) {
    const reservoirs = [...input.reservoirs].sort((a, b) => a.name.localeCompare(b.name, 'fr', { numeric: true }));
    for (const reservoir of reservoirs) {
      const line = reservoirLine(reservoir, today);
      if (line) lines.push(line);
    }
  }
  if (on('actual-rain') && input.actualRainMissingDates && input.actualRainMissingDates.length > 0) {
    const missing = new Set(input.actualRainMissingDates).size;
    lines.push({
      kind: 'actual-rain',
      key: 'actual-rain',
      text: `Pluie réelle incomplète : ${countText(missing, 'jour manquant', 'jours manquants')}. ${ACTUAL_RAIN_CONSEQUENCE}`,
      action: { kind: 'link', label: 'Noter la pluie de la semaine', page: 'besoins', anchor: MEASURED_RAIN_ANCHOR },
    });
  }
  if (on('soil') && input.soilGardensNeverObserved.length > 0) {
    const gardens = [...input.soilGardensNeverObserved].sort((a, b) => a.name.localeCompare(b.name, 'fr', { numeric: true }));
    const first = gardens[0];
    const text = gardens.length === 1
      ? `Le sol du jardin ${first.name} n’a jamais été observé.`
      : `Le sol de ${gardens.length} jardins n’a jamais été observé : ${namesText(gardens.map((garden) => garden.name))}.`;
    lines.push({
      kind: 'soil',
      key: 'soil',
      text,
      action: { kind: 'link', label: `Observer le sol de ${first.name}`, page: 'sol', anchor: soilGardenAnchor(first.plotId) },
    });
  }
  if (on('species') && input.speciesWithoutReference.length > 0) {
    const count = sortedNames(input.speciesWithoutReference).length;
    lines.push({
      kind: 'species',
      key: 'species',
      text: count === 1
        ? '1 espèce sans référence : son besoin n’est pas calculé, seul l’objectif compte.'
        : `${count} espèces sans référence : leur besoin n’est pas calculé, seul l’objectif compte.`,
      action: { kind: 'link', label: 'Rattacher les espèces', page: 'reglages', anchor: SPECIES_CORRESPONDENCE_ANCHOR },
    });
  }
  if (on('plan')) {
    const line = planLine(input.planComputedAt, input.now);
    if (line) lines.push(line);
  }
  return lines;
}

function reservoirLine(reservoir: ReliabilityReservoir, today: string): ReliabilityLine | null {
  const consequence = 'Le plan s’en sert pour ne pas tirer plus qu’il n’y a.';
  const action: ReliabilityAction = { kind: 'link', label: `Saisir le volume de ${reservoir.name}`, page: 'ressources', anchor: reservoirAnchor(reservoir.id) };
  const key = `reservoir-volume:${reservoir.id}`;
  if (reservoir.observedAt === null) {
    return { kind: 'reservoir-volume', key, text: `Le volume de ${reservoir.name} n’a jamais été saisi. ${consequence}`, action };
  }
  const observedOn = farmDateKey(reservoir.observedAt);
  const age = daysBetween(observedOn, today);
  if (age <= RESERVOIR_VOLUME_MAX_AGE_DAYS) return null;
  return {
    kind: 'reservoir-volume',
    key,
    text: `Le volume de ${reservoir.name} date du ${dateWithYearText(observedOn)} (${countText(age, 'jour', 'jours')}). ${consequence}`,
    action,
  };
}

function planLine(computedAt: string | null, now: Date): ReliabilityLine | null {
  const action: ReliabilityAction = { kind: 'recalculate-plan', label: 'Recalculer le plan' };
  if (computedAt === null) {
    return { kind: 'plan', key: 'plan', text: 'Le plan de la semaine n’a pas été calculé.', action };
  }
  if (now.getTime() - Date.parse(computedAt) <= millisecondsFromHours(PLAN_MAX_AGE_HOURS)) return null;
  return {
    kind: 'plan',
    key: 'plan',
    text: `Le plan n’a pas été recalculé depuis le ${shortDayText(farmDateKey(computedAt))} à ${farmHourText(computedAt)}.`,
    action,
  };
}

/** Le nom court de chaque donnée, en tête de sa ligne dans l'anneau du tableau de bord. */
const CHECK_LABELS: Record<ReliabilityKind, string> = {
  'reservoir-volume': 'Volume des réserves',
  'actual-rain': 'Pluie mesurée',
  soil: 'Réserve du sol',
  species: 'Espèces',
  plan: 'Plan de la semaine',
};

export type ReliabilityCheck = {
  kind: ReliabilityKind;
  label: string;
  /** À jour : la donnée n'a aucune ligne à rafraîchir. */
  ok: boolean;
  /** « Notée les 7 derniers jours », « 2 jours manquants : le besoin est surévalué ». */
  summary: string;
  /** Les lignes de la donnée, chacune avec sa phrase et son geste ; vide quand elle est à jour. */
  lines: ReliabilityLine[];
};

function okSummary(kind: ReliabilityKind, input: ReliabilityInputs): string {
  switch (kind) {
    case 'reservoir-volume':
      return input.reservoirs.length === 0 ? 'Aucune réserve à relever' : `Relevé de moins de ${RESERVOIR_VOLUME_MAX_AGE_DAYS} jours`;
    case 'actual-rain':
      return input.actualRainMissingDates === null ? 'Tout est sous abri : pas de pluie à noter' : `Notée les ${ACTUAL_RAIN_LOOKBACK_DAYS} derniers jours`;
    case 'soil': return 'Tous les jardins ont été observés';
    case 'species': return 'Toutes ont une culture de référence';
    case 'plan': return `Calculé il y a moins de ${PLAN_MAX_AGE_HOURS} heures`;
  }
}

function todoSummary(kind: ReliabilityKind, input: ReliabilityInputs, lines: readonly ReliabilityLine[]): string {
  switch (kind) {
    case 'reservoir-volume': return countText(lines.length, 'réserve à relever', 'réserves à relever');
    case 'actual-rain': {
      const missing = new Set(input.actualRainMissingDates ?? []).size;
      return `${countText(missing, 'jour manquant', 'jours manquants')} : le besoin est surévalué`;
    }
    case 'soil': return countText(input.soilGardensNeverObserved.length, 'jardin jamais observé', 'jardins jamais observés');
    case 'species': return countText(sortedNames(input.speciesWithoutReference).length, 'espèce sans référence', 'espèces sans référence');
    case 'plan': return input.planComputedAt === null
      ? 'Jamais calculé'
      : `Calculé le ${shortDayText(farmDateKey(input.planComputedAt))} à ${farmHourText(input.planComputedAt)}`;
  }
}

/**
 * L'anneau de « Fiabilité du calcul » (docs/aujourdhui-tableau-de-bord-contract.md,
 * section 3.2, précision T6) : une ligne par donnée suivie — sa case cochée —,
 * à jour ou à rafraîchir, avec les lignes de `reliabilityLines` qui la
 * concernent. Aucune règle de plus : une donnée est à jour quand elle n'a
 * aucune ligne.
 */
export function reliabilityChecks(input: ReliabilityInputs, lines: readonly ReliabilityLine[]): ReliabilityCheck[] {
  return RELIABILITY_KINDS
    .filter((kind) => input.enabled.includes(RELIABILITY_FEATURE[kind]))
    .map((kind) => {
      const own = lines.filter((line) => line.kind === kind);
      return { kind, label: CHECK_LABELS[kind], ok: own.length === 0, summary: own.length === 0 ? okSummary(kind, input) : todoSummary(kind, input, own), lines: own };
    });
}

export type ReliabilityZone = {
  /** Les lignes montrées d'emblée, cinq au plus. */
  shown: ReliabilityLine[];
  /** Les autres, derrière `moreLabel`. */
  hidden: ReliabilityLine[];
  /** « Voir l’autre », « Voir les 2 autres » ; `null` quand tout est montré. */
  moreLabel: string | null;
  /** La phrase calme quand rien n'est à rafraîchir ; `null` sinon. */
  allClear: string | null;
};

export const RELIABILITY_ALL_CLEAR = 'Rien à rafraîchir : le plan s’appuie sur des données récentes.';

export function reliabilityZone(lines: readonly ReliabilityLine[]): ReliabilityZone {
  const hidden = lines.slice(RELIABILITY_LINES_SHOWN);
  return {
    shown: lines.slice(0, RELIABILITY_LINES_SHOWN),
    hidden,
    moreLabel: hidden.length === 0 ? null : hidden.length === 1 ? 'Voir l’autre' : `Voir les ${hidden.length} autres`,
    allClear: lines.length === 0 ? RELIABILITY_ALL_CLEAR : null,
  };
}

/** La zone existe quand au moins une de ses cinq données est suivie (section 5, bloc e). */
export function hasReliabilityZone(enabled: FeatureSelection): boolean {
  return RELIABILITY_KINDS.some((kind) => enabled.includes(RELIABILITY_FEATURE[kind]));
}

/** Le « ? » de la zone écrit chaque seuil : aucun n'est caché (section 6). */
export function reliabilityThresholdsText(): string {
  return `Une donnée est à rafraîchir quand le volume d’une réserve date de plus de ${RESERVOIR_VOLUME_MAX_AGE_DAYS} jours, `
    + `quand la pluie réelle manque un des ${ACTUAL_RAIN_LOOKBACK_DAYS} derniers jours, quand le sol d’un jardin n’a jamais été observé, `
    + `quand une espèce plantée n’est rattachée à aucune culture de référence, ou quand le plan date de plus de ${PLAN_MAX_AGE_HOURS} heures. `
    + 'Ces seuils servent à l’affichage : ils ne changent aucun calcul.';
}
