import assert from 'node:assert/strict';
import test from 'node:test';
import { OtfReadClient } from '../lib/adapters/otf/read-client.ts';
import { readOtfSeasonSnapshot } from '../lib/adapters/otf/snapshot-reader.ts';
import type { Outline, OutlinePosition } from '../lib/domain/domain.ts';
import { mapOtfSnapshot } from '../lib/domain/otf/mapper.ts';
import {
  OUTLINE_SIMPLIFY_ABOVE_POINTS,
  OUTLINE_SIMPLIFY_TOLERANCE_METERS,
  readOtfOutline,
} from '../lib/domain/otf/outline.ts';

/**
 * La lecture tolérante des contours d'Ouvre ta ferme (S3,
 * docs/satellite-view-contract.md, F201 et F202). Les points sont pris sur un
 * lieu fictif, des champs ronds autour de 2,4° E et 47° N (F211) : aucune
 * ferme réelle.
 */

const A: OutlinePosition = [2.4, 47];
const B: OutlinePosition = [2.401, 47];
const C: OutlinePosition = [2.401, 47.001];
const D: OutlinePosition = [2.4, 47.001];
const SQUARE_OPEN = [A, B, C, D];
const SQUARE_CLOSED = [A, B, C, D, A];
const HOLE = [[2.4004, 47.0004], [2.4006, 47.0004], [2.4006, 47.0006], [2.4004, 47.0006]];
const HOLE_CLOSED = [...HOLE, HOLE[0]];
const FAR = [[2.5, 47.1], [2.501, 47.1], [2.501, 47.101], [2.5, 47.101]];
const FAR_CLOSED = [...FAR, FAR[0]];

const square: Outline = [{ exterior: SQUARE_CLOSED, holes: [] }];

test('F201 : un anneau de points [lon, lat] ouvert est fermé sur son premier point', () => {
  assert.deepEqual(readOtfOutline(SQUARE_OPEN), square);
});

test('F201 : un anneau déjà fermé ne reçoit pas un second point de fermeture', () => {
  assert.deepEqual(readOtfOutline(SQUARE_CLOSED), square);
});

test('F201 : une liste d’anneaux donne un polygone, le premier extérieur, les suivants des trous', () => {
  assert.deepEqual(readOtfOutline([SQUARE_OPEN, HOLE]), [
    { exterior: SQUARE_CLOSED, holes: [HOLE_CLOSED] },
  ]);
});

test('F201 : une liste de polygones donne un contour en plusieurs morceaux', () => {
  assert.deepEqual(readOtfOutline([[SQUARE_OPEN, HOLE], [FAR]]), [
    { exterior: SQUARE_CLOSED, holes: [HOLE_CLOSED] },
    { exterior: FAR_CLOSED, holes: [] },
  ]);
});

test('F201 : les objets GeoJSON Polygon et MultiPolygon sont lus ; les autres géométries ne dessinent rien', () => {
  assert.deepEqual(readOtfOutline({ type: 'Polygon', coordinates: [SQUARE_CLOSED, HOLE] }), [
    { exterior: SQUARE_CLOSED, holes: [HOLE_CLOSED] },
  ]);
  assert.deepEqual(readOtfOutline({ type: 'MultiPolygon', coordinates: [[SQUARE_CLOSED], [FAR]] }), [
    { exterior: SQUARE_CLOSED, holes: [] },
    { exterior: FAR_CLOSED, holes: [] },
  ]);
  assert.equal(readOtfOutline({ type: 'Point', coordinates: A }), null);
  assert.equal(readOtfOutline({ type: 'LineString', coordinates: SQUARE_OPEN }), null);
  assert.equal(readOtfOutline({ type: 'MultiPolygon', coordinates: 'rien' }), null);
});

