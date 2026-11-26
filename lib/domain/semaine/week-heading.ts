import { addDaysToDateKey, weekStartDateKey } from '../water-management.ts';

/**
 * La ligne des flèches et le titre de la page « Semaine » (simplification,
 * lot S4, PR 2, docs/simplification-s4-contract.md, sections 4, point 1, et
 * 4.1) : « Cette semaine » quand la semaine contient aujourd'hui, sinon
 * « Semaine du 8 au 14 juin » ; dessous, « du lundi 15 au dimanche 21 juin ».
 * Du lundi au dimanche, à l'heure de la ferme (D-004). L'adresse dit la
 * semaine (`week`, précision S4-g) : les flèches mènent à une adresse, que le
 * rechargement, le bouton retour et un lien envoyé retrouvent.
 */

export type WeekState = 'current' | 'past' | 'upcoming';

export type WeekHeading = {
  state: WeekState;
  /** « Cette semaine », « Semaine du 8 au 14 juin », « Semaine du 8 au 14 juin 2025 » pour une autre saison. */
  title: string;
  /** « du lundi 15 au dimanche 21 juin ». */
  range: string;
  weekStart: string;
  weekEnd: string;
  /** Le lundi des semaines voisines, pour les flèches. */
  previous: string;
  next: string;
  /** Le lundi de la semaine en cours, pour le raccourci « Cette semaine » ; `null` quand on y est (F470). */
  thisWeek: string | null;
};

const WEEK_LAST_DAY = 6;
const DAYS_PER_WEEK = 7;

const dayParts = new Intl.DateTimeFormat('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' });

type DayParts = { weekday: string; day: string; month: string; year: string };

function parts(dateKey: string): DayParts {
  const found = Object.fromEntries(dayParts.formatToParts(new Date(`${dateKey}T12:00:00.000Z`)).map((part) => [part.type, part.value]));
  // « 1er juin », comme on l'écrit (le format du navigateur écrit « 1 juin »).
  const day = found.day === '1' ? '1er' : String(found.day);
  return { weekday: String(found.weekday), day, month: String(found.month), year: String(found.year) };
}

/**
 * « 8 au 14 juin », « 29 juin au 5 juillet », « 28 décembre 2026 au 3 janvier
 * 2027 » ; `weekdays` ajoute le nom des jours, `year` l'année quand les deux
 * jours sont de la même.
 */
function spanText(start: string, end: string, { weekdays, year }: { weekdays: boolean; year: boolean }): string {
  const from = parts(start);
  const to = parts(end);
  const day = (value: DayParts) => (weekdays ? `${value.weekday} ${value.day}` : value.day);
  const sameYear = from.year === to.year;
  const tail = `${day(to)} ${to.month}${!sameYear || year ? ` ${to.year}` : ''}`;
  if (!sameYear) return `${day(from)} ${from.month} ${from.year} au ${tail}`;
  if (from.month !== to.month) return `${day(from)} ${from.month} au ${tail}`;
  return `${day(from)} au ${tail}`;
}

/**
 * Le titre et les flèches d'une semaine. `weekStart` est le lundi affiché
 * (toute date de la semaine est ramenée à son lundi), `today` le jour de la
 * ferme, `season` la saison affichée et `currentSeason` celle d'aujourd'hui :
 * une autre saison dit son année dans le titre (section 4.1).
 */
export function weekHeading({ weekStart, today, season, currentSeason }: { weekStart: string; today: string; season: number; currentSeason: number }): WeekHeading {
  const start = weekStartDateKey(weekStart);
  const end = addDaysToDateKey(start, WEEK_LAST_DAY);
  const state: WeekState = end < today ? 'past' : start > today ? 'upcoming' : 'current';
  const otherSeason = season !== currentSeason;
  return {
    state,
    title: state === 'current' && !otherSeason ? 'Cette semaine' : `Semaine du ${spanText(start, end, { weekdays: false, year: otherSeason })}`,
    range: `du ${spanText(start, end, { weekdays: true, year: false })}`,
    weekStart: start,
    weekEnd: end,
    previous: addDaysToDateKey(start, -DAYS_PER_WEEK),
    next: addDaysToDateKey(start, DAYS_PER_WEEK),
    thisWeek: state === 'current' ? null : weekStartDateKey(today),
  };
}

