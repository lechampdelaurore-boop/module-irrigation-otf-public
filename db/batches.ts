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

/** Ce que rend chaque lecture d'un lot, dans l'ordre des lectures : ses lignes, comme `all`. */
type ResultsOf<T extends readonly unknown[]> = { -readonly [K in keyof T]: D1Result<T[K]> };

/**
 * Les lectures indépendantes d'un même dépôt en un seul appel à la base
 * (accélérer le site, A3, D-360, F1114 ; docs/acceleration-du-site-contract.md,
 * section 5) : les mêmes instructions, chacune rend ses lignes comme `all`,
 * dans le même ordre, en un aller-retour au lieu d'un par lecture. Un lot de
 * lectures n'écrit rien et ne vide pas la mémoire de la requête (F812) ; une
 * lecture en échec fait échouer le lot entier, comme le premier refus d'un
 * `Promise.all`. Réservé aux lectures : une écriture part par son geste.
 */
export async function readTogether<T extends readonly unknown[]>(
  statements: { readonly [K in keyof T]: D1PreparedStatement },
): Promise<ResultsOf<T>> {
  return (await db.batch(statements as unknown as D1PreparedStatement[])) as unknown as ResultsOf<T>;
}
