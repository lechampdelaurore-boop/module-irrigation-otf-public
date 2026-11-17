/**
 * La clé d'espace (docs/tranche-4-contract.md, section 5 bis, F327 et F328).
 *
 * Un espace, c'est une personne (le sujet de sa connexion Access) et une
 * ferme (l'identifiant de structure d'Ouvre ta ferme, `otf_farm_id`) ; la
 * démonstration et les espaces d'avant la 4.1 n'ont pas de ferme. Le serveur
 * calcule la clé à la connexion, jamais à partir du navigateur, et le reste
 * du module la reçoit à la place de l'identifiant de la personne : chaque
 * requête retrouve l'espace par la personne **et** la ferme ensemble.
 */

export type FarmSpace = {
  /** La personne, telle que la base la garde dans `owner_user_id`. */
  ownerUserId: string;
  /** La ferme d'Ouvre ta ferme, ou `null` pour un espace sans ferme. */
  otfFarmId: string | null;
};

const FARM_SEPARATOR = '·ferme·';
const FARM_ID_PATTERN = /^[A-Za-z0-9_-]{1,64}$/;

export class InvalidFarmSpaceError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'InvalidFarmSpaceError';
  }
}

/** Un identifiant de ferme que la clé d'espace peut porter, sans rien deviner. */
export function isFarmId(value: string): boolean {
  return FARM_ID_PATTERN.test(value);
}

/** La clé de l'espace de cette personne pour cette ferme. */
export function farmSpaceKey(ownerUserId: string, otfFarmId: string): string {
  assertOwner(ownerUserId);
  if (!isFarmId(otfFarmId)) throw new InvalidFarmSpaceError('Identifiant de ferme invalide.');
  return `${ownerUserId}${FARM_SEPARATOR}${otfFarmId}`;
}

/** La clé d'un espace tel que la base le garde : avec sa ferme, ou la personne seule. */
export function spaceKeyOf(space: FarmSpace): string {
  return space.otfFarmId === null ? assertOwner(space.ownerUserId) : farmSpaceKey(space.ownerUserId, space.otfFarmId);
}

/**
 * La personne et la ferme d'une clé d'espace. Une clé sans ferme est celle
 * d'un espace sans ferme (démonstration, espace d'avant la 4.1) ; une clé
 * dont la ferme est mal formée est refusée, jamais lue comme sans ferme.
 */
export function farmSpaceOf(spaceKey: string): FarmSpace {
  const index = spaceKey.lastIndexOf(FARM_SEPARATOR);
  if (index < 0) return { ownerUserId: assertOwner(spaceKey), otfFarmId: null };
  const ownerUserId = assertOwner(spaceKey.slice(0, index));
  const otfFarmId = spaceKey.slice(index + FARM_SEPARATOR.length);
  if (!isFarmId(otfFarmId)) throw new InvalidFarmSpaceError('Clé d’espace invalide : la ferme est mal formée.');
  return { ownerUserId, otfFarmId };
}

function assertOwner(ownerUserId: string): string {
  if (ownerUserId.trim() === '' || ownerUserId.includes(FARM_SEPARATOR)) {
    throw new InvalidFarmSpaceError('Clé d’espace invalide : la personne est absente ou mal formée.');
  }
  return ownerUserId;
}
