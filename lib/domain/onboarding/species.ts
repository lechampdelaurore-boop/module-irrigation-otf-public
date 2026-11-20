import type { SeasonSpecies } from '../crop-water/species.ts';
import { suggestReferenceCrop, type LinkCandidate } from '../crop-water/species-linking.ts';
import { SPECIES_MODEL_LINKS } from './species-model-data.ts';

/**
 * L'étape « Rattachez vos espèces » d'une ferme neuve (4.4,
 * docs/tranche-4-contract.md, F423, F428 réponse 4 ; PR 4c, F587) : chaque
 * espèce de la saison sans rattachement reçoit une proposition, d'après le
 * modèle des rattachements de la ferme du porteur quand il connaît son nom,
 * sinon d'après son nom (`suggestReferenceCrop`). La personne voit chaque
 * proposition, décoche celles qu'elle ne veut pas, rattache le reste d'un
 * geste ; rien n'est rattaché à sa place. Ce qui n'est pas rattaché reste
 * « à rattacher », visible partout (D-003).
 */

/** Une culture de référence de la ferme, telle que la page la reçoit. */
type KnownCrop = { crop: { id: string; name: string; source: LinkCandidate['source'] }; origin: 'common' | 'farm'; problems: readonly string[] };

/**
 * Les cultures qu'une proposition peut viser : celles du jeu commun (ou la
 * version de la ferme d'une culture commune), utilisables ; une culture
 * saisie par la ferme n'est jamais proposée (lot 3, cas 9).
 */
export function linkCandidatesOf(crops: readonly KnownCrop[], commonVersions: Readonly<Record<string, unknown>>): LinkCandidate[] {
  return crops.map((stored) => ({
    id: stored.crop.id,
    name: stored.crop.name,
    source: stored.crop.source,
    fromCommonSet: stored.origin === 'common' || stored.crop.id in commonVersions,
    usable: stored.problems.length === 0,
  }));
}

/**
 * Un lien du modèle : un nom d'espèce, la culture de référence du jeu commun,
 * et si le rattachement se fait par analogie (une espèce sans Kc publié qui
 * suit une culture proche, comme la mâche la salade d'été).
 */
export type SpeciesModelLink = { species: string; referenceCropId: string; analogy: boolean };

/** Le nom d'une espèce tel que le modèle le compare : sans accents ni majuscules, espaces simples. */
export function normalizedSpeciesName(name: string): string {
  return name.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLocaleLowerCase('fr-FR').replace(/\s+/g, ' ').trim();
}

export type SpeciesLinkProposal = {
  plantId: string;
  plantName: string;
  referenceCropId: string;
  cropName: string;
  /** Rattachée par analogie : seul le modèle le dit ; une proposition d'après le nom ne l'est jamais. */
  analogy: boolean;
  /** D'où vient la proposition : le modèle de la ferme du porteur, ou le nom de l'espèce. */
  from: 'model' | 'name';
};

/**
 * Les propositions de l'étape : une par espèce sans aucun rattachement (une
 * espèce rattachée à « sans référence » l'a été par la personne, on ne la
 * propose pas). Le modèle ne propose qu'une culture commune utilisable de la
 * ferme ; à défaut, la proposition d'après le nom ; sans l'un ni l'autre,
 * rien.
 */
export function speciesLinkProposals(
  species: readonly SeasonSpecies[],
  candidates: readonly LinkCandidate[],
  model: readonly SpeciesModelLink[] = SPECIES_MODEL_LINKS,
): SpeciesLinkProposal[] {
  const usable = new Map(candidates.filter((candidate) => candidate.fromCommonSet && candidate.usable).map((candidate) => [candidate.id, candidate]));
  const fromModel = new Map(model.map((link) => [normalizedSpeciesName(link.species), link]));
  return species.flatMap((item): SpeciesLinkProposal[] => {
    if (item.link !== null) return [];
    const modelLink = fromModel.get(normalizedSpeciesName(item.plantName));
    const modelCrop = modelLink ? usable.get(modelLink.referenceCropId) : undefined;
    if (modelLink && modelCrop) {
      return [{ plantId: item.plantId, plantName: item.plantName, referenceCropId: modelCrop.id, cropName: modelCrop.name, analogy: modelLink.analogy, from: 'model' }];
    }
    const named = suggestReferenceCrop(item.plantName, candidates);
    return named ? [{ plantId: item.plantId, plantName: item.plantName, referenceCropId: named.id, cropName: named.name, analogy: false, from: 'name' }] : [];
  });
}

/** D'où vient une proposition, dit à côté d'elle. */
export function proposalOriginText(proposal: SpeciesLinkProposal): string {
  return proposal.from === 'model' ? 'd’après le modèle d’une ferme maraîchère' : 'd’après le nom';
}

/** Ce que la confirmation de l'étape garde : le compte des espèces rattachées, sur celles de la saison. */
export function linkedSpeciesCount(species: readonly SeasonSpecies[]): { linked: number; total: number } {
  return { linked: species.filter((item) => item.link !== null).length, total: species.length };
}
