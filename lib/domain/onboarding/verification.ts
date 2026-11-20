import type { SettingsGroupAnswer, SettingsGroupId } from './settings-review.ts';

/**
 * La vérification finale de l'accueil (4.4, docs/tranche-4-contract.md,
 * F427 ; PR 5b, F589) : en plus de chaque étape (vert, orange, rouge), ce
 * qui reste inconnu dans la ferme, même après une étape confirmée (une
 * espèce laissée sans référence, un jardin apparu dans Ouvre ta ferme, une
 * parcelle sans sol), avec le lien pour le faire ; et, par groupe des
 * « Réglages à relire », ce qui est proposé et ce qui est confirmé. Rien
 * n'est bloqué, sauf le premier planning (F424).
 */

/** Une chose inconnue de la ferme, dite en mots, et où la renseigner. */
export type UnknownItem = { id: 'species' | 'plots' | 'soil'; text: string; href: string };

const plural = (count: number, one: string, many: string) => `${count} ${count > 1 ? many : one}`;

export function remainingUnknowns(input: {
  speciesToLink: number;
  plotsToClassify: number;
  /** Les parcelles sans sol, quand la réserve du sol est cochée, et le lien vers la première ; `null` sinon. */
  soil: { parcels: number; href: string } | null;
  hrefs: { species: string; plots: string };
}): UnknownItem[] {
  const items: UnknownItem[] = [];
  if (input.speciesToLink > 0) {
    items.push({ id: 'species', text: `${plural(input.speciesToLink, 'espèce non rattachée', 'espèces non rattachées')} : besoin non calculé`, href: input.hrefs.species });
  }
  if (input.plotsToClassify > 0) {
    items.push({ id: 'plots', text: `${plural(input.plotsToClassify, 'jardin à classer', 'jardins à classer')} : besoin non calculé`, href: input.hrefs.plots });
  }
  if (input.soil && input.soil.parcels > 0) {
    items.push({ id: 'soil', text: `${plural(input.soil.parcels, 'parcelle sans sol', 'parcelles sans sol')} : réserve non calculable`, href: input.soil.href });
  }
  return items;
}

const ANSWER_WORDS: Record<SettingsGroupAnswer | 'none', string> = { validated: 'confirmé', skipped: 'passé, valeurs proposées', none: 'proposé' };

/** Par groupe des « Réglages à relire » : « Abris : confirmé », « Gel : passé, valeurs proposées », « Planning : proposé ». */
export function settingsGroupsText(groups: readonly { id: SettingsGroupId; label: string; answer: SettingsGroupAnswer | null }[]): string[] {
  return groups.map((group) => `${group.label} : ${ANSWER_WORDS[group.answer ?? 'none']}`);
}
