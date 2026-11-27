import { joinLabels } from '../features/choice.ts';
import type { FeatureId } from '../features/catalogue.ts';
import type { IrrigationPageId } from '../features/pages.ts';
import type { FeatureSelection } from '../features/selection.ts';
import type { RouteState, StartMode } from '../features/start-mode.ts';
import { farmObjectiveScopeText } from '../farm-objective.ts';
import { soilParcelsText } from './steps.ts';

/**
 * La mise en route d'une ferme (simplification, lot S6,
 * docs/simplification-s6-contract.md, section 5 ; D-336) : jusqu'à cinq
 * étapes pour décrire la ferme, dans cet ordre. Une étape **existe quand sa
 * case est cochée** (une case décochée retire sa page, donc sa fiche, donc
 * son étape). C'est le seul endroit qui le sait : l'écran de la première
 * ouverture compte ses étapes ici (section 3.3), la carte « Mise en route »
 * de « Ma ferme » les montre d'ici (section 5.2) ; un test échoue si les
 * deux divergent.
 */

type RouteStepId = 'equipment' | 'placement' | 'water' | 'objective' | 'soil';

export type RouteStepDefinition = {
  id: RouteStepId;
  /** Le nom de l'étape sur la carte. */
  label: string;
  /** Son nom dans la phrase d'« Aujourd'hui » (section 8) : « Combien vous visez par semaine : … ». */
  yourLabel: string;
  /** La case qui la fait exister. */
  feature: FeatureId;
  /** Ce qu'elle décrit, dans la phrase de la première ouverture (« le matériel, où il est posé… »). */
  inSentence: string;
  /** Ce qu'elle débloque, dit pour l'étape en cours seulement (section 5.1). */
  unlocks: string;
};

const ROUTE_STEPS: readonly RouteStepDefinition[] = [
  {
    id: 'equipment', label: 'Mon matériel', yourLabel: 'Votre matériel', feature: 'materiel', inSentence: 'le matériel',
    unlocks: 'Après cette étape, vous pouvez noter un arrosage.',
  },
  {
    id: 'placement', label: 'Où il est posé', yourLabel: 'Où il est posé', feature: 'materiel', inSentence: 'où il est posé',
    unlocks: 'Après cette étape, le module sait quelles planches vous arrosez.',
  },
  {
    id: 'water', label: 'D’où vient l’eau', yourLabel: 'D’où vient l’eau', feature: 'ressources', inSentence: 'd’où vient l’eau',
    unlocks: 'Après cette étape, le module vérifie qu’il y a assez d’eau.',
  },
  {
    id: 'objective', label: 'Combien je vise par semaine', yourLabel: 'Combien vous visez par semaine', feature: 'besoins', inSentence: 'combien vous visez',
    unlocks: 'Après cette étape, le module vous propose vos arrosages.',
  },
  {
    id: 'soil', label: 'Mon sol', yourLabel: 'Votre sol', feature: 'sol', inSentence: 'votre sol',
    unlocks: 'Après cette étape, le module sait ce que votre sol retient.',
  },
];

/** Les étapes d'une ferme, dans l'ordre : celles dont la case est cochée. */
export function routeStepsFor(selection: FeatureSelection): RouteStepDefinition[] {
  return ROUTE_STEPS.filter((step) => selection.includes(step.feature));
}

const COUNT_WORDS = ['aucune', 'une', 'deux', 'trois', 'quatre', 'cinq'] as const;

/** « deux étapes », « une étape » : le nombre en lettres, comme dans la maquette. */
export function routeStepCountText(count: number): string {
  const word = COUNT_WORDS[count] ?? String(count);
  return `${word} étape${count > 1 ? 's' : ''}`;
}

/**
 * La phrase qui dit ce qui suit le choix (section 3.3) : le nombre d'étapes
 * et ce qu'elles décrivent, tirés des étapes de ces cases. Sans choix, ou pour
 * des cases qui n'ont aucune étape, la phrase ne promet pas de nombre.
 */
export function whatFollowsText(selection: FeatureSelection | null): string {
  const steps = selection === null ? [] : routeStepsFor(selection);
  if (steps.length === 0) return 'Ensuite, quelques étapes pour décrire votre ferme, en plusieurs fois si vous voulez.';
  return `Ensuite, ${routeStepCountText(steps.length)} pour décrire votre ferme : ${joinLabels(steps.map((step) => step.inSentence))}. En plusieurs fois si vous voulez.`;
}

