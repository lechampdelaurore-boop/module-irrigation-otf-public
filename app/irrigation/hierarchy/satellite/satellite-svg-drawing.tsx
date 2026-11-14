'use client';
import type { OutlinePosition, Plot, Zone } from '@/lib/domain/domain';
import { svgOutlinePath, svgProjection, type SvgProjection } from '@/lib/domain/satellite-view/svg-drawing';
import type { SatelliteView } from '@/lib/domain/satellite-view/view';

type Props = {
  zone: Zone;
  plots: Plot[];
  view: SatelliteView;
  highlightedPlotId: string | null;
  onSelectGarden: (plotId: string) => void;
};

/** Hauteur du dessin au plus, en part de la hauteur de l'écran, comme la carte (F213). */
const MAX_HEIGHT_VIEWPORT_SHARE = 60;

function labelStyle(position: OutlinePosition, projection: SvgProjection) {
  const [x, y] = projection.project(position);
  return { left: `${(x / projection.width) * 100}%`, top: `${(y / projection.height) * 100}%` };
}

/**
 * Le dessin de secours, en SVG, quand le navigateur n'a pas WebGL (F206 e) :
 * les mêmes contours, le même cadrage et la même projection que la carte,
 * sans photos. Les noms sont posés en HTML par-dessus, comme sur la carte ;
 * la liste à côté reste l'alternative au clavier et au lecteur d'écran.
 */
export function SatelliteSvgDrawing({ zone, plots, view, highlightedPlotId, onSelectGarden }: Props) {
  if (view.framing === null) return null;
  const projection = svgProjection(view.framing);
  const ratio = projection.width / Math.max(projection.height, 1);
  const outlinedPlots = plots.filter(
    (plot) => plot.zoneId === zone.id && plot.outline !== undefined,
  );
  return (
    <div
      className="satellite-svg"
      style={{
        aspectRatio: `${projection.width} / ${Math.max(projection.height, 1)}`,
        width: `min(100%, calc(${MAX_HEIGHT_VIEWPORT_SHARE}vh * ${ratio}))`,
      }}
    >
      <svg
        viewBox={`0 0 ${projection.width} ${Math.max(projection.height, 1)}`}
        role="img"
        aria-label={`Dessin de ${view.zoneName} et de ses jardins dessinés, nord en haut`}
      >
        {outlinedPlots.map((plot) => (
          <path
            key={plot.id}
            className="satellite-svg-garden"
            data-mode={plot.mode}
            data-highlighted={plot.id === highlightedPlotId}
            d={svgOutlinePath(plot.outline!, projection)}
            fillRule="evenodd"
            onClick={() => onSelectGarden(plot.id)}
          />
        ))}
        {zone.outline ? (
          <path className="satellite-svg-zone" d={svgOutlinePath(zone.outline, projection)} fillRule="evenodd" />
        ) : null}
      </svg>
      {view.zoneLabelAt ? (
        <span className="satellite-label satellite-label-zone" style={labelStyle(view.zoneLabelAt, projection)} aria-hidden="true">
          {view.zoneName}
        </span>
      ) : null}
      {view.gardens.map((garden) =>
        garden.labelAt ? (
          <span
            key={garden.plotId}
            className="satellite-label"
            data-mode={garden.mode}
            data-highlighted={garden.plotId === highlightedPlotId}
            style={labelStyle(garden.labelAt, projection)}
            aria-hidden="true"
          >
            {garden.name}
          </span>
        ) : null,
      )}
    </div>
  );
}
