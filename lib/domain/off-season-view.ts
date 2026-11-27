import { compareNamesNaturally } from './bed-order.ts';
import { clockText } from './clock-text.ts';
import type { Bed, PlotMode, Plot, Zone } from './domain.ts';
import { goalScopeChoiceGroups, FARM_SCOPE_VALUE, type GoalScopeChoiceGroup } from './goal-scope-choices.ts';
import { offSeasonScopeCovers, type OffSeasonBed, type OffSeasonSchedule, type OffSeasonScope } from './off-season.ts';
import type { OffSeasonPlannedIrrigation } from './off-season-planned.ts';
import { FARM_TIME_ZONE, dateKeyInTimeZone } from './water-management.ts';

/**
 * Les écrans du filtre « hors saison » (6 quaterdecies, PR B3,
 * docs/objectif-automatique-saison-contract.md, sections 4.3 à 4.5 et 10 ;
 * D-337, D-353) : ce que le bloc « Hors saison » du pli « Objectifs de la
 * semaine » montre et dit. La règle reste celle de B1 (`offSeasonSchedule`),
 * la liste des arrosages celle de B2 : ce module ne fait que les mots.
 */

/** L'ancre du bloc, dans le pli « Objectifs de la semaine » : la tuile d'« Aujourd'hui » y mène. */
export const OFF_SEASON_ANCHOR = 'hors-saison';

type FarmPlaces = { zones: readonly Zone[]; plots: readonly Plot[]; beds: readonly Bed[] };

/** Une portée active aujourd'hui, en puce : « Tout le plein champ · depuis le 20 nov. ». */
type OffSeasonChip = {
  key: string;
  scope: OffSeasonScope;
  label: string;
  /** Le jour, en heure de Paris, où elle est devenue hors saison. */
  since: string;
  /** Les planches de la saison qu'elle couvre aujourd'hui. */
  beds: number;
};

export type OffSeasonView = {
  chips: OffSeasonChip[];
  /** Les planches de la saison hors saison aujourd'hui, par une portée au moins. */
  offSeasonBeds: number;
  /** La ferme a des jardins de plein champ, des abris : sans eux, pas de bouton « tout le … » (section 4.3). */
  modes: { garden: boolean; greenhouse: boolean };
  /** Les jardins « à classer » de la saison : aucune portée de mode ne les couvre, l'écran le dit. */
  unclassifiedGardens: number;
};

const sinceFormat = new Intl.DateTimeFormat('fr-FR', { day: 'numeric', month: 'short', timeZone: 'UTC' });

/** « depuis le 20 nov. » : le jour du geste, lu tel quel. */
export function offSeasonSinceText(since: string): string {
  return `depuis le ${sinceFormat.format(new Date(`${since}T12:00:00.000Z`))}`;
}

/**
 * Le nom d'une portée, au vocabulaire du sélecteur des objectifs : « Tout le
 * plein champ », « Parcelle · Clémentière », « Jardin · Nord », « Abri ·
 * Tunnel 1 », « Planche · N1 ». Un lieu qu'Ouvre ta ferme ne montre plus se
 * dit tel, pour qu'on puisse encore le reprendre (F1064).
 */
export function offSeasonScopeLabel(scope: OffSeasonScope, places: FarmPlaces): string {
  switch (scope.level) {
    case 'mode': return scope.mode === 'greenhouse' ? 'Tout le sous-abri' : 'Tout le plein champ';
    case 'zone': {
      const zone = places.zones.find((item) => item.id === scope.zoneId);
      return zone ? `Parcelle · ${zone.name}` : 'Une parcelle qui n’est plus dans Ouvre ta ferme';
    }
    case 'plot': {
      const plot = places.plots.find((item) => item.id === scope.plotId);
      if (!plot) return 'Un jardin qui n’est plus dans Ouvre ta ferme';
      return `${plot.mode === 'greenhouse' ? 'Abri' : 'Jardin'} · ${plot.name}`;
    }
    case 'bed': {
      const bed = places.beds.find((item) => item.id === scope.bedId);
      return bed ? `Planche · ${bed.name}` : 'Une planche qui n’est plus dans Ouvre ta ferme';
    }
  }
}

/** Les planches de la saison, avec le mode de leur jardin dans l'instantané (un jardin absent : à classer, D-003). */
function seasonBeds(places: FarmPlaces, season: number): OffSeasonBed[] {
  const modes = new Map(places.plots.map((plot) => [plot.id, plot.mode]));
  return places.beds
    .filter((bed) => bed.seasons.includes(season))
    .map((bed) => ({ id: bed.id, zoneId: bed.zoneId, plotId: bed.plotId, plotMode: modes.get(bed.plotId) ?? 'unclassified' }));
}

