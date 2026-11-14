import { fractionFromPercent } from '../units.ts';
import type { Outline, OutlinePolygon, OutlinePosition, OutlineRing, Plot, Zone } from '../domain.ts';

/**
 * Le cadrage de la vue satellite (S3, docs/satellite-view-contract.md, F203) :
 * l'emprise (« bounds ») se calcule à la main, sans bibliothèque de calcul,
 * à partir des contours rangés par `lib/domain/otf/outline.ts`.
 */

/** Une emprise en degrés : ouest, sud, est, nord. */
export type GeoBounds = {
  west: number;
  south: number;
  east: number;
  north: number;
};

/** La marge autour de ce qu'on cadre, de chaque côté, en % de la largeur ou de la hauteur (F203). */
export const FRAMING_MARGIN_PERCENT = 10;

/**
 * Latitude au-delà de laquelle la projection de Mercator, celle de la carte
 * et du dessin de secours, n'a plus de sens : une emprise s'y arrête.
 */
export const MERCATOR_MAX_LATITUDE = 85.051129;
const MAX_LONGITUDE = 180;

/** L'emprise d'un contour, par ses anneaux extérieurs (un trou est dedans) ; `null` sans contour. */
export function outlineBounds(outline: Outline | undefined): GeoBounds | null {
  if (outline === undefined || outline.length === 0) return null;
  const positions = outline.flatMap(({ exterior }) => exterior);
  const longitudes = positions.map(([longitude]) => longitude);
  const latitudes = positions.map(([, latitude]) => latitude);
  return {
    west: Math.min(...longitudes),
    south: Math.min(...latitudes),
    east: Math.max(...longitudes),
    north: Math.max(...latitudes),
  };
}

function unionBounds(list: (GeoBounds | null)[]): GeoBounds | null {
  const present = list.filter((bounds): bounds is GeoBounds => bounds !== null);
  if (present.length === 0) return null;
  return {
    west: Math.min(...present.map(({ west }) => west)),
    south: Math.min(...present.map(({ south }) => south)),
    east: Math.max(...present.map(({ east }) => east)),
    north: Math.max(...present.map(({ north }) => north)),
  };
}

/**
 * Étend une emprise de 10 % de sa largeur à l'est et à l'ouest, de 10 % de sa
 * hauteur au nord et au sud. Un contour aligné sur un méridien ou un parallèle
 * (largeur ou hauteur nulle) reprend la marge de l'autre sens, pour ne jamais
 * cadrer sur une ligne. Bornée au globe et aux latitudes de Mercator.
 */
export function withFramingMargin(bounds: GeoBounds): GeoBounds {
  const fraction = fractionFromPercent(FRAMING_MARGIN_PERCENT);
  const width = bounds.east - bounds.west;
  const height = bounds.north - bounds.south;
  const horizontal = (width > 0 ? width : height) * fraction;
  const vertical = (height > 0 ? height : width) * fraction;
  return {
    west: Math.max(-MAX_LONGITUDE, bounds.west - horizontal),
    south: Math.max(-MERCATOR_MAX_LATITUDE, bounds.south - vertical),
    east: Math.min(MAX_LONGITUDE, bounds.east + horizontal),
    north: Math.min(MERCATOR_MAX_LATITUDE, bounds.north + vertical),
  };
}

/**
 * Le cadrage d'une parcelle : son contour étendu à ceux de ses jardins, marge
 * comprise. `null` : rien n'est dessiné, ni la parcelle ni ses jardins (F206 a,
 * aucune carte n'est montrée).
 */
export function zoneFraming(zone: Zone, plots: Plot[]): GeoBounds | null {
  const ownPlots = plots.filter(({ zoneId }) => zoneId === zone.id);
  const bounds = unionBounds([
    outlineBounds(zone.outline),
    ...ownPlots.map(({ outline }) => outlineBounds(outline)),
  ]);
  return bounds === null ? null : withFramingMargin(bounds);
}

/** Le cadrage d'un jardin : son contour, marge comprise ; sans contour, il se cadre comme sa parcelle (F203). */
export function plotFraming(plot: Plot, zone: Zone, plots: Plot[]): GeoBounds | null {
  const bounds = outlineBounds(plot.outline);
  return bounds === null ? zoneFraming(zone, plots) : withFramingMargin(bounds);
}

/** Le centre d'une emprise : sert à décider si le fond IGN s'essaie (F206 d). */
export function boundsCenter(bounds: GeoBounds): OutlinePosition {
  return [(bounds.west + bounds.east) / 2, (bounds.south + bounds.north) / 2];
}

/**
 * Où poser le nom d'une parcelle ou d'un jardin sur la carte : un point
 * toujours à l'intérieur de son plus grand polygone, même en forme de L ou
 * troué (le centre de gravité d'un contour concave peut tomber dehors). La
 * ligne horizontale à mi-hauteur du polygone coupe ses anneaux ; le nom va au
 * milieu du plus large segment intérieur. `null` sans contour.
 */
export function outlineLabelPoint(outline: Outline | undefined): OutlinePosition | null {
  if (outline === undefined || outline.length === 0) return null;
  const polygon = largestPolygon(outline);
  const bounds = outlineBounds([polygon]) as GeoBounds;
  const latitude = (bounds.south + bounds.north) / 2;
  const crossings = [polygon.exterior, ...polygon.holes]
    .flatMap((ring) => ringCrossings(ring, latitude))
    .sort((a, b) => a - b);
  let best: [number, number] | null = null;
  for (let index = 0; index + 1 < crossings.length; index += 2) {
    const segment: [number, number] = [crossings[index], crossings[index + 1]];
    if (best === null || segment[1] - segment[0] > best[1] - best[0]) best = segment;
  }
  const longitude = best === null ? (bounds.west + bounds.east) / 2 : (best[0] + best[1]) / 2;
  return [longitude, latitude];
}

/** Les longitudes où un anneau coupe un parallèle (règle du demi-segment : un sommet ne compte qu'une fois). */
function ringCrossings(ring: OutlineRing, latitude: number): number[] {
  const crossings: number[] = [];
  for (let index = 0; index + 1 < ring.length; index += 1) {
    const [x1, y1] = ring[index];
    const [x2, y2] = ring[index + 1];
    if ((y1 <= latitude && latitude < y2) || (y2 <= latitude && latitude < y1)) {
      crossings.push(x1 + ((latitude - y1) / (y2 - y1)) * (x2 - x1));
    }
  }
  return crossings;
}

function largestPolygon(outline: Outline): OutlinePolygon {
  return outline.reduce((largest, polygon) =>
    polygonArea(polygon) > polygonArea(largest) ? polygon : largest,
  );
}

/** Une aire relative, pour comparer des polygones voisins entre eux seulement (degrés carrés, sans unité au sol). */
function polygonArea({ exterior, holes }: OutlinePolygon): number {
  return Math.abs(ringArea(exterior)) - holes.reduce((sum, hole) => sum + Math.abs(ringArea(hole)), 0);
}

function ringArea(ring: OutlineRing): number {
  let twiceArea = 0;
  for (let index = 0; index + 1 < ring.length; index += 1) {
    const [x1, y1] = ring[index];
    const [x2, y2] = ring[index + 1];
    twiceArea += x1 * y2 - x2 * y1;
  }
  return twiceArea / 2;
}
