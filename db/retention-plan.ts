import { RETENTION_WORDS, type RetentionPurgeKey } from '../lib/domain/operations/retention.ts';
import { SPACE_ROOT_TABLE, SPACE_TABLES } from './farm-erasure-plan.ts';

/**
 * Le plan de conservation (4.5, PR 5 ; docs/tranche-4-contract.md, F562, et
 * 10 bis.18, F649 à F651) : pour chaque table de la base, combien de temps
 * ses lignes sont gardées, et qui les efface.
 *
 * - Les tables d'un espace (celles du plan d'effacement, `SPACE_TABLES`, et
 *   l'espace lui-même) ont une seule règle, `SPACE_RETENTION` : gardées tant
 *   que l'espace existe.
 * - Chaque autre table a la sienne dans `RETENTION_PLAN`, en clair ; celles
 *   dont les lignes vieillissent nomment leur purge, que la tâche
 *   « Purges de conservation » du matin applique (`RETENTION_PURGES`).
 *
 * `tests/retention-plan.test.ts` lit la base migrée et échoue si une table
 * n'a pas de règle ou si elle en a deux : une table ajoutée plus tard sans
 * durée écrite casse la CI, comme une table ajoutée sans règle d'effacement.
 */

export type RetentionRule = {
  /** Combien de temps, en clair. */
  kept: string;
  /** Qui efface, en clair. */
  erasedBy: string;
};

/** Une purge par durée : la condition des lignes trop vieilles, avec un seul paramètre, la limite (`RETENTION_LIMITS`). */
export type RetentionPurge = { table: RetentionPurgeKey; condition: string };

/** Les tables d'un espace : ce que la personne saisit, et ce que le module calcule ou lit pour elle. */
export const SPACE_RETENTION: RetentionRule = {
  kept: 'Tant que l’espace existe.',
  erasedBy: 'L’effacement de la ferme, sept jours après sa demande (F563, F641). Après « Déconnecter la ferme » (4.3, PR 3), 90 jours, puis le même effacement (F562, F652).',
};

/** La règle et la purge éventuelle de chaque table qui n'est pas d'un espace. */
export const RETENTION_PLAN: Readonly<Record<string, RetentionRule & { purge?: string }>> = {
  otf_snapshots: {
    kept: 'Tant que la ferme est lue : chaque lecture remplace la copie de sa saison.',
    erasedBy: 'L’effacement de l’espace (F642) ; « Déconnecter la ferme » (4.3, PR 3, F360).',
  },
  otf_farm_connections: {
    kept: 'Tant que la ferme est reliée.',
    erasedBy: '« Déconnecter la ferme », ou l’autorisation retirée dans Ouvre ta ferme (4.3, F358, F360) ; l’effacement de l’espace (F642).',
  },
  otf_farm_reads: {
    kept: 'Une ligne par ferme (le bail de lecture, la base de la réserve, la dernière lecture complète), tant qu’un espace garde la ferme.',
    erasedBy: 'L’effacement du dernier espace de la ferme (F642).',
  },
  otf_call_starts: {
    kept: RETENTION_WORDS.otf_call_starts,
    erasedBy: 'La purge du matin et chaque départ de lecture (F361) ; l’effacement du dernier espace de la ferme (F642).',
    purge: 'started_at_ms < ?',
  },
  otf_call_outcomes: {
    kept: RETENTION_WORDS.otf_call_outcomes,
    erasedBy: 'La purge du matin et chaque appel compté (F614) ; l’effacement du dernier espace de la ferme (F642).',
    purge: 'hour_start_ms < ?',
  },
  otf_daily_calls: {
    kept: RETENTION_WORDS.otf_daily_calls,
    erasedBy: 'La purge du matin et chaque départ de lecture (F363) ; l’effacement du dernier espace de la ferme (F642).',
    purge: 'paris_day < ?',
  },
  otf_call_pauses: {
    kept: RETENTION_WORDS.otf_call_pauses,
    erasedBy: 'La purge du matin et chaque départ de lecture (F361) ; l’effacement du dernier espace de la ferme (F642).',
    purge: 'paused_until_ms <= ?',
  },
  otf_authentication_failures: {
    kept: RETENTION_WORDS.otf_authentication_failures,
    erasedBy: 'La purge du matin et chaque départ de lecture (F359). Des heures seules, d’aucune ferme.',
    purge: 'failed_at_ms <= ?',
  },
  irrigation_operator_notices: {
    kept: RETENTION_WORDS.irrigation_operator_notices,
    erasedBy: 'La purge du matin (F650). Un genre, un nombre et des heures, d’aucune ferme.',
    purge: 'paris_day < ?',
  },
  irrigation_farm_erasures: {
    kept: 'Sans limite : la preuve qu’une demande d’effacement a été traitée.',
    erasedBy: 'Personne. L’identifiant interne de l’espace, un état et des dates ; ni nom, ni personne, ni ferme, ni contenu ; une fois l’espace effacé, il ne désigne plus rien (F640).',
  },
  irrigation_background_jobs: {
    kept: 'Une ligne par tâche du registre, réécrite à chaque exécution.',
    erasedBy: 'Personne : des heures, des nombres et des classes d’erreur, d’aucune ferme.',
  },
  irrigation_crop_alert_common: {
    kept: 'Sans limite : les seuils de gel communs, les mêmes pour toutes les fermes.',
    erasedBy: 'Une migration qui les change ; aucune ligne n’est d’une ferme.',
  },
  otf_deployment_farm: {
    kept: 'Une ligne, réécrite à chaque lecture par la clé du déploiement.',
    erasedBy: 'Personne : le réglage du déploiement, pas une donnée de la personne.',
  },
};

/** Les tables d'un espace, l'espace compris. */
export const SPACE_RETENTION_TABLES: readonly string[] = [...SPACE_TABLES.map(({ table }) => table), SPACE_ROOT_TABLE];

/** Les purges par durée, dans l'ordre du plan. */
export const RETENTION_PURGES: readonly RetentionPurge[] = Object.entries(RETENTION_PLAN).flatMap(([table, rule]) => (
  rule.purge ? [{ table: table as RetentionPurgeKey, condition: rule.purge }] : []
));
