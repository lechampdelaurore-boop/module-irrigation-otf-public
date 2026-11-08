import type { CropPlan } from '../domain/domain.ts';
import { addDaysToDateKey, dateKeyInTimeZone } from '../domain/water-management.ts';
import { weekKeyFromDateKey } from '../domain/week-keys.ts';

// Trois semaines : assez loin pour rester « à venir » le temps d'un parcours
// navigateur, quel que soit le jour où il tourne.
const DAYS_UNTIL_UPCOMING_PLANTING = 21;
const DAYS_OF_UPCOMING_HARVEST_START = DAYS_UNTIL_UPCOMING_PLANTING + 42;
// Des carottes semées trois semaines plus tôt et récoltées dans huit : une
// culture en place le jour du parcours, au premier stade de la carotte du
// CRIIAM (30 jours), pour la fiche du besoin de la culture (5 quater).
const DAYS_SINCE_CURRENT_SOWING = 21;
const DAYS_UNTIL_CURRENT_HARVEST = 56;

/**
 * Le plan de culture de la ferme de démonstration, cohérent avec ses planches
 * (docs/series-contract.md, « Lecture et cache ») : une succession sur N01 —
 * les carottes, puis la mâche encore à venir —, des tomates en cours sous le
 * tunnel, des carottes en place sous le verger le jour même, une série sans
 * implantation et une série en bloc, toutes deux ignorées sans affichage, et
 * une série d'une autre saison.
 */
export function buildMockCropPlan(now = new Date()): CropPlan {
  const today = dateKeyInTimeZone(now);
  const plantingWeek = weekKeyFromDateKey(addDaysToDateKey(today, DAYS_UNTIL_UPCOMING_PLANTING));
  const upcomingHarvestWeek = weekKeyFromDateKey(addDaysToDateKey(today, DAYS_OF_UPCOMING_HARVEST_START));
  const currentSowingWeek = weekKeyFromDateKey(addDaysToDateKey(today, -DAYS_SINCE_CURRENT_SOWING));
  const currentHarvestWeek = weekKeyFromDateKey(addDaysToDateKey(today, DAYS_UNTIL_CURRENT_HARVEST));

  return {
    series: [
      {
        id: 'serie-carottes', name: 'Carottes de printemps', season: 2026, use: 'bed', cycle: 'annual',
        cultivations: [{
          id: 'culture-carottes', plantId: 'plante-carotte', plantName: 'Carotte',
          harvestWeeks: ['2026-W24', '2026-W25', '2026-W26'],
          harvestWeeksExpected: ['2026-W24', '2026-W25', '2026-W26', '2026-W27'],
        }],
      },
      {
        id: 'serie-mache', name: 'Mâche d’automne', season: 2026, use: 'bed', cycle: 'annual',
        cultivations: [{
          id: 'culture-mache', plantId: 'plante-mache', plantName: 'Mâche',
          harvestWeeks: [], harvestWeeksExpected: [upcomingHarvestWeek],
        }],
      },
      {
        id: 'serie-tomates', name: 'Tomates du tunnel', season: 2026, use: 'bed', cycle: 'annual',
        cultivations: [{
          id: 'culture-tomates', plantId: 'plante-tomate', plantName: 'Tomate',
          harvestWeeks: [], harvestWeeksExpected: ['2026-W28', '2026-W36', '2026-W44'],
        }],
      },
      {
        id: 'serie-carottes-verger', name: 'Carottes du verger', season: 2026, use: 'bed', cycle: 'annual',
        cultivations: [{
          id: 'culture-carottes-verger', plantId: 'plante-carotte', plantName: 'Carotte',
          harvestWeeks: [], harvestWeeksExpected: [currentHarvestWeek],
        }],
      },
      {
        id: 'serie-radis', name: 'Radis sans semis', season: 2026, use: 'bed', cycle: 'annual',
        cultivations: [{
          id: 'culture-radis', plantId: 'plante-radis', plantName: 'Radis',
          harvestWeeks: [], harvestWeeksExpected: ['2026-W18'],
        }],
      },
      {
        id: 'serie-endives', name: 'Endives en bloc', season: 2026, use: 'block', cycle: 'annual',
        cultivations: [{
          id: 'culture-endives', plantId: 'plante-endive', plantName: 'Endive',
          harvestWeeks: [], harvestWeeksExpected: ['2026-W48'],
        }],
      },
      {
        id: 'serie-oignons-2027', name: 'Oignons', season: 2027, use: 'bed', cycle: 'annual',
        cultivations: [{
          id: 'culture-oignons', plantId: 'plante-oignon', plantName: 'Oignon',
          harvestWeeks: [], harvestWeeksExpected: ['2027-W30'],
        }],
      },
    ],
    places: [
      { id: 'place-carottes-n01', seriesId: 'serie-carottes', bedId: 'bed-n01', lengthMeters: 30 },
      { id: 'place-mache-n01', seriesId: 'serie-mache', bedId: 'bed-n01', lengthMeters: 16 },
      { id: 'place-tomates-t01', seriesId: 'serie-tomates', bedId: 'bed-t01', lengthMeters: 20 },
      { id: 'place-carottes-v01', seriesId: 'serie-carottes-verger', bedId: 'bed-v01', lengthMeters: 20 },
      { id: 'place-radis-n02', seriesId: 'serie-radis', bedId: 'bed-n02', lengthMeters: 30 },
      { id: 'place-oignons-n01', seriesId: 'serie-oignons-2027', bedId: 'bed-n01', lengthMeters: 30 },
    ],
    implantationTasks: [
      { id: 'tache-carottes-semis', seriesId: 'serie-carottes', cultivationId: 'culture-carottes', kind: 'direct-sowing', plannedWeek: '2026-W12', doneWeek: '2026-W12', status: 'done' },
      { id: 'tache-mache-plantation', seriesId: 'serie-mache', cultivationId: null, kind: 'planting', plannedWeek: plantingWeek, doneWeek: null, status: 'todo' },
      { id: 'tache-tomates-plantation', seriesId: 'serie-tomates', cultivationId: 'culture-tomates', kind: 'planting', plannedWeek: '2026-W15', doneWeek: '2026-W16', status: 'done' },
      { id: 'tache-carottes-verger-semis', seriesId: 'serie-carottes-verger', cultivationId: 'culture-carottes-verger', kind: 'direct-sowing', plannedWeek: currentSowingWeek, doneWeek: currentSowingWeek, status: 'done' },
      { id: 'tache-endives-semis', seriesId: 'serie-endives', cultivationId: 'culture-endives', kind: 'direct-sowing', plannedWeek: '2026-W20', doneWeek: '2026-W20', status: 'done' },
      { id: 'tache-oignons-plantation', seriesId: 'serie-oignons-2027', cultivationId: null, kind: 'planting', plannedWeek: '2027-W10', doneWeek: null, status: 'todo' },
    ],
    readSummary: {
      seriesRead: 7,
      placesRead: 6,
      tasksRead: 6,
      tasksRetained: 6,
      placesWithoutSeries: 0,
      placesOfUnknownSeries: 0,
      placesWithUnknownBed: 0,
    },
  };
}
