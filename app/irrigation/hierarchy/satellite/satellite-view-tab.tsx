'use client';
import { useMemo, useState } from 'react';
import type { Plot, Season, Zone } from '@/lib/domain/domain';
import { chooseBasemap, DRAWING_BASEMAP, type BasemapPreference } from '@/lib/domain/satellite-view/basemaps';
import { satelliteView } from '@/lib/domain/satellite-view/view';
import { storeBasemapPreference, useBasemapPreference, useWebGlSupport } from './browser-capabilities';
import { SatelliteGardenList } from './satellite-garden-list';
import { SatelliteMap } from './satellite-map';
import { SatelliteSvgDrawing } from './satellite-svg-drawing';

type Props = {
  zone: Zone;
  /** Tous les jardins de l'instantané : l'onglet garde ceux de la parcelle et de la saison. */
  plots: Plot[];
  season: Season;
};

function noticeFor(input: { svg: boolean; failed: boolean; notConfigured: boolean }): string | null {
  if (input.svg) return 'Ce navigateur ne peut pas afficher la carte : voici le dessin des contours, sans photos.';
  if (input.failed) return 'Fond satellite indisponible : la carte montre le dessin des contours.';
  if (input.notConfigured) return 'Fond satellite non configuré pour cette ferme : la carte montre le dessin des contours.';
  return null;
}

/**
 * L'onglet « Vue satellite » d'une parcelle (S3, docs/satellite-view-contract.md,
 * F204 à F213) : la carte de la parcelle et de ses jardins, leur liste à côté,
 * la bascule « Satellite / Dessin ». Un affichage seulement : rien n'est
 * calculé ni écrit, hors le choix de fond de l'appareil.
 */
export function SatelliteViewTab({ zone, plots, season }: Props) {
  // L'instantané ne change pas d'un rendu à l'autre : la carte ne se refait que si la parcelle ou la saison change.
  const zonePlots = useMemo(
    () => plots.filter((plot) => plot.zoneId === zone.id && plot.seasons.includes(season)),
    [plots, zone, season],
  );
  const view = useMemo(() => satelliteView(zone, zonePlots), [zone, zonePlots]);
  const preference = useBasemapPreference();
  const webGl = useWebGlSupport();
  const [mapUnavailable, setMapUnavailable] = useState(false);
  const [failedBasemapId, setFailedBasemapId] = useState<string | null>(null);
  const [highlightedPlotId, setHighlightedPlotId] = useState<string | null>(null);

  const choice = chooseBasemap(preference, view.framing);
  const failed = failedBasemapId === choice.basemap.id;
  const basemap = failed ? DRAWING_BASEMAP : choice.basemap;
  const hasMap = view.drawing !== 'none' && view.framing !== null;
  const renderer = webGl === null ? 'pending' : webGl && !mapUnavailable ? 'map' : 'svg';
  const notice = hasMap
    ? noticeFor({ svg: renderer === 'svg', failed, notConfigured: choice.notice === 'satellite-not-configured' })
    : null;

  const choosePreference = (next: BasemapPreference) => {
    storeBasemapPreference(next);
    // Redemander le satellite le réessaie, après une panne de réseau par exemple.
    if (next === 'satellite') setFailedBasemapId(null);
  };
  // La ligne de la liste est une bascule ; toucher un jardin sur la carte le désigne.
  const toggleGarden = (plotId: string) =>
    setHighlightedPlotId((current) => (current === plotId ? null : plotId));

  return (
    <div className="satellite-view" data-drawing={view.drawing}>
      {hasMap ? (
        <>
          {renderer === 'map' ? (
            <div className="satellite-basemap-toggle" role="group" aria-label="Fond de la carte">
              <button type="button" aria-pressed={preference === 'satellite'} onClick={() => choosePreference('satellite')}>
                Satellite
              </button>
              <button type="button" aria-pressed={preference === 'drawing'} onClick={() => choosePreference('drawing')}>
                Dessin
              </button>
            </div>
          ) : null}
          {notice ? <p className="satellite-notice" role="status">{notice}</p> : null}
          <div className="satellite-map-frame">
            {renderer === 'map' ? (
              <SatelliteMap
                zone={zone}
                plots={zonePlots}
                view={view}
                basemap={basemap}
                highlightedPlotId={highlightedPlotId}
                onSelectGarden={setHighlightedPlotId}
                onBasemapFailed={setFailedBasemapId}
                onUnavailable={() => setMapUnavailable(true)}
              />
            ) : renderer === 'svg' ? (
              <SatelliteSvgDrawing
                zone={zone}
                plots={zonePlots}
                view={view}
                highlightedPlotId={highlightedPlotId}
                onSelectGarden={setHighlightedPlotId}
              />
            ) : (
              <p className="satellite-loading">Chargement de la carte…</p>
            )}
          </div>
          <p className="satellite-legend">
            <span className="satellite-legend-swatch" data-mode="garden" aria-hidden="true" />
            plein champ
            <span className="satellite-legend-swatch" data-mode="greenhouse" aria-hidden="true" />
            abri
          </p>
          {renderer === 'map' && basemap.kind === 'raster' ? (
            <p className="satellite-privacy">
              Les photos viennent de l’IGN : votre navigateur les lui demande directement. L’IGN voit quelle zone est
              regardée, pas qui la regarde.
            </p>
          ) : null}
        </>
      ) : (
        <p className="satellite-undrawn" role="note">
          Cette parcelle n’est pas dessinée dans Ouvre ta ferme, et le module ne dessine pas de contour. Tracez la
          parcelle et ses jardins dans le plan de la ferme d’Ouvre ta ferme pour les voir ici.
        </p>
      )}
      <SatelliteGardenList gardens={view.gardens} highlightedPlotId={highlightedPlotId} onSelectGarden={toggleGarden} />
    </div>
  );
}
