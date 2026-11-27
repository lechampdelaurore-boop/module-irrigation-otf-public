import { mmText } from '../figure-origin.ts';
import { percentFromFraction } from '../units.ts';
import { moreGardensLabel, type TodayWeek } from '../today/week.ts';

/**
 * « Jardin par jardin » de la page « Semaine » (simplification, lot S4,
 * PR 2, docs/simplification-s4-contract.md, section 6) : une ligne par
 * jardin, son nom, « 12 mm sur 20 mm », une barre. Les chiffres sont les
 * lignes d'« Eau de la semaine » d'« Aujourd'hui » (`todayWeek`, T4) : une
 * seule fonction pour les deux pages, pas deux façons de faire la moyenne
 * (S1-O1). L'ordre est celui d'« Aujourd'hui » ; à plus de dix jardins, les
 * dix premiers puis « Voir les n autres », les autres dans l'ordre naturel
 * (S4-j). Un jardin sans objectif n'a pas de barre : « pas d'eau visée » et
 * « Lui en donner une » (S4-f) ; tout hors saison, « hors saison », sans lien.
 */

/** Les jardins montrés d'emblée sur la page « Semaine » (S4-j). */
export const WEEK_PAGE_GARDENS_SHOWN = 10;

type WeekRow = TodayWeek['farm'];

export type WeekGardenLine = {
  key: string;
  name: string;
  /** « 12 mm sur 20 mm », « 8 mm irrigués sur 20 mm, pluie inconnue », « pas d’eau visée ». */
  text: string;
  /** La barre, reçus sur visés, pleine au-delà de 100 % ; `null` sans objectif. */
  bar: { irrigationPercent: number; rainPercent: number; unknown: boolean } | null;
  /** La phrase lue de la ligne, nom de son lien. */
  label: string;
  /** Son pli dans « Ce qu'il reste à arroser » (section 7.4). */
  anchor: string;
  aimed: boolean;
  /** Toutes ses planches hors saison : « hors saison », sans « Lui en donner une » (recette de la ligne 34, écart c). */
  offSeason: boolean;
};

export type WeekGardens = {
  shown: WeekGardenLine[];
  hidden: WeekGardenLine[];
  moreLabel: string | null;
  /** « 3 planches n’ont pas d’eau visée : elles ne sont pas comptées. », une fois sous la liste ; `null` quand toutes en ont une ou aucune. */
  unaimedBeds: string | null;
};

function mm(value: number): string {
  return mmText(Math.round(value * 10) / 10);
}

/** « (3 planches de 5 ont un objectif) » : le jardin chiffré sur une partie de ses planches le dit (F280). */
function partOf(row: WeekRow): string {
  const { withObjective, total } = row.objectiveBeds;
  if (withObjective === 0 || withObjective === total) return '';
  return ` (${withObjective} planche${withObjective > 1 ? 's' : ''} de ${total} ${withObjective > 1 ? 'ont' : 'a'} un objectif)`;
}

function gardenLine(row: WeekRow): WeekGardenLine {
  const objective = row.objectiveMm;
  if (objective === null) {
    const offSeason = allOffSeason(row);
    const text = offSeason ? 'hors saison' : 'pas d’eau visée';
    return { key: row.key, name: row.name, text, bar: null, label: `${row.name} : ${text}`, anchor: row.anchor, aimed: false, offSeason };
  }
  const percent = (value: number) => (objective <= 0 ? (value > 0 ? 100 : 0) : Math.round(percentFromFraction(Math.min(1, Math.max(0, value / objective))) * 10) / 10);
  const irrigationPercent = percent(row.irrigationMm);
  const text = row.receivedMm === null
    ? `${mm(row.irrigationMm)} irrigués sur ${mm(objective)}${partOf(row)}, pluie inconnue`
    : `${mm(row.receivedMm)} sur ${mm(objective)}${partOf(row)}`;
  return {
    key: row.key,
    name: row.name,
    text,
    bar: {
      irrigationPercent,
      rainPercent: row.rainMm === null ? 0 : Math.max(0, Math.round((percent(row.irrigationMm + row.rainMm) - irrigationPercent) * 10) / 10),
      unknown: row.rainMm === null,
    },
    label: `${row.name} : ${text}`,
    anchor: row.anchor,
    aimed: true,
    offSeason: false,
  };
}

function allOffSeason(row: WeekRow): boolean {
  return row.objectiveBeds.total > 0 && row.objectiveBeds.offSeason === row.objectiveBeds.total;
}

/** Les lignes des jardins, d'après la semaine d'« Aujourd'hui » lue avec dix jardins montrés. */
export function weekGardens(week: Pick<TodayWeek, 'farm' | 'shown' | 'hidden'>): WeekGardens {
  // Une planche hors saison n'attend pas d'objectif : elle n'est pas « sans eau visée » (écart c).
  const { withObjective, total, offSeason = 0 } = week.farm.objectiveBeds;
  const unaimed = total - withObjective - offSeason;
  const hidden = week.hidden.map(gardenLine);
  return {
    shown: week.shown.map(gardenLine),
    hidden,
    moreLabel: moreGardensLabel(hidden.length),
    unaimedBeds: withObjective === 0 || unaimed === 0 ? null
      : unaimed === 1 ? '1 planche n’a pas d’eau visée : elle n’est pas comptée.'
        : `${unaimed} planches n’ont pas d’eau visée : elles ne sont pas comptées.`,
  };
}
