import { db } from '../binding';
import { familyOfSubject, isChangeFieldKey, type ChangeSubject } from '@/lib/domain/change-journal/subjects';

/**
 * Les instructions qui écrivent une ligne du journal des modifications
 * (amélioration n° 7, docs/ameliorations-6-2-3-7-contract.md, section 5,
 * F706 à F709 ; D-285).
 *
 * **Une ligne s'écrit dans le même lot que le changement, à ses conditions
 * mêmes** (F709) : l'écrivain place l'instruction du journal dans son
 * `db.batch`, avec la condition qui désigne la ligne qu'il change. Tout le
 * lot réussit ou rien n'est gardé ; un changement refusé (ligne introuvable,
 * d'un autre espace, déjà supprimée) n'écrit rien, au journal non plus.
 *
 * L'avant se lit **dans la base, dans le lot**, jamais d'une lecture faite
 * plus tôt : deux gestes presque simultanés ne peuvent pas laisser un avant
 * périmé. L'avant et l'après ne gardent que les champs qui changent, comparés
 * par SQLite (`IS`, qui tient `NULL` pour une valeur) ; un geste qui ne change
 * rien n'écrit aucune ligne.
 *
 * - `journalCreation` : **après** l'insertion, l'après lu sur la ligne écrite ;
 * - `journalUpdate` : **avant** l'écriture, l'avant lu sur la ligne d'avant,
 *   l'après donné par l'écrivain (les valeurs mêmes qu'il écrit) ;
 * - `journalDeletion` : **avant** l'effacement, l'avant lu sur la ligne.
 *
 * Les colonnes et les conditions sont du code, jamais une saisie : seules
 * les valeurs passent en paramètres.
 */

/** Ce que chaque ligne porte : l'espace, la personne, l'instant, le sujet et l'objet touché. */
export type JournalLine = {
  workspaceId: string;
  actorUserId: string;
  /** L'instant du geste, ISO 8601, le même que celui que l'écrivain écrit. */
  at: string;
  subject: ChangeSubject;
  /** L'identifiant de la ligne touchée, ou `null` pour un réglage de toute la ferme. */
  objectId: string | null;
  /** Le repère de l'objet (§5.2) : une valeur connue, ou une colonne lue sur la ligne (`current.name`). */
  context?: Readonly<Record<string, JournalValue>>;
};

/** Une valeur du repère ou de l'après : donnée par l'écrivain, ou lue en SQL sur la ligne `current`. */
type JournalValue = { value: string | number | boolean | null } | { sql: string };

/**
 * La ligne de l'objet, lue sous l'alias `current` : sa table et la condition
 * qui la désigne, celle du geste lui-même. Elle désigne une ligne au plus.
 */
export type JournalTarget = { table: string; where: string; params?: readonly unknown[] };

/** Un champ : son nom, sa valeur actuelle lue en SQL sur `current`, et pour un changement, la valeur écrite. */
export type JournalField = { key: string; current: string; next?: unknown };

type Statement = { sql: string; params: unknown[] };

const TABLE_NAME = /^[a-z_]+$/;

function checkTarget(target: JournalTarget): void {
  if (!TABLE_NAME.test(target.table)) throw new Error(`Table du journal invalide : ${target.table}`);
}

function checkFields(fields: readonly JournalField[]): void {
  if (fields.length === 0) throw new Error('Une ligne du journal porte au moins un champ.');
  const seen = new Set<string>();
  for (const { key } of fields) {
    if (!isChangeFieldKey(key) || seen.has(key)) throw new Error(`Champ du journal invalide ou en double : ${key}`);
    seen.add(key);
  }
}

/** `json_object('a', <a>, 'b', <b>)` ; une valeur donnée devient un paramètre. */
function jsonObject(entries: readonly (readonly [string, JournalValue])[]): Statement {
  if (entries.length === 0) return { sql: 'NULL', params: [] };
  const params: unknown[] = [];
  const parts = entries.map(([key, value]) => {
    if ('sql' in value) return `'${key}', ${value.sql}`;
    params.push(value.value);
    return `'${key}', ?`;
  });
  return { sql: `json_object(${parts.join(', ')})`, params };
}

function contextOf(line: JournalLine): Statement {
  const entries = Object.entries(line.context ?? {});
  for (const [key] of entries) if (!isChangeFieldKey(key)) throw new Error(`Repère du journal invalide : ${key}`);
  return jsonObject(entries);
}

const INSERT_HEAD = `INSERT INTO irrigation_change_journal
  (id, workspace_id, family, subject, object_id, object_context, action, before_values, after_values, actor_user_id, created_at)`;

function head(line: JournalLine): unknown[] {
  return [crypto.randomUUID(), line.workspaceId, familyOfSubject(line.subject), line.subject, line.objectId];
}

/**
 * La création d'un objet : placée **après** l'insertion dans le lot, elle lit
 * l'après sur la ligne écrite ; aucune ligne si l'insertion n'a rien écrit
 * (une insertion ignorée, par exemple).
 */
