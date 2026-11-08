import type { CropCultivation, CropSeries, ImplantationTask, WeekKey } from '../../lib/domain/domain.ts';
import { cultivationDates, isUnplacedCultivation, type CultivationDates } from '../../lib/domain/crop-water/crop-calendar.ts';
import type { ReferenceCrop, StageAnchor, StageStart } from '../../lib/domain/crop-water/reference.ts';

/**
 * Les cultures de référence des scénarios du contrat
 * (docs/crop-water-need-contract.md) : les Kc du CRIIAM et de la FAO, les
 * dates par défaut et les délais de levée validés par le porteur le
 * 31 octobre 2026 (D-054). Ce sont des données de test : en service, elles
 * viennent de la base (PR suivante).
 */

const ALL_MONTHS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12];
const NO_EMERGENCE_DELAY = { 'direct-sowing': 0, planting: 0 } as const;

const at = (anchor: StageAnchor, estimated = false): StageStart => ({ anchor, estimated });
const day = (days: number, estimated = false) => at({ from: 'implantation', days }, estimated);
const afterEmergence = (days: number) => at({ from: 'emergence', days });
const beforeHarvest = (days: number) => at({ from: 'before-harvest', days });

export const TOMATO: ReferenceCrop = {
  id: 'criiam-tomate',
  name: 'Tomate',
  source: 'criiam',
  emergenceDelayDays: NO_EMERGENCE_DELAY,
  curve: {
    shape: 'steps',
    stages: [
      { rank: 1, label: 'Plantation → Reprise', kc: 0.2 },
      { rank: 2, label: 'Reprise → Floraison 3e bouquet', kc: 0.6 },
      { rank: 3, label: 'Floraison 3e bouquet → Mi-récolte', kc: 0.9 },
      { rank: 4, label: 'Mi-récolte → Fin culture', kc: 0.7 },
    ],
    sets: [{ months: ALL_MONTHS, value: [day(0), day(15), day(30, true), at({ from: 'mid-harvest' })] }],
  },
};

export const CARROT: ReferenceCrop = {
  id: 'criiam-carotte',
  name: 'Carotte',
  source: 'criiam',
  emergenceDelayDays: { 'direct-sowing': 10, planting: 0 },
  curve: {
    shape: 'steps',
    stages: [
      { rank: 1, label: 'Semis → 30 j après', kc: 0.5 },
      { rank: 2, label: '30 j → Récolte', kc: 1 },
    ],
    sets: [{ months: ALL_MONTHS, value: [day(0), day(30)] }],
  },
};

export const GARLIC: ReferenceCrop = {
  id: 'criiam-ail',
  name: 'Ail',
  source: 'criiam',
  emergenceDelayDays: { 'direct-sowing': 30, planting: 30 },
  curve: {
    shape: 'steps',
    stages: [
      { rank: 1, label: 'Fin levée → Formation bulbe', kc: 0.5 },
      { rank: 2, label: 'Formation bulbe → Grossissement maxi', kc: 0.9 },
      { rank: 3, label: 'Grossissement maxi → 20 j avant récolte', kc: 0.6 },
      { rank: 4, label: '20 j avant récolte → Récolte', kc: 0 },
    ],
    sets: [{ months: ALL_MONTHS, value: [day(0), beforeHarvest(45), beforeHarvest(25), beforeHarvest(20)] }],
  },
};

export const CAULIFLOWER: ReferenceCrop = {
  id: 'criiam-chou-fleur',
  name: 'Chou-fleur',
  source: 'criiam',
  emergenceDelayDays: NO_EMERGENCE_DELAY,
  curve: {
    shape: 'steps',
    stages: [
      { rank: 1, label: 'Plantation → Apparition inflorescences', kc: 0.5 },
      { rank: 2, label: 'Apparition inflorescences → Début formation des choux', kc: 1 },
      { rank: 3, label: 'Début formation des choux → Récolte', kc: 1.3 },
    ],
    sets: [
      { months: [3, 4, 5, 6, 7, 8], value: [day(0), day(35), day(50, true)] },
      { months: [9, 10, 11, 12, 1, 2], value: [day(0), day(30), day(155)] },
    ],
  },
};

