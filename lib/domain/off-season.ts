import type { Bed, PlotMode } from './domain.ts';
import { FARM_TIME_ZONE, dateKeyInTimeZone } from './water-management.ts';

/**
 * Le filtre « hors saison » (6 quaterdecies,
 * docs/objectif-automatique-saison-contract.md, section 4 ; D-337, PR B1) :
 * une planche, un jardin ou un abri, une parcelle, tout le plein champ ou
 * tout le sous-abri, mis hors saison à la main, ne reçoit plus d'irrigation
 * calculée : ni l'objectif saisi ni l'objectif automatique n'y compte, à
 * partir du jour du geste, en heure de Paris, comme une révision d'objectif
 * (D-034). « Reprendre », à la main seulement, le lève à partir de son jour :
 * rien ne le lève seul, ni date ni calendrier (section 10, question 1).
 *
 * Il n'ignore que l'irrigation (section 4.2) : la pluie, la réserve du sol,
 * l'ET0, la météo et ses alertes, les irrigations réelles, les semaines
 * closes et l'historique ne passent jamais par ce module ; un test de garde
 * le vérifie (tests/hors-saison-regle.test.ts).
 *
 * Ce module est le seul endroit de la règle (section 4.6) : `objectiveForBed`
 * (lib/domain/irrigation-needs.ts) reçoit sa réponse jour par jour et rend
 * les jours « hors saison » ; aucun lecteur ne la refait. Filtre vide, rien
 * ne change.
 */

/** Les deux portées de mode ; un jardin « à classer » n'est couvert par aucune (section 4.3). */
type OffSeasonMode = Exclude<PlotMode, 'unclassified'>;

/**
 * Les cinq portées (section 4.3) : une planche, un jardin ou un abri, une
 * parcelle, chacun par son identifiant OTF seul, qui le suit d'une saison à
 * l'autre (section 6) ; tout le plein champ (`garden`) et tout le sous-abri
 * (`greenhouse`), au vocabulaire de `PlotMode`.
 */
export type OffSeasonScope =
  | { level: 'bed'; bedId: string }
  | { level: 'plot'; plotId: string }
  | { level: 'zone'; zoneId: string }
  | { level: 'mode'; mode: OffSeasonMode };

/** Un geste daté (section 4.5) : mettre une portée hors saison, ou la reprendre. */
export type OffSeasonRevision = {
  scope: OffSeasonScope;
  /** `true` : « Mettre hors saison » ; `false` : « Reprendre ». */
  offSeason: boolean;
  /** L'instant du geste : il compte à partir de son jour, en heure de Paris (D-034). */
  createdAt: string;
};

/**
 * Ce que le filtre lit d'une planche : ses identifiants OTF et le mode de son
 * jardin au moment de la lecture. Une portée s'évalue à la lecture, comme un
 * objectif saisi : un jardin reclassé suit la portée qui le couvre alors.
 */
export type OffSeasonBed = Pick<Bed, 'id' | 'zoneId' | 'plotId'> & { plotMode: PlotMode };

/** Une portée hors saison un jour donné, et le jour, en heure de Paris, où elle l'est devenue. */
export type ActiveOffSeasonScope = { scope: OffSeasonScope; since: string };

/** La réponse du filtre pour une planche, jour par jour (`AAAA-MM-JJ`) : ce que `objectiveForBed` reçoit. */
export type OffSeasonDays = (date: string) => boolean;

/**
 * La réponse du filtre pour des planches, par identifiant : ce que reçoivent
 * les lecteurs qui composent l'objectif sur une période, jour par jour
 * (l'historique, les séries ; D-352). Une planche absente est en saison.
 */
export type OffSeasonByBed = ReadonlyMap<string, OffSeasonDays>;

/** Le filtre d'une ferme, lu jour par jour ; le jour de chaque geste ne se calcule qu'une fois. */
export type OffSeasonSchedule = {
  /** Les portées hors saison ce jour-là, chacune depuis le jour où elle l'est devenue. */
  activeScopes(date: string): readonly ActiveOffSeasonScope[];
  /** Les portées hors saison qui couvrent la planche ce jour-là ; aucune : elle est en saison. */
  scopesCovering(bed: OffSeasonBed, date: string): ActiveOffSeasonScope[];
  /** La réponse pour une planche : hors saison quand une portée active au moins la couvre (section 4.3). */
  daysOf(bed: OffSeasonBed): OffSeasonDays;
};

type DatedGesture = { offSeason: boolean; createdAt: string; day: string };

/**
 * Le filtre d'une ferme à partir de ses gestes. Pour chaque portée, le
 * dernier geste posé ce jour ou avant, en heure de Paris, fait foi ; deux
 * gestes du même jour, le second fait foi pour toute la journée, et deux
 * gestes de la même milliseconde gardent l'ordre reçu
 * (docs/revision-order-contract.md, comme `automaticObjectiveSchedule`).
 * Une planche est hors saison quand une portée active au moins la couvre ;
 * lever une portée ne lève pas celles qui la recouvrent (section 4.3).
 */
