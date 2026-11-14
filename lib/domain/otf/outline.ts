import type {
  Outline,
  OutlinePolygon,
  OutlinePosition,
  OutlineRing,
} from '../domain.ts';

/**
 * La lecture tolérante des contours d'Ouvre ta ferme (`coordinates` des
 * parcelles et des jardins), pour la vue satellite (S3,
 * docs/satellite-view-contract.md, F201 et F202, D-110).
 *
 * OTF ne documente pas la forme exacte de `coordinates` : la lecture accepte
 * toutes celles du contrat, garde ce qui est sain et écarte le reste. Un
 * contour illisible devient « contour absent », un cas normal : cette
 * fonction ne lève jamais d'erreur et ne fait jamais rejeter l'instantané,
 * comme une planche orpheline aujourd'hui.
 */

/** Six décimales de degré : environ 0,1 m au sol (F201). */
const COORDINATE_DECIMALS = 6;
const COORDINATE_SCALE = 10 ** COORDINATE_DECIMALS;

/** Au-delà de ce nombre de points rangés, anneaux fermés compris, le contour est simplifié (F202). */
export const OUTLINE_SIMPLIFY_ABOVE_POINTS = 2000;

/** Tolérance de la simplification de Douglas-Peucker, en mètres au sol (F202). */
export const OUTLINE_SIMPLIFY_TOLERANCE_METERS = 0.5;

/** Rayon moyen de la Terre, en mètres (UGGI) : sert à juger la tolérance en mètres. */
const EARTH_MEAN_RADIUS_METERS = 6_371_008.8;
const RADIANS_PER_DEGREE = Math.PI / 180;
const METERS_PER_DEGREE_OF_LATITUDE = EARTH_MEAN_RADIUS_METERS * RADIANS_PER_DEGREE;

const MIN_DISTINCT_POINTS_PER_RING = 3;
/** Profondeur des nombres dans un anneau, un polygone, une liste de polygones. */
const RING_DEPTH = 2;
const POLYGON_DEPTH = 3;
const MULTI_POLYGON_DEPTH = 4;

/**
 * Range `coordinates` tel qu'OTF le donne. Formes acceptées : une liste de
 * points `[lon, lat]` (un anneau) ; une liste d'anneaux (le premier
 * extérieur, les suivants des trous) ; une liste de polygones ; un objet
 * GeoJSON `Polygon` ou `MultiPolygon` ; l'une de ces formes en texte JSON.
 * Un point peut porter une altitude en troisième nombre, ignorée (GeoJSON).
 *
 * Chaque anneau est fermé, ses points consécutifs identiques ôtés, ses
 * coordonnées arrondies à six décimales ; il lui faut trois points distincts
 * au moins, tous des nombres finis dans les bornes du globe. Un anneau
 * invalide est écarté (un extérieur invalide emporte son polygone) ; si rien
 * ne reste, le résultat est `null`, « contour absent ».
 */
export function readOtfOutline(value: unknown): Outline | null {
  try {
    const polygons = readPolygons(parseJsonText(value));
    return polygons.length === 0 ? null : simplifyLargeOutline(polygons);
  } catch {
    // Filet de sécurité : rien de ce qu'OTF envoie ne doit faire tomber la
    // lecture de l'instantané pour un dessin (F201).
    return null;
  }
}

/**
 * La forme d'un contour rangé, telle que le cache doit la rendre : sert au
 * validateur d'un instantané relu (`isIrrigationSnapshot`).
 */
export function isOutlineShape(value: unknown): value is Outline {
  return Array.isArray(value) && value.length > 0 && value.every(isPolygonShape);
}

function isPolygonShape(value: unknown): boolean {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return false;
  const polygon = value as Record<string, unknown>;
  return (
    isRingShape(polygon.exterior) &&
    Array.isArray(polygon.holes) &&
    polygon.holes.every(isRingShape)
  );
}

function isRingShape(value: unknown): boolean {
  return (
    Array.isArray(value) &&
    value.length > MIN_DISTINCT_POINTS_PER_RING &&
    value.every(
      (point) =>
        Array.isArray(point) &&
        point.length === 2 &&
        point.every((number) => typeof number === 'number' && Number.isFinite(number)),
    )
  );
}

