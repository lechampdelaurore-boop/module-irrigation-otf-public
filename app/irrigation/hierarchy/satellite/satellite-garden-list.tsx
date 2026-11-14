'use client';
import type { SatelliteView } from '@/lib/domain/satellite-view/view';
import { formatMeasure } from '../presentation';

type Props = {
  gardens: SatelliteView['gardens'];
  highlightedPlotId: string | null;
  onSelectGarden: (plotId: string) => void;
};

/**
 * La liste des jardins à côté de la carte : son alternative texte, au clavier
 * comme au lecteur d'écran (F205, F213). Tout ce que la carte dessine y est,
 * avec la surface d'Ouvre ta ferme, jamais recalculée à partir du contour.
 */
export function SatelliteGardenList({ gardens, highlightedPlotId, onSelectGarden }: Props) {
  if (gardens.length === 0) {
    return <p className="satellite-garden-empty">Aucun jardin ou abri n’est rattaché à cette parcelle.</p>;
  }
  return (
    <ul className="satellite-garden-list" aria-label="Jardins de la parcelle">
      {gardens.map((garden) => {
        const content = (
          <>
            <strong>{garden.name}</strong>
            <span>{garden.mode === 'greenhouse' ? 'abri' : 'plein champ'}</span>
            <span>{formatMeasure(garden.areaSquareMeters, 'm²')}</span>
            <span className="satellite-garden-outline">
              {garden.outlined ? 'contour dessiné' : 'contour non dessiné'}
            </span>
          </>
        );
        // Un jardin sans contour n'a rien à montrer sur la carte : sa ligne se lit, elle ne se touche pas (F206 b).
        return (
          <li key={garden.plotId}>
            {garden.outlined ? (
              <button
                type="button"
                className="satellite-garden-row"
                data-mode={garden.mode}
                aria-pressed={garden.plotId === highlightedPlotId}
                onClick={() => onSelectGarden(garden.plotId)}
              >
                {content}
              </button>
            ) : (
              <div className="satellite-garden-row" data-mode={garden.mode} data-outlined="false">
                {content}
              </div>
            )}
          </li>
        );
      })}
    </ul>
  );
}
