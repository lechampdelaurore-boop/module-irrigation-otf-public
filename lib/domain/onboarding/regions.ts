import type { KcSource } from '../crop-water/reference.ts';
import type { ResolvedOnboarding } from './steps.ts';

/**
 * La région d'origine des cultures du jeu commun (4.4,
 * docs/tranche-4-contract.md, F422, F428 réponse 3 ; PR 4b, F586) : chaque
 * culture dit d'où viennent ses dates de stade, et une ferme d'une autre
 * région en est avertie. La région de la ferme se déduit de la commune
 * confirmée (F419) : le département de son code postal, puis l'une des
 * treize régions de France métropolitaine.
 */

const REGIONS = {
  ara: 'Auvergne-Rhône-Alpes',
  bfc: 'Bourgogne-Franche-Comté',
  bre: 'Bretagne',
  cvl: 'Centre-Val de Loire',
  cor: 'Corse',
  ges: 'Grand Est',
  hdf: 'Hauts-de-France',
  idf: 'Île-de-France',
  nor: 'Normandie',
  naq: 'Nouvelle-Aquitaine',
  occ: 'Occitanie',
  pdl: 'Pays de la Loire',
  pac: 'Provence-Alpes-Côte d’Azur',
} as const;
type RegionId = keyof typeof REGIONS;

/** Les départements de chaque région (découpage de 2016), par les deux premiers chiffres du code postal ; 20 : la Corse. */
const DEPARTMENTS: Record<RegionId, readonly string[]> = {
  ara: ['01', '03', '07', '15', '26', '38', '42', '43', '63', '69', '73', '74'],
  bfc: ['21', '25', '39', '58', '70', '71', '89', '90'],
  bre: ['22', '29', '35', '56'],
  cvl: ['18', '28', '36', '37', '41', '45'],
  cor: ['20'],
  ges: ['08', '10', '51', '52', '54', '55', '57', '67', '68', '88'],
  hdf: ['02', '59', '60', '62', '80'],
  idf: ['75', '77', '78', '91', '92', '93', '94', '95'],
  nor: ['14', '27', '50', '61', '76'],
  naq: ['16', '17', '19', '23', '24', '33', '40', '47', '64', '79', '86', '87'],
  occ: ['09', '11', '12', '30', '31', '32', '34', '46', '48', '65', '66', '81', '82'],
  pdl: ['44', '49', '53', '72', '85'],
  pac: ['04', '05', '06', '13', '83', '84'],
};

const REGION_OF_DEPARTMENT = new Map<string, RegionId>(
  (Object.entries(DEPARTMENTS) as [RegionId, readonly string[]][]).flatMap(([region, departments]) => departments.map((department) => [department, region])),
);

export type FarmRegion = { id: RegionId; label: string };

/** La région d'un code postal de France métropolitaine ; `null` pour un code inconnu ou d'outre-mer. */
export function regionOfPostcode(postcode: string | null | undefined): FarmRegion | null {
  const digits = (postcode ?? '').trim();
  if (!/^\d{5}$/.test(digits)) return null;
  const id = REGION_OF_DEPARTMENT.get(digits.slice(0, 2));
  return id ? { id, label: REGIONS[id] } : null;
}

/** Les régions d'où viennent les dates de stade du CRIIAM Sud (F428, réponse 3). */
const CRIIAM_REGIONS: readonly RegionId[] = ['pac', 'occ'];

/** D'où viennent les dates de stade d'une culture, dit sur sa fiche. */
export function cropOriginText(source: KcSource, origin: 'common' | 'farm'): string {
  if (origin === 'farm') return 'Dates de stade de votre ferme.';
  if (source === 'criiam') return 'Dates de stade de la région Sud / Occitanie (CRIIAM Sud), validées par la ferme du porteur le 31 octobre 2026.';
  if (source === 'fao56') return 'Dates de stade générales (FAO-56), sans région.';
  return 'Dates de stade saisies par une ferme.';
}

/** Les délais de levée et les calendriers du jeu commun : ceux de la ferme du porteur (F428, réponse 3). */
export const CARRIER_CONDUCT_TEXT = 'Délais de levée et calendriers du jeu commun : ceux de la ferme du porteur, Auvergne-Rhône-Alpes, validés le 31 octobre 2026.';

/**
 * L'avertissement d'une culture dont les dates viennent d'une autre région
 * que celle de la ferme : seulement pour une culture commune du CRIIAM, pour
 * une ferme qui fait l'accueil et dont la commune est choisie. Les cultures
 * de la FAO-56 sont générales ; la ferme du porteur a validé ces dates
 * (F426) ; sans commune, la région n'est pas connue.
 */
export function cropRegionWarning(input: {
  source: KcSource;
  origin: 'common' | 'farm';
  farmRegion: FarmRegion | null;
  onboarding: ResolvedOnboarding;
}): string | null {
  if (input.onboarding.kind !== 'onboarding' || input.origin !== 'common' || input.source !== 'criiam' || input.farmRegion === null) return null;
  if (CRIIAM_REGIONS.includes(input.farmRegion.id)) return null;
  return `Ces dates viennent d’une autre région que la vôtre (${input.farmRegion.label}) : vérifiez-les.`;
}
