import type { BedIrrigationNeed } from './irrigation-needs.ts';
import type { Bed } from './domain.ts';
import type { HydricGoal } from './water-management.ts';
import { automaticObjectiveSchedule, type AutomaticObjectiveSettingRevision, type AutomaticObjectiveWeek } from './automatic-objective.ts';
import { et0OfDay, type Et0Reading } from './crop-water/etm.ts';
import { et0NatureLabel } from './crop-water/presentation.ts';
import { decimalText, mmText } from './figure-origin.ts';
import { farmObjective } from './farm-objective.ts';
import { shortDayText } from './today/today-text.ts';

/**
 * L'objectif d'une planche lu de la même façon sur chaque page (audit
 * ergonomique final, lot A, R2, docs/audit-ergonomie-final-lot-a-contract.md,
 * section 4, précisions F281 et F282). Affichage seul : l'objectif adopté
 * reste celui que `objectiveForBed` lit pour le besoin, le planning, la
 * faisabilité et la fiche de la culture ; rien ici ne le calcule.
 *
 * Cause établie dans le code : chaque page lit le même objectif, mais un
 * total de jardin ou de ferme devient « Non calculable » dès qu'une seule
 * planche n'en a pas (D-003), sans dire pourquoi, et la fiche de la planche
 * nommait « applicable » ce que le reste du module appelle adopter (D-045).
 */

/** F281 : la différence entre les deux objectifs d'une planche, en une phrase. */
export const ADOPTED_OBJECTIVE_HELP = 'L’objectif adopté est celui que le besoin et le planning appliquent ; l’objectif proposé, calculé d’après la culture, ne s’applique que si vous l’adoptez.';

/** « 1 planche sur 5 », « 2 planches sur 5 ». */
function bedsOf(count: number, total: number): string {
  return `${count} planche${count > 1 ? 's' : ''} sur ${total}`;
}

/**
 * F282 : pourquoi le total d'un jardin ne se calcule pas. Le besoin d'une
 * planche n'est inconnu que faute d'objectif adopté (la pluie inconnue est
 * remplacée et listée, D-019) ; `null` quand toutes ont leur valeur.
 */
export function gardenUnknownReason<B extends Pick<BedIrrigationNeed, 'objectiveMm'>>(beds: readonly B[], value: (bed: B) => number | null): string | null {
  const unknown = beds.filter((bed) => value(bed) === null);
  if (unknown.length === 0) return null;
  const withoutObjective = unknown.filter((bed) => bed.objectiveMm === null).length;
  if (withoutObjective === unknown.length) return `${bedsOf(withoutObjective, beds.length)} sans objectif adopté`;
  return `${bedsOf(unknown.length, beds.length)} au besoin inconnu`;
}

/**
 * F282 : pourquoi le besoin de la semaine, sur « Ressources », n'est pas
 * chiffré en entier : les planches sans objectif adopté, puis celles dont la
 * surface mouillée manque pour passer des millimètres aux mètres cubes
 * (D-022). `null` quand aucune ne manque.
 */
export function feasibilityUnknownReason(unknown: { noObjective: number; noWettedArea: number }): string | null {
  const parts = [
    unknown.noObjective > 0 ? `${unknown.noObjective} planche${unknown.noObjective > 1 ? 's' : ''} sans objectif adopté` : null,
    unknown.noWettedArea > 0 ? `${unknown.noWettedArea} planche${unknown.noWettedArea > 1 ? 's' : ''} sans surface mouillée connue` : null,
  ].filter((part): part is string => part !== null);
  return parts.length === 0 ? null : parts.join(', ');
}

/*
 * L'objectif automatique dit à l'écran (6 decies, O4,
 * docs/objectif-automatique-contract.md, section 5 ; D-319). Affichage seul :
 * la valeur vient d'`objectiveForBed`, ces fonctions la mettent en mots.
 * Réglage éteint, ou objectif automatique qui ne s'applique à aucun jour,
 * elles ne disent rien : l'écran reste celui d'avant.
 */

