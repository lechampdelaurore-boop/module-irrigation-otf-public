/**
 * Les limites du service d'envoi des notifications (le Worker Push, contrat
 * recopié dans `lib/domain/irrigation-push-contract.ts`) : un texte d'au plus
 * 160 caractères ; une étiquette faite de lettres, de chiffres, de « . »,
 * « _ », « : » et « - », d'au plus 128 caractères, puisqu'elle nomme aussi
 * l'envoi. Une notification qui les dépasse est refusée en entier.
 *
 * Trouvé à la recette réelle de la 5 quinquies (6 novembre 2026) : l'alerte
 * de gel qui nommait deux cultures était refusée, son étiquette portant une
 * virgule (docs/weather-crop-alerts-contract.md, « Précisions faites à la
 * recette réelle »).
 */
export const PUSH_BODY_MAX_LENGTH = 160;

/**
 * « crop-frost:2026-11-08:1a2b3c4d » : le préfixe, puis une empreinte stable
 * des sujets annoncés, dans n'importe quel ordre ; deux listes différentes
 * donnent deux étiquettes différentes.
 */
export function pushTag(prefix: string, subjectKeys: readonly string[]): string {
  return `${prefix}:${fingerprint([...subjectKeys].sort().join('\n'))}`;
}

/** Le texte tel quel s'il tient ; sinon coupé au dernier mot avant la limite, suivi de « … ». */
export function fitPushBody(text: string): string {
  const normalized = text.trim().replace(/\s+/gu, ' ');
  if (normalized.length <= PUSH_BODY_MAX_LENGTH) return normalized;
  const cut = normalized.slice(0, PUSH_BODY_MAX_LENGTH - 1);
  const lastSpace = cut.lastIndexOf(' ');
  const kept = lastSpace > PUSH_BODY_MAX_LENGTH / 2 ? cut.slice(0, lastSpace) : cut;
  return `${kept.replace(/[\s,;:.(]+$/u, '')}…`;
}

/** FNV-1a sur 32 bits des octets UTF-8, en hexadécimal sur huit chiffres. */
function fingerprint(text: string): string {
  let hash = 0x811c9dc5;
  for (const byte of new TextEncoder().encode(text)) {
    hash ^= byte;
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return hash.toString(16).padStart(8, '0');
}