test('F201 : chaque forme se lit aussi en texte JSON ; un texte illisible est un contour absent', () => {
  assert.deepEqual(readOtfOutline(JSON.stringify(SQUARE_OPEN)), square);
  assert.deepEqual(readOtfOutline(JSON.stringify([SQUARE_OPEN, HOLE])), [
    { exterior: SQUARE_CLOSED, holes: [HOLE_CLOSED] },
  ]);
  assert.deepEqual(readOtfOutline(JSON.stringify({ type: 'Polygon', coordinates: [SQUARE_OPEN] })), square);
  assert.equal(readOtfOutline('[[2.4, 47], [2.401'), null);
  assert.equal(readOtfOutline(''), null);
  assert.equal(readOtfOutline(JSON.stringify(JSON.stringify(SQUARE_OPEN))), null, 'un seul niveau de texte');
});

test('F201 : nul, vide ou d’un autre type, le contour est absent', () => {
  for (const value of [null, undefined, [], {}, 42, true, [[]], [[[]]], [[[[]]]], [A], A, 'carré']) {
    assert.equal(readOtfOutline(value), null, JSON.stringify(value));
  }
});

test('F201 : les points consécutifs identiques sont ôtés ; il faut trois points distincts', () => {
  assert.deepEqual(readOtfOutline([A, A, B, B, C, D, D, A, A]), square);
  assert.equal(readOtfOutline([A, B, A]), null, 'deux points distincts');
  assert.equal(readOtfOutline([A, A, A, B, B]), null);
  assert.deepEqual(readOtfOutline([A, B, C]), [{ exterior: [A, B, C, A], holes: [] }], 'un triangle suffit');
});

test('F201 : un point hors des bornes du globe, non fini ou qui n’est pas un nombre rend son anneau invalide', () => {
  const invalidPoints: unknown[] = [
    [181, 47], [-180.5, 47], [2.4, 90.1], [2.4, -91],
    [Number.NaN, 47], [2.4, Number.POSITIVE_INFINITY],
    ['2.4', '47'], [2.4, null], [2.4], [2.4, 47, 10, 3], { lon: 2.4, lat: 47 }, null,
  ];
  for (const point of invalidPoints) {
    assert.equal(readOtfOutline([A, B, point, D]), null, JSON.stringify(point));
  }
  assert.deepEqual(readOtfOutline([[-180, -90], [180, -90], [180, 90]]), [
    { exterior: [[-180, -90], [180, -90], [180, 90], [-180, -90]], holes: [] },
  ], 'les bornes elles-mêmes sont permises');
});

test('F201 : une altitude en troisième nombre, permise par GeoJSON, est ignorée', () => {
  assert.deepEqual(readOtfOutline([[2.4, 47, 120], [2.401, 47, 121], [2.401, 47.001, 119], [2.4, 47.001, 120]]), square);
});

test('F201 : un extérieur invalide emporte son polygone, un trou invalide est seul écarté', () => {
  assert.deepEqual(readOtfOutline([SQUARE_OPEN, [A, B]]), square, 'trou de deux points écarté');
  assert.deepEqual(readOtfOutline([SQUARE_OPEN, [[2.4, 'x'], B, C]]), square);
  assert.equal(readOtfOutline([[A, B], HOLE]), null, 'sans extérieur, pas de polygone');
  assert.deepEqual(readOtfOutline([[[A, B]], [FAR]]), [{ exterior: FAR_CLOSED, holes: [] }]);
});

test('F201 : un premier point invalide ne trompe pas la lecture de la forme', () => {
  const firstPolygonBroken = [[[null, [2.401, 47], C, D]], [FAR]];
  assert.deepEqual(readOtfOutline(firstPolygonBroken), [{ exterior: FAR_CLOSED, holes: [] }]);
  const firstHoleBroken = [SQUARE_OPEN, [[Number.NaN, 47], ...HOLE], HOLE];
  assert.deepEqual(readOtfOutline(firstHoleBroken), [{ exterior: SQUARE_CLOSED, holes: [HOLE_CLOSED] }]);
});

