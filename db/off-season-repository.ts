import { db } from './binding';
import type { OffSeasonRevision, OffSeasonScope } from '@/lib/domain/off-season';
import { offSeasonJournal, type OffSeasonScopeColumns } from './change-journal/objectives';
import { ensureWorkspaceForUser, findWorkspaceIdForUser } from './workspace-repository';
import { aEcritUneLigne } from './write-result';

/**
 * Les gestes « Mettre hors saison » et « Reprendre » d'une ferme (6
 * quaterdecies, B2, docs/objectif-automatique-saison-contract.md, sections
 * 4.3 à 4.5 et 6 ; D-337, D-341, D-352) : chaque geste porte sur une portée
 * et compte à partir de son jour, en heure de Paris. La règle le lit geste
 * par geste (`offSeasonSchedule`, lib/domain/off-season.ts) : rien n'est
 * réécrit, les jours d'avant gardent ce qu'ils avaient. Les portées vivent
 * par ferme : celles d'une planche, d'un jardin ou d'une parcelle par
 * l'identifiant OTF, qui les suit d'une saison à l'autre ; tout le plein
 * champ et tout le sous-abri valent pour toutes les saisons (section 6).
 */

const MODES: ReadonlySet<string> = new Set(['garden', 'greenhouse']);

/** La portée comme la ligne la garde : son niveau et son identifiant (le mode, pour tout le plein champ ou tout le sous-abri). */
function scopeColumns(scope: OffSeasonScope): OffSeasonScopeColumns {
  switch (scope.level) {
    case 'bed': return { level: 'bed', id: scope.bedId };
    case 'plot': return { level: 'plot', id: scope.plotId };
    case 'zone': return { level: 'zone', id: scope.zoneId };
    case 'mode': return { level: 'mode', id: scope.mode };
  }
}

/** La portée d'une ligne ; `null` pour une ligne que cette version ne sait pas lire, laissée de côté. */
function scopeOf(level: string, id: string): OffSeasonScope | null {
  if (id.length === 0) return null;
  switch (level) {
    case 'bed': return { level: 'bed', bedId: id };
    case 'plot': return { level: 'plot', plotId: id };
    case 'zone': return { level: 'zone', zoneId: id };
    case 'mode': return id === 'garden' || id === 'greenhouse' ? { level: 'mode', mode: id } : null;
    default: return null;
  }
}

/** Une portée écrivable : un identifiant non vide, un mode parmi les deux (jamais « à classer », D-003). */
function checkedColumns(scope: OffSeasonScope): OffSeasonScopeColumns {
  const columns = scopeColumns(scope);
  if (typeof columns.id !== 'string' || columns.id.trim().length === 0) throw new Error('La portée « hors saison » est invalide.');
  if (columns.level === 'mode' && !MODES.has(columns.id)) throw new Error('La portée « hors saison » est invalide.');
  return columns;
}

/**
 * Les gestes de la ferme, du plus ancien au plus récent ; deux gestes de la
 * même milliseconde gardent l'ordre d'écriture, le second fait foi
 * (docs/revision-order-contract.md). Aucun : rien n'est hors saison.
 */
export async function listOffSeasonRevisionsForUser(ownerUserId: string): Promise<OffSeasonRevision[]> {
  const workspaceId = await findWorkspaceIdForUser(ownerUserId);
  if (!workspaceId) return [];
  const result = await db.prepare(
    `SELECT scope_level, scope_id, off_season, created_at
     FROM irrigation_off_season_revisions
     WHERE workspace_id = ?
     ORDER BY created_at, rowid`,
  ).bind(workspaceId).all<{ scope_level: string; scope_id: string; off_season: number; created_at: string }>();
  return result.results.flatMap((row) => {
    const scope = scopeOf(row.scope_level, row.scope_id);
    return scope === null ? [] : [{ scope, offSeason: Number(row.off_season) === 1, createdAt: row.created_at }];
  });
}

/**
 * Met une portée hors saison (`true`) ou la reprend (`false`), à l'instant
 * `now` du geste. Un geste qui ne change pas l'état de cette portée n'écrit
 * rien, au journal non plus : reprendre une portée qui n'est pas hors saison,
 * ou la remettre hors saison deux fois. Sinon, la ligne et celle du journal
 * des modifications s'écrivent dans le même lot (F709), et la faisabilité est
 * à refaire (déclencheurs de la migration). Rend `true` quand l'état a
 * changé. Rien n'est effacé : un objectif saisi reste là, inactif.
 */
export async function saveOffSeasonForUser(ownerUserId: string, scope: OffSeasonScope, offSeason: boolean, now: Date): Promise<boolean> {
  const columns = checkedColumns(scope);
  const workspaceId = await ensureWorkspaceForUser(ownerUserId);
  const at = now.toISOString();
  const gesture = { workspaceId, actorUserId: ownerUserId, at };
  const [, inserted] = await db.batch([
    // Le journal d'abord : l'avant se lit sur la révision en vigueur de la portée (F716).
    offSeason
      ? offSeasonJournal('jardin-hors-saison', gesture, columns, true)
      : offSeasonJournal('reprise-saison', gesture, columns, false),
    db.prepare(
      `INSERT INTO irrigation_off_season_revisions (id, workspace_id, scope_level, scope_id, off_season, actor_user_id, created_at)
       SELECT ?, ?, ?, ?, ?, ?, ?
       WHERE COALESCE((
         SELECT off_season FROM irrigation_off_season_revisions
         WHERE workspace_id = ? AND scope_level = ? AND scope_id = ? ORDER BY created_at DESC, rowid DESC LIMIT 1
       ), 0) IS NOT ?`,
    ).bind(revisionId(), workspaceId, columns.level, columns.id, offSeason ? 1 : 0, ownerUserId, at, workspaceId, columns.level, columns.id, offSeason ? 1 : 0),
  ]);
  return aEcritUneLigne(inserted.meta);
}

function revisionId() {
  return `${String(Date.now()).padStart(13, '0')}-${crypto.randomUUID()}`;
}