const LEVEL_ORDER: Record<OffSeasonScope['level'], number> = { mode: 0, zone: 1, plot: 2, bed: 3 };

/** Une clé stable par portée, pour les puces et les tests. */
export function offSeasonScopeKey(scope: OffSeasonScope): string {
  switch (scope.level) {
    case 'mode': return `mode:${scope.mode}`;
    case 'zone': return `zone:${scope.zoneId}`;
    case 'plot': return `plot:${scope.plotId}`;
    case 'bed': return `bed:${scope.bedId}`;
  }
}

/**
 * Ce que le bloc montre aujourd'hui (`today`, en heure de Paris) : les
 * portées actives, de la plus large à la plus étroite, chacune avec ses
 * planches de la saison ; le compte des planches hors saison ; les modes
 * que la ferme a, et ses jardins à classer. `schedule` nul : aucun geste.
 */
export function offSeasonView(input: { schedule: OffSeasonSchedule | null; places: FarmPlaces; season: number; today: string }): OffSeasonView {
  const beds = seasonBeds(input.places, input.season);
  const plots = input.places.plots.filter((plot) => plot.seasons.includes(input.season));
  const active = input.schedule?.activeScopes(input.today) ?? [];
  const chips = active
    .map(({ scope, since }): OffSeasonChip => ({
      key: offSeasonScopeKey(scope),
      scope,
      label: offSeasonScopeLabel(scope, input.places),
      since,
      beds: beds.filter((bed) => offSeasonScopeCovers(scope, bed)).length,
    }))
    .sort((left, right) => LEVEL_ORDER[left.scope.level] - LEVEL_ORDER[right.scope.level] || compareNamesNaturally(left.label, right.label));
  return {
    chips,
    offSeasonBeds: input.schedule === null ? 0 : beds.filter((bed) => input.schedule!.scopesCovering(bed, input.today).length > 0).length,
    modes: { garden: plots.some((plot) => plot.mode === 'garden'), greenhouse: plots.some((plot) => plot.mode === 'greenhouse') },
    unclassifiedGardens: plots.filter((plot) => plot.mode === 'unclassified').length,
  };
}

/** Les valeurs du choix des portées de mode ; les autres sont celles du sélecteur des objectifs (`zone:…`, `plot:…:…`, `bed:…:…:…`). */
const MODE_VALUES: Record<Exclude<PlotMode, 'unclassified'>, string> = { garden: 'mode:garden', greenhouse: 'mode:greenhouse' };

/**
 * Le choix des cinq portées (section 4.3) : tout le plein champ et tout le
 * sous-abri d'abord, seulement si la ferme en a ; puis les parcelles, et un
 * groupe par jardin ou abri avec ses planches, comme pour un objectif (sans
 * « Toute la ferme », qui n'est pas une portée).
 */
export function offSeasonScopeChoiceGroups(places: FarmPlaces, season: number, modes: OffSeasonView['modes']): GoalScopeChoiceGroup[] {
  const modeChoices = [
    ...(modes.garden ? [{ value: MODE_VALUES.garden, label: 'Tout le plein champ', searchText: 'Tout le plein champ' }] : []),
    ...(modes.greenhouse ? [{ value: MODE_VALUES.greenhouse, label: 'Tout le sous-abri', searchText: 'Tout le sous-abri abri' }] : []),
  ];
  const [farmGroup, ...plotGroups] = goalScopeChoiceGroups(places, season);
  const zones = farmGroup.choices.filter((choice) => choice.value !== FARM_SCOPE_VALUE);
  return [
    ...(modeChoices.length > 0 ? [{ label: 'Plein champ et sous-abri', choices: modeChoices }] : []),
    ...(zones.length > 0 ? [{ label: 'Parcelles', choices: zones }] : []),
    ...plotGroups,
  ];
}

/** La portée d'une valeur du choix ; `null` pour une valeur qui n'en est pas une. */
export function offSeasonScopeFromValue(value: string): OffSeasonScope | null {
  const parts = value.split(':');
  const id = parts.at(-1) ?? '';
  if (parts[0] === 'mode' && parts.length === 2 && (id === 'garden' || id === 'greenhouse')) return { level: 'mode', mode: id };
  if (id === '') return null;
  if (parts[0] === 'zone' && parts.length === 2) return { level: 'zone', zoneId: id };
  if (parts[0] === 'plot' && parts.length === 3) return { level: 'plot', plotId: id };
  if (parts[0] === 'bed' && parts.length === 4) return { level: 'bed', bedId: id };
  return null;
}