function parseJsonText(value: unknown): unknown {
  if (typeof value !== 'string') return value;
  try {
    return JSON.parse(value) as unknown;
  } catch {
    return null;
  }
}

function readPolygons(value: unknown): OutlinePolygon[] {
  if (isGeoJsonGeometry(value)) {
    if (value.type === 'Polygon') return keepPolygons([value.coordinates]);
    if (value.type === 'MultiPolygon' && Array.isArray(value.coordinates)) {
      return keepPolygons(value.coordinates);
    }
    return [];
  }
  if (!Array.isArray(value)) return [];

  switch (numberDepth(value, MULTI_POLYGON_DEPTH)) {
    case RING_DEPTH:
      return keepPolygons([[value]]);
    case POLYGON_DEPTH:
      return keepPolygons([value]);
    case MULTI_POLYGON_DEPTH:
      return keepPolygons(value);
    default:
      return [];
  }
}

function isGeoJsonGeometry(
  value: unknown,
): value is { type: unknown; coordinates: unknown } {
  return (
    typeof value === 'object' &&
    value !== null &&
    !Array.isArray(value) &&
    'type' in value &&
    'coordinates' in value
  );
}

/**
 * La profondeur du premier nombre rencontré : 2 pour un anneau, 3 pour un
 * polygone, 4 pour une liste de polygones. Le premier nombre, pas le premier
 * élément : un premier point invalide ne trompe pas la lecture de la forme.
 */
function numberDepth(value: unknown, limit: number): number | null {
  if (typeof value === 'number') return 0;
  if (!Array.isArray(value) || limit === 0) return null;
  for (const item of value) {
    const depth = numberDepth(item, limit - 1);
    if (depth !== null) return depth + 1;
  }
  return null;
}

function keepPolygons(values: unknown[]): OutlinePolygon[] {
  return values
    .map(readPolygon)
    .filter((polygon): polygon is OutlinePolygon => polygon !== null);
}

function readPolygon(value: unknown): OutlinePolygon | null {
  if (!Array.isArray(value) || value.length === 0) return null;
  const [first, ...rest] = value;
  const exterior = readRing(first);
  if (exterior === null) return null;
  const holes = rest
    .map(readRing)
    .filter((ring): ring is OutlineRing => ring !== null);
  return { exterior, holes };
}

function readRing(value: unknown): OutlineRing | null {
  if (!Array.isArray(value)) return null;
  const positions: OutlinePosition[] = [];
  for (const item of value) {
    const position = readPosition(item);
    if (position === null) return null;
    positions.push(position);
  }
  return closeRing(positions);
}

function readPosition(value: unknown): OutlinePosition | null {
  if (!Array.isArray(value) || value.length < 2 || value.length > 3) return null;
  if (!value.every((item) => typeof item === 'number' && Number.isFinite(item))) {
    return null;
  }
  const [longitude, latitude] = value as number[];
  if (longitude < -180 || longitude > 180 || latitude < -90 || latitude > 90) {
    return null;
  }
  return [roundCoordinate(longitude), roundCoordinate(latitude)];
}

function roundCoordinate(value: number): number {
  // `+ 0` range -0 en 0 : un contour relu du cache retrouve les mêmes points.
  return Math.round(value * COORDINATE_SCALE) / COORDINATE_SCALE + 0;
}

/**
 * Ôte les points consécutifs identiques et le point de fermeture, compte les
 * points distincts, puis referme l'anneau sur son premier point.
 */
function closeRing(positions: OutlinePosition[]): OutlineRing | null {
  const open = positions.filter(
    (position, index) => index === 0 || !samePosition(position, positions[index - 1]),
  );
  if (open.length > 1 && samePosition(open[0], open[open.length - 1])) open.pop();
  const distinct = new Set(open.map(([longitude, latitude]) => `${longitude} ${latitude}`));
  if (distinct.size < MIN_DISTINCT_POINTS_PER_RING) return null;
  const [longitude, latitude] = open[0];
  return [...open, [longitude, latitude]];
}

