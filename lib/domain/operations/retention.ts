import { HOURS_PER_DAY, millisecondsFromHours } from '../units.ts';
import { addDaysToDateKey } from '../water-management.ts';
import { OTF_CALL_OUTCOME_HOURS_KEPT, outcomeHourStartMs } from '../otf/call-outcome.ts';
import { OTF_AUTHENTICATION_BRAKE_WINDOW_MS, OTF_CALL_ROWS_KEPT_MS, oldestKeptCountDay, parisDayOf } from '../otf/shared-call-pace.ts';

/**
 * La conservation des données à durée limitée (4.5, PR 5 ;
 * docs/tranche-4-contract.md, F562, et 10 bis.18, F649 à F653) : ce qui ne
 * dépend pas de la base.
 *
 * Chaque table de la base a sa durée et qui l'efface (`db/retention-plan.ts`).
 * Celles dont les lignes vieillissent ont ici leur limite, calculée à partir
 * de l'instant du passage : les mêmes constantes que les purges faites « au
 * passage » par le compteur des appels (F361, F363, F614), pour qu'une seule
 * durée soit écrite par donnée. La tâche « Purges de conservation » du matin
 * les applique chaque jour, même quand rien ne lit Ouvre ta ferme.
 */

/**
 * La notification du jour de la veille de l'exploitant (F611) : 35 jours,
 * assez pour relire un mois de veille ; la page d'état ne montre que la
 * dernière.
 */
export const OPERATOR_NOTICES_KEPT_DAYS = 35;

/** Les lignes effacées par instruction, comme les lots de l'effacement d'une ferme (F644) : loin des bornes de D1. */
export const RETENTION_PURGE_BATCH_ROWS = 500;

/**
 * Les instructions d'un passage du matin : assez pour rattraper, en un
 * matin, 25 000 lignes en retard ; ce qui reste reprend au passage suivant.
 * Le reste du matin garde sa place dans les 1 000 requêtes qu'une exécution
 * d'un Worker payant peut faire à D1 (F644).
 */
export const RETENTION_PURGE_RUN_STATEMENTS = 50;

/** Les tables purgées par durée, dans l'ordre du passage. */
export type RetentionPurgeKey =
  | 'otf_call_starts'
  | 'otf_call_outcomes'
  | 'otf_daily_calls'
  | 'otf_call_pauses'
  | 'otf_authentication_failures'
  | 'irrigation_operator_notices';

/**
 * La limite de chaque purge à l'instant `atMs` : une ligne en deçà est
 * effacée, la limite elle-même comprise ou non selon la règle d'origine.
 */
export const RETENTION_LIMITS: Readonly<Record<RetentionPurgeKey, (atMs: number) => number | string>> = {
  // Une ligne par appel parti, deux jours (F361).
  otf_call_starts: (atMs) => atMs - OTF_CALL_ROWS_KEPT_MS,
  // Les appels comptés par heure et par résultat, huit jours (F614).
  otf_call_outcomes: (atMs) => outcomeHourStartMs(atMs) - millisecondsFromHours(OTF_CALL_OUTCOME_HOURS_KEPT),
  // Le compte du jour d'une ferme, trente jours (F363).
  otf_daily_calls: (atMs) => oldestKeptCountDay(atMs),
  // Une pause finie ne sert plus (F361, F363).
  otf_call_pauses: (atMs) => atMs,
  // Les refus d'authentification comptés par le frein, quinze minutes (F359).
  otf_authentication_failures: (atMs) => atMs - OTF_AUTHENTICATION_BRAKE_WINDOW_MS,
  irrigation_operator_notices: (atMs) => addDaysToDateKey(parisDayOf(atMs), -OPERATOR_NOTICES_KEPT_DAYS),
};

/** Les durées, en clair, telles que le contrat et la politique de confidentialité les disent. */
export const RETENTION_WORDS: Readonly<Record<RetentionPurgeKey, string>> = {
  otf_call_starts: '2 jours',
  otf_call_outcomes: `${OTF_CALL_OUTCOME_HOURS_KEPT / HOURS_PER_DAY} jours`,
  otf_daily_calls: '30 jours',
  otf_call_pauses: 'jusqu’à la fin de la pause',
  otf_authentication_failures: '15 minutes',
  irrigation_operator_notices: `${OPERATOR_NOTICES_KEPT_DAYS} jours`,
};

/** Ce que le matin a purgé. */
export type RetentionPurgeRunReport = {
  /** Les lignes effacées, toutes tables confondues. */
  purged: number;
  /** Les purges arrêtées par la borne du passage, qui reprendront au suivant. */
  unfinished: number;
  /** La classe d'erreur de chaque purge qui a échoué, dans l'ordre. */
  failures: readonly string[];
};
