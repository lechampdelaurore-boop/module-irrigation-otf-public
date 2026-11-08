'use client';

import type { WaterSurplus } from '@/lib/domain/soil-reserve/water-surplus';
import { gaugeDayLabel, gaugeShortDayLabel } from '@/lib/domain/soil-reserve/gauge-view';

/**
 * La pastille « eau arrosée en trop » (docs/soil-reserve-contract.md, « La
 * pastille de l'eau arrosée en trop ») : l'eau d'irrigation des sept derniers
 * jours que le sol n'a pas pu retenir, en tout puis planche par planche. Une
 * information : rien ne change un besoin, un plan ni une dose.
 */

const mm = new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 1 });
const volume = new Intl.NumberFormat('fr-FR', { minimumFractionDigits: 1, maximumFractionDigits: 2 });

export function WaterSurplusBadge({ surplus }: { surplus: WaterSurplus }) {
  const period = `du ${gaugeDayLabel(surplus.from)} au ${gaugeDayLabel(surplus.to)}`;
  const total = surplus.beds.length === 0
    ? 'aucune'
    : surplus.cubicMeters === null
      ? `${surplus.beds.length} planche${surplus.beds.length > 1 ? 's' : ''}, volume inconnu`
      : `${surplus.volumeIncomplete ? 'au moins ' : ''}${volume.format(surplus.cubicMeters)} m³`;
  return (
    <details className="water-surplus" data-empty={surplus.beds.length === 0} suppressHydrationWarning>
      <summary>
        <strong>Eau arrosée en trop sur sept jours : {total}</strong>
        <small>L’irrigation que le sol n’a pas pu retenir, perdue sous les racines, {period}.</small>
      </summary>
      <div className="water-surplus-detail">
        {surplus.beds.length > 0 ? (
          <ul aria-label="Eau arrosée en trop, planche par planche">
            {surplus.beds.map((bed) => (
              <li key={bed.bedId}>
                <strong>Planche {bed.bedName}</strong>
                <span>{mm.format(bed.drainedMm)} mm{bed.cubicMeters === null ? ', volume inconnu' : `, ${volume.format(bed.cubicMeters)} m³`}</span>
                <small>{bed.days.map(gaugeShortDayLabel).join(', ')}</small>
              </li>
            ))}
          </ul>
        ) : (
          <p>Aucune irrigation de ces sept jours n’a dépassé ce que le sol pouvait retenir.</p>
        )}
        {surplus.unknownBeds.length > 0 ? (
          <p className="soil-unknown">
            Non comptée{surplus.unknownBeds.length > 1 ? 's' : ''}, la jauge étant inconnue un jour d’arrosage :{' '}
            {surplus.unknownBeds.map((bed) => `planche ${bed.bedName}`).join(', ')}.
          </p>
        ) : null}
        <p className="water-surplus-note">
          Le drainage d’un jour se partage entre la pluie et l’irrigation selon leurs mm. Information seulement : la dose du plan ne change pas.
        </p>
      </div>
    </details>
  );
}