function samePosition(a: OutlinePosition, b: OutlinePosition): boolean {
  return a[0] === b[0] && a[1] === b[1];
}

function countPoints(outline: Outline): number {
  return outline.reduce(
    (total, { exterior, holes }) =>
      total + exterior.length + holes.reduce((sum, hole) => sum + hole.length, 0),
    0,
  );
}

/**
 * Au-delà de 2 000 points, chaque anneau est simplifié par Douglas-Peucker à
 * 0,5 m (F202), pour tenir la taille du cache. Les distances se jugent en
 * mètres sur un plan local, la longitude resserrée par le cosinus de la
 * latitude moyenne du contour. Un anneau que la simplification réduit à
 * moins de trois points distincts est écarté, comme à la lecture.
 */
function simplifyLargeOutline(outline: Outline): Outline | null {
  if (countPoints(outline) <= OUTLINE_SIMPLIFY_ABOVE_POINTS) return outline;
  const latitudes = outline.flatMap(({ exterior }) => exterior.map(([, latitude]) => latitude));
  const meanLatitude = latitudes.reduce((sum, latitude) => sum + latitude, 0) / latitudes.length;
  const metersPerDegreeOfLongitude =
    METERS_PER_DEGREE_OF_LATITUDE * Math.cos(meanLatitude * RADIANS_PER_DEGREE);
  const toMeters = ([longitude, latitude]: OutlinePosition): [number, number] => [
    longitude * metersPerDegreeOfLongitude,
    latitude * METERS_PER_DEGREE_OF_LATITUDE,
  ];
  const simplify = (ring: OutlineRing) =>
    closeRing(douglasPeucker(ring, toMeters, OUTLINE_SIMPLIFY_TOLERANCE_METERS));

  const polygons = outline
    .map(({ exterior, holes }): OutlinePolygon | null => {
      const simplifiedExterior = simplify(exterior);
      if (simplifiedExterior === null) return null;
      return {
        exterior: simplifiedExterior,
        holes: holes.map(simplify).filter((ring): ring is OutlineRing => ring !== null),
      };
    })
    .filter((polygon): polygon is OutlinePolygon => polygon !== null);
  return polygons.length === 0 ? null : polygons;
}

/**
 * Douglas-Peucker sans récursion (une pile), pour qu'un très long contour ne
 * déborde jamais la pile d'appels. L'anneau fermé se traite comme une ligne
 * de son premier point à lui-même : le point le plus éloigné du départ est
 * gardé d'abord, puis chaque moitié.
 */
function douglasPeucker(
  ring: OutlineRing,
  toMeters: (position: OutlinePosition) => [number, number],
  toleranceMeters: number,
): OutlinePosition[] {
  const points = ring.map(toMeters);
  const keep = new Array<boolean>(ring.length).fill(false);
  keep[0] = true;
  keep[ring.length - 1] = true;
  const stack: [number, number][] = [[0, ring.length - 1]];
  while (stack.length > 0) {
    const [start, end] = stack.pop() as [number, number];
    let farthest = -1;
    let farthestDistance = toleranceMeters;
    for (let index = start + 1; index < end; index += 1) {
      const distance = distanceToSegment(points[index], points[start], points[end]);
      if (distance > farthestDistance) {
        farthest = index;
        farthestDistance = distance;
      }
    }
    if (farthest !== -1) {
      keep[farthest] = true;
      stack.push([start, farthest], [farthest, end]);
    }
  }
  return ring.filter((_, index) => keep[index]);
}

function distanceToSegment(
  [x, y]: [number, number],
  [x1, y1]: [number, number],
  [x2, y2]: [number, number],
): number {
  const dx = x2 - x1;
  const dy = y2 - y1;
  const lengthSquared = dx * dx + dy * dy;
  const t = lengthSquared === 0
    ? 0
    : Math.max(0, Math.min(1, ((x - x1) * dx + (y - y1) * dy) / lengthSquared));
  return Math.hypot(x - (x1 + t * dx), y - (y1 + t * dy));
}
