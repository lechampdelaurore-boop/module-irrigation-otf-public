import type { FarmCardLines } from '../farm-home/lines.ts';
import type { UnfinishedStep } from '../onboarding/steps.ts';
import { farmCardPages, type FarmCardPage } from './places';
import type { FeatureSelection } from './selection';

/**
 * La page « Ma ferme » en fiches (simplification, lot S3,
 * docs/simplification-s3-contract.md, section 5 ; D-331) : une fiche par page
 * cochée de l'endroit, Réglages toujours. Chaque fiche dit son nom, celui de
 * la page (S3-b : les noms courts de la maquette attendent S6), et une ligne
 * fixe, qui dit à quoi sert la page, relue contre son « ? » (S3-f).
 *
 * S3 n'avait pas de chiffre d'état (S3-g) ; S6 les ajoute avec la mise en
 * route (lot S6, PR 3, docs/simplification-s6-contract.md, section 7) : la
 * ligne d'état (« 4 goutte-à-goutte, tous posés ») remplace la ligne fixe
 * quand la donnée est connue (`lib/domain/farm-home/lines.ts`), la ligne fixe
 * revient sinon. La marque « À faire » vient toujours de l'accueil de la
 * ferme : la ligne dit ce qui est, la marque ce qui manque.
 */

/**
 * La ligne de chaque fiche, sans mot du calcul (le test de garde de S1 lit
 * aussi ce fichier). « Alertes cultures » corrigée à la relecture contre son
 * « ? » (S3-f) : la ligne du contrat disait « séchage » et « arrêt avant la
 * récolte », deux noms de la même alerte, et taisait le gel selon la culture.
 */
export const FARM_CARD_LINES: Readonly<Record<FarmCardPage, string>> = {
  materiel: 'Vos goutte-à-goutte et vos aspersions, et où ils sont posés',
  ressources: 'D’où vient l’eau, les pompes, et s’il y en a assez',
  cultures: 'Ce que chaque culture demande, stade par stade',
  sol: 'Ce que le sol de chaque parcelle retient',
  'alertes-meteo': 'Gel, chaleur et pluie annoncés',
  'alertes-cultures': 'Gel selon la culture, arrêt avant la récolte, aspersions',
  reglages: 'Météo, messages du téléphone, fonctionnalités',
};

export type FarmCard = {
  page: FarmCardPage;
  line: string;
  /** `state` : la ligne d'état de la fiche ; `fixed` : la ligne fixe de S3, son repli. */
  lineKind: 'state' | 'fixed';
  /** « À faire : sol de 3 parcelles » quand l'accueil de la ferme attend une étape de cette page ; `null` sinon. */
  todo: string | null;
};

/**
 * Les fiches d'une ferme, dans l'ordre de l'endroit. Une étape de l'accueil
 * à finir (4.4, F582) dit sa page (`UnfinishedStep.page`) : la fiche de cette
 * page porte « À faire », avec le texte de l'étape, celui du bandeau « À
 * finir ». `lines` : les lignes d'état, lues par le gabarit de « Ma ferme »
 * (lot S6, section 7) ; une fiche qui n'en a pas garde sa ligne fixe.
 */
export function farmCards(selection: FeatureSelection, unfinished: readonly UnfinishedStep[], lines: FarmCardLines | null = null): FarmCard[] {
  return farmCardPages(selection).map((page) => {
    const steps = unfinished.filter((step) => step.page === page);
    const state = lines?.[page];
    return {
      page,
      line: state ?? FARM_CARD_LINES[page],
      lineKind: state ? 'state' : 'fixed',
      todo: steps.length > 0 ? `À faire : ${steps.map((step) => step.text).join(', ')}` : null,
    };
  });
}