export const PEPPER: ReferenceCrop = {
  id: 'criiam-poivron',
  name: 'Poivron',
  source: 'criiam',
  emergenceDelayDays: NO_EMERGENCE_DELAY,
  curve: {
    shape: 'steps',
    stages: [
      { rank: 1, label: 'Plantation → Début floraison', kc: 0.5 },
      { rank: 2, label: 'Début floraison → Croissance 3e étage', kc: 0.6 },
      { rank: 3, label: 'Croissance 3e étage → Mi-récolte', kc: 0.7 },
      { rank: 4, label: 'Mi-récolte → Fin récolte', kc: 0.6 },
    ],
    sets: [{ months: ALL_MONTHS, value: [day(0), day(30), day(50, true), at({ from: 'mid-harvest' })] }],
  },
};

export const POTATO: ReferenceCrop = {
  id: 'criiam-pomme-de-terre',
  name: 'Pomme de terre',
  source: 'criiam',
  emergenceDelayDays: { 'direct-sowing': 25, planting: 25 },
  curve: {
    shape: 'steps',
    stages: [
      { rank: 1, label: 'Levée → 20 j', kc: 0.5 },
      { rank: 2, label: '20 j → Fin tubérisation', kc: 1.1 },
      { rank: 3, label: 'Fin tubérisation → 20 j avant récolte', kc: 0.6 },
      { rank: 4, label: '20 j avant récolte → Récolte', kc: 0 },
    ],
    sets: [{ months: ALL_MONTHS, value: [afterEmergence(0), afterEmergence(20), beforeHarvest(30), beforeHarvest(20)] }],
  },
};

export const ONION: ReferenceCrop = {
  id: 'criiam-oignon',
  name: 'Oignon',
  source: 'criiam',
  emergenceDelayDays: { 'direct-sowing': 7, planting: 0 },
  curve: {
    shape: 'steps',
    stages: [
      { rank: 1, label: 'Levée → 30 j', kc: 0.6 },
      { rank: 2, label: '30 → 60 j', kc: 0.8 },
      { rank: 3, label: '60 j → Début maturité', kc: 1 },
      { rank: 4, label: 'Début maturité → 20 j avant récolte', kc: 1.1 },
      { rank: 5, label: '20 j avant récolte → Récolte', kc: 0.5 },
    ],
    sets: [{ months: ALL_MONTHS, value: [afterEmergence(0), afterEmergence(30), afterEmergence(60), beforeHarvest(40), beforeHarvest(20)] }],
  },
};

export const SUMMER_SALAD: ReferenceCrop = {
  id: 'criiam-salade-ete',
  name: "Salade d'été",
  source: 'criiam',
  emergenceDelayDays: { 'direct-sowing': 4, planting: 0 },
  curve: {
    shape: 'steps',
    stages: [
      { rank: 1, label: 'Plantation → Début croissance active', kc: 0.4 },
      { rank: 2, label: 'Début croissance active → Récolte', kc: 0.7 },
    ],
    sets: [
      { months: [3, 4, 5, 6, 7, 8, 9, 10], value: [day(0), day(20)] },
      { months: [11, 12, 1], value: [day(0), day(30)] },
      { months: [2], value: [day(0), day(35)] },
    ],
  },
};

export const ASPARAGUS: ReferenceCrop = {
  id: 'criiam-asperge',
  name: 'Asperge',
  source: 'criiam',
  emergenceDelayDays: NO_EMERGENCE_DELAY,
  curve: {
    shape: 'calendar',
    stages: [
      { rank: 1, label: 'Fin récolte → Débuttage', kc: 0.5, start: '05-31', estimated: true },
      { rank: 2, label: 'Débuttage → 1 mois après', kc: 0.9, start: '06-07', estimated: false },
      { rank: 3, label: '1 → 2 mois après', kc: 0.7, start: '07-07', estimated: false },
      { rank: 4, label: '2 → 3 mois après', kc: 0.5, start: '08-07', estimated: false },
    ],
    end: '09-07',
    establishment: null,
  },
};

