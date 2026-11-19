import { isFarmId } from '../farm-space.ts';
import { extractCollection } from './api-contract.ts';

/**
 * L'identité de la ferme lue chez Ouvre ta ferme (docs/tranche-4-contract.md,
 * section 5 bis, F329, et section 5 ter, F338) : ce que dit `GET /me`, et la
 * ferme qu'un instantané en cache a vue. Rien n'est deviné (D-003) : une
 * réponse sans identifiant lisible, ou qui désigne plusieurs structures,
 * n'est pas une identité.
 */

/**
 * Le remplaçant que la lecture de l'instantané met à la place d'un
 * identifiant de structure absent (`lib/domain/otf/mapper.ts`) : il sert à
 * l'affichage, jamais d'identité.
 */
export const UNKNOWN_STRUCTURE_ID = 'unknown';

/** L'identifiant de la ferme que désigne une réponse de `GET /me`, ou `null`. */
export function otfFarmIdentity(payload: unknown): string | null {
  const structures = otfStructuresOf(payload);
  if (structures.length !== 1) return null;
  const structure = structures[0];
  if (!isRecord(structure)) return null;
  return farmIdOf(structure.id ?? structure['@id']);
}

/** La ferme qu'a vue la lecture d'un instantané, si elle est lisible ; sinon `null`. */
export function snapshotFarmIdentity(snapshot: { structure: { id: string } }): string | null {
  return readableFarmId(snapshot.structure.id);
}

/**
 * La lecture s'arrête avant toute autre route : la clé d'Ouvre ta ferme mène
 * à une autre ferme que celle de l'espace (`observedFarmId`), ou à aucune
 * ferme lisible (`null`) (F332, F341).
 */
export class OtfFarmMismatchError extends Error {
  readonly observedFarmId: string | null;

  constructor(observedFarmId: string | null) {
    super(
      observedFarmId === null
        ? 'Ouvre ta ferme n’a pas dit à quelle ferme mène la clé.'
        : 'La clé d’Ouvre ta ferme mène à une autre ferme que celle de l’espace.',
    );
    this.name = 'OtfFarmMismatchError';
    this.observedFarmId = observedFarmId;
  }
}

/**
 * La forme d'une réponse de `GET /me`, sans aucune de ses valeurs : combien de
 * structures elle porte et de quel type est l'identifiant de la première.
 * Elle se journalise quand la réponse ne donne pas d'identité (F341), pour
 * comprendre un refus sans rien écrire de la ferme.
 */
export function farmIdentityShape(payload: unknown): { structures: number; identifier: string } {
  const structures = otfStructuresOf(payload);
  const first = structures[0];
  if (!isRecord(first)) return { structures: structures.length, identifier: 'aucun' };
  const identifier = first.id ?? first['@id'];
  return { structures: structures.length, identifier: identifier === undefined || identifier === null ? 'absent' : typeof identifier };
}

/**
 * Les structures que porte une réponse de `GET /me` : la réponse elle-même, ou
 * les éléments de sa liste. Une seule règle pour l'identité (F338), la
 * vérification de forme de `/me` et la traduction de l'instantané (point D2
 * de la revue de l'isolation, F392) : plusieurs structures ne sont jamais une
 * ferme.
 */
export function otfStructuresOf(payload: unknown): unknown[] {
  if (Array.isArray(payload)) return payload;
  if (!isRecord(payload)) return [];
  try {
    return extractCollection(payload);
  } catch {
    return [payload];
  }
}

/** Un entier positif, ou un texte de la forme d'un identifiant de ferme ; d'une adresse (`@id`), le dernier segment. */
function farmIdOf(value: unknown): string | null {
  if (typeof value === 'number') {
    return Number.isSafeInteger(value) && value > 0 ? String(value) : null;
  }
  if (typeof value !== 'string') return null;
  return readableFarmId(value.trim().split('/').filter(Boolean).at(-1) ?? '');
}

/** Un identifiant de la forme de la clé d'espace (F327), jamais le remplaçant. */
function readableFarmId(id: string): string | null {
  return id !== UNKNOWN_STRUCTURE_ID && isFarmId(id) ? id : null;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
