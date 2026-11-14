import type { Outline, Plot, PlotMode, Zone } from '../domain.ts';
import type { Basemap } from './basemaps.ts';

/**
 * Le style de la carte de la vue satellite (S3, docs/satellite-view-contract.md,
 * F205, F208, F210), construit par une fonction pure et testé comme tel : un
 * fond (images ou uni), les contours en GeoJSON, des couches `fill` et `line`.
 *
 * Aucune couche de texte : MapLibre demanderait des glyphes chargés à
 * distance, que la charte des polices exclut (docs/licence-polices.md). Les
 * noms sont posés en HTML sur la carte, au point que donne
 * `outlineLabelPoint` (F208, son repli). Aucune couleur n'est écrite ici :
 * l'interface passe celles de la charte (`SatelliteMapPalette`).
 */

/** Les couleurs de la charte que l'interface lit dans sa feuille de style. */
export type SatelliteMapPalette = {
  /** Le fond « Dessin », uni et clair. */
  drawingBackground: string;
  /** Un jardin de plein champ : le vert de la charte. */
  field: string;
  /** Un abri : le bleu eau de la charte. */
  shelter: string;
  /** Le contour de la parcelle sur les photos : blanc et épais. */
  zoneOnSatellite: string;
  /** Le contour de la parcelle sur le « Dessin », où le blanc ne se verrait pas : l'encre de la charte. */
  zoneOnDrawing: string;
};

type OutlineFeature = {
  type: 'Feature';
  properties: {
    /** Clé unique de la carte, pour la mise en évidence (`promoteId`) : une parcelle et un jardin peuvent porter le même numéro dans OTF. */
    key: string;
    kind: 'zone' | 'garden';
    id: string;
    name: string;
    mode: PlotMode | null;
  };
  geometry: { type: 'MultiPolygon'; coordinates: number[][][][] };
};

type OutlineFeatureCollection = { type: 'FeatureCollection'; features: OutlineFeature[] };

type RasterSource = {
  type: 'raster';
  tiles: string[];
  tileSize: number;
  maxzoom?: number;
  attribution?: string;
};

type GeoJsonSource = { type: 'geojson'; data: OutlineFeatureCollection; promoteId: string };

type StyleExpression = (string | number | boolean | StyleExpression)[];

type StyleLayer = {
  id: string;
  type: 'background' | 'raster' | 'fill' | 'line';
  source?: string;
  filter?: StyleExpression;
  paint: Record<string, string | number | StyleExpression>;
};

/** Un style MapLibre, version 8 de la spécification, réduit à ce que la vue emploie. */
export type SatelliteMapStyle = {
  version: 8;
  sources: Record<string, RasterSource | GeoJsonSource>;
  layers: StyleLayer[];
};

/** L'état que l'interface pose sur un jardin touché dans la liste ou sur la carte (F205). */
export const HIGHLIGHT_FEATURE_STATE = 'highlighted';
export const OUTLINES_SOURCE_ID = 'outlines';

const ZONE_LINE_WIDTH_PX = 4;
const GARDEN_LINE_WIDTH_PX = 2;
const HIGHLIGHTED_GARDEN_LINE_WIDTH_PX = 5;
/** Opacité du remplissage d'un jardin : les photos restent lisibles dessous. */
const GARDEN_FILL_OPACITY = 0.2;
const HIGHLIGHTED_GARDEN_FILL_OPACITY = 0.4;

export function zoneFeatureKey(zoneId: string): string {
  return `zone:${zoneId}`;
}

export function gardenFeatureKey(plotId: string): string {
  return `garden:${plotId}`;
}

function geometry(outline: Outline): OutlineFeature['geometry'] {
  return {
    type: 'MultiPolygon',
    coordinates: outline.map(({ exterior, holes }) => [exterior, ...holes]),
  };
}

/**
 * Les contours dessinés de la parcelle et de ses jardins, en GeoJSON. Un
 * élément sans contour n'y est pas : la liste à côté de la carte le dit
 * (F206 b). Les jardins d'abord, la parcelle en dernier, au-dessus.
 */
