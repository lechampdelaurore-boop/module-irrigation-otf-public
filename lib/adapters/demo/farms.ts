import type { IrrigationSnapshot } from '../../domain/domain.ts';
import type { DemoProfileId } from '../../domain/demo/catalogue.ts';
import { bedRow, buildDemoSnapshot, type DemoFarmDefinition, type DemoSeriesDefinition } from './farm-builder.ts';

/**
 * Les quatre fermes fictives de la démonstration (docs/demo-guided-contract.md,
 * section 6). Noms de lieux inventés, aucun repris de la ferme réelle (couche
 * 4, `tests/demo-farms.test.ts`) ; uniquement des espèces du catalogue Kc
 * validé, aucune valeur agronomique nouvelle. La ferme A reprend la forme de
 * la ferme de démonstration des parcours (plein champ, un abri, un verger),
 * étendue ; les parcours gardent la leur, intacte.
 */

const series = (
  id: string, name: string, plant: string, plantName: string, kind: DemoSeriesDefinition['kind'],
  implantationWeek: number, harvest: readonly [number, number], places: DemoSeriesDefinition['places'],
): DemoSeriesDefinition => ({
  id: `serie-${id}`,
  name,
  plantId: `plante-${plant}`,
  plantName,
  kind,
  implantationWeek: `2026-W${String(implantationWeek).padStart(2, '0')}`,
  harvestWeeks: Array.from({ length: harvest[1] - harvest[0] + 1 }, (_, index) => `2026-W${String(harvest[0] + index).padStart(2, '0')}`),
  places,
});

const MARAICHAGE: DemoFarmDefinition = {
  id: 'demo-maraichage',
  name: 'Ferme des Trois Noues',
  city: 'Nantes',
  postcode: '44000',
  zones: [
    {
      id: 'zone-grand-champ',
      name: 'Le Grand Champ',
      plots: [
        { id: 'plot-champ-haut', name: 'Champ du haut', mode: 'garden', length: 42, width: 18, beds: bedRow('H', 3, { length: 30, width: 0.75, alleyWidth: 0.45 }) },
        { id: 'plot-abri-noues', name: 'Abri des noues', mode: 'greenhouse', length: 30, width: 8, beds: bedRow('A', 3, { length: 26, width: 0.75, alleyWidth: 0.35 }) },
      ],
    },
    {
      id: 'zone-butte',
      name: 'La Butte',
      plots: [{ id: 'plot-champ-bas', name: 'Champ du bas', mode: 'garden', length: 36, width: 22, beds: bedRow('C', 2, { length: 32, width: 0.8, alleyWidth: 0.4 }) }],
    },
    {
      id: 'zone-clos-saules',
      name: 'Le Clos des Saules',
      plots: [{ id: 'plot-clos-saules', name: 'Clos des saules', mode: 'garden', length: 24, width: 14, beds: bedRow('S', 2, { length: 20, width: 0.8, alleyWidth: 0.5 }) }],
    },
  ],
  series: [
    series('carottes', 'Carottes de printemps', 'carotte', 'Carotte', 'direct-sowing', 12, [24, 27], [{ bedId: 'bed-h01', lengthMeters: 30 }]),
    series('epinards', 'Épinards d’automne', 'epinard', 'Épinard', 'planting', 36, [42, 46], [{ bedId: 'bed-h01', lengthMeters: 16 }]),
    series('tomates', 'Tomates sous abri', 'tomate', 'Tomate', 'planting', 16, [28, 40], [{ bedId: 'bed-a01', lengthMeters: 26 }, { bedId: 'bed-a02', lengthMeters: 26 }]),
    series('courgettes', 'Courgettes', 'courgette', 'Courgette', 'planting', 19, [26, 36], [{ bedId: 'bed-h02', lengthMeters: 30 }]),
    series('salades', 'Salades d’été', 'salade', 'Salade', 'planting', 22, [27, 29], [{ bedId: 'bed-h03', lengthMeters: 30 }]),
    series('radis', 'Radis de printemps', 'radis', 'Radis', 'direct-sowing', 14, [18, 19], [{ bedId: 'bed-c01', lengthMeters: 32 }]),
    series('poireaux', 'Poireaux d’hiver', 'poireau', 'Poireau', 'planting', 24, [40, 48], [{ bedId: 'bed-c02', lengthMeters: 32 }]),
    series('oignons', 'Oignons', 'oignon', 'Oignon', 'planting', 12, [28, 30], [{ bedId: 'bed-s01', lengthMeters: 20 }]),
  ],
};