/** Une portée reçue d'un écran, vérifiée champ par champ : rien d'autre n'entre (le serveur ne croit pas l'écran). */
export function parsedOffSeasonScope(value: unknown): OffSeasonScope | null {
  if (typeof value !== 'object' || value === null) return null;
  const scope = value as Record<string, unknown>;
  const text = (key: string) => (typeof scope[key] === 'string' && (scope[key] as string).length > 0 && (scope[key] as string).length <= 200 ? scope[key] as string : null);
  switch (scope.level) {
    case 'mode': return scope.mode === 'garden' || scope.mode === 'greenhouse' ? { level: 'mode', mode: scope.mode } : null;
    case 'zone': { const zoneId = text('zoneId'); return zoneId ? { level: 'zone', zoneId } : null; }
    case 'plot': { const plotId = text('plotId'); return plotId ? { level: 'plot', plotId } : null; }
    case 'bed': { const bedId = text('bedId'); return bedId ? { level: 'bed', bedId } : null; }
    default: return null;
  }
}

function planches(count: number): string {
  return `${count} planche${count > 1 ? 's' : ''}`;
}

/** Le message de « Mettre hors saison » : ce qui change, à partir de quand, ce qui reste suivi ; un geste sans effet le dit (section 4.5). */
export function offSeasonPutText(label: string, changed: boolean, beds: number): string {
  if (!changed) return `${label} était déjà hors saison : rien n’a changé.`;
  return `${label} est hors saison à partir d’aujourd’hui (${planches(beds)}) : son irrigation est ignorée, ni objectif ni arrosage proposé. La pluie, la météo et les alertes restent suivies.`;
}

/**
 * Le message de « Reprendre ». Lever une portée ne lève pas celles qui la
 * recouvrent (section 4.3) : l'écran dit lesquelles restent, et combien de
 * ses planches elles gardent hors saison (cas 4).
 */
export function offSeasonResumeText(label: string, changed: boolean, still: { beds: number; labels: readonly string[] }): string {
  if (!changed) return `${label} n’était pas hors saison : rien n’a changé.`;
  const resumed = `${label} reprend : son irrigation est de nouveau calculée à partir d’aujourd’hui.`;
  if (still.beds === 0) return resumed;
  const they = still.labels.length > 1 ? 'le sont encore' : 'l’est encore';
  return `${resumed} ${planches(still.beds)} ${still.beds > 1 ? 'restent' : 'reste'} hors saison : ${still.labels.join(', ')} ${they}.`;
}

/**
 * Après « Reprendre » une portée : ses planches de la saison qu'une autre
 * portée garde hors saison aujourd'hui, et les noms de ces portées, de la
 * plus large à la plus étroite.
 */
export function stillOffSeasonAfterResume(input: { scope: OffSeasonScope; schedule: OffSeasonSchedule | null; places: FarmPlaces; season: number; today: string }): { beds: number; labels: string[] } {
  if (input.schedule === null) return { beds: 0, labels: [] };
  const covered = seasonBeds(input.places, input.season).filter((bed) => offSeasonScopeCovers(input.scope, bed));
  const keeping = new Map<string, { level: OffSeasonScope['level']; label: string }>();
  let beds = 0;
  for (const bed of covered) {
    const scopes = input.schedule.scopesCovering(bed, input.today);
    if (scopes.length > 0) beds += 1;
    for (const { scope } of scopes) keeping.set(offSeasonScopeKey(scope), { level: scope.level, label: offSeasonScopeLabel(scope, input.places) });
  }
  const labels = [...keeping.values()]
    .sort((left, right) => LEVEL_ORDER[left.level] - LEVEL_ORDER[right.level] || compareNamesNaturally(left.label, right.label))
    .map((item) => item.label);
  return { beds, labels };
}

/** Un arrosage planifié ou validé que la mise hors saison touche, en mots, pour la fenêtre (section 10, question 2). */
export type OffSeasonPlannedLine = {
  eventEquipmentId: string;
  /** « Goutte-à-goutte A · jeu. 27 nov., 8 h » */
  text: string;
  /** Les planches qu'il arrose et que la portée couvre. */
  covered: string;
  /** Les autres planches qu'il arrose : l'annuler les prive aussi de cette eau ; `null` quand il n'y en a pas. */
  others: string | null;
};

const plannedDay = new Intl.DateTimeFormat('fr-FR', { weekday: 'short', day: 'numeric', month: 'short', timeZone: FARM_TIME_ZONE });

