import type { OutlinePosition, Plot, PlotMode, Zone } from '../domain.ts';
import { outlineLabelPoint, zoneFraming, type GeoBounds } from './framing.ts';

/**
 * Ce que l'onglet « Vue satellite » d'une parcelle montre (S3,
 * docs/satellite-view-contract.md, F205 à F207, F209) : un affichage seulement,
 * qui ne calcule aucune règle d'eau et n'écrit rien. La liste des jardins est
 * l'alternative texte de la carte : tout ce que la carte dessine y est.
 */

/** Une ligne de la liste à côté de la carte. */
type SatelliteGarden = {
  plotId: string;
  name: string;
  mode: PlotMode;
  /** La surface d'Ouvre ta ferme, jamais recalculée à partir du contour (F205, D-003, D-047). */
  areaSquareMeters: number;
  /** `false` : « contour non dessiné » dans la liste, rien sur la carte (F206 b). */
  outlined: boolean;
  /** Où poser son nom sur la carte ; `null` sans contour. */
  labelAt: OutlinePosition | null;
};

/**
 * `none` : ni la parcelle ni ses jardins ne sont dessinés dans OTF, aucune
 * carte, un encart le dit (F206 a) ; `partial` : certains contours manquent
 * (F206 b) ; `complete` : tout est dessiné.
 */
type SatelliteDrawing = 'none' | 'partial' | 'complete';

export type SatelliteView = {
  zoneId: string;
  zoneName: string;
  zoneOutlined: boolean;
  zoneLabelAt: OutlinePosition | null;
  drawing: SatelliteDrawing;
  /** Le cadrage de la carte, marge comprise ; `null` quand rien n'est dessiné. */
  framing: GeoBounds | null;
  /** Les jardins de la parcelle, dans l'ordre reçu ; jamais les planches, qu'OTF ne situe pas (F207). */
  gardens: SatelliteGarden[];
};

export function satelliteView(zone: Zone, plots: Plot[]): SatelliteView {
  const ownPlots = plots.filter(({ zoneId }) => zoneId === zone.id);
  const gardens = ownPlots.map((plot): SatelliteGarden => ({
    plotId: plot.id,
    name: plot.name,
    mode: plot.mode,
    areaSquareMeters: plot.area,
    outlined: plot.outline !== undefined,
    labelAt: outlineLabelPoint(plot.outline),
  }));
  const zoneOutlined = zone.outline !== undefined;
  const outlinedCount = gardens.filter(({ outlined }) => outlined).length + (zoneOutlined ? 1 : 0);
  const drawing: SatelliteDrawing =
    outlinedCount === 0 ? 'none' : outlinedCount === gardens.length + 1 ? 'complete' : 'partial';
  return {
    zoneId: zone.id,
    zoneName: zone.name,
    zoneOutlined,
    zoneLabelAt: outlineLabelPoint(zone.outline),
    drawing,
    framing: zoneFraming(zone, ownPlots),
    gardens,
  };
}
