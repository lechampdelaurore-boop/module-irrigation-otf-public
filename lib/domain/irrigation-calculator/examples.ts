import {
  NOZZLE_PRESSURE_EXPONENT,
  SELF_REGULATING_PRESSURE_EXPONENT,
  type CalculatorField,
  type CalculatorInputs,
  type CalculatorMethod,
} from './inputs';

/**
 * Les exemples de départ (docs/irrigation-calculator-contract.md, section 9) :
 * une courte liste dans le code, identique pour toutes les fermes, jamais une
 * base de produits. Un exemple ne préremplit que des champs ; l'utilisateur
 * les modifie librement. Chacun porte sa source, la date de lecture et ses
 * réserves, affichées à l'écran. Les noms de marque sont des références, sans
 * partenariat suggéré.
 */

export type CalculatorExample = {
  id: string;
  label: string;
  kind: 'drip' | 'sprinkler';
  /** La manière conseillée pour ce matériel, dite à l'écran ; l'exemple préremplit la manière choisie. */
  method: CalculatorMethod;
  fields: Partial<Record<CalculatorField, number>>;
  source: string;
  /** Date de lecture de la source, `AAAA-MM-JJ`. */
  readOn: string;
  reserve: string;
};

export const CALCULATOR_EXAMPLES: readonly CalculatorExample[] = [
  {
    id: 'naandanjain-427-orange-2-8',
    label: 'NaanDanJain 427 B-AG, buse orange 2,8 mm',
    kind: 'sprinkler',
    method: 'sprinkler_cone',
    fields: {
      referenceFlowLitersPerHour: 450,
      referencePressureBar: 2,
      pressureExponent: NOZZLE_PRESSURE_EXPONENT,
      reachMeters: 11,
      pressureRangeMinBar: 2,
      pressureRangeMaxBar: 4,
    },
    source: 'Fiche Bosta, asperseur type 427.',
    readOn: '2026-11-06',
    reserve: 'La fiche donne aussi 550 l/h à 3 bars et 630 l/h à 4 bars. À basse pression, le débit réel est bien plus bas : saisissez la pression réelle ou un débit mesuré.',
  },
  {
    id: 'naandanjain-hadar-7110-1-8',
    label: 'NaanDanJain Hadar 7110 inversé, buse 1,8 mm',
    kind: 'sprinkler',
    method: 'sprinkler_mean',
    fields: {
      referenceFlowLitersPerHour: 166,
      referencePressureBar: 2,
      pressureExponent: NOZZLE_PRESSURE_EXPONENT,
      reachMeters: 5.3,
      pressureRangeMinBar: 1.5,
      pressureRangeMaxBar: 3,
    },
    source: 'Fiche Bosta du micro-asperseur Hadar 7110 inversé, buse 1,8 mm vert clair (article 0610025) : 166 l/h et 5,3 m de portée à 2 bars, de 1,5 à 3 bars conseillés.',
    readOn: '2026-11-07',
    reserve: 'Valeurs de l’inventaire revérifiées sur la fiche le 7 novembre 2026. La fiche donne aussi 140 l/h à 1,5 bar et 197 l/h à 3 bars.',
  },
  {
    id: 'naandanjain-amnondrip-pc-as-16',
    label: 'NaanDanJain AmnonDrip PC AS Ø16, 1,6 l/h tous les 30 cm',
    kind: 'drip',
    method: 'drip_per_bed',
    fields: {
      referenceFlowLitersPerHour: 1.6,
      spacingMeters: 0.3,
      pressureExponent: SELF_REGULATING_PRESSURE_EXPONENT,
      pressureRangeMinBar: 0.5,
      pressureRangeMaxBar: 3.5,
    },
    source: 'Fiche technique longue NaanDanJain AmnonDrip (9 août 2018) : goutteur autorégulant de 0,5 à 4 bars, tuyau Ø16 de 2,5 à 3,5 bars au plus selon sa paroi.',
    readOn: '2026-11-07',
    reserve: 'La plage retenue s’arrête à 3,5 bars, la pression maximale du tuyau Ø16 en paroi de 1,0 ou 1,15 mm ; une paroi de 0,63 mm ne supporte que 2,5 bars, 0,90 mm que 3 bars.',
  },
  {
    id: 'netafim-supernet-sr-30',
    label: 'Netafim SuperNet SR 30 l/h',
    kind: 'sprinkler',
    method: 'sprinkler_mean',
    fields: {
      referenceFlowLitersPerHour: 30,
      spacingMeters: 1,
      wettedWidthMeters: 3,
      efficiencyPercent: 64,
    },
    source: 'Fiche de simulation Netafim transmise par Francis (Nutri-O), hauteur 0,5 m, 2,5 bars.',
    readOn: '2026-11-06',
    reserve: 'La fiche annonce 6,8 mm/h ; la moyenne à 64 % donne 6,4 mm/h, sans doute parce que la fiche suit le profil réel.',
  },
];

export function examplesForKind(kind: 'drip' | 'sprinkler'): CalculatorExample[] {
  return CALCULATOR_EXAMPLES.filter((example) => example.kind === kind);
}

/**
 * Les champs de l'exemple remplacent ceux de l'entrée. Ce qui décrit le
 * matériel de l'exemple précédent (débit et pression de sa fiche, sa plage)
 * est d'abord vidé ; ce que l'utilisateur sait de sa ferme (pression réelle,
 * largeurs, nombres) reste saisi.
 */
export function applyExample(inputs: CalculatorInputs, example: CalculatorExample): CalculatorInputs {
  return {
    ...inputs,
    measuredFlowLitersPerHour: null,
    referenceFlowLitersPerHour: null,
    referencePressureBar: null,
    pressureExponent: NOZZLE_PRESSURE_EXPONENT,
    pressureRangeMinBar: null,
    pressureRangeMaxBar: null,
    ...example.fields,
  };
}