export function outlineFeatures(zone: Zone, plots: Plot[]): OutlineFeatureCollection {
  const gardens = plots
    .filter(({ zoneId, outline }) => zoneId === zone.id && outline !== undefined)
    .map((plot): OutlineFeature => ({
      type: 'Feature',
      properties: { key: gardenFeatureKey(plot.id), kind: 'garden', id: plot.id, name: plot.name, mode: plot.mode },
      geometry: geometry(plot.outline as Outline),
    }));
  const parcel: OutlineFeature[] = zone.outline === undefined
    ? []
    : [{
        type: 'Feature',
        properties: { key: zoneFeatureKey(zone.id), kind: 'zone', id: zone.id, name: zone.name, mode: null },
        geometry: geometry(zone.outline),
      }];
  return { type: 'FeatureCollection', features: [...gardens, ...parcel] };
}

function attributionHtml(attribution: NonNullable<Basemap['attribution']>): string {
  return `<a href="${attribution.href}" target="_blank" rel="noopener noreferrer">${attribution.text}</a>`;
}

/**
 * Le style complet : le fond uni toujours en dessous (il reste si les photos
 * manquent, F206 c) ; les images du fond choisi ; les jardins remplis et
 * cernés, vert en plein champ, bleu eau sous abri, plus marqués quand ils
 * sont mis en évidence ; le contour de la parcelle par-dessus.
 */
export function buildSatelliteMapStyle(input: {
  basemap: Basemap;
  zone: Zone;
  plots: Plot[];
  palette: SatelliteMapPalette;
}): SatelliteMapStyle {
  const { basemap, zone, plots, palette } = input;
  const raster = basemap.kind === 'raster' && basemap.tiles !== null;
  const highlighted: StyleExpression = ['boolean', ['feature-state', HIGHLIGHT_FEATURE_STATE], false];
  const modeColor: StyleExpression = ['match', ['get', 'mode'], 'greenhouse', palette.shelter, palette.field];
  const isGarden: StyleExpression = ['==', ['get', 'kind'], 'garden'];

  const sources: SatelliteMapStyle['sources'] = {
    [OUTLINES_SOURCE_ID]: { type: 'geojson', data: outlineFeatures(zone, plots), promoteId: 'key' },
  };
  if (raster) {
    sources.basemap = {
      type: 'raster',
      tiles: [basemap.tiles as string],
      tileSize: basemap.tileSizePx ?? 256,
      ...(basemap.maxZoom === null ? {} : { maxzoom: basemap.maxZoom }),
      ...(basemap.attribution === null ? {} : { attribution: attributionHtml(basemap.attribution) }),
    };
  }

  return {
    version: 8,
    sources,
    layers: [
      { id: 'drawing-background', type: 'background', paint: { 'background-color': palette.drawingBackground } },
      ...(raster ? [{ id: 'basemap', type: 'raster' as const, source: 'basemap', paint: {} }] : []),
      {
        id: 'gardens-fill',
        type: 'fill',
        source: OUTLINES_SOURCE_ID,
        filter: isGarden,
        paint: {
          'fill-color': modeColor,
          'fill-opacity': ['case', highlighted, HIGHLIGHTED_GARDEN_FILL_OPACITY, GARDEN_FILL_OPACITY],
        },
      },
      {
        id: 'gardens-line',
        type: 'line',
        source: OUTLINES_SOURCE_ID,
        filter: isGarden,
        paint: {
          'line-color': modeColor,
          'line-width': ['case', highlighted, HIGHLIGHTED_GARDEN_LINE_WIDTH_PX, GARDEN_LINE_WIDTH_PX],
        },
      },
      {
        id: 'zone-line',
        type: 'line',
        source: OUTLINES_SOURCE_ID,
        filter: ['==', ['get', 'kind'], 'zone'],
        paint: {
          'line-color': raster ? palette.zoneOnSatellite : palette.zoneOnDrawing,
          'line-width': ZONE_LINE_WIDTH_PX,
        },
      },
    ],
  };
}