/**
 * Ce que la mise en route compte (section 6), lu une fois par page par le
 * service (`lib/services/start-route.ts`) et passé ici : des nombres, jamais
 * des lignes de la base. `null` : la lecture de ce compte a échoué ; l'étape
 * est « à vérifier », jamais faite ni à zéro (D-003). Le compte d'une étape
 * qui n'existe pas (sa case décochée) n'est pas lu et vaut `null`.
 */
export type RouteCounts = {
  /**
   * Les matériels actifs par sorte, comptés comme l'inventaire de « Matériel
   * et placement » (le goutte-à-goutte : tout ce qui n'est pas une aspersion),
   * et, parmi eux, ceux qui n'ont aucun réglage. La fiche « Matériel et
   * placement » dit les mêmes nombres (section 7.1).
   */
  equipment: { drip: number; sprinkler: number; withoutSetting: number } | null;
  /** Les planches de la saison arrosées par un matériel posé (`calculateIrrigationCoverage`), sur toutes. */
  placement: { watered: number; total: number } | null;
  /** Les ressources et les réserves actives : au plus deux noms, et leur nombre. */
  water: { names: readonly string[]; total: number } | null;
  /**
   * Les planches de la saison qui ont une eau visée cette semaine (`farmObjective`), sur toutes ; celles hors
   * saison, à part (`offSeason`, D-352), absent quand il n'y en a aucune.
   */
  objective: { withObjective: number; total: number; offSeason?: number } | null;
  /** Les parcelles de la saison sans sol saisi (`parcelsWithoutSoil`), sur toutes, et l'ancre de la première. */
  soil: { withoutSoil: number; total: number; anchor: string | null } | null;
};

/** Faite, en cours (la première à faire), à faire, ou à vérifier (son compte n'a pas pu être lu). */
export type RouteStepStatus = 'done' | 'current' | 'todo' | 'unknown';

/** Où mène une étape : sa page, son onglet, son ancre. La saison et la parcelle de la page s'y ajoutent. */
export type RouteLink = { page: IrrigationPageId; tab?: 'materiel'; anchor?: string };

export type RouteStep = {
  id: RouteStepId;
  /** Son rang parmi les étapes qui existent : « Continuer l'étape 2 ». */
  number: number;
  label: string;
  yourLabel: string;
  status: RouteStepStatus;
  /**
   * La ligne sous le nom : ce qui existe pour une étape faite (« 4
   * goutte-à-goutte ») ; ce qui manque pour l'étape en cours ; ce qu'elle
   * attend, ou ce qui existe déjà, pour une étape à faire ; « à vérifier ».
   */
  line: string | null;
  /** Ce qui manque, en une phrase, pour l'étape en cours : sa ligne et la phrase d'« Aujourd'hui » (section 8). */
  missing: string | null;
  /** Ce qu'elle débloque, pour l'étape en cours seulement. */
  unlocks: string | null;
  /** Où elle mène ; `null` : elle attend une autre étape et ne mène nulle part avant (section 5.1). */
  link: RouteLink | null;
};

export type StartRoute =
  /** Pas de carte : ferme d'avant S6, mise en route terminée, ou aucune étape (sections 5.2, 5.3). */
  | { kind: 'none' }
  /** La lecture a échoué : la carte est omise, une ligne le dit (section 6). */
  | { kind: 'unreadable' }
  /** La carte (section 5.2). `current` : `null` quand rien ne reste à faire qui soit connu. */
  | { kind: 'card'; steps: RouteStep[]; done: number; total: number; progress: string; current: RouteStep | null; foldDone: boolean }
  /** Toutes les étapes faites, `route_state` nul : « Votre ferme est décrite. » et « Terminer la mise en route ». */
  | { kind: 'complete'; total: number; progress: string }
  /** Remise à plus tard : une ligne, « Reprendre la mise en route · 3 étapes sur 5 » (S6-l). */
  | { kind: 'later'; progress: string };

