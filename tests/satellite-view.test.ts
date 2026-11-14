import assert from 'node:assert/strict';
import test from 'node:test';
import { DEMO_FARMS, demoFarmSnapshot } from '../lib/adapters/demo/farms.ts';
import { mockSnapshot } from '../lib/adapters/mock-data.ts';
import type { Outline, OutlinePosition, Plot, Zone } from '../lib/domain/domain.ts';
import {
  DRAWING_BASEMAP,
  FRANCE_AREAS,
  IGN_ORTHOPHOTOS,
  chooseBasemap,
  isInFrance,
  readBasemapPreference,
  type Basemap,
} from '../lib/domain/satellite-view/basemaps.ts';
import {
  FRAMING_MARGIN_PERCENT,
  MERCATOR_MAX_LATITUDE,
  boundsCenter,
  outlineBounds,
  outlineLabelPoint,
  plotFraming,
  withFramingMargin,
  zoneFraming,
} from '../lib/domain/satellite-view/framing.ts';
import {
  HIGHLIGHT_FEATURE_STATE,
  OUTLINES_SOURCE_ID,
  buildSatelliteMapStyle,
  gardenFeatureKey,
  outlineFeatures,
  zoneFeatureKey,
  type SatelliteMapPalette,
} from '../lib/domain/satellite-view/map-style.ts';
import { SVG_DRAWING_WIDTH, svgOutlinePath, svgProjection } from '../lib/domain/satellite-view/svg-drawing.ts';
import { satelliteView } from '../lib/domain/satellite-view/view.ts';

/**
 * La vue satellite, sans interface (S3, docs/satellite-view-contract.md,
 * F203 à F213) : le cadrage, la décision « en France », le choix du fond, le
 * style de la carte, ce que l'onglet montre, le dessin de secours en SVG.
 * Les contours sont pris sur un lieu fictif (F211), des rectangles ronds
 * autour de 2,4° E et 47° N.
 */

function rectangle(west: number, south: number, east: number, north: number): Outline {
  return [{
    exterior: [[west, south], [east, south], [east, north], [west, north], [west, south]],
    holes: [],
  }];
}

const ZONE_OUTLINE = rectangle(2.4, 47, 2.41, 47.01);
const zone: Zone = { id: '7', name: 'Parcelle d’essai', area: 76000, seasons: [2026], outline: ZONE_OUTLINE };

function plot(id: string, options: Partial<Plot> = {}): Plot {
  return {
    id,
    zoneId: '7',
    name: `Jardin ${id}`,
    mode: 'garden',
    length: 30,
    width: 10,
    area: 300,
    seasons: [2026],
    ...options,
  };
}

const outlinedGarden = plot('21', { outline: rectangle(2.402, 47.002, 2.404, 47.004) });
const outlinedShelter = plot('22', { mode: 'greenhouse', name: 'Tunnel', outline: rectangle(2.405, 47.002, 2.406, 47.003) });
const undrawnGarden = plot('23', { name: 'Jardin sans dessin' });
const otherZoneGarden = plot('99', { zoneId: '8', outline: rectangle(3, 48, 3.1, 48.1) });

const palette: SatelliteMapPalette = {
  drawingBackground: 'fond-clair',
  field: 'vert-charte',
  shelter: 'bleu-eau',
  zoneOnSatellite: 'blanc',
  zoneOnDrawing: 'encre',
};

function close(actual: number, expected: number, label?: string) {
  assert.ok(Math.abs(actual - expected) < 1e-9, `${label ?? ''} ${actual} ≠ ${expected}`);
}

// F203 — cadrage

test('F203 : l’emprise d’un contour se lit sur ses anneaux extérieurs', () => {
  assert.deepEqual(outlineBounds(ZONE_OUTLINE), { west: 2.4, south: 47, east: 2.41, north: 47.01 });
  assert.equal(outlineBounds(undefined), null);
  assert.equal(outlineBounds([]), null);
});