export function offSeasonSchedule(revisions: readonly OffSeasonRevision[]): OffSeasonSchedule {
  const byScope = new Map<string, { scope: OffSeasonScope; gestures: DatedGesture[] }>();
  for (const revision of revisions) {
    const key = scopeKey(revision.scope);
    const entry = byScope.get(key) ?? { scope: revision.scope, gestures: [] };
    entry.gestures.push({ offSeason: revision.offSeason, createdAt: revision.createdAt, day: dateKeyInTimeZone(revision.createdAt, FARM_TIME_ZONE) });
    byScope.set(key, entry);
  }
  // Tri stable sur l'instant seul : deux gestes de la même milliseconde restent dans l'ordre reçu.
  for (const entry of byScope.values()) entry.gestures.sort((left, right) => left.createdAt.localeCompare(right.createdAt));
  const byDate = new Map<string, readonly ActiveOffSeasonScope[]>();
  const activeScopes = (date: string): readonly ActiveOffSeasonScope[] => {
    const known = byDate.get(date);
    if (known !== undefined) return known;
    const active: ActiveOffSeasonScope[] = [];
    for (const { scope, gestures } of byScope.values()) {
      const since = offSeasonSince(gestures, date);
      if (since !== null) active.push({ scope, since });
    }
    byDate.set(date, active);
    return active;
  };
  const scopesCovering = (bed: OffSeasonBed, date: string) => activeScopes(date).filter((active) => scopeCovers(active.scope, bed));
  return {
    activeScopes,
    scopesCovering,
    daysOf: (bed) => (date) => activeScopes(date).some((active) => scopeCovers(active.scope, bed)),
  };
}

/**
 * L'objectif d'une planche sur une période est « hors saison » : aucun jour
 * n'a d'objectif et au moins un jour est hors saison. Elle sort alors des
 * comptes d'objectif et se dit « hors saison », jamais « sans objectif » ni
 * zéro (section 4.1, D-003). Une planche qui garde un objectif sur une
 * partie de la période le garde, compté comme tout objectif posé en cours de
 * semaine (D-034).
 */
export function objectiveOffSeason(bed: { objectiveMm: number | null; offSeasonDates?: readonly string[] }): boolean {
  return bed.objectiveMm === null && (bed.offSeasonDates?.length ?? 0) > 0;
}

/**
 * Le besoin d'une planche est hors saison pour la semaine (D-352) : son
 * objectif l'est (`objectiveOffSeason`), ou elle est hors saison le jour du
 * calcul, `today`, en heure de Paris. Seul « Reprendre » lève une portée
 * (section 10, question 1) : hors saison ce jour-là, la planche le reste
 * jusqu'à la fin de la semaine, et rien ne lui reste à donner ; l'objectif de
 * ses jours d'avant reste écrit, inactif. Ni besoin, ni volume, ni
 * proposition d'arrosage ; la pénurie et la faisabilité ne la comptent pas
 * (section 4.1). Reprise ce jour-là, elle est servie sur l'objectif de ses
 * jours en saison (cas 9). Une semaine passée ne contient pas le jour du
 * calcul : seul son objectif compte, comme dans l'historique.
 */
export function needOffSeason(bed: { objectiveMm: number | null; offSeasonDates?: readonly string[] }, today: string): boolean {
  return objectiveOffSeason(bed) || (bed.offSeasonDates?.includes(today) ?? false);
}

/**
 * La portée couvre-t-elle la planche ? Évaluée à la lecture, avec le mode du
 * jardin à ce moment-là : un jardin à classer n'est couvert par aucune portée
 * de mode (section 4.3, D-003). Pour la liste des arrosages planifiés à
 * proposer à l'annulation (section 10, question 2) ; la réponse jour par jour
 * reste celle de `offSeasonSchedule`.
 */
export function offSeasonScopeCovers(scope: OffSeasonScope, bed: OffSeasonBed): boolean {
  return scopeCovers(scope, bed);
}

/**
 * Le jour où la portée est devenue hors saison, si elle l'est le jour
 * `date` ; `null` quand elle est en saison. Un second « Mettre hors saison »
 * sans « Reprendre » entre les deux ne change pas ce jour.
 */
function offSeasonSince(gestures: readonly DatedGesture[], date: string): string | null {
  let since: string | null = null;
  for (const gesture of gestures) {
    // Les gestes sont dans l'ordre du temps : leur jour, en heure de Paris, ne recule jamais.
    if (gesture.day > date) break;
    since = gesture.offSeason ? (since ?? gesture.day) : null;
  }
  return since;
}

function scopeCovers(scope: OffSeasonScope, bed: OffSeasonBed): boolean {
  switch (scope.level) {
    case 'bed': return scope.bedId === bed.id;
    case 'plot': return scope.plotId === bed.plotId;
    case 'zone': return scope.zoneId === bed.zoneId;
    // Un jardin à classer n'est ni plein champ ni sous abri : aucune portée de mode ne le couvre (D-003).
    case 'mode': return scope.mode === bed.plotMode;
  }
}

function scopeKey(scope: OffSeasonScope): string {
  switch (scope.level) {
    case 'bed': return `bed:${scope.bedId}`;
    case 'plot': return `plot:${scope.plotId}`;
    case 'zone': return `zone:${scope.zoneId}`;
    case 'mode': return `mode:${scope.mode}`;
  }
}
