/**
 * Les mots tels que l'écran les accorde (audit ergonomique final, lot E, J9,
 * docs/audit-ergonomie-final-lot-e-contract.md, section 5, précision F262).
 * Un affichage seulement : rien de ce qui est écrit ici n'est enregistré.
 */

/** Une voyelle, accentuée ou non ; jamais un h, qui peut être aspiré. */
const STARTS_WITH_VOWEL = /^[aeiouœæ]/i;

/**
 * « de » devant un nom que la ferme a donné : « d'Abri des noues », « d'Étang »,
 * mais « de Haut Champ » et « de Serre 2 ».
 */
export function ofName(name: string): string {
  const bare = name.trim().normalize('NFD');
  return STARTS_WITH_VOWEL.test(bare) ? `d'${name.trim()}` : `de ${name.trim()}`;
}

/** « la proposition » quand il n'y en a qu'une, « les 3 propositions » sinon. */
export function proposalsText(count: number): string {
  return count === 1 ? 'la proposition' : `les ${count} propositions`;
}

/** « Réglage 5 planches », mais « Réglage habituel » une fois quand le nom le dit déjà (F263). */
export function settingText(settingName: string): string {
  return /^réglage(?:\s|$)/i.test(settingName.trim()) ? settingName.trim() : `Réglage ${settingName}`;
}