export function journalCreation(line: JournalLine, target: JournalTarget, fields: readonly JournalField[]): D1PreparedStatement {
  checkTarget(target);
  checkFields(fields);
  const context = contextOf(line);
  const after = jsonObject(fields.map(({ key, current }) => [key, { sql: current }] as const));
  return db.prepare(`${INSERT_HEAD}
    SELECT ?, ?, ?, ?, ?, ${context.sql}, 'cree', NULL, ${after.sql}, ?, ?
    FROM ${target.table} AS current WHERE ${target.where}`)
    .bind(...head(line), ...context.params, ...after.params, line.actorUserId, line.at, ...(target.params ?? []));
}

/**
 * L'effacement d'un objet, ou sa suppression logique : placée **avant**
 * l'écriture dans le lot, à sa condition même, elle garde l'avant de chaque
 * champ. Rien si la ligne n'est pas là.
 */
export function journalDeletion(line: JournalLine, target: JournalTarget, fields: readonly JournalField[]): D1PreparedStatement {
  checkTarget(target);
  checkFields(fields);
  const context = contextOf(line);
  const before = jsonObject(fields.map(({ key, current }) => [key, { sql: current }] as const));
  return db.prepare(`${INSERT_HEAD}
    SELECT ?, ?, ?, ?, ?, ${context.sql}, 'supprime', ${before.sql}, NULL, ?, ?
    FROM ${target.table} AS current WHERE ${target.where}`)
    .bind(...head(line), ...context.params, ...before.params, line.actorUserId, line.at, ...(target.params ?? []));
}

/**
 * Quand la ligne de l'objet manque :
 * - `refuse` (par défaut) : le changement porte sur une ligne qui existe ;
 *   sans elle, rien ;
 * - `create` : le geste la crée (un enregistrement « insérer ou remplacer ») ;
 *   la ligne du journal dit alors « créé », avec chaque champ dans l'après ;
 * - `defaults` : une ligne absente vaut les valeurs par défaut, que les
 *   expressions `current` disent elles-mêmes (`COALESCE(current.x, 1)`) ;
 *   la ligne dit « modifié », de la valeur par défaut à la nouvelle.
 */
export type MissingRow = 'refuse' | 'create' | 'defaults';

/**
 * Le changement d'un objet : placée **avant** l'écriture dans le lot, à sa
 * condition même. L'avant se lit sur la ligne d'avant ; l'après est la valeur
 * que l'écrivain écrit (`next`). Seuls les champs qui changent sont gardés ;
 * si rien ne change, aucune ligne.
 */
export function journalUpdate(
  line: JournalLine,
  target: JournalTarget,
  fields: readonly JournalField[],
  missing: MissingRow = 'refuse',
): D1PreparedStatement {
  checkTarget(target);
  checkFields(fields);
  const context = contextOf(line);
  const next = fields.map((field, index) => ({ ...field, alias: `next.v${index}` }));
  const unchangedPaths = next.map(({ key, current, alias }) => `CASE WHEN (${current}) IS ${alias} THEN '$.${key}' ELSE '$.-' END`).join(', ');
  const before = `json_remove(json_object(${next.map(({ key, current }) => `'${key}', ${current}`).join(', ')}), ${unchangedPaths})`;
  const after = `json_remove(json_object(${next.map(({ key, alias }) => `'${key}', ${alias}`).join(', ')}), ${unchangedPaths})`;
  const changed = next.map(({ current, alias }) => `(${current}) IS NOT ${alias}`).join(' OR ');
  const values = `SELECT ${next.map((_, index) => `? AS v${index}`).join(', ')}`;
  const nextParams = next.map(({ next: value }) => (value === undefined ? null : value));
  const sql = missing === 'create'
    ? `${INSERT_HEAD}
      SELECT ?, ?, ?, ?, ?, ${context.sql},
        CASE WHEN current.rowid IS NULL THEN 'cree' ELSE 'modifie' END,
        CASE WHEN current.rowid IS NULL THEN NULL ELSE ${before} END,
        CASE WHEN current.rowid IS NULL THEN json_object(${next.map(({ key, alias }) => `'${key}', ${alias}`).join(', ')}) ELSE ${after} END,
        ?, ?
      FROM (${values}) AS next LEFT JOIN ${target.table} AS current ON ${target.where}
      WHERE current.rowid IS NULL OR ${changed}`
    : `${INSERT_HEAD}
      SELECT ?, ?, ?, ?, ?, ${context.sql}, 'modifie', ${before}, ${after}, ?, ?
      FROM (${values}) AS next ${missing === 'defaults' ? 'LEFT JOIN' : 'JOIN'} ${target.table} AS current ON ${target.where}
      WHERE ${changed}`;
  return db.prepare(sql).bind(...head(line), ...context.params, line.actorUserId, line.at, ...nextParams, ...(target.params ?? []));
}