test('F203 : la parcelle se cadre sur son contour étendu à ceux de ses jardins, marge de 10 % de chaque côté', () => {
  assert.equal(FRAMING_MARGIN_PERCENT, 10);
  const outside = plot('24', { outline: rectangle(2.41, 47.01, 2.42, 47.02) });
  const framing = zoneFraming(zone, [outlinedGarden, outside, otherZoneGarden]);
  assert.ok(framing !== null);
  close(framing.west, 2.4 - 0.002, 'ouest');
  close(framing.east, 2.42 + 0.002, 'est');
  close(framing.south, 47 - 0.002, 'sud');
  close(framing.north, 47.02 + 0.002, 'nord');
});

test('F203 : un jardin sans contour se cadre comme sa parcelle ; dessiné, il se cadre sur lui-même', () => {
  const plots = [outlinedGarden, undrawnGarden];
  assert.deepEqual(plotFraming(undrawnGarden, zone, plots), zoneFraming(zone, plots));
  const own = plotFraming(outlinedGarden, zone, plots);
  assert.ok(own !== null);
  close(own.west, 2.402 - 0.0002);
  close(own.north, 47.004 + 0.0002);
});

test('F203 : sans aucun contour, aucune emprise (F206 a) ; une parcelle non dessinée se cadre sur ses jardins', () => {
  const undrawnZone: Zone = { ...zone, outline: undefined };
  assert.equal(zoneFraming(undrawnZone, [undrawnGarden]), null);
  assert.equal(plotFraming(undrawnGarden, undrawnZone, [undrawnGarden]), null);
  assert.equal(zoneFraming(undrawnZone, [otherZoneGarden]), null, 'le jardin d’une autre parcelle ne compte pas');
  const framing = zoneFraming(undrawnZone, [outlinedGarden]);
  assert.ok(framing !== null);
  close(framing.west, 2.402 - 0.0002);
});

test('F203 : un contour sans largeur ou sans hauteur reprend la marge de l’autre sens ; le cadrage reste dans Mercator', () => {
  const meridian = withFramingMargin({ west: 2.4, south: 47, east: 2.4, north: 47.01 });
  close(meridian.west, 2.4 - 0.001);
  close(meridian.east, 2.4 + 0.001);
  const parallel = withFramingMargin({ west: 2.4, south: 47, east: 2.41, north: 47 });
  close(parallel.south, 47 - 0.001);
  const polar = withFramingMargin({ west: 179, south: 84, east: 180, north: 85 });
  assert.equal(polar.north, MERCATOR_MAX_LATITUDE);
  assert.equal(polar.east, 180);
  assert.deepEqual(boundsCenter({ west: 2, south: 46, east: 3, north: 48 }), [2.5, 47]);
});

test('F205 : le nom se pose dans le contour, même en forme de L ou troué, et dans son plus grand morceau', () => {
  const lShape: Outline = [{
    exterior: [[0, 0], [10, 0], [10, 1], [1, 1], [1, 10], [0, 10], [0, 0]],
    holes: [],
  }];
  const lPoint = outlineLabelPoint(lShape) as OutlinePosition;
  assert.ok(lPoint[0] > 0 && lPoint[0] < 1 && lPoint[1] > 1 && lPoint[1] < 10, `dans la branche du L : ${lPoint}`);

  const ring: Outline = [{
    exterior: [[0, 0], [10, 0], [10, 10], [0, 10], [0, 0]],
    holes: [[[3, 3], [7, 3], [7, 7], [3, 7], [3, 3]]],
  }];
  const ringPoint = outlineLabelPoint(ring) as OutlinePosition;
  assert.ok(ringPoint[0] < 3 || ringPoint[0] > 7, `hors du trou : ${ringPoint}`);

  const twoPieces: Outline = [...rectangle(0, 0, 1, 1), ...rectangle(5, 5, 9, 9)];
  assert.deepEqual(outlineLabelPoint(twoPieces), [7, 7]);
  assert.equal(outlineLabelPoint(undefined), null);
});

