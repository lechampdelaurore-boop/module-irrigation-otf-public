'use client';
import { useEffect, useRef } from 'react';
import type { SatelliteView } from '@/lib/domain/satellite-view/view';
import { formatMeasure } from '../presentation';

type Props = {
  gardens: SatelliteView['gardens'];
  highlightedPlotId: string | null;
  onSelectGarden: (plotId: string) => void;
  /** À côté de la carte, la liste défile seule (F235) : elle se rejoint alors au clavier. */
  scrollable: boolean;
};

/**
 * La liste des jardins à côté de la carte : son alternative texte, au clavier
 * comme au lecteur d'écran (F205, F213). Tout ce que la carte dessine y est,
 * avec la surface d'Ouvre ta ferme, jamais recalculée à partir du contour.
 */
export function SatelliteGardenList({ gardens, highlightedPlotId, onSelectGarden, scrollable }: Props) {
  const listRef = useRef<HTMLUListElement>(null);
  // Un jardin touché sur la carte : sa ligne vient en vue dans la liste, sans faire défiler la page (F235).
  useEffect(() => {
    const list = listRef.current;
    if (!list || highlightedPlotId === null || list.scrollHeight <= list.clientHeight) return;
    const row = Array.from(list.children).find(
      (item): item is HTMLElement => item instanceof HTMLElement && item.dataset.plotId === highlightedPlotId,
    );
    if (!row) return;
    if (row.offsetTop < list.scrollTop) list.scrollTop = row.offsetTop;
    else if (row.offsetTop + row.offsetHeight > list.scrollTop + list.clientHeight) {
      list.scrollTop = row.offsetTop + row.offsetHeight - list.clientHeight;
    }
  }, [highlightedPlotId]);

  if (gardens.length === 0) {
    return <p className="satellite-garden-empty">Aucun jardin ou abri n’est rattaché à cette parcelle.</p>;
  }
  return (
    <ul ref={listRef} className="satellite-garden-list" aria-label="Jardins de la parcelle" tabIndex={scrollable ? 0 : undefined}>
      {gardens.map((garden, index) => {
        const content = (
          <>
            {/* Le numéro que la carte montre à la place d'un nom qui n'y tient pas : la liste sert de légende (lot K, n° 16, F468). */}
            <strong><span className="satellite-garden-number" aria-hidden="true">{index + 1}</span>{garden.name}</strong>
            <span>{garden.mode === 'greenhouse' ? 'abri' : 'plein champ'}</span>
            <span>{formatMeasure(garden.areaSquareMeters, 'm²')}</span>
            <span className="satellite-garden-outline">
              {garden.outlined ? 'contour dessiné' : 'contour non dessiné'}
            </span>
          </>
        );
        // Un jardin sans contour n'a rien à montrer sur la carte : sa ligne se lit, elle ne se touche pas (F206 b).
        return (
          <li key={garden.plotId} data-plot-id={garden.plotId}>
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
