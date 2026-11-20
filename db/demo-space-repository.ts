import { db } from './binding';

/**
 * Les espaces de la démonstration et leur remise à zéro
 * (docs/demo-guided-contract.md, section 8 ; D4). Un espace remis à zéro
 * n'est pas effacé : son identité est mise de côté (`…·archive·<date>`), et
 * l'invité retrouve, à sa prochaine requête, un espace neuf préparé comme à
 * sa première ouverture. Toutes ses lignes pendent à l'espace, jamais à
 * l'invité : changer la seule identité de l'espace les détache d'un coup, en
 * une écriture, sans toucher aux tables que le module garde immuables (les
 * déclarations du sol, les coefficients corrigés). Seule la base de la
 * démonstration est visée : le service refuse hors démonstration.
 */

const DEMO_MARK = '%·demo·%';
const ARCHIVE_MARK = '·archive·';
const NOW = "strftime('%Y-%m-%dT%H:%M:%fZ', 'now')";

/** L'identité mise de côté d'un espace remis à zéro : elle n'est plus celle d'aucun invité. */
function archivedOwnerId(ownerUserId: string, archivedAt: string): string {
  return `${ownerUserId}${ARCHIVE_MARK}${archivedAt}`;
}

/** Met de côté l'espace de cet invité, s'il existe ; dit si un espace a été mis de côté. */
export async function archiveDemoWorkspace(ownerUserId: string, archivedAt: string): Promise<boolean> {
  const result = await db.prepare(
    `UPDATE irrigation_workspaces SET owner_user_id = ?, updated_at = ${NOW}
     WHERE owner_user_id = ? AND otf_farm_id IS NULL`,
  ).bind(archivedOwnerId(ownerUserId, archivedAt), ownerUserId).run();
  return Number(result.meta.changes ?? 0) === 1;
}

/**
 * L'invité est passé : l'espace porte l'heure de son dernier passage, au plus
 * une écriture par heure, pour que la tâche de nuit sache qui est inactif.
 */
export async function touchDemoWorkspace(ownerUserId: string): Promise<void> {
  await db.prepare(
    `UPDATE irrigation_workspaces SET updated_at = ${NOW}
     WHERE owner_user_id = ? AND otf_farm_id IS NULL
       AND updated_at < strftime('%Y-%m-%dT%H:%M:%fZ', 'now', '-1 hour')`,
  ).bind(ownerUserId).run();
}

/**
 * La tâche de nuit : met de côté, d'un coup, chaque espace de la
 * démonstration où personne n'est passé depuis plus de 24 heures. Le nombre
 * d'espaces mis de côté, pour le journal.
 */
export async function archiveInactiveDemoWorkspaces(archivedAt: string): Promise<number> {
  const result = await db.prepare(
    `UPDATE irrigation_workspaces SET owner_user_id = owner_user_id || ? || ?, updated_at = ${NOW}
     WHERE otf_farm_id IS NULL AND owner_user_id LIKE ? AND instr(owner_user_id, ?) = 0
       AND updated_at < strftime('%Y-%m-%dT%H:%M:%fZ', 'now', '-1 day')`,
  ).bind(ARCHIVE_MARK, archivedAt, DEMO_MARK, ARCHIVE_MARK).run();
  return Number(result.meta.changes ?? 0);
}

/**
 * Une préparation interrompue (audit du 19 novembre 2026, lot I, n° 11,
 * F450) : l'espace de l'invité existe depuis plus de `staleMinutes` sans ses
 * cases cochées, que la préparation écrit en dernier. Il est mis de côté,
 * d'une seule écriture qui n'aboutit que pour une requête : celle-ci le
 * prépare de nouveau jusqu'au bout. Dit si c'est cet appel qui l'a mis de
 * côté. Une préparation en cours depuis moins longtemps n'est pas touchée.
 */
export async function archiveStaleDemoPreparation(ownerUserId: string, archivedAt: string, staleMinutes: number): Promise<boolean> {
  const result = await db.prepare(
    `UPDATE irrigation_workspaces SET owner_user_id = ?, updated_at = ${NOW}
     WHERE owner_user_id = ? AND otf_farm_id IS NULL
       AND created_at < strftime('%Y-%m-%dT%H:%M:%fZ', 'now', ?)
       AND NOT EXISTS (SELECT 1 FROM irrigation_feature_selections selection WHERE selection.workspace_id = irrigation_workspaces.id)`,
  ).bind(archivedOwnerId(ownerUserId, archivedAt), ownerUserId, `-${staleMinutes} minutes`).run();
  return Number(result.meta.changes ?? 0) === 1;
}