// F206 d — « en France »

test('F206 d : le fond IGN s’essaie en métropole, en Corse et outre-mer', () => {
  const inFrance: Record<string, OutlinePosition> = {
    Paris: [2.35, 48.86], Lille: [3.06, 50.63], Strasbourg: [7.75, 48.58], Nice: [7.27, 43.7],
    Menton: [7.5, 43.78], Brest: [-4.49, 48.39], Ouessant: [-5.1, 48.46], Biarritz: [-1.56, 43.48],
    Perpignan: [2.9, 42.7], Chamonix: [6.87, 45.92], Dunkerque: [2.38, 51.03], Mulhouse: [7.34, 47.75],
    'Évian-les-Bains': [6.59, 46.4], Longwy: [5.76, 49.52], Givet: [4.83, 50.14], Hendaye: [-1.78, 43.36],
    Cerbère: [3.17, 42.44], "Île d'Yeu": [-2.35, 46.71], 'Belle-Île': [-3.18, 47.33], Cherbourg: [-1.62, 49.64],
    Calais: [1.86, 50.95], Lauterbourg: [8.18, 48.97], 'Bagnères-de-Luchon': [0.59, 42.79],
    Ajaccio: [8.74, 41.92], Bastia: [9.45, 42.7], Bonifacio: [9.16, 41.39],
    'Pointe-à-Pitre': [-61.53, 16.24], 'Fort-de-France': [-61.07, 14.6], Cayenne: [-52.33, 4.94],
    'Saint-Denis de La Réunion': [55.45, -20.88], Mamoudzou: [45.23, -12.78], 'Saint-Pierre': [-56.18, 46.78],
    Marigot: [-63.08, 18.07], 'Mata-Utu': [-176.17, -13.28], Papeete: [-149.57, -17.54], Nouméa: [166.45, -22.27],
  };
  for (const [place, position] of Object.entries(inFrance)) {
    assert.equal(isInFrance(position), true, place);
  }
  assert.equal(FRANCE_AREAS.length, 12, 'la métropole, la Corse et dix territoires d’outre-mer');
});

test('F206 d : hors de France, le fond IGN ne s’essaie pas, même près de la frontière', () => {
  const abroad: Record<string, OutlinePosition> = {
    Londres: [-0.13, 51.51], Douvres: [1.31, 51.13], Brighton: [-0.14, 50.82], Jersey: [-2.11, 49.21],
    Bruxelles: [4.35, 50.85], Luxembourg: [6.13, 49.61], Karlsruhe: [8.4, 49.01], Fribourg: [7.85, 47.99],
    Bâle: [7.65, 47.56], Lausanne: [6.63, 46.52], Neuchâtel: [6.93, 46.99], Berne: [7.45, 46.95],
    Turin: [7.68, 45.07], Coni: [7.55, 44.39], Gênes: [8.93, 44.41], Sardaigne: [9.19, 41.24],
    Barcelone: [2.17, 41.39], Figueres: [2.96, 42.27], Pampelune: [-1.64, 42.81], 'Saint-Sébastien': [-2.02, 43.32],
    Madrid: [-3.7, 40.42], Dakar: [-17.44, 14.69], Roseau: [-61.39, 15.3], Paramaribo: [-55.2, 5.85],
    'Port-Louis': [57.5, -20.16], Montréal: [-73.57, 45.5],
  };
  for (const [place, position] of Object.entries(abroad)) {
    assert.equal(isInFrance(position), false, place);
  }
});

// F206 c et d, F210, F212 — fonds

