/**
 * Ce que chaque ferme fictive a déjà réglé dans le module à sa première
 * ouverture (docs/demo-guided-contract.md, section 6 ; D2) : le rattachement
 * de ses espèces aux cultures de référence du catalogue Kc validé
 * (migration 0023) et au jeu commun des seuils de gel (migration 0026).
 * Aucune valeur agronomique ici : seulement des clés de ces deux jeux, que
 * la ferme choisirait elle-même dans Réglages et dans Alertes cultures.
 */

/** L'espèce d'Ouvre ta ferme (fictive) → la culture de référence du catalogue Kc. */
export const DEMO_SPECIES_REFERENCES: Readonly<Record<string, string>> = {
  'plante-carotte': 'criiam-carotte',
  'plante-epinard': 'fao-epinard',
  'plante-tomate': 'criiam-tomate',
  'plante-courgette': 'criiam-courgette',
  'plante-salade': 'criiam-salade-ete',
  'plante-radis': 'fao-radis',
  'plante-poireau': 'criiam-poireau',
  'plante-oignon': 'criiam-oignon',
  'plante-haricot': 'criiam-haricot',
  'plante-pomme-de-terre': 'criiam-pomme-de-terre',
  'plante-fraisier': 'criiam-fraisier',
};

/**
 * L'espèce → l'entrée du jeu commun des seuils de gel. Le fraisier n'y a
 * aucune valeur (« aucune valeur trouvée ») : il reste sans rattachement,
 * comme le ferait une vraie ferme.
 */
export const DEMO_FROST_COMMON_KEYS: Readonly<Record<string, string>> = {
  'plante-carotte': 'carotte',
  'plante-epinard': 'epinard',
  'plante-tomate': 'tomate',
  'plante-courgette': 'courgette',
  'plante-salade': 'laitue-mesclun',
  'plante-radis': 'radis',
  'plante-poireau': 'poireau',
  'plante-oignon': 'oignon-jaune',
  'plante-haricot': 'haricot',
  'plante-pomme-de-terre': 'pomme-de-terre',
};

/**
 * Le matériel de chaque ferme : un goutte-à-goutte par parcelle, posé sur
 * toutes ses planches depuis le début de la saison. Valeurs de matériel
 * fictives, ni agronomiques ni reprises de la ferme réelle.
 */
export type DemoEquipmentDefinition = { name: string; plotId: string; rateMmPerHour: number };

const DRIP_RATE_MM_PER_HOUR = 6;
const drip = (name: string, plotId: string): DemoEquipmentDefinition => ({ name, plotId, rateMmPerHour: DRIP_RATE_MM_PER_HOUR });

export const DEMO_EQUIPMENT: Readonly<Record<string, readonly DemoEquipmentDefinition[]>> = {
  maraichage: [
    drip('Goutte-à-goutte du champ du haut', 'plot-champ-haut'),
    drip('Goutte-à-goutte de l’abri', 'plot-abri-noues'),
    drip('Goutte-à-goutte du champ du bas', 'plot-champ-bas'),
    drip('Goutte-à-goutte du clos', 'plot-clos-saules'),
  ],
  'petite-ferme': [
    drip('Goutte-à-goutte du jardin', 'plot-jardin-mare'),
    drip('Goutte-à-goutte du petit abri', 'plot-petit-abri'),
  ],
  'vannes-alertes': [
    drip('Goutte-à-goutte des vignes', 'plot-parcelle-vignes'),
    drip('Goutte-à-goutte du verger', 'plot-rangs-verger'),
  ],
};

/** La pose date du début de la saison : avant le premier moment. */
export const DEMO_PLACED_AT = '2026-03-02T08:00:00.000Z';

/**
 * L'eau de chaque ferme. La ferme A : un puits qui remplit un bassin, d'où
 * une pompe tire l'eau de l'arrosage ; au pic d'été, le puits est à sec et le bassin bas, d'où
 * la pénurie. La ferme B : le réseau, sans réserve. Volumes fictifs.
 */
export type DemoWaterDefinition = {
  resource: { name: string; type: 'well' | 'network'; nominalFlowCubicMetersPerHour: number };
  reservoir: { name: string; capacityCubicMeters: number; minimumSafetyCubicMeters: number; volumeByMoment: Readonly<Record<string, number>> } | null;
  /** La pompe qui tire l'eau de la réserve vers le matériel. */
  pump: { name: string; maximumFlowCubicMetersPerHour: number } | null;
  /** Les moments où la ressource est à sec, avec ce que la fiche en dit. */
  dryMoments: Readonly<Record<string, string>>;
};

export const DEMO_WATER: Readonly<Record<string, DemoWaterDefinition>> = {
  maraichage: {
    resource: { name: 'Puits des noues', type: 'well', nominalFlowCubicMetersPerHour: 1.5 },
    reservoir: {
      name: 'Bassin des noues',
      capacityCubicMeters: 40,
      minimumSafetyCubicMeters: 4,
      volumeByMoment: { 'gel-printemps': 36, ete: 30, penurie: 6, automne: 22 },
    },
    pump: { name: 'Pompe du bassin', maximumFlowCubicMetersPerHour: 3 },
    dryMoments: { penurie: 'À sec depuis la mi-juillet : le bassin ne se remplit plus.' },
  },
  'petite-ferme': {
    resource: { name: 'Réseau communal', type: 'network', nominalFlowCubicMetersPerHour: 2 },
    reservoir: null,
    pump: null,
    dryMoments: {},
  },
};

/**
 * Les habitudes d'arrosage des fermes fictives, pour l'historique et les
 * cumuls : un arrosage par semaine et par goutte-à-goutte, le lundi à 7 h
 * (la veille de chaque moment, un mardi : la semaine du moment en a déjà un),
 * d'une durée qui suit la saison. Ce sont les gestes d'une ferme inventée,
 * pas une recommandation : le module ne s'en sert que pour les compter.
 */
export const DEMO_HISTORY_START = '2026-04-20';
export const DEMO_HISTORY_HOUR_UTC = 5;

/** La durée habituelle d'un arrosage selon le mois (`01` à `12`), en minutes ; 0 : pas d'arrosage. */
export const DEMO_HISTORY_MINUTES_BY_MONTH: Readonly<Record<string, number>> = {
  '04': 45,
  '05': 60,
  '06': 120,
  '07': 150,
  '08': 150,
  '09': 90,
  '10': 45,
};