export const ROUTE_TITLE = 'Mise en route';
export const ROUTE_COMPLETE_TEXT = 'Votre ferme est décrite.';
export const ROUTE_FINISH_LABEL = 'Terminer la mise en route';
export const ROUTE_LATER_LABEL = 'Plus tard';
export const ROUTE_RESUME_LABEL = 'Reprendre la mise en route';
export const ROUTE_UNREADABLE_TEXT = 'La mise en route n’a pas pu être lue.';
const UNKNOWN_LINE = 'À vérifier : ce compte n’a pas pu être lu.';
const NO_BED_TEXT = 'Aucune planche dans votre plan. Ajoutez-les dans Ouvre ta ferme.';
const NO_PARCEL_TEXT = 'Aucune parcelle dans votre plan. Ajoutez-les dans Ouvre ta ferme.';
const PLACE_FIRST_TEXT = 'Posez d’abord le matériel sur vos planches.';
/** Les étapes faites se replient en une ligne dès trois (section 5.2, F959). */
const FOLD_FROM = 3;
const WATER_NAMES_SHOWN = 2;

/** « Continuer l'étape 2 ». */
export function continueLabel(step: Pick<RouteStep, 'number'>): string {
  return `Continuer l’étape ${step.number}`;
}

/** « 3 étapes sur 5 » : les étapes faites sur celles qui existent, jamais cinq d'office (section 5.2). */
export function routeProgressText(done: number, total: number): string {
  return `${done} étape${done > 1 ? 's' : ''} sur ${total}`;
}

/** « 3 étapes faites » : le pli des étapes faites. */
export function doneFoldText(done: number): string {
  return `${done} étape${done > 1 ? 's' : ''} faite${done > 1 ? 's' : ''}`;
}

function plural(count: number, word: string): string {
  return `${count} ${word}${count > 1 ? 's' : ''}`;
}

/** « 4 goutte-à-goutte », « 2 goutte-à-goutte et 1 aspersion » : l'étape 1 et la fiche « Matériel et placement » (section 7.2). */
export function equipmentKindsText(drip: number, sprinkler: number): string {
  return joinLabels([...(drip > 0 ? [`${drip} goutte-à-goutte`] : []), ...(sprinkler > 0 ? [plural(sprinkler, 'aspersion')] : [])]);
}

/** « Puits », « Puits et Bassin », « Puits, Bassin et 1 autre » (F948 : le dernier joint par « et »). */
function waterNamesText(names: readonly string[], total: number): string {
  const shown = names.slice(0, WATER_NAMES_SHOWN);
  const others = total - shown.length;
  return joinLabels(others > 0 ? [...shown, plural(others, 'autre')] : shown);
}

/** « 3 planches n'ont pas encore d'eau visée. » */
function bedsWithoutObjectiveText(count: number): string {
  return `${plural(count, 'planche')} n’${count > 1 ? 'ont' : 'a'} pas encore d’eau visée.`;
}

/** Ce qu'une étape lit de ses comptes, avant de savoir laquelle est en cours. */
type StepReading =
  | { known: false }
  | { known: true; done: boolean; progress: string | null; missing: string; waiting: string | null; link: RouteLink };

function capitalized(text: string): string {
  return text.charAt(0).toUpperCase() + text.slice(1);
}

/** La page de chaque étape, à l'endroit où elle se fait (section 5.1). */
const STEP_LINKS: Readonly<Record<RouteStepId, RouteLink>> = {
  // « Matériel et placement », l'inventaire et son bouton « Ajouter un matériel ».
  equipment: { page: 'materiel', tab: 'materiel', anchor: 'equipment-title' },
  // « Matériel et placement », le plan où l'on pose.
  placement: { page: 'materiel', anchor: 'farm-plan' },
  // « Ressources et pompes », la liste des ressources et son ajout.
  water: { page: 'ressources', anchor: 'water-resources-title' },
  // L'ancienne « Objectifs et besoins », dans « Semaine » (S4) : le volet des objectifs.
  objective: { page: 'semaine', anchor: 'objectifs-de-la-semaine' },
  // « Réserve du sol » ; la première parcelle sans sol quand on la connaît.
  soil: { page: 'sol' },
};

