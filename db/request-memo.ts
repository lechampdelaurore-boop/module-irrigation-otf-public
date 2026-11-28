/**
 * La mémoire d'une requête (docs/tranche-4-contract.md, section 5 sexies) :
 * pendant une requête, une même lecture ne va qu'une fois à la base, au lieu
 * d'une fois par service qui la demande (l'ouverture d'« Aujourd'hui »
 * relisait 57 fois l'espace de la ferme, 12 fois son accueil).
 *
 * - Elle ne vit que le temps d'une requête. Ce module n'en garde aucune :
 *   l'interface, seule à savoir ce qu'est une requête, la lui fournit
 *   (`app/request-memo.ts`, par `cacheForRequest` de vinext, qui rend la même
 *   pendant toute une requête, page, action ou route, et aucune qui dure hors
 *   d'une requête). Hors d'une requête (tâche sans requête, tests), il n'y en
 *   a pas, et chaque lecture va à la base comme avant.
 * - Elle range une lecture sous ce qui la désigne entièrement : l'espace par
 *   la personne et la ferme ensemble, comme le filtre des requêtes
 *   (`db/workspace-scope.ts`) ; une lecture d'un service par son nom et ses
 *   arguments, la clé d'espace comprise. Deux fermes, deux entrées.
 * - Toute écriture la vide, à son début et à sa fin (`db/binding.ts`), et une
 *   lecture qui a croisé une écriture n'y entre pas : un espace rattaché à sa
 *   ferme, mis de côté par la démonstration ou effacé n'y survit pas, ni une
 *   valeur que la requête vient de changer.
 * - L'absence d'un espace n'y entre jamais : un espace créé pendant la
 *   requête, par elle ou par une autre, se lit aussitôt.
 */
export type RequestMemo = {
  /** La lecture de l'espace de chaque clé, finie ou en cours, rangée par `workspaceMemoKey`. */
  readonly workspaceIds: Map<string, Promise<string | null>>;
  /** Les lectures des services (`rememberedRead`), finies ou en cours, rangées par nom et arguments. */
  readonly reads: Map<string, Promise<unknown>>;
  /** Monte à chaque début et à chaque fin d'écriture : une lecture qui l'a vu bouger ne reste pas. */
  writeMarks: number;
};

/** Une mémoire neuve, pour une requête. */
export function createRequestMemo(): RequestMemo {
  return { workspaceIds: new Map(), reads: new Map(), writeMarks: 0 };
}

type RequestMemoSource = () => RequestMemo | null;

const noMemo: RequestMemoSource = () => null;
let source: RequestMemoSource = noMemo;

/**
 * Dit où trouver la mémoire de la requête en cours : posé une fois, au
 * chargement de l'interface (`app/request-memo.ts`) ; les tests y posent la
 * leur. Une fonction, jamais une mémoire : rien de ce qu'une requête a lu
 * n'est gardé ici. `null` la retire.
 */
export function provideRequestMemo(next: RequestMemoSource | null): void {
  source = next ?? noMemo;
}

/** La mémoire de la requête en cours ; hors d'une requête, aucune (`null`) ou une neuve à chaque appel, ce qui revient au même. */
function currentRequestMemo(): RequestMemo | null {
  return source();
}

/** La clé de rangement d'un espace : la personne et la ferme, ensemble. */
export function workspaceMemoKey(ownerUserId: string, otfFarmId: string | null): string {
  return JSON.stringify([ownerUserId, otfFarmId]);
}

/**
 * L'identifiant de l'espace d'une personne et d'une ferme, lu au plus une fois
 * par requête ; hors d'une requête, lu à chaque fois. Une lecture qui ne
 * trouve rien est oubliée : la suivante relit la base.
 */
export function rememberedWorkspaceId(
  ownerUserId: string,
  otfFarmId: string | null,
  read: () => Promise<string | null>,
): Promise<string | null> {
  const memo = currentRequestMemo();
  if (!memo) return read();
  return shared(memo, memo.workspaceIds, workspaceMemoKey(ownerUserId, otfFarmId), read, (id) => id !== null);
}

/** Ce qui désigne une lecture, après son nom : la clé d'espace et les autres arguments. */
type ReadArgument = string | number | boolean | null;

/**
 * Une lecture d'un service, faite au plus une fois par requête ; hors d'une
 * requête, faite à chaque fois. Chaque appelant reçoit sa propre copie : ce
 * que l'un change ne se voit pas chez l'autre. Réservé aux lectures de
 * données simples (sans fonction ni classe), qu'aucun traitement ne relit
 * pour attendre l'écriture d'une autre requête.
 */
export async function rememberedRead<T>(name: string, args: readonly ReadArgument[], read: () => Promise<T>): Promise<T> {
  const memo = currentRequestMemo();
  if (!memo) return read();
  const reads = memo.reads as Map<string, Promise<T>>;
  return structuredClone(await shared(memo, reads, JSON.stringify([name, ...args]), read, () => true));
}

/**
 * Une écriture : la mémoire de la requête est vidée quand elle commence et
 * quand elle finit, même en échec. Ce qu'une lecture avait trouvé avant elle
 * se relit après elle.
 */
export async function duringWrite<T>(write: () => Promise<T>): Promise<T> {
  const memo = currentRequestMemo();
  if (memo) markWrite(memo);
  try {
    return await write();
  } finally {
    if (memo) markWrite(memo);
  }
}

/**
 * Un calcul qui recommence parce qu'une autre requête a écrit pendant le sien
 * (la faisabilité, quand sa révision a bougé ; accélérer le site, A3, F1113) :
 * la mémoire de la requête est vidée, comme par une écriture, et tout ce que
 * le calcul relit va à la base. Hors d'une requête, rien à oublier.
 */
export function forgetRequestReads(): void {
  const memo = currentRequestMemo();
  if (memo) markWrite(memo);
}

function markWrite(memo: RequestMemo): void {
  memo.writeMarks += 1;
  memo.workspaceIds.clear();
  memo.reads.clear();
}

/**
 * Une lecture en cours est partagée, une lecture finie est rendue telle
 * quelle. Une lecture qui échoue, que `keep` refuse ou qui a croisé une
 * écriture est oubliée.
 */
function shared<T>(
  memo: RequestMemo,
  entries: Map<string, Promise<T>>,
  key: string,
  read: () => Promise<T>,
  keep: (value: T) => boolean,
): Promise<T> {
  const known = entries.get(key);
  if (known) return known;
  const marks = memo.writeMarks;
  const forget = () => {
    if (entries.get(key) === lookup) entries.delete(key);
  };
  const lookup: Promise<T> = read().then(
    (value) => {
      if (!keep(value) || memo.writeMarks !== marks) forget();
      return value;
    },
    (error: unknown) => {
      forget();
      throw error;
    },
  );
  entries.set(key, lookup);
  return lookup;
}
