import { db } from './binding';

/**
 * Écrire beaucoup de lignes en peu d'allers-retours (accélérer le site, A2,
 * D-359 ; docs/acceleration-du-site-contract.md, section 4) : chaque groupe
 * est l'écriture d'un seul geste, telle qu'un dépôt l'enverrait seule en un
 * lot ; les groupes partent ensemble, dans leur ordre, en lots d'au plus
 * `STATEMENTS_PER_BATCH` instructions. Un groupe n'est jamais coupé entre deux
 * lots : chaque geste reste écrit en entier ou pas du tout, comme seul ; un
 * groupe plus grand que la limite part dans un lot à lui. Un lot compte pour
 * un seul appel à la base.
 */

/** Un lot de D1 reste court : quelques dizaines de kilo-octets, une transaction brève. */
const STATEMENTS_PER_BATCH = 100;

export async function batchWholeGroups(groups: readonly (readonly D1PreparedStatement[])[]): Promise<void> {
  let pending: D1PreparedStatement[] = [];
  for (const group of groups) {
    if (group.length === 0) continue;
    if (pending.length > 0 && pending.length + group.length > STATEMENTS_PER_BATCH) {
      await db.batch(pending);
      pending = [];
    }
    pending.push(...group);
  }
  if (pending.length > 0) await db.batch(pending);
}