function readStep(id: RouteStepId, counts: RouteCounts, placementDone: boolean | null): StepReading {
  switch (id) {
    case 'equipment': {
      const count = counts.equipment;
      if (!count) return { known: false };
      // Faite dès qu'un matériel a un réglage ; sa ligne dit tout le matériel actif, comme l'inventaire et la fiche.
      const withSetting = count.drip + count.sprinkler - count.withoutSetting;
      return {
        known: true,
        done: withSetting > 0,
        progress: withSetting > 0 ? equipmentKindsText(count.drip, count.sprinkler) : null,
        missing: count.withoutSetting === 0
          ? 'Aucun matériel pour l’instant.'
          : count.withoutSetting === 1 ? 'Un matériel n’a pas encore de réglage.' : `${count.withoutSetting} matériels n’ont pas encore de réglage.`,
        waiting: null,
        link: STEP_LINKS.equipment,
      };
    }
    case 'placement': {
      const count = counts.placement;
      if (!count) return { known: false };
      return {
        known: true,
        done: count.total > 0 && count.watered > 0,
        progress: count.watered > 0 ? `${plural(count.watered, 'planche')} arrosée${count.watered > 1 ? 's' : ''} sur ${count.total}` : null,
        // Sans planche, le bouton mène au plan que le module lit, et la phrase dit où les ajouter (D-001, section 12).
        missing: count.total === 0 ? NO_BED_TEXT : 'Aucune planche n’a encore de matériel posé.',
        waiting: null,
        link: STEP_LINKS.placement,
      };
    }
    case 'water': {
      const count = counts.water;
      if (!count) return { known: false };
      return {
        known: true,
        done: count.total > 0,
        progress: count.total > 0 ? waterNamesText(count.names, count.total) : null,
        missing: 'Aucune ressource en eau pour l’instant.',
        waiting: null,
        link: STEP_LINKS.water,
      };
    }
    case 'objective': {
      const count = counts.objective;
      if (!count) return { known: false };
      // L'étape 4 attend l'étape 2 : sans planche arrosée, « combien je vise » n'a pas de sens pour le module (section 5.1).
      const waiting = placementDone === false ? PLACE_FIRST_TEXT : count.total === 0 ? NO_BED_TEXT : null;
      // Une planche hors saison n'a rien à viser (D-337, D-352) : l'étape compte les planches en saison, comme
      // « Aujourd'hui » ; toutes hors saison, rien ne manque.
      const inSeason = count.total - (count.offSeason ?? 0);
      return {
        known: true,
        done: count.total > 0 && count.withObjective === inSeason,
        // La phrase d'« Aujourd'hui » et de « Semaine » (S1, S6-i) : « 7 planches sur 10 ont un objectif », « ferme entière »,
        // « 7 planches sur 7 ont un objectif, 3 hors saison ».
        progress: count.withObjective > 0 || inSeason < count.total ? farmObjectiveScopeText(count) : null,
        missing: count.total === 0 ? NO_BED_TEXT : bedsWithoutObjectiveText(inSeason - count.withObjective),
        waiting,
        link: STEP_LINKS.objective,
      };
    }
    case 'soil': {
      const count = counts.soil;
      if (!count) return { known: false };
      const entered = count.total - count.withoutSoil;
      return {
        known: true,
        done: count.total > 0 && count.withoutSoil === 0,
        progress: entered > 0 ? `${soilParcelsText(entered)} saisi` : null,
        // Le texte du bandeau « À finir », la même ancre (S6-i).
        missing: count.total === 0 ? NO_PARCEL_TEXT : `${capitalized(soilParcelsText(count.withoutSoil))} à saisir.`,
        waiting: count.total === 0 ? NO_PARCEL_TEXT : null,
        link: count.anchor ? { ...STEP_LINKS.soil, anchor: count.anchor } : STEP_LINKS.soil,
      };
    }
  }
}

/**
 * La mise en route d'une ferme (sections 5 et 6) : ses étapes, leur état, et
 * ce que la carte montre. Rien n'est lu ici : les comptes viennent du
 * service. Une étape est faite quand ce qu'elle décrit existe (S6-h) ; la
 * première non faite est en cours, sauf une qui attend une autre étape ;
 * une étape au compte inconnu est « à vérifier ». Une ferme d'avant S6
 * (`startMode` nul) et une mise en route terminée n'ont pas de carte,
 * jamais (S6-j, S6-k).
 */
