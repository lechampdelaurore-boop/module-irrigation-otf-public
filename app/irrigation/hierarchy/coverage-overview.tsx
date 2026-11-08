'use client';
import { formatIrrigationRate, numberFormatter } from './presentation';

import { sortByNameNaturally } from '@/lib/domain/bed-order';
import { displayFlowRate } from '@/lib/domain/irrigation-calculations';
import { type IrrigationCoverageResult } from '@/lib/domain/irrigation-coverage';

export function CoverageOverview({
  coverage,
  highlightedEquipmentId,
  onHighlightEquipment,
}: {
  coverage: IrrigationCoverageResult;
  highlightedEquipmentId: string | null;
  onHighlightEquipment: (equipmentId: string | null) => void;
}) {
  const totalFlow = displayFlowRate(
    coverage.equipment.reduce(
      (total, item) => total + item.totalLitersPerHour,
      0,
    ),
  );
  // Une aspersion sur une planche sans passe-pied connu n'entre pas dans le
  // débit : le total est alors incomplet, et le dit (D-003).
  const unknownAreaBedCount = coverage.equipment.reduce(
    (total, item) => total + item.unknownAreaBedCount,
    0,
  );

  return (
    <section className="coverage-overview" aria-labelledby="coverage-overview-title">
      <div className="coverage-overview-heading">
        <span className="coverage-overview-icon" aria-hidden="true">≈</span>
        <div>
          <small>Aperçu instantané</small>
          <h2 id="coverage-overview-title">Apport calculé par heure</h2>
          <p>Valeur du réglage au centre de chaque planche.</p>
        </div>
      </div>
      {coverage.equipment.length > 0 ? (
        <>
          <div className="coverage-metrics">
            <span data-warning={unknownAreaBedCount > 0}>
              <small>Débit total{unknownAreaBedCount > 0 ? ' · incomplet' : ''}</small>
              <strong>{numberFormatter.format(totalFlow.value)} {totalFlow.unit}</strong>
            </span>
            <span data-warning={coverage.overlapBedCount > 0}>
              <small>Chevauchements</small>
              <strong>{coverage.overlapBedCount} planche{coverage.overlapBedCount > 1 ? 's' : ''}</strong>
            </span>
            <span>
              <small>Cumul maximal</small>
              <strong>{formatIrrigationRate(coverage.maxRateMmPerHour)}</strong>
            </span>
          </div>
          <div className="coverage-equipment-list" aria-label="Matériels calculés">
            {/* Dans l'ordre naturel des noms : rampe bloc 2 avant rampe bloc 10 (audit ergonomique, point 4). */}
            {sortByNameNaturally(coverage.equipment, (item) => item.equipmentName, (item) => item.equipmentId).map((item) => {
              const focused = highlightedEquipmentId === item.equipmentId;
              return (
                <button
                  key={item.equipmentId}
                  type="button"
                  data-focused={focused}
                  onMouseEnter={() => onHighlightEquipment(item.equipmentId)}
                  onMouseLeave={() => onHighlightEquipment(null)}
                  onFocus={() => onHighlightEquipment(item.equipmentId)}
                  onBlur={() => onHighlightEquipment(null)}
                >
                  <span className="coverage-equipment-dot" aria-hidden="true" />
                  <span>
                    <strong>{item.equipmentName}</strong>
                    <small>{item.settingName} · {item.bedCount} planche{item.bedCount > 1 ? 's' : ''}{item.unknownAreaBedCount > 0 ? ` · ${item.unknownAreaBedCount} sans passe-pied connu, hors débit` : ''}</small>
                  </span>
                  <b>{formatFlowRate(item.totalLitersPerHour)}</b>
                </button>
              );
            })}
          </div>
        </>
      ) : (
        <p className="coverage-empty">
          Placez un matériel possédant un réglage pour afficher les planches arrosées.
        </p>
      )}
    </section>
  );
}

function formatFlowRate(litersPerHour: number) {
  const display = displayFlowRate(litersPerHour);
  return `${numberFormatter.format(display.value)} ${display.unit}`;
}
