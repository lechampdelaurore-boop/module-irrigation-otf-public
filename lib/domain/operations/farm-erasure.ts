import { millisecondsFromDays } from '../units.ts';
import { parisMoment } from './operator-watch.ts';

/**
 * L'effacement d'une ferme (4.5, PR 3 ; docs/tranche-4-contract.md, F563, et
 * 10 bis.17, F640 à F648) : ce qui ne dépend pas de la base.
 *
 * Une personne demande l'effacement de son espace sur une ferme ; il a lieu
 * sept jours après, annulable entre-temps. Pendant ce délai l'espace est
 * figé : les traitements du matin le sautent. Le premier matin après le
 * délai, la tâche « farm-erasure » efface par lots tout ce que l'espace
 * garde, puis l'espace lui-même ; ce qui n'a pas pu finir reprend au passage
 * suivant.
 */

/** Le délai entre la demande et l'effacement, annulable pendant ce temps (F563 : la recommandation). */
export const FARM_ERASURE_DELAY_DAYS = 7;

/** Les lignes effacées par instruction : la base D1 borne le travail d'une requête (F563, preuve 3 ; F644). */
export const FARM_ERASURE_BATCH_ROWS = 200;

/**
 * Le travail d'un passage du matin : au plus tant d'instructions, et rien de
 * neuf après tant de secondes. Ce qui reste reprend au passage suivant (le
 * matin passe deux fois, à une heure d'écart, puis chaque jour). La borne des
 * instructions laisse de la place au reste du matin dans les 1 000 requêtes
 * qu'une exécution d'un Worker payant peut faire à D1.
 */
export const FARM_ERASURE_RUN_BUDGET = { statements: 300, milliseconds: 20_000 } as const;

export type FarmErasureState = 'pending' | 'erasing' | 'erased' | 'cancelled';

/** L'heure à partir de laquelle une demande faite à `requestedAt` s'efface. */
export function farmErasureDueAt(requestedAt: Date): Date {
  return new Date(requestedAt.getTime() + millisecondsFromDays(FARM_ERASURE_DELAY_DAYS));
}

/** Ce que le matin a fait des demandes échues. */
export type FarmErasureRunReport = {
  /** Les demandes échues traitées à ce passage, commencées avant ou à l'instant. */
  due: number;
  /** Celles effacées jusqu'au bout. */
  erased: number;
  /** Celles arrêtées par la borne du passage, qui reprendront au suivant. */
  unfinished: number;
  /** La classe d'erreur de chacune de celles qui ont échoué, dans l'ordre. */
  failures: readonly string[];
};

/** Les demandes d'effacement, comptées pour la page d'état. */
export type FarmErasureCounts = {
  /** En attente de leur délai de sept jours, encore annulables. */
  waiting: number;
  /** Échues, ou commencées, pas encore faites. */
  due: number;
  erased: number;
  lastErasedAt: string | null;
};

export type FarmErasureLine = { tone: 'ok' | 'warn'; text: string };

/**
 * « Demandes d'effacement : 1 en attente, 2 faites ; dernière faite le 20/11
 * à 6 h 16. » (F563, point 5 ; F646). Une demande échue et pas encore faite
 * se dit à part, en orange : le registre la surveille aussi.
 */
export function farmErasureLine(counts: FarmErasureCounts): FarmErasureLine {
  const { waiting, due, erased, lastErasedAt } = counts;
  if (waiting + due + erased === 0) return { tone: 'ok', text: 'Aucune demande d’effacement.' };
  const parts = [
    `${waiting} en attente`,
    ...(due > 0 ? [`${due} à effacer`] : []),
    erased === 0 ? 'aucune faite' : `${erased} faite${erased > 1 ? 's' : ''}`,
  ];
  const last = lastErasedAt ? ` ; dernière faite le ${parisMoment(lastErasedAt)}` : '';
  return { tone: due > 0 ? 'warn' : 'ok', text: `Demandes d’effacement : ${parts.join(', ')}${last}.` };
}