/** La phrase du réglage, dans le volet « Objectifs hebdomadaires » (section 5, point 1). */
export const AUTOMATIC_OBJECTIVE_SETTING_TEXT = 'Sans objectif saisi, l’objectif d’une planche suit chaque matin le besoin de sa culture, ou l’ET0 quand ce besoin n’est pas connu.';

/** Ce que les écrans lisent de l'objectif d'une planche pour en dire l'origine. */
export type ObjectiveOriginReading = Pick<BedIrrigationNeed, 'objectiveOrigin' | 'automaticObjective'>;

type AutomaticBasis = NonNullable<AutomaticObjectiveWeek['basis']>;

const BASIS_TEXT: Record<AutomaticBasis, string> = {
  crop: 'd’après le besoin de la culture',
  et0: 'd’après l’ET0',
  'sheltered-et0': 'd’après l’ET0 sous abri',
  mixed: 'd’après la culture et l’ET0',
};

/**
 * L'origine de l'objectif de la semaine d'une planche, en quelques mots :
 * « saisi », « automatique, d’après l’ET0 », « saisi et automatique, d’après
 * la culture »… (section 5, point 3). `null` quand l'objectif automatique ne
 * s'applique à aucun jour : l'écran d'avant, sans mot de plus.
 */
export function objectiveOriginText(bed: ObjectiveOriginReading): string | null {
  const automatic = bed.automaticObjective;
  if (automatic === null) return null;
  const basis = automatic.basis === null ? '' : `, ${BASIS_TEXT[automatic.basis]}`;
  if (bed.objectiveOrigin === 'automatic') return `automatique${basis}`;
  if (bed.objectiveOrigin === 'both') return `saisi et automatique${basis}`;
  if (bed.objectiveOrigin === 'entered') return 'saisi';
  // L'objectif automatique s'applique sans aucune valeur : il le dit, jamais un zéro (D-003).
  if (automatic.noCropWeek) return 'automatique : pas de culture cette semaine';
  return 'automatique, sans valeur : aucun jour n’est connu';
}

/**
 * La bulle de l'objectif automatique d'une planche (section 5, point 3) :
 * ses jours, sa base, ses millimètres par nature d'ET0 (passé, estimé,
 * prévu), les jours sans valeur, nommés, et la clôture de la semaine.
 * `null` quand il ne s'applique à aucun jour.
 */
export function automaticObjectiveOriginText(bed: ObjectiveOriginReading): string | null {
  const automatic = bed.automaticObjective;
  if (automatic === null) return null;
  const parts: string[] = [];
  const applied = automatic.days.length;
  if (automatic.noCropWeek) {
    parts.push(`Objectif automatique sur ${dayCount(applied)} : la planche ne porte aucune culture de la semaine, elle n’a pas d’objectif automatique.`);
  } else if (automatic.mm === null) {
    parts.push(`Objectif automatique sur ${dayCount(applied)} : aucun n’a de valeur, il ne compte pas.`);
  } else {
    const basis = automatic.basis === null ? '' : ` ${BASIS_TEXT[automatic.basis]}`;
    parts.push(`Objectif automatique sur ${dayCount(applied)} : ${mmText(automatic.mm)}${basis}.`);
    const shelter = shelterFactorOf(automatic);
    if (shelter !== null) parts.push(`Sous abri, l’ET0 est multipliée par le K_abri, ${decimalText(shelter)}.`);
    const natures = (['reanalysis', 'estimated', 'forecast'] as const)
      .filter((nature) => automatic.byNature[nature] > 0)
      .map((nature) => `${mmText(automatic.byNature[nature])} sur ${et0NatureLabel(nature)}`);
    if (natures.length > 0) parts.push(`Dont ${natures.join(', ')}.`);
  }
  if (bed.objectiveOrigin === 'both') parts.push('Les autres jours, l’objectif saisi passe avant.');
  const missing = automatic.days.filter((day) => !('mm' in day));
  if (missing.length > 0 && !automatic.noCropWeek) {
    parts.push(`Sans valeur, non comptés : ${missing.map((day) => `${shortDayText(day.date)} (${missingDayReason(day)})`).join(', ')}.`);
  }
  if (automatic.closure === 'recorded') parts.push('Semaine close, enregistrée : elle ne bouge plus.');
  if (automatic.closure === 'provisional') parts.push('Semaine close, provisoire : la tâche du matin l’enregistrera.');
  if (automatic.closure === 'open') parts.push('Mis à jour chaque matin avec la météo.');
  return parts.join(' ');
}

