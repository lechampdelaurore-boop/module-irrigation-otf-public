/**
 * Le journal des modifications d'une ferme (amélioration n° 7,
 * docs/ameliorations-6-2-3-7-contract.md, section 5, F706 à F709 ; D-285) :
 * ce qui y entre.
 *
 * Trois familles (§5.1) : les objectifs, les réglages, le matériel et les
 * ressources. Chaque changement porte un **sujet**, un code court et stable,
 * pris dans la liste fermée ci-dessous ; la famille se lit du sujet, jamais
 * de l'écrivain. N'y entrent pas : une irrigation (immuable, D-006, déjà
 * tracée par son journal), une pluie ou un volume mesuré (une observation,
 * pas un réglage), un calcul, une synchronisation météo, un acte de
 * l'exploitant du service (4.5).
 *
 * Une ligne dit qui, quand, l'action (créé, modifié, supprimé) et, pour les
 * seuls champs qui changent, l'avant et l'après (§5.2). Elle ne se modifie
 * jamais ni ne s'efface : un journal qui se réécrit ne prouve rien.
 */

const CHANGE_FAMILIES = ['objectif', 'reglage', 'materiel'] as const;
export type ChangeFamily = (typeof CHANGE_FAMILIES)[number];

export type ChangeAction = 'cree' | 'modifie' | 'supprime';

type SubjectDefinition = { family: ChangeFamily; label: string };

/**
 * La liste fermée des sujets, par famille (§5.1). Un code ne change jamais
 * une fois des lignes écrites : il est relu tel quel par l'écran du journal.
 */
const CHANGE_SUBJECTS = {
  // Objectifs.
  'objectif-hydrique': { family: 'objectif', label: 'Objectif hydrique' },
  'objectif-adopte': { family: 'objectif', label: 'Objectif proposé adopté' },
  'seuil-de-besoin': { family: 'objectif', label: 'Seuil minimal de besoin' },
  'decision-de-planche': { family: 'objectif', label: 'Décision sur le besoin d’une planche' },
  // Réglages.
  'reglages-du-planning': { family: 'reglage', label: 'Réglages du planning' },
  'creneau-protege': { family: 'reglage', label: 'Créneau protégé' },
  'limite-d-eau-du-jour': { family: 'reglage', label: 'Limite d’eau de la journée' },
  'limite-de-ressource': { family: 'reglage', label: 'Limite de prélèvement d’une ressource' },
  'sol-de-parcelle': { family: 'reglage', label: 'Sol d’une zone ou d’une parcelle' },
  'reglages-du-sol': { family: 'reglage', label: 'Réglages du sol' },
  'profil-racinaire': { family: 'reglage', label: 'Profondeur des racines' },
  'critere-meteo': { family: 'reglage', label: 'Alerte météo' },
  'alertes-de-culture': { family: 'reglage', label: 'Alertes de culture' },
  'seuil-de-gel': { family: 'reglage', label: 'Seuil de gel d’une culture' },
  'jours-de-sechage': { family: 'reglage', label: 'Dessèchement d’une culture' },
  fonctionnalites: { family: 'reglage', label: 'Fonctionnalités' },
  'message-du-matin': { family: 'reglage', label: 'Message du matin' },
  'rappel-du-soir': { family: 'reglage', label: 'Rappel du soir' },
  // Matériel et ressources.
  materiel: { family: 'materiel', label: 'Matériel' },
  'reglage-de-materiel': { family: 'materiel', label: 'Réglage de matériel' },
  pompe: { family: 'materiel', label: 'Pompe' },
  'pompe-par-defaut': { family: 'materiel', label: 'Pompe d’un matériel' },
  ressource: { family: 'materiel', label: 'Ressource en eau' },
  reserve: { family: 'materiel', label: 'Réserve d’eau' },
  'liaison-ressource-reserve': { family: 'materiel', label: 'Remplissage d’une réserve' },
  'liaison-entre-reserves': { family: 'materiel', label: 'Liaison entre réserves' },
  'alimentation-par-defaut': { family: 'materiel', label: 'Eau par défaut des arrosages' },
  pose: { family: 'materiel', label: 'Pose de matériel' },
} as const satisfies Record<string, SubjectDefinition>;

export type ChangeSubject = keyof typeof CHANGE_SUBJECTS;

export const CHANGE_SUBJECT_CODES = Object.keys(CHANGE_SUBJECTS) as ChangeSubject[];

/** La famille d'un sujet : elle se lit de la liste, jamais de l'écrivain. */
export function familyOfSubject(subject: ChangeSubject): ChangeFamily {
  return CHANGE_SUBJECTS[subject].family;
}

export function isChangeSubject(value: string): value is ChangeSubject {
  return Object.hasOwn(CHANGE_SUBJECTS, value);
}

export function isChangeFamily(value: string): value is ChangeFamily {
  return (CHANGE_FAMILIES as readonly string[]).includes(value);
}

/**
 * Le nom d'un champ dans l'avant et l'après d'une ligne : un identifiant
 * simple, qui sert aussi de chemin JSON (`$.nom`). Les champs viennent du
 * code, jamais d'une saisie.
 */
const FIELD_KEY = /^[a-z][A-Za-z0-9]{0,47}$/;

export function isChangeFieldKey(value: string): boolean {
  return FIELD_KEY.test(value);
}
