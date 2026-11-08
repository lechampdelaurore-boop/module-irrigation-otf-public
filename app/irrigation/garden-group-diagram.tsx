'use client';

/**
 * Le schéma du « ? » des groupes de jardins alignés (3.8, précision P38) :
 * deux jardins côte à côte, une aspersion au bout du premier, et les planches
 * qu'elle arrose, jusque dans le jardin voisin. Les couleurs viennent de la
 * charte (help.css) ; le texte du schéma est lu par un lecteur d'écran.
 */

const BED_WIDTH = 70;
const ALLEY = 10;
const GARDENS = [
  { name: 'Jardin A', x: 10, beds: ['A1', 'A2', 'A3'] },
  { name: 'Jardin B', x: 320, beds: ['B1', 'B2', 'B3'] },
] as const;
const WATERED = new Set(['A2', 'A3', 'B1']);
const SPRINKLER = { x: 258, y: 115 };

export function GardenGroupDiagram({ label }: { label: string }) {
  return (
    <svg className="garden-diagram" viewBox="0 0 580 244" role="img" aria-label={label}>
      <defs>
        <marker id="garden-diagram-arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="8" markerHeight="8" orient="auto-start-reverse">
          <path d="M0 0 L10 5 L0 10 z" className="arrow-head" />
        </marker>
      </defs>
      {GARDENS.map((garden) => (
        <g key={garden.name}>
          <text x={garden.x + 125} y={60} className="diagram-title">{garden.name}</text>
          <rect x={garden.x} y={70} width={250} height={90} rx={8} className="garden" />
          {garden.beds.map((bed, index) => {
            const x = garden.x + 12 + index * (BED_WIDTH + ALLEY);
            return (
              <g key={bed}>
                <rect x={x} y={82} width={BED_WIDTH} height={66} rx={4} className={WATERED.has(bed) ? 'bed is-watered' : 'bed'} />
                <text x={x + BED_WIDTH / 2} y={120} className="bed-label">{bed}</text>
              </g>
            );
          })}
        </g>
      ))}
      <ellipse cx={SPRINKLER.x} cy={SPRINKLER.y} rx={100} ry={56} className="reach" />
      <line x1={SPRINKLER.x} y1={30} x2={SPRINKLER.x} y2={SPRINKLER.y - 9} className="pointer" />
      <text x={SPRINKLER.x} y={24} className="diagram-title">aspersion</text>
      <circle cx={SPRINKLER.x} cy={SPRINKLER.y} r={7} className="sprinkler" />
      <line x1={260} y1={182} x2={320} y2={182} className="measure" markerStart="url(#garden-diagram-arrow)" markerEnd="url(#garden-diagram-arrow)" />
      <text x={290} y={200} className="diagram-note">3 m</text>
      <line x1={22} y1={218} x2={562} y2={218} className="measure" markerEnd="url(#garden-diagram-arrow)" />
      <text x={292} y={238} className="diagram-note">une seule ligne, dans l’ordre du groupe</text>
    </svg>
  );
}