/** Pourquoi un jour de l'objectif automatique n'a pas de valeur, en quelques mots. */
function missingDayReason(day: AutomaticObjectiveWeek['days'][number]): string {
  switch (day.status) {
    case 'missing-et0': return 'ET0 manquante';
    case 'blocked': return day.problems.join(' ') || 'calcul bloqué';
    case 'crop-plan-unread': return 'plan de culture non lu';
    case 'unclassified-plot': return 'jardin à classer';
    default: return 'sans valeur';
  }
}

/** Le K_abri des jours où l'ET0 sous abri a servi ; `null` en plein champ ou sans ce cas. */
function shelterFactorOf(automatic: AutomaticObjectiveWeek): number | null {
  for (const day of automatic.days) {
    if (day.status === 'et0' && day.shelterFactor !== null) return day.shelterFactor;
  }
  return null;
}

function dayCount(count: number): string {
  return `${count} jour${count > 1 ? 's' : ''}`;
}

/**
 * Une planche dont l'objectif automatique est déjà, tous ses jours, le besoin
 * de la culture n'a plus de proposition à adopter : elle l'applique déjà
 * (section 5, point 4).
 */
export function objectiveFollowsCropNeed(objective: { origin: BedIrrigationNeed['objectiveOrigin']; automatic: AutomaticObjectiveWeek | null }): boolean {
  return objective.origin === 'automatic' && objective.automatic?.basis === 'crop';
}

/** La phrase qui remplace « Adopter la proposition » quand l'objectif suit déjà la culture. */
export const FOLLOWS_CROP_NEED_TEXT = 'L’objectif automatique suit déjà le besoin de la culture : rien à adopter.';

/**
 * Les planches de la saison qui gardent un objectif saisi cette semaine
 * (section 5, point 2, cas 5) : un objectif de ferme les couvre toutes ; un
 * objectif de parcelle, de jardin ou de planche, celles qu'il vise.
 */
export function bedsKeepingEnteredGoal(
  goals: readonly Pick<HydricGoal, 'otfZoneId' | 'otfPlotId' | 'otfBedId'>[],
  beds: readonly Pick<Bed, 'id' | 'zoneId' | 'plotId' | 'seasons'>[],
  season: number,
): number {
  return beds.filter((bed) => bed.seasons.includes(season) && goals.some((goal) =>
    (goal.otfZoneId === null || goal.otfZoneId === bed.zoneId)
    && (goal.otfPlotId === null || goal.otfPlotId === bed.plotId)
    && (goal.otfBedId === null || goal.otfBedId === bed.id))).length;
}

/**
 * L'origine de l'objectif d'un groupe de planches (la ferme, un jardin), pour
 * « Aujourd'hui » : « automatique, d’après l’ET0 » quand il l'est partout avec
 * une seule base, « automatique » avec plusieurs bases, « saisi et
 * automatique » quand les deux se mêlent. `null` quand l'objectif automatique
 * ne compte pour aucune planche : la phrase d'avant, sans mot de plus.
 */