export function offSeasonPlannedLines(list: readonly OffSeasonPlannedIrrigation[], beds: readonly Pick<Bed, 'id' | 'name'>[]): OffSeasonPlannedLine[] {
  const names = new Map(beds.map((bed) => [bed.id, bed.name]));
  const named = (ids: readonly string[]) => ids.map((id) => names.get(id) ?? id).sort(compareNamesNaturally).join(', ');
  return list.map((item) => {
    const start = new Date(item.plannedStartAt);
    const when = Number.isFinite(start.getTime()) ? `${plannedDay.format(start)}, ${clockText(start)}` : 'date inconnue';
    return {
      eventEquipmentId: item.eventEquipmentId,
      text: `${item.equipmentName} · ${when}`,
      covered: named(item.coveredBedIds),
      others: item.otherBedIds.length === 0 ? null : named(item.otherBedIds),
    };
  });
}

/** La question de la fenêtre : combien d'arrosages, et que rien n'est annulé sans ce choix. */
export function offSeasonPlannedQuestion(count: number): string {
  return count > 1
    ? `${count} arrosages planifiés ou validés arrosent ces planches à partir d’aujourd’hui. Les annuler ?`
    : '1 arrosage planifié ou validé arrose ces planches à partir d’aujourd’hui. L’annuler ?';
}

/** Le message après l'annulation, arrosage par arrosage, par le geste du planning. */
export function offSeasonCanceledText(canceled: number, failed: number): string {
  const done = canceled === 0 ? '' : `${canceled} arrosage${canceled > 1 ? 's' : ''} planifié${canceled > 1 ? 's' : ''} annulé${canceled > 1 ? 's' : ''}.`;
  const missed = failed === 0 ? '' : `${failed} n’${failed > 1 ? 'ont' : 'a'} pas pu être annulé${failed > 1 ? 's' : ''} : voyez « Arrosages ».`;
  return [done, missed].filter((part) => part !== '').join(' ');
}

/** Aujourd'hui, en heure de Paris. */
export function offSeasonToday(now: Date): string {
  return dateKeyInTimeZone(now, FARM_TIME_ZONE);
}

/** Le lien de la tuile d'« Aujourd'hui » (section 4.4) : « 3 planches hors saison ». */
export function offSeasonTileLabel(beds: number): string {
  return `${planches(beds)} hors saison`;
}

const weekDay = new Intl.DateTimeFormat('fr-FR', { weekday: 'long', timeZone: 'UTC' });

function daysText(dates: readonly string[]): string {
  return dates.map((date) => weekDay.format(new Date(`${date}T12:00:00.000Z`))).join(', ');
}

/**
 * La ligne « hors saison » d'une planche au tableau des besoins (section 6 ;
 * F1066, F991) : grisée, jamais masquée, dite « hors saison », jamais « sans
 * objectif » ni zéro ; la pluie reste suivie. `null` pour une planche en
 * saison toute la semaine.
 */
export function offSeasonNeedText(bed: { offSeason?: true; offSeasonDates?: readonly string[]; objectiveMm: number | null; manualOverrideMm: number | null }): string | null {
  const dates = bed.offSeasonDates ?? [];
  if (bed.offSeason !== true) {
    return dates.length === 0 ? null : `Hors saison ${daysText(dates)} : ces jours n’ont pas d’objectif. La pluie reste suivie.`;
  }
  const since = bed.objectiveMm !== null && dates.length > 0 ? ` depuis ${daysText([dates[0]])}` : '';
  const before = since === '' ? '' : ' L’objectif des jours d’avant reste affiché, sans rien à apporter.';
  const override = bed.manualOverrideMm === null ? '' : ' Le besoin remplacé à la main reste enregistré, inactif.';
  return `Hors saison${since} : son irrigation est ignorée, ni besoin ni arrosage proposé. La pluie reste suivie.${before}${override}`;
}

/** Un jardin dont toutes les planches sont hors saison : sa ligne le dit, au lieu d'un besoin « non calculable ». */
export function gardenAllOffSeason(beds: readonly { offSeason?: true }[]): boolean {
  return beds.length > 0 && beds.every((bed) => bed.offSeason === true);
}

/** Les planches hors saison d'un jardin, pour sa ligne : « 2 hors saison » ; `null` sans. */
export function gardenOffSeasonText(beds: readonly { offSeason?: true }[]): string | null {
  const count = beds.filter((bed) => bed.offSeason === true).length;
  return count === 0 ? null : `${count} hors saison`;
}