test('F212 : le fond IGN est public, sans clé ni compte, et crédite l’IGN (F210)', () => {
  assert.equal(IGN_ORTHOPHOTOS.kind, 'raster');
  const tiles = IGN_ORTHOPHOTOS.tiles ?? '';
  assert.ok(tiles.startsWith('https://data.geopf.fr/wmts?'));
  for (const placeholder of ['{z}', '{x}', '{y}']) assert.ok(tiles.includes(placeholder), placeholder);
  assert.ok(tiles.includes('LAYER=ORTHOIMAGERY.ORTHOPHOTOS'));
  assert.ok(tiles.includes('TILEMATRIXSET=PM'));
  assert.doesNotMatch(tiles, /key|token|apikey|password/i);
  assert.equal(IGN_ORTHOPHOTOS.tileSizePx, 256);
  assert.match(IGN_ORTHOPHOTOS.attribution?.text ?? '', /^© IGN/);
  assert.equal(IGN_ORTHOPHOTOS.attribution?.href, 'https://cartes.gouv.fr');
  assert.equal(IGN_ORTHOPHOTOS.coverage, FRANCE_AREAS);
  assert.equal(DRAWING_BASEMAP.kind, 'plain');
  assert.equal(DRAWING_BASEMAP.tiles, null, 'le Dessin ne fait aucune requête');
  assert.equal(DRAWING_BASEMAP.attribution, null);
});

test('F205 : la bascule mémorisée revient au satellite pour toute valeur autre que « dessin »', () => {
  assert.equal(readBasemapPreference('drawing'), 'drawing');
  for (const stored of ['satellite', null, undefined, '', 'Dessin', 42]) {
    assert.equal(readBasemapPreference(stored), 'satellite', String(stored));
  }
});

test('F206 : le fond suit la bascule, la France et le cadrage', () => {
  const inFrance = zoneFraming(zone, []);
  assert.deepEqual(chooseBasemap('satellite', inFrance), { basemap: IGN_ORTHOPHOTOS, notice: null });
  assert.deepEqual(chooseBasemap('drawing', inFrance), { basemap: DRAWING_BASEMAP, notice: null });
  const quebec = { west: -71.3, south: 46.8, east: -71.2, north: 46.9 };
  assert.deepEqual(
    chooseBasemap('satellite', quebec),
    { basemap: DRAWING_BASEMAP, notice: 'satellite-not-configured' },
    'F206 d : hors de France, Dessin et « non configuré »',
  );
  assert.deepEqual(chooseBasemap('drawing', quebec), { basemap: DRAWING_BASEMAP, notice: null });
  assert.deepEqual(chooseBasemap('satellite', null), { basemap: DRAWING_BASEMAP, notice: null }, 'F206 a : rien à cadrer');
});

test('F206 d : un fond est interchangeable ; un fond mondial se brancherait sans toucher au choix', () => {
  const world: Basemap = { ...IGN_ORTHOPHOTOS, id: 'mondial-fictif', coverage: null, tiles: 'https://tuiles.example/{z}/{x}/{y}.jpg' };
  const quebec = { west: -71.3, south: 46.8, east: -71.2, north: 46.9 };
  assert.equal(chooseBasemap('satellite', quebec, [IGN_ORTHOPHOTOS, world]).basemap, world);
  assert.equal(chooseBasemap('satellite', zoneFraming(zone, []), [IGN_ORTHOPHOTOS, world]).basemap, IGN_ORTHOPHOTOS, 'le premier qui couvre');
});

// F205, F208, F210 — style

test('F208 : les contours dessinés vont dans la carte, les absents n’y sont pas, chacun sous une clé unique', () => {
  const sameNumber = plot('7', { outline: rectangle(2.407, 47.005, 2.408, 47.006) });
  const collection = outlineFeatures(zone, [outlinedGarden, outlinedShelter, undrawnGarden, otherZoneGarden, sameNumber]);
  assert.deepEqual(
    collection.features.map(({ properties }) => [properties.key, properties.kind, properties.mode]),
    [
      ['garden:21', 'garden', 'garden'],
      ['garden:22', 'garden', 'greenhouse'],
      ['garden:7', 'garden', 'garden'],
      ['zone:7', 'zone', null],
    ],
  );
  assert.equal(gardenFeatureKey('7') === zoneFeatureKey('7'), false);
  assert.deepEqual(collection.features[0].geometry, {
    type: 'MultiPolygon',
    coordinates: [[outlinedGarden.outline?.[0].exterior]],
  });
  assert.deepEqual(outlineFeatures({ ...zone, outline: undefined }, [undrawnGarden]).features, []);
});

