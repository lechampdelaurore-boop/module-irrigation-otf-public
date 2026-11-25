/**
 * Les mots du premier niveau (simplification, lot S1, PR 2,
 * docs/simplification-s1-contract.md, section 4 ; D-328) : les titres, les
 * boutons et les phrases d'en-tête parlent comme le champ. Le tableau des
 * mots a été accepté tel quel par le porteur le 25 novembre 2026 (D-327).
 *
 * Un seul endroit (règle 1) : l'interface prend ces libellés ici, elle ne
 * les recopie pas. Le mot du calcul (RFU, ET0, culture de référence…) reste
 * là où il informe : dans le « ? » et dans le détail repliable, pour que le
 * maraîcher qui lit un document d'Ouvre ta ferme ou de Tlaloc retrouve son
 * terme. Les identifiants du code, les adresses, les en-têtes de l'export
 * CSV, les ancres et les textes des notifications gardent leurs mots (F828).
 */
export const SIMPLE_WORDS = {
  /** « Objectifs hydriques », « objectif hebdomadaire ». */
  weekGoal: 'Eau visée cette semaine',
  /** « Reste à apporter ». */
  stillMissing: 'Il manque encore',
  /** « Besoins d'irrigation ». */
  leftToWater: 'Ce qu’il reste à arroser',
  /** « Faisabilité et répartition de l'eau ». */
  enoughWater: 'Y a-t-il assez d’eau ?',
  /** « Volume mobilisable », « disponibilité physique ». */
  usableWater: 'Eau utilisable',
  /** « Réserve utile (RFU) » : « RFU » dans le détail. */
  soilHolds: 'Ce que votre sol retient',
  /** « ET0 » : « ET0 » dans le détail (F833 : du jour, de la semaine, de la période). */
  thirstOfDay: 'Soif du jour',
  thirstOfWeek: 'Soif de la semaine',
  thirstOfPeriod: 'Soif de la période',
  /** « Culture de référence », « correspondance des espèces ». */
  lookalikeCrop: 'À quelle culture ressemble cette espèce ?',
  /** Le titre de la liste des espèces (F832 : le même mot, au pluriel du sens). */
  lookalikeCrops: 'À quelle culture ressemble chaque espèce ?',
  /** « Coefficients culturaux », « profils racinaires ». */
  cropFineSettings: 'Réglages fins des cultures (pour les experts)',
  /** « Réglage (d'un matériel) », « apport horaire ». */
  hourlyApplication: 'Ce que ce matériel apporte en une heure',
  /** « Créneaux protégés ». */
  noWateringHours: 'Heures où l’on n’arrose pas',
  /** « Reliquat ». */
  stoppedRemainder: 'Ce qui reste d’un arrosage arrêté',
} as const;

/**
 * Les mots du calcul qui ne paraissent plus au premier niveau (règle 5) :
 * le test de garde (tests/simplification-s1-mots.test.ts) les cherche dans
 * les titres, les boutons et les lignes de résumé, hors des endroits permis.
 */
export const TECHNICAL_WORDS = [
  'Objectifs hydriques',
  'Objectif hydrique',
  'objectif hebdomadaire',
  'Objectifs hebdomadaires',
  'Reste à apporter',
  'Besoins d’irrigation',
  'Faisabilité et répartition',
  'Volume mobilisable',
  'Disponibilité physique',
  'Réserve utile',
  'Culture de référence',
  'Cultures de référence',
  'Correspondance des espèces',
  'Coefficients culturaux',
  'Profils racinaires',
  'Apport horaire',
  'Créneaux protégés',
  'Reliquat',
  'Par périmètre',
  'totaux partiels',
] as const;
