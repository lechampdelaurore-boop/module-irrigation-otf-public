/**
 * Les textures du sol et l'eau évaporable de la couche de surface qu'elles
 * proposent (4.4, docs/tranche-4-contract.md, F421 ; PR 3, F584) : les neuf
 * classes du tableau 19 de la FAO-56, TEW et REW proposés au milieu de leur
 * fourchette, arrondis au demi-millimètre, la fourchette entière dite à côté
 * (F428, réponse 1). Une proposition s'ajuste : rien n'est posé seul.
 */

/** Les neuf classes de texture du tableau 19 de la FAO-56, dans l'ordre du tableau. */
export const SOIL_TEXTURES = [
  'sand',
  'loamy-sand',
  'sandy-loam',
  'loam',
  'silt-loam',
  'silt',
  'silty-clay-loam',
  'silty-clay',
  'clay',
] as const;
export type SoilTexture = (typeof SOIL_TEXTURES)[number];

/** Une fourchette du tableau, en mm, bornes comprises. */
type Range = { min: number; max: number };

type TextureRow = {
  /** Le nom français, suivi de la classe de la FAO-56 entre parenthèses, pour qu'aucune traduction ne trompe. */
  label: string;
  rew: Range;
  tew: Range;
};

/**
 * FAO-56 (Allen et al., 1998), chapitre 7, tableau 19 : eau facilement
 * évaporable (REW) et eau évaporable (TEW, pour Ze = 0,10 m) par classe de
 * texture. Relu le 20 novembre 2026 sur la page
 * https://www.fao.org/4/x0490e/x0490e0c.htm, par deux lectures séparées
 * qui donnent les mêmes fourchettes, et recoupé par les exemples 31 (terre
 * franche : TEW ≈ 20 mm, REW ≈ 9 mm) et 35 (limon sableux : REW ≈ 8 mm) du
 * même chapitre ; le porteur a confié cette relecture au module (F584).
 */
const TABLE_19: Record<SoilTexture, TextureRow> = {
  sand: { label: 'Sable (sand)', rew: { min: 2, max: 7 }, tew: { min: 6, max: 12 } },
  'loamy-sand': { label: 'Sable limoneux (loamy sand)', rew: { min: 4, max: 8 }, tew: { min: 9, max: 14 } },
  'sandy-loam': { label: 'Limon sableux (sandy loam)', rew: { min: 6, max: 10 }, tew: { min: 15, max: 20 } },
  loam: { label: 'Terre franche (loam)', rew: { min: 8, max: 10 }, tew: { min: 16, max: 22 } },
  'silt-loam': { label: 'Limon (silt loam)', rew: { min: 8, max: 11 }, tew: { min: 18, max: 25 } },
  silt: { label: 'Limon pur (silt)', rew: { min: 8, max: 11 }, tew: { min: 22, max: 26 } },
  'silty-clay-loam': { label: 'Limon argileux (silty clay loam)', rew: { min: 8, max: 11 }, tew: { min: 22, max: 27 } },
  'silty-clay': { label: 'Argile limoneuse (silty clay)', rew: { min: 8, max: 12 }, tew: { min: 22, max: 28 } },
  clay: { label: 'Argile (clay)', rew: { min: 8, max: 12 }, tew: { min: 22, max: 29 } },
};

/** La source dite à côté de chaque proposition. */
export const SOIL_TEXTURE_SOURCE = 'FAO-56, tableau 19';

export function isSoilTexture(value: unknown): value is SoilTexture {
  return typeof value === 'string' && (SOIL_TEXTURES as readonly string[]).includes(value);
}

export function soilTextureLabel(texture: SoilTexture): string {
  return TABLE_19[texture].label;
}

/** Le milieu d'une fourchette, arrondi au demi-millimètre (F428, réponse 1). */
function middle(range: Range): number {
  return Math.round(range.min + range.max) / 2;
}

export type TextureProposal = {
  texture: SoilTexture;
  tewMm: number;
  rewMm: number;
  tewRange: Range;
  rewRange: Range;
};

/** TEW et REW proposés pour une texture : le milieu de chaque fourchette, et la fourchette. */
export function textureProposal(texture: SoilTexture): TextureProposal {
  const row = TABLE_19[texture];
  return { texture, tewMm: middle(row.tew), rewMm: middle(row.rew), tewRange: row.tew, rewRange: row.rew };
}

const mm = new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 1 });

/** La phrase qui accompagne une proposition : la source, la fourchette, et qu'elle s'ajuste. */
export function textureProposalText(texture: SoilTexture): string {
  const { tewRange, rewRange } = textureProposal(texture);
  return `${SOIL_TEXTURE_SOURCE}, pour Ze = 10 cm : TEW de ${mm.format(tewRange.min)} à ${mm.format(tewRange.max)} mm, REW de ${
    mm.format(rewRange.min)} à ${mm.format(rewRange.max)} mm ; le milieu est proposé, à ajuster.`;
}