test('F208 : sur les photos, un style à fond uni dessous, les images, les jardins, la parcelle en blanc, et le crédit', () => {
  const style = buildSatelliteMapStyle({ basemap: IGN_ORTHOPHOTOS, zone, plots: [outlinedGarden, outlinedShelter], palette });
  assert.equal(style.version, 8);
  assert.deepEqual(style.layers.map(({ id, type }) => `${id}:${type}`), [
    'drawing-background:background',
    'basemap:raster',
    'gardens-fill:fill',
    'gardens-line:line',
    'zone-line:line',
  ]);
  const basemap = style.sources.basemap;
  assert.ok(basemap?.type === 'raster');
  assert.deepEqual(basemap.tiles, [IGN_ORTHOPHOTOS.tiles]);
  assert.equal(basemap.tileSize, 256);
  assert.equal(basemap.maxzoom, 19);
  assert.equal(
    basemap.attribution,
    '<a href="https://cartes.gouv.fr" target="_blank" rel="noopener noreferrer">© IGN – Géoplateforme</a>',
  );
  const outlines = style.sources[OUTLINES_SOURCE_ID];
  assert.ok(outlines?.type === 'geojson');
  assert.equal(outlines.promoteId, 'key');
  assert.equal(outlines.data.features.length, 3);
  const zoneLine = style.layers.find(({ id }) => id === 'zone-line');
  assert.equal(zoneLine?.paint['line-color'], 'blanc');
  assert.deepEqual(style.layers.find(({ id }) => id === 'gardens-line')?.paint['line-color'], ['match', ['get', 'mode'], 'greenhouse', 'bleu-eau', 'vert-charte']);
  assert.ok(JSON.stringify(style).includes(`"feature-state","${HIGHLIGHT_FEATURE_STATE}"`), 'mise en évidence par état, sans refaire le style');
});