test('F201 : les coordonnées sont arrondies à six décimales, et -0 vaut 0', () => {
  const outline = readOtfOutline([[2.40000049, 47.0000004], [2.4010006, 47], [2.401, 47.0010004], [-0.0000001, 47.001]]);
  assert.deepEqual(outline, [{
    exterior: [[2.4, 47], [2.401001, 47], [2.401, 47.001], [0, 47.001], [2.4, 47]],
    holes: [],
  }]);
  assert.equal(Object.is(outline?.[0].exterior[3][0], -0), false);
  assert.deepEqual(JSON.parse(JSON.stringify(outline)), outline, 'relu du cache, le contour est le même');
});

test('F201 : aucune valeur ne fait lever d’erreur', () => {
  const nested: unknown[] = [];
  let deepest = nested;
  for (let depth = 0; depth < 200; depth += 1) {
    const next: unknown[] = [];
    deepest.push(next);
    deepest = next;
  }
  const hostile = {
    get type(): string {
      throw new Error('getter hostile');
    },
    coordinates: [],
  };
  const values: unknown[] = [
    nested, hostile, Symbol('x'), () => SQUARE_OPEN, new Map(), [[[[[[A]]]]]],
    { type: 'Polygon', coordinates: null }, { type: 'Polygon' }, new Array(5000).fill(null),
  ];
  for (const value of values) {
    assert.doesNotThrow(() => readOtfOutline(value));
    assert.equal(readOtfOutline(value), null);
  }
});

/** Un anneau de `count` points autour d'un centre fictif, rayon alterné en mètres. */
function circle(count: number, radiusMeters: (index: number) => number): OutlinePosition[] {
  const metersPerDegree = (6_371_008.8 * Math.PI) / 180;
  const latitude = 47;
  const longitudeScale = metersPerDegree * Math.cos((latitude * Math.PI) / 180);
  return Array.from({ length: count }, (_, index) => {
    const angle = (2 * Math.PI * index) / count;
    const radius = radiusMeters(index);
    return [2.4 + (radius * Math.cos(angle)) / longitudeScale, latitude + (radius * Math.sin(angle)) / metersPerDegree];
  });
}

test('F202 : au-delà de 2 000 points, le contour est simplifié à 0,5 m, ses points pris parmi ceux d’OTF', () => {
  assert.equal(OUTLINE_SIMPLIFY_ABOVE_POINTS, 2000);
  assert.equal(OUTLINE_SIMPLIFY_TOLERANCE_METERS, 0.5);
  const smooth = circle(5000, () => 100);
  const outline = readOtfOutline(smooth);
  assert.ok(outline !== null);
  const ring = outline[0].exterior;
  assert.ok(ring.length < 100, `cercle lisse de 100 m : ${ring.length} points gardés`);
  assert.ok(ring.length > 20, 'la forme reste un cercle');
  const sixDecimals = (value: number) => Math.round(value * 1e6) / 1e6;
  const fromOtf = new Set(smooth.map(([longitude, latitude]) => `${sixDecimals(longitude)} ${sixDecimals(latitude)}`));
  assert.ok(ring.every((point) => fromOtf.has(point.join(' '))), 'les points gardés sont des points d’OTF');
  assert.deepEqual(ring[0], ring[ring.length - 1], 'anneau fermé');
});

test('F202 : la simplification garde ce qui s’écarte de plus de 0,5 m, et ôte ce qui s’en écarte moins', () => {
  // Sur un cercle de 2 400 points, un point s'écarte de la corde de ses deux
  // voisins de R × (1 − cos(2π / 2 400)) : 0,69 m pour 200 km, 0,34 m pour 100 km.
  const wide = readOtfOutline(circle(2400, () => 200_000));
  assert.equal(wide?.[0].exterior.length, 2401, 'à 0,69 m de la corde, rien ne part');
  const narrow = readOtfOutline(circle(2400, () => 100_000));
  assert.ok((narrow?.[0].exterior.length ?? 0) < 2401, 'à 0,34 m de la corde, des points partent');
  assert.ok((narrow?.[0].exterior.length ?? 0) > 1000, 'mais pas plus que la tolérance ne le permet');
});

