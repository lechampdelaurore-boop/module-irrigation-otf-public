'use client';
import type { ResourceFlowMeasurement } from '@/lib/domain/resource-flow';
import type { ResourceFlowRevisionRecord } from '@/db/water-resource-flow-repository';

/**
 * Le débit du forage au fil du temps (`docs/resource-flow-contract.md`).
 *
 * Une seule couleur : les mesures. Le débit de référence est tracé en gris
 * pointillé, parce que ce n'est pas une seconde série mais le repère sur lequel
 * on lit les mesures. Ce choix rend aussi le graphique lisible sans distinguer
 * les couleurs, l'allure du trait suffisant à séparer les deux tracés.
 */

const WIDTH = 720;
const HEIGHT = 200;
const PADDING = { top: 16, right: 16, bottom: 28, left: 46 };
const PLOT = {
  width: WIDTH - PADDING.left - PADDING.right,
  height: HEIGHT - PADDING.top - PADDING.bottom,
};

type Point = { at: number; flow: number; label: string };

export function ResourceFlowChart({
  measurements,
  revisions,
  currentFlowCubicMetersPerHour,
  formatFlow,
  formatDate,
}: {
  measurements: readonly ResourceFlowMeasurement[];
  revisions: readonly ResourceFlowRevisionRecord[];
  currentFlowCubicMetersPerHour: number;
  formatFlow: (value: number) => string;
  formatDate: (value: string) => string;
}) {
  const points = measurementPoints(measurements, formatDate);
  if (points.length === 0) {
    return <p className="resource-flow-chart-empty">Deux relevés suffisent à tracer le premier point.</p>;
  }

  const references = referencePoints(revisions, currentFlowCubicMetersPerHour);
  const scale = buildScale(points, references);
  const segments = splitOnChainBreaks(measurements, points);

  return (
    <figure className="resource-flow-chart">
      <svg
        viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
        role="img"
        aria-label={`Débit du forage en mètres cubes par heure, ${points.length} mesure${points.length > 1 ? 's' : ''}, de ${points[0].label} à ${points[points.length - 1].label}.`}
        preserveAspectRatio="none"
      >
        {scale.ticks.map((tick) => (
          <g key={tick.value}>
            <line className="resource-flow-grid" x1={PADDING.left} x2={WIDTH - PADDING.right} y1={tick.y} y2={tick.y} />
            <text className="resource-flow-axis" x={PADDING.left - 6} y={tick.y + 4} textAnchor="end">{formatFlow(tick.value)}</text>
          </g>
        ))}

        {references.length > 0 ? (
          <path className="resource-flow-reference" d={stepPath(references, scale)} fill="none" />
        ) : null}

        {segments.map((segment, index) => (
          <polyline
            key={`segment-${index}`}
            className="resource-flow-line"
            fill="none"
            points={segment.map((point) => `${scale.x(point.at)},${scale.y(point.flow)}`).join(' ')}
          />
        ))}

        {points.map((point) => (
          <circle
            key={`${point.at}-${point.flow}`}
            className="resource-flow-point"
            cx={scale.x(point.at)}
            cy={scale.y(point.flow)}
            r={4}
          >
            <title>{`${point.label} : ${formatFlow(point.flow)} m³/h`}</title>
          </circle>
        ))}

        <text
          className="resource-flow-last-label"
          x={scale.x(points[points.length - 1].at)}
          y={scale.y(points[points.length - 1].flow) - 10}
          textAnchor="end"
        >
          {formatFlow(points[points.length - 1].flow)} m³/h
        </text>
      </svg>

      <figcaption className="resource-flow-legend">
        <span><span className="resource-flow-swatch" aria-hidden="true" /> Débit mesuré en fonctionnement</span>
        <span><span className="resource-flow-swatch resource-flow-swatch-reference" aria-hidden="true" /> Débit de référence en vigueur</span>
      </figcaption>
    </figure>
  );
}

function measurementPoints(
  measurements: readonly ResourceFlowMeasurement[],
  formatDate: (value: string) => string,
): Point[] {
  return measurements
    .filter((item) => item.runningFlowCubicMetersPerHour !== null)
    .map((item) => ({
      at: Date.parse(item.toTakenAt),
      flow: item.runningFlowCubicMetersPerHour as number,
      label: formatDate(item.toTakenAt),
    }));
}

/**
 * Les marches de la référence : chaque décision, puis celle en vigueur
 * prolongée jusqu'à aujourd'hui. Sans aucune décision, la référence est le
 * débit saisi à la création, constant.
 */
function referencePoints(
  revisions: readonly ResourceFlowRevisionRecord[],
  currentFlowCubicMetersPerHour: number,
): Point[] {
  if (revisions.length === 0) return [];
  const steps = revisions.map((revision) => ({
    at: Date.parse(revision.validFrom),
    flow: revision.flowCubicMetersPerHour,
    label: revision.validFrom,
  }));
  return [...steps, { at: Date.now(), flow: currentFlowCubicMetersPerHour, label: 'maintenant' }];
}

/**
 * Deux mesures qui ne se suivent pas — un compteur remplacé entre elles — ne
 * sont pas reliées : le trait s'interrompt au lieu de suggérer une continuité
 * qui n'existe pas.
 */
function splitOnChainBreaks(
  measurements: readonly ResourceFlowMeasurement[],
  points: readonly Point[],
): Point[][] {
  const plotted = measurements.filter((item) => item.runningFlowCubicMetersPerHour !== null);
  const segments: Point[][] = [];
  let current: Point[] = [];
  for (let index = 0; index < plotted.length; index += 1) {
    const continues = index > 0 && plotted[index].fromReadingId === plotted[index - 1].toReadingId;
    if (!continues && current.length > 0) {
      segments.push(current);
      current = [];
    }
    current.push(points[index]);
  }
  if (current.length > 0) segments.push(current);
  return segments;
}

function buildScale(points: readonly Point[], references: readonly Point[]) {
  const times = [...points, ...references].map((point) => point.at);
  const flows = [...points, ...references].map((point) => point.flow);
  const minAt = Math.min(...times);
  const maxAt = Math.max(...times);
  const maxFlow = Math.max(...flows, 0);
  const top = maxFlow > 0 ? maxFlow * 1.15 : 1;
  const spanAt = maxAt - minAt || 1;

  const x = (at: number) => PADDING.left + ((at - minAt) / spanAt) * PLOT.width;
  const y = (flow: number) => PADDING.top + PLOT.height - (flow / top) * PLOT.height;
  const ticks = [0, top / 2, top].map((value) => ({ value, y: y(value) }));
  return { x, y, ticks };
}

function stepPath(references: readonly Point[], scale: ReturnType<typeof buildScale>): string {
  return references
    .map((point, index) => {
      const commands = index === 0
        ? [`M ${scale.x(point.at)} ${scale.y(point.flow)}`]
        : [`L ${scale.x(point.at)} ${scale.y(references[index - 1].flow)}`, `L ${scale.x(point.at)} ${scale.y(point.flow)}`];
      return commands.join(' ');
    })
    .join(' ');
}