export const ARTICHOKE: ReferenceCrop = {
  id: 'criiam-artichaut-remontant',
  name: 'Artichaut remontant',
  source: 'criiam',
  emergenceDelayDays: NO_EMERGENCE_DELAY,
  curve: {
    shape: 'calendar',
    stages: [
      { rank: 3, label: 'Montée des capitules → 15 j avant 1re récolte', kc: 0.8, start: '08-01', estimated: true },
      { rank: 4, label: '15 j avant 1re récolte → Fin 1re récolte', kc: 1.1, start: '08-15', estimated: false },
      { rank: 5, label: 'Fin 1re → Fin 2e récolte', kc: 0.6, start: '01-01', estimated: false },
    ],
    end: '05-31',
    establishment: { rank: 1, label: 'Plantation-reprise → 2 mois après', kc: 0.5, months: 2 },
  },
};

const faoTrapezoid = (
  id: string,
  name: string,
  kc: [number, number, number],
  lengths: [number, number, number, number],
): ReferenceCrop => ({
  id,
  name,
  source: 'fao56',
  emergenceDelayDays: NO_EMERGENCE_DELAY,
  curve: {
    shape: 'trapezoid',
    kcInitial: kc[0],
    kcMid: kc[1],
    kcEnd: kc[2],
    sets: [{ months: ALL_MONTHS, value: { initial: lengths[0], development: lengths[1], mid: lengths[2], late: lengths[3] } }],
    abatement: 1,
  },
});

export const BROCCOLI = faoTrapezoid('fao-brocoli', 'Brocoli', [0.7, 1.05, 0.95], [20, 30, 20, 10]);
export const GREEN_ONION = faoTrapezoid('fao-oignon-vert', 'Oignon vert', [0.7, 1, 1], [25, 30, 10, 5]);
export const BROAD_BEAN = faoTrapezoid('fao-feve', 'Fève', [0.5, 1.15, 1.1], [90, 45, 40, 0]);

export const REFERENCE_CROPS: readonly ReferenceCrop[] = [
  TOMATO, CARROT, GARLIC, CAULIFLOWER, PEPPER, POTATO, ONION, SUMMER_SALAD, ASPARAGUS, ARTICHOKE, BROCCOLI, GREEN_ONION, BROAD_BEAN,
];

export function cultivation(
  id: string,
  plantId: string,
  plantName: string,
  harvest: { realized?: WeekKey[]; expected?: WeekKey[] } = {},
): CropCultivation {
  return { id, plantId, plantName, harvestWeeks: harvest.realized ?? [], harvestWeeksExpected: harvest.expected ?? [] };
}

export function series(
  id: string,
  cultivations: CropCultivation[],
  options: Partial<Pick<CropSeries, 'name' | 'season' | 'use' | 'cycle'>> = {},
): CropSeries {
  return { id, name: options.name ?? id, season: options.season ?? 2026, use: options.use ?? 'bed', cycle: options.cycle ?? 'annual', cultivations };
}

export function task(seriesId: string, kind: ImplantationTask['kind'], week: WeekKey, done = true): ImplantationTask {
  return { id: `${seriesId}-${kind}-${week}`, seriesId, cultivationId: null, kind, plannedWeek: week, doneWeek: done ? week : null, status: done ? 'done' : 'todo' };
}

/** Les dates d'une série d'une seule culture, implantée par une tâche ; échoue si la culture n'est pas placée. */
export function datesOf(item: CropSeries, tasks: readonly ImplantationTask[], today = '2026-11-05'): CultivationDates {
  const dates = cultivationDates(item, item.cultivations[0], tasks, today);
  if (isUnplacedCultivation(dates)) throw new Error(`Culture non placée : ${dates.reason}`);
  return dates;
}
