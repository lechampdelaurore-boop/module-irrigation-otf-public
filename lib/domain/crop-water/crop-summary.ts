import type { KcOverrideRow } from './settings-view.ts';
import type { SeasonSpecies } from './species.ts';
import { PROPOSED_DEPTH_M } from '../soil-reserve/rooting.ts';
import type { RootingProfileView } from '../soil-reserve/rooting-view.ts';

/**
 * Le résumé d'une culture de référence, lu sans ouvrir sa carte, à droite de
 * son nom sur la page « Besoin par culture » (choix du porteur du
 * 8 novembre 2026) : l'étendue des Kc qui comptent aujourd'hui, la
 * profondeur de racines la plus grande de son profil, et le nombre de séries
 * de la saison qui s'y rattachent. Rien d'autre que ce que la carte ouverte
 * montre déjà.
 */
export type ReferenceCropSummary = {
  /** Le plus petit et le plus grand Kc en vigueur, surcharges comprises, avant abattement ; `null` : aucun Kc. */
  kc: { min: number; max: number } | null;
  /** La profondeur la plus grande du profil en vigueur ; `proposed` : elle vient des 30 cm proposés faute de profil. */
  rootDepth: { meters: number; proposed: boolean };
  /** Les séries posées de la saison rattachées à la culture, par leur espèce ou par une exception. */
  seriesCount: number;
};

export function referenceCropSummary(
  referenceCropId: string,
  overrideRows: readonly KcOverrideRow[],
  rooting: RootingProfileView,
  species: readonly SeasonSpecies[],
): ReferenceCropSummary {
  const kcs = overrideRows.map((row) => row.inForce?.kc ?? row.sourceKc).filter((kc) => Number.isFinite(kc));
  return {
    kc: kcs.length === 0 ? null : { min: Math.min(...kcs), max: Math.max(...kcs) },
    rootDepth: deepestRoot(rooting),
    seriesCount: seriesOf(referenceCropId, species).size,
  };
}

function deepestRoot(rooting: RootingProfileView): ReferenceCropSummary['rootDepth'] {
  const depths = (rooting.inForce?.lines ?? []).map((line) => Math.max(line.depthM, line.endDepthM ?? 0));
  const deepest = depths.length === 0 ? null : Math.max(...depths);
  // Un stade sans ligne compte 30 cm proposés : ils ne comptent que s'ils sont plus profonds.
  const proposedToo = rooting.inForce === null || rooting.proposedStages.length > 0;
  if (deepest === null || (proposedToo && PROPOSED_DEPTH_M > deepest)) return { meters: PROPOSED_DEPTH_M, proposed: true };
  return { meters: deepest, proposed: false };
}

/** Les séries de la saison rattachées à la culture : l'exception d'une série l'emporte sur le rattachement de son espèce. */
function seriesOf(referenceCropId: string, species: readonly SeasonSpecies[]): Set<string> {
  const ids = new Set<string>();
  for (const item of species) {
    for (const series of item.series) {
      const entry = item.exceptions.find((exception) => exception.seriesId === series.id) ?? item.link;
      if (entry?.target.kind === 'reference' && entry.target.referenceCropId === referenceCropId) ids.add(series.id);
    }
  }
  return ids;
}

const kcFormat = new Intl.NumberFormat('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 3 });
const meters = new Intl.NumberFormat('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

/** « Kc de 0,40 à 1,05 · racines jusqu'à 0,40 m · 3 séries de la saison ». */
export function referenceCropSummaryText(summary: ReferenceCropSummary): string {
  const parts: string[] = [];
  if (summary.kc !== null) {
    parts.push(summary.kc.min === summary.kc.max
      ? `Kc ${kcFormat.format(summary.kc.min)}`
      : `Kc de ${kcFormat.format(summary.kc.min)} à ${kcFormat.format(summary.kc.max)}`);
  }
  parts.push(summary.rootDepth.proposed
    ? `racines : ${meters.format(summary.rootDepth.meters)} m proposés`
    : `racines jusqu’à ${meters.format(summary.rootDepth.meters)} m`);
  parts.push(summary.seriesCount === 0
    ? 'aucune série de la saison'
    : `${summary.seriesCount} série${summary.seriesCount > 1 ? 's' : ''} de la saison`);
  return parts.join(' · ');
}