export function groupObjectiveOriginText(beds: readonly ObjectiveOriginReading[], withBasis = true): string | null {
  const withObjective = beds.filter((bed) => bed.objectiveOrigin !== null);
  if (!withObjective.some((bed) => bed.objectiveOrigin === 'automatic' || bed.objectiveOrigin === 'both')) return null;
  if (!withObjective.every((bed) => bed.objectiveOrigin === 'automatic')) return 'saisi et automatique';
  const bases = new Set(withObjective.map((bed) => bed.automaticObjective?.basis ?? null));
  if (bases.size !== 1 || !withBasis) return 'automatique';
  const [basis] = [...bases];
  return basis === null ? 'automatique' : `automatique, ${BASIS_TEXT[basis]}`;
}

/**
 * L'origine de l'objectif d'une période de l'historique : « automatique »
 * quand l'objectif automatique a rempli toutes les journées-planche
 * couvertes, « saisi et automatique » quand il en a rempli une partie, avec
 * leur nombre. `null` quand il n'en a rempli aucune.
 */
export function historyObjectiveOriginText(
  availableBedDays: number,
  automatic: { bedDays: number } | undefined,
): string | null {
  if (!automatic || automatic.bedDays === 0) return null;
  if (automatic.bedDays >= availableBedDays) return 'Objectif automatique';
  return `Objectif saisi et automatique : ${automatic.bedDays} journée${automatic.bedDays > 1 ? 's' : ''}-planche automatique${automatic.bedDays > 1 ? 's' : ''} sur ${availableBedDays}`;
}

/**
 * Les jours de la semaine où le réglage est allumé et où l'ET0 manque
 * (section 5, point 5) : l'objectif automatique ne les compte pas. `null`
 * quand le réglage est éteint aujourd'hui : la ligne de fiabilité n'existe
 * pas.
 */
export function automaticObjectiveMissingEt0Dates(
  settings: readonly AutomaticObjectiveSettingRevision[],
  readings: readonly Et0Reading[],
  weekDates: readonly string[],
  today: string,
): string[] | null {
  const enabledOn = automaticObjectiveSchedule(settings);
  if (!enabledOn(today)) return null;
  const byDate = new Map(readings.map((reading) => [reading.date, reading]));
  return weekDates.filter((date) => enabledOn(date) && et0OfDay(byDate.get(date), date, today) === null);
}

/*
 * L'objectif automatique se voit et se modifie dans le volet « Objectifs de
 * la semaine » (6 quaterdecies, PR A1, docs/objectif-automatique-saison-contract.md,
 * section 3 ; D-337). Affichage seul : les valeurs viennent du tableau des
 * besoins (`objectiveForBed`), rien n'est écrit chaque matin (point 1), rien
 * ici ne les recalcule ; les moyennes de surface sont celles de
 * `farmObjective` (S1, D-328), le seul calcul de moyenne.
 */

/** Ce que le volet lit de l'objectif d'une planche, tel que le tableau des besoins le rend. */
export type ObjectiveBedReading = Pick<BedIrrigationNeed,
  'bedId' | 'bedName' | 'plotId' | 'plotName' | 'zoneId' | 'areaSquareMeters' | 'objectiveMm' | 'objectiveOrigin' | 'automaticObjective'>;

/** Les planches du tableau des besoins, réduites à ce que le volet lit de leur objectif. */
export function objectiveBedReadings(gardens: readonly { beds: readonly BedIrrigationNeed[] }[]): ObjectiveBedReading[] {
  return gardens.flatMap((garden) => garden.beds.map((bed) => ({
    bedId: bed.bedId,
    bedName: bed.bedName,
    plotId: bed.plotId,
    plotName: bed.plotName,
    zoneId: bed.zoneId,
    areaSquareMeters: bed.areaSquareMeters,
    objectiveMm: bed.objectiveMm,
    objectiveOrigin: bed.objectiveOrigin,
    automaticObjective: bed.automaticObjective,
  })));
}

