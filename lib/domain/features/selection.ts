import {
  FEATURES_BEFORE_SELECTION,
  FEATURE_IDS,
  PAGE_FEATURE_IDS,
  featureDefinition,
  isFeatureId,
  type FeatureId,
  type PageFeatureId,
} from './catalogue';

/**
 * Les règles du choix (docs/feature-selection-contract.md, section 4) : cocher
 * entraîne le nécessaire (R3), une case nécessaire à une case cochée ne se
 * décoche pas, décocher ne décoche jamais ce qu'on avait entraîné (P6), et au
 * moins une case reste cochée (P7).
 */

/** Les cases cochées, dans l'ordre de la liste, sans doublon. */
export type FeatureSelection = readonly FeatureId[];

/** Ordonne et dédoublonne selon la liste ; écarte un identifiant inconnu. */
export function orderedSelection(ids: Iterable<unknown>): FeatureId[] {
  const wanted = new Set<FeatureId>();
  for (const id of ids) if (isFeatureId(id)) wanted.add(id);
  return FEATURE_IDS.filter((id) => wanted.has(id));
}

/** Ajoute, de proche en proche, les cases dont les cases données ont besoin. */
export function withRequirements(ids: Iterable<FeatureId>): FeatureId[] {
  const closed = new Set<FeatureId>();
  const pending = [...ids];
  while (pending.length > 0) {
    const id = pending.pop()!;
    if (closed.has(id)) continue;
    closed.add(id);
    pending.push(...featureDefinition(id).requires);
  }
  return orderedSelection(closed);
}

/**
 * Lit un choix enregistré : identifiants inconnus écartés, dépendances
 * complétées (un choix ancien reste cohérent si la liste évolue). Vide ou
 * illisible, il ne vaut rien : l'appelant décide quoi faire.
 */
export function normalizeSelection(ids: Iterable<unknown>): FeatureId[] {
  return withRequirements(orderedSelection(ids));
}

/** Les cases cochées qui ont besoin de `id`, directement ou de proche en proche. */
export function featuresRequiring(selection: FeatureSelection, id: FeatureId): FeatureId[] {
  return selection.filter((other) => other !== id && withRequirements([other]).includes(id));
}

/** Les cases que cocher `id` coche en plus, parce qu'elle en a besoin. */
export function featuresBroughtBy(selection: FeatureSelection, id: FeatureId): FeatureId[] {
  const before = new Set(selection);
  return withRequirements([id]).filter((other) => other !== id && !before.has(other));
}

export function checkFeature(selection: FeatureSelection, id: FeatureId): FeatureId[] {
  return withRequirements([...selection, id]);
}

export type UncheckResult =
  | { ok: true; selection: FeatureId[] }
  | { ok: false; reason: 'required'; requiredBy: FeatureId[] }
  | { ok: false; reason: 'last' };

/** Décocher : refusé si une case cochée en a besoin, ou si c'est la dernière ; rien d'autre ne se décoche (P6). */
export function uncheckFeature(selection: FeatureSelection, id: FeatureId): UncheckResult {
  if (!selection.includes(id)) return { ok: true, selection: [...selection] };
  const requiredBy = featuresRequiring(selection, id);
  if (requiredBy.length > 0) return { ok: false, reason: 'required', requiredBy };
  const remaining = selection.filter((other) => other !== id);
  if (remaining.length === 0) return { ok: false, reason: 'last' };
  return { ok: true, selection: remaining };
}

/** Un choix valable : au moins une case, connue, avec tout ce dont elle a besoin. */
export function isCompleteSelection(ids: readonly unknown[]): boolean {
  const ordered = orderedSelection(ids);
  return ordered.length > 0 && ordered.length === ids.length && withRequirements(ordered).length === ordered.length;
}

/**
 * Ce que le module sait du choix d'une ferme, tel que la base le rend :
 * - `first-visit` : aucun espace d'irrigation, la ferme n'a jamais ouvert le module (R5) ;
 * - `before-selection` : un espace mais aucun choix enregistré, une ferme d'avant la 3.8 (R6) ;
 * - `stored` : une ligne de choix, avec les cases connues au moment du dernier choix (R7).
 */
export type StoredFeatureSelection =
  | { kind: 'first-visit' }
  | { kind: 'before-selection' }
  | {
      kind: 'stored';
      enabled: readonly unknown[];
      known: readonly unknown[];
      chosenAt: string | null;
      bannerDismissedAt: string | null;
    };

export type FeatureBanner =
  /** Une ferme d'avant la 3.8 : le choix existe maintenant, dans Réglages (R6). */
  | { kind: 'introduction' }
  /** Des cases apparues depuis le dernier choix, décochées (R7). */
  | { kind: 'new-features'; features: FeatureId[] };

export type ResolvedFeatureSelection = {
  firstVisit: boolean;
  enabled: FeatureId[];
  banner: FeatureBanner | null;
  /** Les cases que la ferme connaissait, à enregistrer avec son prochain choix. */
  known: FeatureId[];
};

export function resolveFeatureSelection(stored: StoredFeatureSelection): ResolvedFeatureSelection {
  if (stored.kind === 'first-visit') return { firstVisit: true, enabled: [], banner: null, known: [] };
  if (stored.kind === 'before-selection') {
    const enabled = [...FEATURES_BEFORE_SELECTION];
    return { firstVisit: false, enabled, banner: { kind: 'introduction' }, known: enabled };
  }
  const known = orderedSelection(stored.known);
  const enabled = normalizeSelection(stored.enabled);
  const newFeatures = FEATURE_IDS.filter((id) => !known.includes(id));
  if (enabled.length === 0) {
    // Un choix vide ne s'enregistre pas (P7) ; s'il se rencontre quand même, rien ne disparaît.
    return { firstVisit: false, enabled: [...FEATURES_BEFORE_SELECTION], banner: { kind: 'introduction' }, known };
  }
  const banner: FeatureBanner | null = newFeatures.length > 0
    ? { kind: 'new-features', features: newFeatures }
    : stored.chosenAt === null && stored.bannerDismissedAt === null
      ? { kind: 'introduction' }
      : null;
  return { firstVisit: false, enabled, banner, known };
}

/** La première page, celle qu'ouvre « Irrigation » : la première case cochée de la liste qui a sa page (P10). */
export function firstEnabledFeature(selection: FeatureSelection): PageFeatureId | null {
  return PAGE_FEATURE_IDS.find((id) => selection.includes(id)) ?? null;
}

export function isEnabled(selection: FeatureSelection, id: FeatureId): boolean {
  return selection.includes(id);
}

/**
 * Un changement de cases qui touche le plan de la semaine (R9, P8, P28) : le
 * Planning est coché après le changement, et il vient de l'être ou Ressources
 * et pompes a changé. Les notes du sol se lisent à l'ouverture de la page et
 * suivent sans recalcul. La première ouverture n'a pas encore de plan à refaire.
 */
export function selectionChangeRecalculatesPlan(before: FeatureSelection, after: FeatureSelection): boolean {
  if (before.length === 0 || !after.includes('planning')) return false;
  return !before.includes('planning') || before.includes('ressources') !== after.includes('ressources');
}

/** Arrosages décochée : les alarmes encore programmées de ses arrosages ne partent plus (R1, P29). */
export function selectionChangeCancelsIrrigationAlarms(before: FeatureSelection, after: FeatureSelection): boolean {
  return before.includes('arrosages') && !after.includes('arrosages');
}
