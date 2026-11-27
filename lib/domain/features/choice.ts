import { FEATURES, featureLabel, type FeatureId } from './catalogue';
import type { FeatureBanner, FeatureSelection } from './selection';
import { featuresBroughtBy, featuresRequiring } from './selection';

/**
 * Ce que la liste des cases dit à côté de chacune (docs/feature-selection-contract.md,
 * R3, R6, R7) : pour une case cochée, les cases cochées qui en ont besoin et
 * l'empêchent d'être décochée ; pour une case décochée, celles que la cocher
 * cochera en plus. Les mêmes lignes servent à la première ouverture et dans
 * Réglages.
 */

export type FeatureChoiceRow = {
  id: FeatureId;
  label: string;
  summary: string;
  checked: boolean;
  /** Les cases cochées qui en ont besoin : tant qu'il y en a, elle reste cochée. */
  requiredBy: string[];
  /** Les cases que la cocher coche aussi, parce qu'elle en a besoin. */
  brings: string[];
};

/** « A », « A et B », « A, B et C ». */
export function joinLabels(labels: readonly string[]): string {
  if (labels.length <= 1) return labels.join('');
  return `${labels.slice(0, -1).join(', ')} et ${labels.at(-1)}`;
}

export function featureChoiceRows(selection: FeatureSelection): FeatureChoiceRow[] {
  return FEATURES.map((feature) => {
    const checked = selection.includes(feature.id);
    return {
      id: feature.id,
      label: feature.label,
      summary: feature.summary,
      checked,
      requiredBy: checked ? featuresRequiring(selection, feature.id).map(featureLabel) : [],
      brings: checked ? [] : featuresBroughtBy(selection, feature.id).map(featureLabel),
    };
  });
}

/** La ligne sous une case : pourquoi elle reste cochée, ou ce qu'elle coche avec elle. */
export function featureChoiceLine(row: FeatureChoiceRow): string | null {
  if (row.requiredBy.length > 0) return `Nécessaire pour ${joinLabels(row.requiredBy)}.`;
  if (row.brings.length > 0) return `Cochera aussi ${joinLabels(row.brings)}, dont elle a besoin.`;
  return null;
}

/** Avant de cocher, dans Réglages : ce que la case coche en plus, ou `null` quand elle vient seule (R3). */
export function checkConfirmation(selection: FeatureSelection, id: FeatureId): string | null {
  const brought = featuresBroughtBy(selection, id).map(featureLabel);
  if (brought.length === 0) return null;
  return `Cocher « ${featureLabel(id)} » coche aussi ${joinLabels(brought)}, dont elle a besoin.`;
}

/** Le texte du bandeau : le choix existe (R6), ou des cases sont apparues, décochées (R7). */
export function featureBannerText(banner: FeatureBanner): string {
  if (banner.kind === 'introduction') return 'Vous pouvez maintenant choisir les fonctionnalités affichées, dans Réglages.';
  const labels = banner.features.map(featureLabel);
  return labels.length > 1
    ? `Nouvelles fonctionnalités : ${joinLabels(labels)}. Elles ne sont pas cochées ; vous pouvez les cocher dans Réglages.`
    : `Nouvelle fonctionnalité : ${labels[0]}. Elle n’est pas cochée ; vous pouvez la cocher dans Réglages.`;
}
