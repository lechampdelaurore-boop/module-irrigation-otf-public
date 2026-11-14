'use client';

import { soilGardenAnchor } from '@/lib/domain/today/reliability';
import { SOIL_BAR_MARKS, soilBarPosition, soilGardenBars, type SoilGardenBar } from '@/lib/domain/soil-reserve/garden-bars';
import type { SoilGaugeZone } from '@/lib/domain/soil-reserve/gauge-view';

/**
 * Le graphique des réserves du sol d'une parcelle, variante B
 * (docs/soil-reserve-contract.md, « La vue d'ensemble par jardin », S2,
 * D-109) : une barre par jardin ou abri, ses planches en points, orange sous
 * leur seuil, le prévu de dimanche en pointillé. Toucher une barre ouvre le
 * pli du jardin et y mène. Aucun chiffre ici qui ne soit déjà dans les plis.
 */

const whole = new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 0 });

export function SoilBars({ zone, onOpen }: { zone: Pick<SoilGaugeZone, 'plots' | 'name'>; onOpen: (plotId: string) => void }) {
  const bars = soilGardenBars(zone);
  if (bars.length === 0) return null;
  return (
    <div className="soil-bars" role="group" aria-label={`Vue d’ensemble · ${zone.name}`}>
      <p className="soil-bars-legend">
        <span><i className="soil-bars-swatch" aria-hidden="true" />jardin maintenant</span>
        <span><i className="soil-bars-swatch is-low" aria-hidden="true" />planche sous son seuil</span>
        <span><i className="soil-bars-swatch is-sunday" aria-hidden="true" />prévu dimanche</span>
      </p>
      <ul className="soil-bars-list">
        {bars.map((bar) => <li key={bar.plotId}><GardenBar bar={bar} onOpen={onOpen} /></li>)}
      </ul>
      <p className="soil-bars-axis" aria-hidden="true">
        <span />
        <span className="soil-bars-scale">
          {SOIL_BAR_MARKS.map((mark) => (
            <span key={mark.percent} style={{ left: `${mark.percent}%` }}>
              {mark.word ? <span className="soil-bars-word">{mark.word} </span> : null}{mark.value}
            </span>
          ))}
        </span>
        <span />
      </p>
    </div>
  );
}

function GardenBar({ bar, onOpen }: { bar: SoilGardenBar; onOpen: (plotId: string) => void }) {
  const place = bar.sheltered ? 'abri' : 'plein champ';
  const head = (
    <span className="soil-bar-name">
      <strong>{bar.name}</strong>
      <small>{place}{bar.lowCount > 0 ? ` · ${bar.lowCount} sous le seuil` : ''}</small>
    </span>
  );
  if (bar.kind === 'no-crop') {
    return (
      <div className="soil-bar" data-kind="no-crop">
        {head}
        <span className="soil-bar-none">aucune planche cultivée</span>
      </div>
    );
  }
  return (
    <button
      type="button"
      className="soil-bar"
      data-kind={bar.kind}
      aria-label={bar.label}
      aria-controls={soilGardenAnchor(bar.plotId)}
      onClick={() => onOpen(bar.plotId)}
    >
      {head}
      {bar.kind === 'known' && bar.percent !== null ? (
        <span className="soil-bar-track">
          <span className="soil-bar-fill" style={{ width: `${soilBarPosition(bar.percent)}%` }} />
          {bar.sundayPercent !== null ? <span className="soil-bar-sunday" style={{ left: `${soilBarPosition(bar.sundayPercent)}%` }} /> : null}
          {bar.beds.map((bed) => (
            <span key={bed.bedId} className="soil-bar-bed" data-low={bed.low} style={{ left: `${soilBarPosition(bed.percent)}%` }} />
          ))}
        </span>
      ) : (
        <span className="soil-bar-track" data-unknown="true"><span>inconnue</span></span>
      )}
      <span className="soil-bar-percent">{bar.kind === 'known' && bar.percent !== null ? `${whole.format(bar.percent)} %` : '–'}</span>
    </button>
  );
}