test('F202 : jusqu’à 2 000 points, rien n’est simplifié', () => {
  const edge = Array.from({ length: 1990 }, (_, index): OutlinePosition => [2.4 + index * 0.000001, 47]);
  const outline = readOtfOutline([...edge, [2.402, 47.001], [2.4, 47.001]]);
  assert.equal(outline?.[0].exterior.length, 1993, 'des points alignés restent, sous le seuil');
});

test('F202 : le seuil compte tous les anneaux du contour, trous compris', () => {
  const big = circle(1500, () => 100);
  const hole = circle(1500, () => 50);
  const outline = readOtfOutline([big, hole]);
  assert.ok(outline !== null);
  assert.ok(outline[0].exterior.length < 100);
  assert.equal(outline[0].holes.length, 1);
  assert.ok(outline[0].holes[0].length < 100);
});

test('F201 : un contour illisible ne fait jamais rejeter l’instantané ; un contour lisible y est rangé', () => {
  const snapshot = mapOtfSnapshot(
    [{ seasonFirst: 2026, seasonLast: 2026 }],
    [
      { id: 1, name: 'Parcelle dessinée', area: 9000, coordinates: [SQUARE_OPEN] },
      { id: 2, name: 'Parcelle au contour cassé', area: 4000, coordinates: [[['x', 'y']]] },
      { id: 3, name: 'Parcelle sans dessin', area: 1000, coordinates: null },
      { id: 4, name: 'Parcelle d’avant', area: 1000 },
    ],
    [
      { id: 10, zone: 1, name: 'Jardin dessiné', mode: 'garden', area: 300, coordinates: JSON.stringify(FAR) },
      { id: 11, zone: 1, name: 'Abri au contour vide', mode: 'greenhouse', area: 200, coordinates: [] },
      { id: 12, zone: 2, name: 'Jardin au contour hostile', area: 50, coordinates: { type: 'Polygon', coordinates: 'oups' } },
    ],
    [],
    new Date('2026-11-14T10:00:00.000Z'),
  );
  assert.deepEqual(snapshot.zones.map(({ outline }) => outline), [square, undefined, undefined, undefined]);
  assert.deepEqual(snapshot.plots.map(({ outline }) => outline), [[{ exterior: FAR_CLOSED, holes: [] }], undefined, undefined]);
  assert.equal('outline' in snapshot.zones[1], false, 'absent, le champ manque, comme dans un ancien cache');
  assert.equal(snapshot.plots[0].area, 300, 'la surface reste celle d’OTF');
});

test('F202 : le contour vient des listes déjà lues, sans aucune requête de plus à OTF', async () => {
  const calls: string[] = [];
  const client = new OtfReadClient({
    baseUrl: 'https://api.ouvretaferme.org/0.1beta',
    token: 'jeton-de-test',
    fetchImpl: async (input) => {
      const url = new URL(input);
      calls.push(url.pathname);
      const list = (items: unknown[]) => Response.json({ count: items.length, list: items });
      if (url.pathname.endsWith('/configuration')) return Response.json({ seasonFirst: 2026, seasonLast: 2026 });
      if (url.pathname.endsWith('/me')) return Response.json([{ id: 4, name: 'Ferme fictive' }]);
      if (url.pathname.endsWith('/zoneList')) return list([{ id: 1, name: 'Parcelle', area: 9000, coordinates: SQUARE_OPEN }]);
      if (url.pathname.endsWith('/plotList')) {
        return list([
          { id: 10, zone: 1, name: 'Jardin', area: 300, coordinates: [FAR] },
          { id: 11, zone: 1, name: 'Jardin sans dessin', area: 200, coordinates: null },
        ]);
      }
      return list([]);
    },
  });
  const snapshot = await readOtfSeasonSnapshot(client, 2026, new Date('2026-11-14T10:00:00.000Z'));
  assert.equal(calls.length, 10, 'les dix routes de toujours, pas une de plus');
  assert.deepEqual(snapshot.zones[0].outline, square);
  assert.deepEqual(snapshot.plots.map(({ outline }) => outline), [[{ exterior: FAR_CLOSED, holes: [] }], undefined]);
});
