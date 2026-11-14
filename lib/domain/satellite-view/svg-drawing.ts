import type { Outline, OutlinePosition, OutlineRing } from '../domain.ts';
import type { GeoBounds } from './framing.ts';

/**
 * Le dessin de secours de la vue satellite, en SVG, quand le navigateur n'a
 * pas WebGL (S3, docs/satellite-view-contract.md, F206 e) : les mêmes
 * contours, le même cadrage, la même projection de Mercator que la carte,
 * nord en haut. C'est aussi ce qui rend le parcours navigateur déterministe.
 */

/** La largeur du dessin en unités SVG ; la page le met à l'échelle de son cadre. */
export const SVG_DRAWING_WIDTH = 1000;
const RADIANS_PER_DEGREE = Math.PI / 180;
/** Un dixième d'unité SVG : bien en deçà du pixel, et des chemins courts. */
const SVG_DECIMALS_SCALE = 10;

export type SvgProjection = {
  width: number;
  height: number;
  /** Un point `[lon, lat]` en coordonnées SVG `[x, y]`, y croissant vers le sud. */
  project: (position: OutlinePosition) => [number, number];
};

function mercatorY(latitude: number): number {
  return Math.log(Math.tan(Math.PI / 4 + (latitude * RADIANS_PER_DEGREE) / 2));
}

function round(value: number): number {
  return Math.round(value * SVG_DECIMALS_SCALE) / SVG_DECIMALS_SCALE + 0;
}

/** La projection d'un cadrage sur un dessin de largeur fixe, sa hauteur suivant les proportions du cadrage. */
export function svgProjection(framing: GeoBounds, width = SVG_DRAWING_WIDTH): SvgProjection {
  const top = mercatorY(framing.north);
  const scale = width / ((framing.east - framing.west) * RADIANS_PER_DEGREE);
  return {
    width,
    height: round((top - mercatorY(framing.south)) * scale),
    project: ([longitude, latitude]) => [
      round((longitude - framing.west) * RADIANS_PER_DEGREE * scale),
      round((top - mercatorY(latitude)) * scale),
    ],
  };
}

function ringPath(ring: OutlineRing, projection: SvgProjection): string {
  // L'anneau est fermé : son dernier point répète le premier, `Z` le remplace.
  const points = ring.slice(0, -1).map((position) => projection.project(position).join(' '));
  return `M${points.join('L')}Z`;
}

/** Le chemin SVG d'un contour, un sous-chemin par anneau ; à remplir en `evenodd` pour que les trous restent vides. */
export function svgOutlinePath(outline: Outline, projection: SvgProjection): string {
  return outline
    .flatMap(({ exterior, holes }) => [exterior, ...holes])
    .map((ring) => ringPath(ring, projection))
    .join('');
}
