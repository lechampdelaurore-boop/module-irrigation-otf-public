/**
 * Les clés des instantanés d'Ouvre ta ferme gardés en cache (`otf_snapshots`),
 * telles que `lib/services/irrigation-service.ts` les écrit et les lit :
 * l'effacement d'une ferme (4.5, PR 3 ; docs/tranche-4-contract.md, F563,
 * F643) efface ceux de l'espace, et seulement eux.
 *
 * Une clé par espace et par saison (`["v6-plan-de-culture", clé d'espace,
 * saison]`), et la clé d'avant le plan de culture (`v3-zone-fill-area:` suivi
 * de la clé d'espace), toutes saisons. `tests/db/farm-erasure.test.ts` vérifie
 * que le service lit bien ce que ces clés désignent.
 */

const SNAPSHOT_CACHE_VERSION = 'v6-plan-de-culture';
const LEGACY_SNAPSHOT_CACHE_VERSION = 'v3-zone-fill-area';

/** La clé de l'instantané d'un espace pour une saison. */
export function seasonSnapshotKey(spaceKey: string, season: number): string {
  return JSON.stringify([SNAPSHOT_CACHE_VERSION, spaceKey, season]);
}

/** Le début commun des clés de toutes les saisons d'un espace, comparé signe à signe (`instr(cache_key, ?) = 1`). */
export function seasonSnapshotPrefix(spaceKey: string): string {
  return `${JSON.stringify([SNAPSHOT_CACHE_VERSION, spaceKey]).slice(0, -1)},`;
}

/** La clé de l'instantané d'avant le plan de culture, toutes saisons. */
export function legacySnapshotKey(spaceKey: string): string {
  return `${LEGACY_SNAPSHOT_CACHE_VERSION}:${spaceKey}`;
}
