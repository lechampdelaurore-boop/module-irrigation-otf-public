'use client';
import { useEffect, useRef, useState } from 'react';
import type { Map as MapLibreMap, MapOptions } from 'maplibre-gl';
import type { OutlinePosition, Plot, Zone } from '@/lib/domain/domain';
import type { Basemap } from '@/lib/domain/satellite-view/basemaps';
import {
  buildSatelliteMapStyle,
  gardenFeatureKey,
  HIGHLIGHT_FEATURE_STATE,
  OUTLINES_SOURCE_ID,
  type SatelliteMapPalette,
  type SatelliteMapStyle,
} from '@/lib/domain/satellite-view/map-style';
import type { SatelliteView } from '@/lib/domain/satellite-view/view';
import { loadMapLibre } from './load-maplibre';

type Props = {
  zone: Zone;
  plots: Plot[];
  view: SatelliteView;
  basemap: Basemap;
  highlightedPlotId: string | null;
  onSelectGarden: (plotId: string) => void;
  /** Le fond d'images n'a rien donné à l'écran (réseau, blocage, tuile sans donnée) : la carte passe au « Dessin » (F206 c). */
  onBasemapFailed: (basemapId: string) => void;
  /** La bibliothèque ou WebGL a fait défaut : le dessin SVG prend le relais (F206 e). */
  onUnavailable: () => void;
};

/** Les textes des boutons de la carte, en français (F213). */
const FRENCH_LOCALE: Record<string, string> = {
  'AttributionControl.ToggleAttribution': 'Afficher ou masquer les crédits',
  'AttributionControl.MapFeedback': 'Signaler une erreur de carte',
  'CooperativeGesturesHandler.WindowsHelpText': 'Ctrl et la molette pour zoomer sur la carte',
  'CooperativeGesturesHandler.MacHelpText': '⌘ et la molette pour zoomer sur la carte',
  'CooperativeGesturesHandler.MobileHelpText': 'Deux doigts pour déplacer la carte',
  'FullscreenControl.Enter': 'Afficher la carte en plein écran',
  'FullscreenControl.Exit': 'Quitter le plein écran',
  'LogoControl.Title': 'MapLibre',
  'Map.Title': 'Carte de la parcelle',
  'NavigationControl.ResetBearing': 'Remettre le nord en haut',
  'NavigationControl.ZoomIn': 'Rapprocher',
  'NavigationControl.ZoomOut': 'Éloigner',
  'ScaleControl.Kilometers': 'km',
  'ScaleControl.Meters': 'm',
};

/** Au-delà du zoom maximal du fond, la carte agrandit la dernière tuile : assez pour un petit jardin. */
const MAP_MAX_ZOOM = 21;

/**
 * Les couleurs de la charte, lues dans la feuille de style du cadre de la
 * carte (F220) : le domaine n'en écrit aucune.
 */
function readPalette(element: HTMLElement): SatelliteMapPalette {
  const style = getComputedStyle(element);
  const read = (name: string) => style.getPropertyValue(name).trim();
  return {
    drawingBackground: read('--satellite-drawing-background'),
    field: read('--satellite-field'),
    shelter: read('--satellite-shelter'),
    zoneOnSatellite: read('--satellite-zone-on-photo'),
    zoneOnDrawing: read('--satellite-zone-on-drawing'),
  };
}

/**
 * Le style est construit et testé par le domaine (lib/domain/satellite-view/map-style.ts) ;
 * son type, réduit à ce que la vue emploie, est un sous-ensemble de la spécification de MapLibre.
 */
function asMapLibreStyle(style: SatelliteMapStyle): MapOptions['style'] {
  return style as unknown as MapOptions['style'];
}

function labelElement(text: string, className: string, mode: string | null): HTMLSpanElement {
  const element = document.createElement('span');
  element.className = className;
  element.textContent = text;
  if (mode) element.dataset.mode = mode;
  // La liste à côté de la carte dit déjà chaque nom : le lecteur d'écran ne l'entend pas deux fois.
  element.setAttribute('aria-hidden', 'true');
  return element;
}

/**
 * La carte MapLibre de la vue satellite (F205, F208, F210, F213) : chargée à
 * l'ouverture de l'onglet seulement, cadrée sur la parcelle, nord en haut,
 * sans rotation ni inclinaison, gestes coopératifs, échelle en mètres, zoom,
 * plein écran et crédit du fond toujours visible.
 */