/** Une ligne « automatique » de la liste du volet (point 2) : un jardin, ou une planche qui s'écarte de son jardin. */
export type AutomaticObjectiveLine = {
  key: string;
  /** « Jardin Nord · 6 planches », « Jardin Nord · Planche 3 ». */
  label: string;
  /** La valeur du choix d'endroit qui la corrige, au format du sélecteur (`plot:…:…`, `bed:…:…:…`). */
  scopeValue: string;
  /** Les millimètres de la semaine ; `null` quand aucun jour n'a de valeur (D-003, jamais zéro). */
  mm: number | null;
  /** L'origine dans les mots de F791 : « automatique, d’après l’ET0 », « saisi et automatique »… */
  origin: string;
  /** Tous les jours automatiques reposent sur l'ET0 prévue : la ligne le dit (« prévu »). */
  forecast: boolean;
};

/**
 * La planche suit l'objectif automatique au moins un jour de la semaine, avec
 * ou sans valeur (une semaine sans ET0 connue le dit, D-003) ; celle dont
 * l'objectif saisi couvre tous les jours chiffrés n'en a pas.
 */
function followsAutomatic(bed: ObjectiveBedReading): boolean {
  return bed.automaticObjective !== null && bed.objectiveOrigin !== 'entered';
}

/** Tous les millimètres automatiques de la planche viennent de l'ET0 prévue (une semaine à venir). */
function forecastOnly(bed: ObjectiveBedReading): boolean {
  const nature = bed.automaticObjective?.byNature;
  return nature !== undefined && nature.forecast > 0 && nature.reanalysis === 0 && nature.estimated === 0;
}

/** Les millimètres comparés comme l'écran les montre, au dixième. */
function sameShownMm(left: number | null, right: number | null): boolean {
  if (left === null || right === null) return left === right;
  return Math.round(left * 10) === Math.round(right * 10);
}

/**
 * Les lignes « automatique » du volet (point 2) : une par jardin dont des
 * planches suivent l'objectif automatique, avec la moyenne de surface de
 * leurs millimètres, puis une par planche dont la valeur ou l'origine
 * s'écarte de celle de son jardin. Les jardins dans l'ordre du tableau des
 * besoins. Aucune ligne quand aucune planche ne suit l'objectif automatique.
 */
export function automaticObjectiveLines(beds: readonly ObjectiveBedReading[]): AutomaticObjectiveLine[] {
  const byPlot = new Map<string, ObjectiveBedReading[]>();
  for (const bed of beds.filter(followsAutomatic)) byPlot.set(bed.plotId, [...(byPlot.get(bed.plotId) ?? []), bed]);
  return [...byPlot.values()].flatMap((plotBeds) => {
    const [first] = plotBeds;
    const gardenMm = farmObjective(plotBeds).objectiveMm;
    const gardenOrigin = groupObjectiveOriginText(plotBeds) ?? objectiveOriginText(first) ?? 'automatique';
    const garden: AutomaticObjectiveLine = {
      key: `plot:${first.plotId}`,
      label: `${first.plotName} · ${plotBeds.length} planche${plotBeds.length > 1 ? 's' : ''}`,
      scopeValue: `plot:${first.zoneId}:${first.plotId}`,
      mm: gardenMm,
      origin: gardenOrigin,
      forecast: plotBeds.every(forecastOnly),
    };
    const apart = plotBeds.length < 2 ? [] : plotBeds.filter((bed) => {
      const origin = objectiveOriginText(bed) ?? 'automatique';
      return !sameShownMm(bed.objectiveMm, gardenMm) || origin !== gardenOrigin;
    });
    return [garden, ...apart.map((bed): AutomaticObjectiveLine => ({
      key: `bed:${bed.bedId}`,
      label: `${bed.plotName} · ${bed.bedName}`,
      scopeValue: `bed:${bed.zoneId}:${bed.plotId}:${bed.bedId}`,
      mm: bed.objectiveMm,
      origin: objectiveOriginText(bed) ?? 'automatique',
      forecast: forecastOnly(bed),
    }))];
  });
}

