/**
 * Les fonctionnalités à la carte (3.8, docs/feature-selection-contract.md,
 * section 2, D-067) : la liste des cases, dans l'ordre où elles s'affichent (du
 * geste de chaque jour à l'installation, précision P36), et ce dont chacune a
 * besoin. C'est le seul endroit qui sait quelle case dépend de quelle autre.
 */

export const FEATURE_IDS = [
  'arrosages',
  'planning',
  'besoins',
  'sol',
  'cultures',
  'materiel',
  'calculateur',
  'ressources',
  'alertes-meteo',
  'alertes-cultures',
  'historique',
] as const;

export type FeatureId = (typeof FEATURE_IDS)[number];

/**
 * Les cases sans page à elles : elles ajoutent un outil à la page d'une case
 * dont elles ont besoin. Le calculateur d'irrigation (3.8 bis,
 * docs/irrigation-calculator-contract.md, section 11) vit dans la fenêtre
 * des réglages du matériel.
 */
const FEATURES_WITHOUT_PAGE = ['calculateur'] as const satisfies readonly FeatureId[];

/** Les cases qui ont leur page, leur entrée du menu et leur « ? ». */
export type PageFeatureId = Exclude<FeatureId, (typeof FEATURES_WITHOUT_PAGE)[number]>;

export function isPageFeatureId(value: unknown): value is PageFeatureId {
  return typeof value === 'string'
    && (FEATURE_IDS as readonly string[]).includes(value)
    && !(FEATURES_WITHOUT_PAGE as readonly string[]).includes(value);
}

export const PAGE_FEATURE_IDS: readonly PageFeatureId[] = FEATURE_IDS.filter(isPageFeatureId);

export type FeatureDefinition = {
  id: FeatureId;
  /** Le nom de la case et de sa page, validé par le porteur (question 2). */
  label: string;
  /** Une ligne sous la case : ce qu'elle montre et fait tourner. */
  summary: string;
  /** Les cases dont elle a besoin directement ; la fermeture se lit de proche en proche. */
  requires: readonly FeatureId[];
};

export const FEATURES: readonly FeatureDefinition[] = [
  {
    id: 'arrosages',
    label: 'Arrosages',
    summary: 'Irriguer maintenant, planifier, saisir un arrosage fait, la limite journalière.',
    requires: ['materiel'],
  },
  {
    id: 'planning',
    label: 'Planning de la semaine',
    summary: 'Les propositions d’arrosage de la semaine, calculées chaque matin, et leur suivi.',
    requires: ['besoins'],
  },
  {
    id: 'besoins',
    label: 'Objectifs et besoins',
    summary: 'Les objectifs en mm par semaine, la météo, la pluie mesurée, les besoins par planche.',
    requires: ['arrosages'],
  },
  {
    id: 'sol',
    label: 'Réserve du sol',
    summary: 'Le sol des parcelles, la jauge de la réserve, les observations, l’eau arrosée en trop.',
    requires: ['cultures', 'arrosages'],
  },
  {
    id: 'cultures',
    label: 'Besoin par culture',
    summary: 'Les coefficients culturaux, les profils racinaires, les durées et l’objectif proposé.',
    requires: ['besoins'],
  },
  {
    id: 'materiel',
    label: 'Matériel et placement',
    summary: 'Le plan des parcelles, jardins et planches, le matériel, ses réglages et sa pose.',
    requires: [],
  },
  {
    id: 'calculateur',
    label: 'Calculateur d’irrigation',
    summary: 'Calculer le débit d’un réglage depuis le matériel : débit, espacement, largeur, pression.',
    requires: ['materiel'],
  },
  {
    id: 'ressources',
    label: 'Ressources et pompes',
    summary: 'Les ressources en eau, leurs relevés et leur débit, les pompes, la faisabilité.',
    requires: ['arrosages'],
  },
  {
    id: 'alertes-meteo',
    label: 'Alertes météo',
    summary: 'Une alerte sur le téléphone quand la prévision passe un seuil que vous choisissez.',
    requires: [],
  },
  {
    id: 'alertes-cultures',
    label: 'Alertes cultures',
    summary: 'Le gel selon la culture, l’arrêt d’arrosage avant récolte, les aspersions à reconsidérer.',
    requires: [],
  },
  {
    id: 'historique',
    label: 'Historique et cumuls',
    summary: 'Les cumuls par planche, jardin ou ferme, le suivi par série et l’export CSV.',
    requires: ['arrosages'],
  },
];

/**
 * Les cases qui existaient quand le choix est apparu (3.8). Une ferme qui
 * utilisait déjà le module et n'a encore rien choisi les a toutes, cochées
 * (R6) ; une case ajoutée plus tard n'en fait pas partie et arrive décochée,
 * annoncée par le bandeau (R7, précision P2).
 */
export const FEATURES_BEFORE_SELECTION: readonly FeatureId[] = [
  'arrosages',
  'planning',
  'besoins',
  'sol',
  'cultures',
  'materiel',
  'ressources',
  'alertes-meteo',
  'alertes-cultures',
  'historique',
];

const FEATURE_BY_ID = new Map(FEATURES.map((feature) => [feature.id, feature]));

export function isFeatureId(value: unknown): value is FeatureId {
  return typeof value === 'string' && FEATURE_BY_ID.has(value as FeatureId);
}

export function featureDefinition(id: FeatureId): FeatureDefinition {
  const feature = FEATURE_BY_ID.get(id);
  if (!feature) throw new Error(`Fonctionnalité inconnue : ${id}`);
  return feature;
}

export function featureLabel(id: FeatureId): string {
  return featureDefinition(id).label;
}
