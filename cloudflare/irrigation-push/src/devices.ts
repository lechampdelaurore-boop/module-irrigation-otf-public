/**
 * Un appareil, une personne (docs/tranche-4-contract.md, section 5 quater,
 * F371 à F377 ; constat A de la revue de l'isolation du 18 novembre 2026).
 *
 * Le service garde, pour chaque appareil (son adresse d'abonnement), la
 * personne à qui il est et les espaces de cette personne où il est inscrit.
 * Un appareil ne reçoit une notification que d'un espace de cette liste ; il
 * ne change de personne que par le geste « Activer » de la nouvelle personne,
 * jamais par une simple ouverture de page. La personne n'est connue que par
 * une empreinte calculée par le module : jamais son nom, son courriel ni son
 * identifiant de connexion.
 *
 * Ce module ne fait que décider ; la classe `PushDevice` range la décision
 * et retire l'appareil des listes qu'elle nomme.
 */

/** Ce que le service sait d'un appareil. */
export type DeviceHolder = {
  /** L'empreinte de la personne, ou `null` pour un appareil inscrit avant le correctif et pas encore rouvert. */
  personKey: string | null;
  /** Les espaces de cette personne où l'appareil est inscrit, du plus ancien au plus récent. */
  recipientKeys: string[];
};

/**
 * `activate` : le geste « Activer » de la personne, qui peut prendre
 * l'appareil d'une autre ; `refresh` : l'ouverture d'une page, qui ne fait
 * que renouveler l'inscription de la personne à qui l'appareil est déjà.
 */
export type RegistrationIntent = 'activate' | 'refresh';

export type RegistrationDecision =
  | { status: 'registered'; holder: DeviceHolder; detachFrom: string[] }
  | { status: 'other-person' };

/** Un appareil sert au plus vingt espaces d'une même personne ; au-delà, les plus anciens le perdent. */
export const MAX_RECIPIENTS_PER_DEVICE = 20;

/**
 * L'inscription d'un appareil dans un espace (F372 à F375).
 *
 * - Un appareil à personne (`null`, jamais vu ou inscrit avant le correctif)
 *   devient à la personne qui l'inscrit, et n'est plus inscrit que dans cet
 *   espace : les espaces qu'il servait déjà sont détachés.
 * - Un appareil de la même personne gagne cet espace, sans perdre les autres,
 *   jusqu'à vingt ; au-delà, le plus ancien est détaché.
 * - Un appareil d'une autre personne ne change que par `activate` : il est
 *   détaché de tous les espaces de la personne précédente. Une ouverture de
 *   page (`refresh`) le laisse tel quel et dit `other-person`.
 */
export function decideRegistration(
  current: DeviceHolder | null,
  request: { personKey: string; recipientKey: string; intent: RegistrationIntent },
): RegistrationDecision {
  const { personKey, recipientKey, intent } = request;
  if (current?.personKey === personKey) {
    const recipientKeys = withRecipient(current.recipientKeys, recipientKey);
    return {
      status: 'registered',
      holder: { personKey, recipientKeys },
      detachFrom: current.recipientKeys.filter((key) => !recipientKeys.includes(key)),
    };
  }
  if (current?.personKey && intent !== 'activate') return { status: 'other-person' };
  return {
    status: 'registered',
    holder: { personKey, recipientKeys: [recipientKey] },
    detachFrom: (current?.recipientKeys ?? []).filter((key) => key !== recipientKey),
  };
}

/**
 * « Désactiver » (F376) : l'appareil quitte cet espace et reste à sa
 * personne, même sans aucun espace ; une ancienne inscription ne peut donc
 * plus le reprendre au premier envoi.
 */
export function holderAfterUnregistration(current: DeviceHolder | null, recipientKey: string): DeviceHolder {
  return {
    personKey: current?.personKey ?? null,
    recipientKeys: (current?.recipientKeys ?? []).filter((key) => key !== recipientKey),
  };
}

/**
 * Au moment d'envoyer (F371, F375) : l'appareil reçoit la notification d'un
 * espace seulement s'il est inscrit dans cet espace. Un appareil que le
 * service n'a jamais vu (inscrit avant le correctif) est réservé au premier
 * espace qui lui envoie : `claim` est alors ce qu'il faut ranger.
 */
export function decideDelivery(
  current: DeviceHolder | null,
  recipientKey: string,
): { admitted: true; claim: DeviceHolder | null } | { admitted: false } {
  if (current === null) return { admitted: true, claim: { personKey: null, recipientKeys: [recipientKey] } };
  return current.recipientKeys.includes(recipientKey) ? { admitted: true, claim: null } : { admitted: false };
}

function withRecipient(recipientKeys: readonly string[], recipientKey: string): string[] {
  const kept = recipientKeys.filter((key) => key !== recipientKey);
  return [...kept, recipientKey].slice(-MAX_RECIPIENTS_PER_DEVICE);
}