const PETITE_FERME: DemoFarmDefinition = {
  id: 'demo-petite-ferme',
  name: 'Le Jardin de la Mare',
  city: 'Tours',
  postcode: '37000',
  zones: [{
    id: 'zone-potager',
    name: 'Le Potager',
    plots: [
      { id: 'plot-jardin-mare', name: 'Jardin de la mare', mode: 'garden', length: 20, width: 12, beds: bedRow('M', 4, { length: 15, width: 0.8, alleyWidth: 0.4 }) },
      { id: 'plot-petit-abri', name: 'Petit abri', mode: 'greenhouse', length: 12, width: 6, beds: bedRow('P', 2, { length: 10, width: 0.8, alleyWidth: 0.4 }) },
    ],
  }],
  series: [
    series('salades', 'Salades d’été', 'salade', 'Salade', 'planting', 18, [22, 24], [{ bedId: 'bed-m01', lengthMeters: 15 }]),
    series('courgettes', 'Courgettes', 'courgette', 'Courgette', 'planting', 19, [26, 35], [{ bedId: 'bed-m02', lengthMeters: 15 }]),
    series('haricots', 'Haricots verts', 'haricot', 'Haricot', 'direct-sowing', 20, [29, 33], [{ bedId: 'bed-m03', lengthMeters: 15 }]),
    series('tomates', 'Tomates de l’abri', 'tomate', 'Tomate', 'planting', 17, [28, 38], [{ bedId: 'bed-p01', lengthMeters: 10 }, { bedId: 'bed-p02', lengthMeters: 10 }]),
  ],
};

const VANNES_ALERTES: DemoFarmDefinition = {
  id: 'demo-vannes-alertes',
  name: 'Domaine des Terres Blanches',
  city: 'Valence',
  postcode: '26000',
  zones: [
    {
      id: 'zone-terres-blanches',
      name: 'Les Terres Blanches',
      plots: [{ id: 'plot-parcelle-vignes', name: 'Parcelle des vignes', mode: 'garden', length: 40, width: 20, beds: bedRow('V', 3, { length: 35, width: 1.2, alleyWidth: 0.6 }) }],
    },
    {
      id: 'zone-verger',
      name: 'Le Verger',
      plots: [{ id: 'plot-rangs-verger', name: 'Rangs du verger', mode: 'garden', length: 30, width: 10, beds: bedRow('R', 2, { length: 25, width: 1, alleyWidth: 0.5 }) }],
    },
  ],
  series: [
    series('pommes-de-terre', 'Pommes de terre', 'pomme-de-terre', 'Pomme de terre', 'planting', 14, [26, 30], [{ bedId: 'bed-v01', lengthMeters: 35 }, { bedId: 'bed-v02', lengthMeters: 35 }]),
    series('poireaux', 'Poireaux', 'poireau', 'Poireau', 'planting', 22, [38, 46], [{ bedId: 'bed-v03', lengthMeters: 35 }]),
    series('fraises', 'Fraisiers', 'fraisier', 'Fraisier', 'planting', 12, [20, 26], [{ bedId: 'bed-r01', lengthMeters: 25 }]),
  ],
};

const VIERGE: DemoFarmDefinition = {
  id: 'demo-vierge',
  name: 'Ferme du Pré Neuf',
  city: 'Nantes',
  postcode: '44000',
  zones: [{
    id: 'zone-pre-neuf',
    name: 'Le Pré Neuf',
    plots: [{ id: 'plot-jardin-neuf', name: 'Jardin neuf', mode: 'garden', length: 25, width: 10, beds: bedRow('J', 4, { length: 20, width: 0.8, alleyWidth: 0.4 }) }],
  }],
  series: [],
};

export const DEMO_FARMS: Readonly<Record<DemoProfileId, DemoFarmDefinition>> = {
  maraichage: MARAICHAGE,
  'petite-ferme': PETITE_FERME,
  'vannes-alertes': VANNES_ALERTES,
  vierge: VIERGE,
};

/** Le plan d'Ouvre ta ferme d'une ferme fictive, tel qu'il se lirait le jour du moment. */
export function demoFarmSnapshot(profile: DemoProfileId, momentDateKey: string): IrrigationSnapshot {
  return buildDemoSnapshot(DEMO_FARMS[profile], momentDateKey);
}

/**
 * Chaque espèce des fermes fictives et sa culture de référence du catalogue
 * Kc validé (migration 0023) : rien d'autre n'entre dans la démonstration.
 */
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