test('F208 : sur le Dessin, aucune requête, la parcelle à l’encre ; jamais de texte ni de police chargée à distance', () => {
  const style = buildSatelliteMapStyle({ basemap: DRAWING_BASEMAP, zone, plots: [outlinedGarden], palette });
  assert.equal(style.sources.basemap, undefined);
  assert.equal(style.layers.some(({ type }) => type === 'raster'), false);
  assert.equal(style.layers.find(({ id }) => id === 'zone-line')?.paint['line-color'], 'encre');
  assert.equal(style.layers.find(({ id }) => id === 'drawing-background')?.paint['background-color'], 'fond-clair');
  for (const built of [style, buildSatelliteMapStyle({ basemap: IGN_ORTHOPHOTOS, zone, plots: [outlinedGarden], palette })]) {
    assert.equal('glyphs' in built, false);
    assert.equal('sprite' in built, false);
    assert.equal(built.layers.some(({ type }) => type === ('symbol' as string)), false);
    const urls = JSON.stringify(built).match(/https?:\/\/[^"\\ ]+/g) ?? [];
    assert.ok(urls.every((url) => url.startsWith('https://data.geopf.fr/') || url === 'https://cartes.gouv.fr'), urls.join(' '));
  }
});

test('F208 : toutes les couleurs du style viennent de la charte passée par l’interface', () => {
  const style = buildSatelliteMapStyle({ basemap: IGN_ORTHOPHOTOS, zone, plots: [outlinedGarden], palette });
  assert.doesNotMatch(JSON.stringify(style), /#[0-9a-f]{3,8}\b|rgba?\(/i);
});

// F205, F206 a et b, F207, F209 — ce que l'onglet montre

test('F205 : la liste des jardins de la parcelle, surface d’OTF, état du contour, jamais les planches', () => {
  const tiny = plot('25', { area: 123, outline: rectangle(2.401, 47.001, 2.409, 47.009) });
  const view = satelliteView(zone, [outlinedGarden, outlinedShelter, undrawnGarden, otherZoneGarden, tiny]);
  assert.deepEqual(
    view.gardens.map(({ plotId, name, mode, areaSquareMeters, outlined }) => [plotId, name, mode, areaSquareMeters, outlined]),
    [
      ['21', 'Jardin 21', 'garden', 300, true],
      ['22', 'Tunnel', 'greenhouse', 300, true],
      ['23', 'Jardin sans dessin', 'garden', 300, false],
      ['25', 'Jardin 25', 'garden', 123, true],
    ],
    'la surface reste celle d’OTF, même quand le contour en dirait une autre',
  );
  assert.equal(view.gardens[2].labelAt, null);
  assert.ok(view.gardens[0].labelAt !== null);
  assert.equal('beds' in view, false);
  assert.equal(view.zoneName, 'Parcelle d’essai');
});

test('F206 : tout dessiné, en partie, ou rien du tout', () => {
  assert.equal(satelliteView(zone, [outlinedGarden, outlinedShelter]).drawing, 'complete');
  assert.equal(satelliteView(zone, []).drawing, 'complete', 'une parcelle dessinée sans jardin');
  assert.equal(satelliteView(zone, [outlinedGarden, undrawnGarden]).drawing, 'partial');
  const undrawnZone: Zone = { ...zone, outline: undefined };
  assert.equal(satelliteView(undrawnZone, [outlinedGarden]).drawing, 'partial');
  const none = satelliteView(undrawnZone, [undrawnGarden]);
  assert.equal(none.drawing, 'none');
  assert.equal(none.framing, null, 'aucune carte');
  assert.equal(none.gardens.length, 1, 'la liste reste');
});

test('F211 : la ferme de démonstration et les fermes fictives n’ont aucun contour : elles montrent « non dessinée »', () => {
  const snapshots = [mockSnapshot, ...Object.keys(DEMO_FARMS).map((profile) => demoFarmSnapshot(profile as keyof typeof DEMO_FARMS, '2026-06-16'))];
  for (const snapshot of snapshots) {
    assert.ok(snapshot.zones.length > 0);
    for (const demoZone of snapshot.zones) {
      const view = satelliteView(demoZone, snapshot.plots);
      assert.equal(view.drawing, 'none', `${snapshot.structure.name}, ${demoZone.name}`);
      assert.equal(view.framing, null);
    }
  }
});

// F206 e — dessin de secours

test('F206 e : le dessin SVG projette le cadrage en Mercator, nord en haut, aux proportions du terrain', () => {
  const framing = { west: 2.4, south: 47, east: 2.41, north: 47.01 };
  const projection = svgProjection(framing);
  assert.equal(projection.width, SVG_DRAWING_WIDTH);
  assert.deepEqual(projection.project([2.4, 47.01]), [0, 0]);
  assert.deepEqual(projection.project([2.41, 47]), [1000, projection.height]);
  const expectedRatio = 1 / Math.cos((47.005 * Math.PI) / 180);
  assert.ok(Math.abs(projection.height / projection.width - expectedRatio) < 0.01, `${projection.height}`);
});

test('F206 e : un contour devient un chemin, un sous-chemin par anneau, trous compris', () => {
  const projection = svgProjection({ west: 0, south: 0, east: 10, north: 10 }, 100);
  const outline: Outline = [{
    exterior: [[0, 0], [10, 0], [10, 10], [0, 10], [0, 0]],
    holes: [[[4, 4], [6, 4], [6, 6], [4, 6], [4, 4]]],
  }];
  const path = svgOutlinePath(outline, projection);
  assert.equal(path.match(/M/g)?.length, 2);
  assert.equal(path.match(/Z/g)?.length, 2);
  assert.ok(path.startsWith(`M0 ${projection.height}L100 ${projection.height}L100 0L0 0Z`), path);
});