/** Un endroit du sélecteur des objectifs, comme `saveHydricGoalAction` le reçoit. */
export type GoalScopeTarget = {
  scopeType: HydricGoal['scopeType'];
  otfZoneId: string | null;
  otfPlotId: string | null;
  otfBedId: string | null;
};

/** La valeur en vigueur d'un endroit (point 3) : ses millimètres et leur origine. */
export type ObjectiveInForce = {
  mm: number;
  /** « saisi », « automatique, d’après l’ET0 », « saisi et automatique »… */
  origin: string;
};

function bedInScope(bed: ObjectiveBedReading, scope: GoalScopeTarget): boolean {
  if (scope.scopeType === 'farm') return true;
  if (scope.scopeType === 'zone') return bed.zoneId === scope.otfZoneId;
  if (scope.scopeType === 'plot') return bed.plotId === scope.otfPlotId;
  return bed.bedId === scope.otfBedId;
}

/**
 * La valeur que montre le champ « mm / semaine » pour l'endroit choisi
 * (point 3) : l'objectif saisi à cet endroit même, s'il y en a un, marqué
 * « saisi » ; sinon la moyenne de surface des objectifs de ses planches, telle
 * que le besoin les applique, marquée selon leur origine. `null` quand aucune
 * planche de l'endroit n'a d'objectif chiffré : le champ reste vide (D-003).
 */
export function objectiveInForce(
  scope: GoalScopeTarget,
  goals: readonly (GoalScopeTarget & { amountMm: number })[],
  beds: readonly ObjectiveBedReading[],
): ObjectiveInForce | null {
  const entered = goals.find((goal) => goal.scopeType === scope.scopeType
    && goal.otfZoneId === scope.otfZoneId && goal.otfPlotId === scope.otfPlotId && goal.otfBedId === scope.otfBedId);
  if (entered) return { mm: entered.amountMm, origin: 'saisi' };
  const covered = beds.filter((bed) => bedInScope(bed, scope) && bed.objectiveMm !== null);
  const mm = farmObjective(covered).objectiveMm;
  if (mm === null) return null;
  return { mm, origin: groupObjectiveOriginText(covered) ?? 'saisi' };
}

/**
 * La phrase de résultat sous l'interrupteur allumé (point 6) : « Cette
 * semaine : 24 mm en moyenne sur 7 planches, d’après l’ET0 ; 2 planches
 * gardent un objectif saisi. » Les chiffres de l'objectif de la ferme
 * (`farmObjective`, D-328), l'origine de ses planches, et les planches qui
 * gardent un objectif saisi.
 */
export function automaticObjectiveResultText(
  objective: { objectiveMm: number | null; withObjective: number },
  beds: readonly ObjectiveOriginReading[],
  keptGoalBeds: number,
): string {
  const kept = keptGoalBeds > 0
    ? ` ; ${keptGoalBeds} planche${keptGoalBeds > 1 ? 's gardent' : ' garde'} un objectif saisi`
    : '';
  if (objective.objectiveMm === null) return `Cette semaine : aucune planche n’a encore d’objectif chiffré${kept}.`;
  const count = objective.withObjective;
  const origin = groupObjectiveOriginText(beds);
  const basis = origin === null ? '' : `, ${origin.startsWith('automatique, ') ? origin.slice('automatique, '.length) : `objectif ${origin}`}`;
  return `Cette semaine : ${mmText(Math.round(objective.objectiveMm * 10) / 10)} en moyenne sur ${count} planche${count > 1 ? 's' : ''}${basis}${kept}.`;
}

/** La fenêtre d'allumage (point 5) : ce qui change, avant, quand des planches gardent un objectif saisi. */
export function automaticObjectiveEnableText(keptGoalBeds: number): string {
  return keptGoalBeds > 1
    ? `${keptGoalBeds} planches ont un objectif saisi, qui passe avant l’objectif automatique.`
    : '1 planche a un objectif saisi, qui passe avant l’objectif automatique.';
}
