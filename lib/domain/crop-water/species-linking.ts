import type { KcSource } from './reference.ts';
import type { SeasonSpecies } from './species.ts';

/**
 * Les espèces à rattacher en tête (audit ergonomique, lot 3, point 12,
 * docs/audit-ergonomie-lot3-contract.md, section 4, cas 8 et 9) : une espèce
 * dont le besoin n'est pas calculé, faute de culture de référence, passe
 * avant les autres ; le compteur dit combien il en reste ; une proposition
 * d'après le nom aide à rattacher, sans jamais rattacher seule.
 */

/**
 * Une espèce « à rattacher » : aucun rattachement saisi, ou rattachée à
 * « sans référence ». Son besoin n'est pas calculé, seul l'objectif saisi
 * compte. L'engrais vert (état de la surface du sol) est un rattachement.
 * Une exception de série « sans référence » se lit dans la liste « sans
 * référence Kc », pas ici : la carte est celle de l'espèce (précision F62).
 */
export function speciesNeedsLink(species: SeasonSpecies): boolean {
  return species.link === null || species.link.target.kind === 'without-reference';
}

/** Les espèces à rattacher d'abord, chaque groupe dans son ordre reçu (par nom). */
export function speciesInLinkOrder(species: readonly SeasonSpecies[]): SeasonSpecies[] {
  return [...species.filter(speciesNeedsLink), ...species.filter((item) => !speciesNeedsLink(item))];
}

/** « 3 espèces à rattacher sur 78 », ou « Les 78 espèces de la saison sont rattachées ». */
export function speciesLinkCounter(species: readonly SeasonSpecies[]): string {
  const total = species.length;
  const toLink = species.filter(speciesNeedsLink).length;
  if (total === 0) return 'Aucune espèce à rattacher';
  if (toLink === 0) return total === 1 ? 'L’espèce de la saison est rattachée' : `Les ${total} espèces de la saison sont rattachées`;
  return `${toLink} espèce${toLink > 1 ? 's' : ''} à rattacher sur ${total}`;
}

/** La phrase de conséquence d'une espèce à rattacher (cas 8). */
export const WITHOUT_REFERENCE_CONSEQUENCE = 'Sans référence : le besoin n’est pas calculé, seul votre objectif compte.';

/** Une culture de référence telle que la proposition la lit. */
export type LinkCandidate = {
  id: string;
  name: string;
  source: KcSource;
  /** Une culture du jeu commun (ou la version de la ferme d'une culture commune) ; une culture saisie par la ferme ne l'est pas. */
  fromCommonSet: boolean;
  /** Rien n'empêche de s'en servir. */
  usable: boolean;
};

const STOP_WORDS = new Set(['a', 'au', 'aux', 'd', 'de', 'des', 'du', 'en', 'et', 'l', 'la', 'le', 'les']);
const SOURCE_ORDER: readonly KcSource[] = ['criiam', 'fao56', 'local'];

/** Les mots d'un nom, sans accents ni majuscules, sans les petits mots ni la marque du pluriel. */
function nameWords(name: string): string[] {
  return name
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLocaleLowerCase('fr-FR')
    .split(/[^\p{L}\p{N}]+/u)
    .filter((word) => word.length > 0 && !STOP_WORDS.has(word))
    .map((word) => (word.length > 3 && /[sx]$/.test(word) ? word.slice(0, -1) : word));
}

/**
 * La proposition d'après le nom (point 12, précision F44) : parmi les cultures
 * du jeu commun utilisables, celle dont tout le nom commence le nom de
 * l'espèce (« Tomate » pour « Tomate cerise », « Pomme de terre » pour
 * « Pommes de terre primeur ») ; la plus précise l'emporte (« Oignon vert »
 * avant « Oignon » pour « Oignon vert botte »). À précision égale, le CRIIAM
 * Sud passe avant la FAO-56, comme partout ailleurs ; s'il reste plusieurs
 * cultures, rien n'est proposé : le choix est agronomique, il revient à
 * l'utilisateur. « Fraisier » ne reçoit ni « Fraisier remontant » ni « non
 * remontant » ; « Mâche » ne reçoit rien. `null` : aucune proposition.
 */
export function suggestReferenceCrop(plantName: string, candidates: readonly LinkCandidate[]): LinkCandidate | null {
  const species = nameWords(plantName);
  if (species.length === 0) return null;
  const matching = candidates.flatMap((candidate) => {
    if (!candidate.fromCommonSet || !candidate.usable) return [];
    const words = nameWords(candidate.name);
    const prefix = words.length > 0 && words.length <= species.length && words.every((word, index) => species[index] === word);
    return prefix ? [{ candidate, length: words.length }] : [];
  });
  if (matching.length === 0) return null;
  const longest = Math.max(...matching.map((item) => item.length));
  const precise = matching.filter((item) => item.length === longest).map((item) => item.candidate);
  const bestSource = Math.min(...precise.map((candidate) => SOURCE_ORDER.indexOf(candidate.source)));
  const retained = precise.filter((candidate) => SOURCE_ORDER.indexOf(candidate.source) === bestSource);
  return retained.length === 1 ? retained[0] : null;
}