export function SatelliteMap({
  zone,
  plots,
  view,
  basemap,
  highlightedPlotId,
  onSelectGarden,
  onBasemapFailed,
  onUnavailable,
}: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const highlightedRef = useRef<string | null>(highlightedPlotId);
  const callbacksRef = useRef({ onSelectGarden, onBasemapFailed, onUnavailable });
  /** La carte posée et prête ; `null` pendant le chargement. */
  const [loadedMap, setLoadedMap] = useState<MapLibreMap | null>(null);

  useEffect(() => {
    callbacksRef.current = { onSelectGarden, onBasemapFailed, onUnavailable };
  }, [onSelectGarden, onBasemapFailed, onUnavailable]);

  useEffect(() => {
    const container = containerRef.current;
    const framing = view.framing;
    if (!container || framing === null) return;
    let cancelled = false;
    let map: MapLibreMap | null = null;

    loadMapLibre()
      .then((maplibre) => {
        if (cancelled) return;
        const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
        map = new maplibre.Map({
          container,
          style: asMapLibreStyle(buildSatelliteMapStyle({ basemap, zone, plots, palette: readPalette(container) })),
          bounds: [[framing.west, framing.south], [framing.east, framing.north]],
          maxZoom: MAP_MAX_ZOOM,
          dragRotate: false,
          pitchWithRotate: false,
          touchPitch: false,
          maxPitch: 0,
          cooperativeGestures: true,
          renderWorldCopies: false,
          attributionControl: { compact: false },
          locale: FRENCH_LOCALE,
          fadeDuration: reducedMotion ? 0 : undefined,
        });
        map.touchZoomRotate.disableRotation();
        map.keyboard.disableRotation();
        map.addControl(new maplibre.NavigationControl({ showCompass: false }), 'top-right');
        map.addControl(new maplibre.FullscreenControl(), 'top-right');
        map.addControl(new maplibre.ScaleControl({ unit: 'metric' }), 'bottom-left');

        const labels: [OutlinePosition | null, HTMLSpanElement][] = [
          [view.zoneLabelAt, labelElement(view.zoneName, 'satellite-label satellite-label-zone', null)],
          ...view.gardens.map((garden): [OutlinePosition | null, HTMLSpanElement] => {
            const element = labelElement(garden.name, 'satellite-label', garden.mode);
            element.dataset.plotId = garden.plotId;
            element.dataset.highlighted = String(garden.plotId === highlightedRef.current);
            element.addEventListener('click', (event) => {
              // Le nom est posé sur le jardin : la carte ne doit pas recevoir le même toucher une seconde fois.
              event.stopPropagation();
              callbacksRef.current.onSelectGarden(garden.plotId);
            });
            return [garden.labelAt, element];
          }),
        ];
        for (const [position, element] of labels) {
          if (position) new maplibre.Marker({ element, anchor: 'center' }).setLngLat(position).addTo(map);
        }

        map.on('click', 'gardens-fill', (event) => {
          const plotId = event.features?.[0]?.properties?.id;
          if (typeof plotId === 'string') callbacksRef.current.onSelectGarden(plotId);
        });

        // F206 c : une tuile en échec ne suffit pas (une ferme frontalière en a au bord) ;
        // quand la carte s'est posée sans qu'aucune tuile du fond n'ait abouti, il est indisponible.
        let basemapTileLoaded = false;
        let basemapErrored = false;
        map.on('data', (event) => {
          if (event.dataType === 'source' && 'sourceId' in event && event.sourceId === 'basemap' && 'tile' in event && event.tile) {
            basemapTileLoaded = true;
          }
        });
        map.on('error', (event) => {
          if ('sourceId' in event && event.sourceId === 'basemap') basemapErrored = true;
        });
        map.on('idle', () => {
          if (basemap.kind === 'raster' && basemapErrored && !basemapTileLoaded) {
            callbacksRef.current.onBasemapFailed(basemap.id);
          }
        });
        const created = map;
        created.on('load', () => {
          if (cancelled) return;
          applyHighlight(created, null, highlightedRef.current);
          setLoadedMap(created);
        });
      })
      .catch(() => {
        if (!cancelled) callbacksRef.current.onUnavailable();
      });

    return () => {
      cancelled = true;
      map?.remove();
      setLoadedMap(null);
    };
  }, [basemap, zone, plots, view]);

  useEffect(() => {
    const previous = highlightedRef.current;
    highlightedRef.current = highlightedPlotId;
    if (loadedMap) applyHighlight(loadedMap, previous, highlightedPlotId);
    containerRef.current?.querySelectorAll<HTMLElement>('.satellite-label[data-plot-id]').forEach((label) => {
      label.dataset.highlighted = String(label.dataset.plotId === highlightedPlotId);
    });
  }, [highlightedPlotId, loadedMap]);

  return (
    <div
      ref={containerRef}
      className="satellite-map"
      data-basemap={basemap.id}
      data-ready={loadedMap !== null}
      aria-label={`Carte de ${view.zoneName}, nord en haut. La liste des jardins suit la carte.`}
      role="region"
    />
  );
}

function applyHighlight(map: MapLibreMap, previous: string | null, next: string | null): void {
  if (previous && previous !== next) {
    map.setFeatureState({ source: OUTLINES_SOURCE_ID, id: gardenFeatureKey(previous) }, { [HIGHLIGHT_FEATURE_STATE]: false });
  }
  if (next) {
    map.setFeatureState({ source: OUTLINES_SOURCE_ID, id: gardenFeatureKey(next) }, { [HIGHLIGHT_FEATURE_STATE]: true });
  }
}