export function startRoute(input: {
  startMode: StartMode | null;
  routeState: RouteState | null;
  enabled: FeatureSelection;
  counts: RouteCounts;
}): StartRoute {
  if (input.startMode === null || input.routeState === 'done') return { kind: 'none' };
  const definitions = routeStepsFor(input.enabled);
  if (definitions.length === 0) return { kind: 'none' };
  const readings = new Map<RouteStepId, StepReading>();
  for (const definition of definitions) {
    const placement = readings.get('placement');
    const placementDone = placement === undefined || !placement.known ? null : placement.done;
    readings.set(definition.id, readStep(definition.id, input.counts, placementDone));
  }
  if ([...readings.values()].every((reading) => !reading.known)) return { kind: 'unreadable' };

  const firstCurrent = definitions.find((definition) => {
    const reading = readings.get(definition.id);
    return reading?.known === true && !reading.done && reading.waiting === null;
  });
  const steps: RouteStep[] = definitions.map((definition, index) => {
    const reading = readings.get(definition.id) ?? { known: false };
    const base = { id: definition.id, number: index + 1, label: definition.label, yourLabel: definition.yourLabel };
    if (!reading.known) return { ...base, status: 'unknown', line: UNKNOWN_LINE, missing: null, unlocks: null, link: STEP_LINKS[definition.id] };
    if (reading.done) return { ...base, status: 'done', line: reading.progress, missing: null, unlocks: null, link: reading.link };
    if (definition === firstCurrent) {
      return { ...base, status: 'current', line: reading.missing, missing: reading.missing, unlocks: definition.unlocks, link: reading.link };
    }
    return {
      ...base,
      status: 'todo',
      line: reading.waiting ?? reading.progress,
      missing: null,
      unlocks: null,
      link: reading.waiting === null ? reading.link : null,
    };
  });

  const done = steps.filter((step) => step.status === 'done').length;
  const total = steps.length;
  const progress = routeProgressText(done, total);
  if (input.routeState === 'later') return { kind: 'later', progress };
  if (done === total) return { kind: 'complete', total, progress };
  return {
    kind: 'card',
    steps,
    done,
    total,
    progress,
    current: steps.find((step) => step.status === 'current') ?? null,
    foldDone: done >= FOLD_FROM,
  };
}

/** La carte de la mise en route est-elle à l'écran ? Le bandeau « À finir » n'est alors pas répété sur « Ma ferme » (S6-d). */
export function routeCardVisible(route: StartRoute | null): boolean {
  return route?.kind === 'card' || route?.kind === 'complete';
}

/**
 * Faut-il lire la mise en route pour cette page (section 6) ? Seulement sur
 * « Ma ferme » et « Aujourd'hui », pour une ferme passée par les trois façons
 * (`startMode` non nul) dont la carte n'est pas terminée et qui a au moins
 * une étape. « Aujourd'hui » ne la lit pas quand elle est remise à plus tard :
 * son bloc ne se montre qu'à une carte visible (section 8).
 */
export function routeReadNeeded(page: IrrigationPageId, input: { startMode: StartMode | null; routeState: RouteState | null; enabled: FeatureSelection }): boolean {
  if (page !== 'ma-ferme' && page !== 'aujourdhui') return false;
  if (input.startMode === null || input.routeState === 'done') return false;
  if (page === 'aujourdhui' && input.routeState === 'later') return false;
  return routeStepsFor(input.enabled).length > 0;
}

/** Le bloc d'« Aujourd'hui » à la place de « Rien à arroser » (section 8). */
export type TodayRouteBlock = {
  title: string;
  /** « Combien vous visez par semaine : 3 planches n'ont pas encore d'eau visée. » */
  sentence: string;
  /** « Continuer l'étape n », un lien vers la page de l'étape. */
  label: string;
  link: RouteLink;
};

/**
 * Le bloc d'« Aujourd'hui » pour une ferme qui n'est pas prête (section 8) :
 * l'étape en cours de la carte, la même, dite en une phrase, avec son lien.
 * `null` sans carte ou sans étape en cours. La page ne le montre que s'il
 * n'y a aucune carte d'arrosage : le travail du jour passe avant.
 */
export function todayRouteBlock(route: StartRoute | null, enabled: FeatureSelection): TodayRouteBlock | null {
  if (route?.kind !== 'card' || !route.current?.link || !route.current.missing) return null;
  const step = route.current;
  const missing = step.missing ?? '';
  return {
    // La première façon ne propose rien : sa ferme n'est pas « décrite », elle n'attend pas de proposition.
    title: enabled.includes('planning') ? 'Votre ferme n’est pas encore prête à proposer des arrosages.' : 'Votre ferme n’est pas encore décrite.',
    sentence: `${step.yourLabel} : ${missing.charAt(0).toLowerCase()}${missing.slice(1)}`,
    label: continueLabel(step),
    link: step.link as RouteLink,
  };
}
