'use client';
import {
  bedAriaLabel,
  formatBedGroup,
  formatIrrigationRate,
  formatMeasure,
  numberFormatter,
} from './presentation';
import type { PlacementEditor } from './use-placement-editor';

import type { EquipmentPlacementRecord } from '@/lib/domain/equipment-placement-record';
import type { EquipmentListItem } from '@/lib/domain/equipment-record';
import {
  type CSSProperties,
  type DragEvent as ReactDragEvent,
  type MouseEvent as ReactMouseEvent,
} from 'react';
import type { Bed, Plot } from '@/lib/domain/domain';
import { type BedIrrigationCoverage } from '@/lib/domain/irrigation-coverage';
import { bedColumns, bedRowCount } from '@/lib/domain/irrigation-layout';
import { type EquipmentInventoryAction } from '../equipment-inventory';

const EQUIPMENT_DRAG_TYPE = 'application/x-irrigation-equipment';

export function PlotPlanCard({
  plot,
  beds,
  selectedBedId,
  placements,
  equipmentById,
  coverageByBedId,
  maxCoverageRate,
  highlightedEquipmentId,
  placementEditor,
  onHighlightEquipment,
  onMoveEquipment,
  onEquipmentAction,
  onSelectBed,
  onChoosePlacementBed,
  onChoosePlacementGap,
}: {
  plot: Plot;
  beds: Bed[];
  selectedBedId: string | null;
  placements: EquipmentPlacementRecord[];
  equipmentById: ReadonlyMap<string, EquipmentListItem>;
  coverageByBedId: ReadonlyMap<string, BedIrrigationCoverage>;
  maxCoverageRate: number;
  highlightedEquipmentId: string | null;
  placementEditor: PlacementEditor | null;
  onHighlightEquipment: (equipmentId: string | null) => void;
  onMoveEquipment: (equipmentId: string) => void;
  onEquipmentAction: (
    equipmentId: string,
    action: EquipmentInventoryAction,
  ) => void;
  onSelectBed: (bedId: string) => void;
  onChoosePlacementBed: (equipmentId: string, bed: Bed) => void;
  onChoosePlacementGap: (
    equipmentId: string,
    beforeBed: Bed,
    afterBed: Bed,
  ) => void;
}) {
  const type = plot.mode === 'greenhouse' ? 'Abri' : 'Jardin';
  const columns = bedColumns(beds.length);
  const layoutVariables = {
    '--bed-columns': columns,
    '--plot-min-width': `${Math.max(290, 80 + columns * 30)}px`,
  } as CSSProperties;
  return (
    <article
      className="plot-plan-card"
      data-mode={plot.mode}
      data-bed-rows={bedRowCount(beds.length)}
      style={layoutVariables}
    >
      <header className="plot-card-heading">
        <strong>{plot.name}</strong>
        <span className="plot-type-badge">{type}</span>
        <span className="plot-area">{formatMeasure(plot.area, 'm²')}</span>
      </header>
      <div className="plot-card-body">
        <span className="plot-bed-count">
          {beds.length} planche{beds.length > 1 ? 's' : ''}
        </span>
        <div className="plot-plan-content">
          <div className="bed-strip">
            {beds.length > 0 ? beds.map((bed, index) => {
            const beforeBed = index > 0 ? beds[index - 1] : null;
            const bedCoverage = coverageByBedId.get(bed.id) ?? null;
            const focusedContribution = highlightedEquipmentId
              ? bedCoverage?.contributions.find(
                  (contribution) =>
                    contribution.equipmentId === highlightedEquipmentId,
                ) ?? null
              : null;
            const coverageAlpha = bedCoverage && maxCoverageRate > 0
              ? 0.16 + 0.34 * Math.min(
                  1,
                  bedCoverage.totalRateMmPerHour / maxCoverageRate,
                )
              : 0;
            const coverageStyle = bedCoverage
              ? { '--coverage-alpha': String(coverageAlpha) } as CSSProperties
              : undefined;
            const sprinklerCenterPlacements = placements.filter(
              (placement) =>
                placement.anchor.type === 'bed_center' &&
                placement.anchor.anchorBedOtfId === bed.id &&
                equipmentById.get(placement.equipmentId)?.kind === 'sprinkler',
            );
            const sprinklerGapPlacements = beforeBed
              ? placements.filter(
                  (placement) =>
                    placement.anchor.type === 'between_beds' &&
                    placement.anchor.beforeBedOtfId === beforeBed.id &&
                    placement.anchor.afterBedOtfId === bed.id &&
                    equipmentById.get(placement.equipmentId)?.kind === 'sprinkler',
                )
              : [];
            const selectedDripPlacements = placements.filter(
              (placement) =>
                equipmentById.get(placement.equipmentId)?.kind === 'drip' &&
                placement.selectedBeds.some(
                  (selected) => selected.otfBedId === bed.id,
                ),
            );
            const selectedForDrip = selectedDripPlacements.length > 0;
            const editorEquipment = placementEditor
              ? equipmentById.get(placementEditor.equipmentId) ?? null
              : null;
            const isEditorSelected = Boolean(
              editorEquipment?.kind === 'drip' &&
              placementEditor?.selectedBedIds.includes(bed.id),
            );
            const isCenterCandidate =
              editorEquipment?.kind === 'sprinkler' &&
              placementEditor?.anchor?.type === 'bed_center' &&
              placementEditor.anchor.anchorBedOtfId === bed.id;
            const isGapCandidate = Boolean(
              beforeBed &&
              editorEquipment?.kind === 'sprinkler' &&
              placementEditor?.anchor?.type === 'between_beds' &&
              placementEditor.anchor.beforeBedOtfId === beforeBed.id &&
              placementEditor.anchor.afterBedOtfId === bed.id,
            );
            const showGapTarget = Boolean(
              beforeBed &&
              (sprinklerGapPlacements.length > 0 || editorEquipment?.kind === 'sprinkler'),
            );
            const bedPlacements = [
              ...sprinklerCenterPlacements,
              ...selectedDripPlacements,
            ];
            const markerLabels = bedPlacements.map((placement) =>
              placementMarkerLabel(placement, equipmentById),
            );
            const focusedDripPlacement = highlightedEquipmentId
              ? selectedDripPlacements.some(
                  (placement) => placement.equipmentId === highlightedEquipmentId,
                )
              : false;

            return (
              <div
                key={bed.id}
                className="bed-anchor-cell"
                data-drip-selected={selectedForDrip || isEditorSelected}
                data-center-candidate={isCenterCandidate}
                data-irrigated={Boolean(bedCoverage)}
                data-overlap={(bedCoverage?.contributions.length ?? 0) > 1}
                data-coverage-focused={Boolean(focusedContribution)}
                data-coverage-dimmed={Boolean(
                  highlightedEquipmentId && !focusedContribution,
                )}
              >
                {showGapTarget && beforeBed ? (
                  <button
                    className="between-bed-anchor"
                    type="button"
                    data-candidate={isGapCandidate}
                    data-placed={sprinklerGapPlacements.length > 0}
                    aria-label={`Placer entre ${beforeBed.name} et ${bed.name}`}
                    title={
                      sprinklerGapPlacements.length > 0
                        ? sprinklerGapPlacements
                            .map((placement) => placementMarkerLabel(placement, equipmentById))
                            .join(' · ')
                        : `Placer entre ${beforeBed.name} et ${bed.name}`
                    }
                    onClick={() => {
                      if (placementEditor) {
                        onChoosePlacementGap(
                          placementEditor.equipmentId,
                          beforeBed,
                          bed,
                        );
                      }
                    }}
                    onDragOver={(event) => allowEquipmentDrop(event)}
                    onDrop={(event) => {
                      const equipmentId = readDraggedEquipmentId(event);
                      if (equipmentId) {
                        onChoosePlacementGap(equipmentId, beforeBed, bed);
                      }
                    }}
                  >
                    <span className="placement-line" aria-hidden="true" />
                  </button>
                ) : null}
                <button
                  className="plan-bed"
                  data-selected={bed.id === selectedBedId}
                  data-placement-selected={selectedForDrip || isEditorSelected}
                  data-placement-anchor={sprinklerCenterPlacements.length > 0 || isCenterCandidate}
                  data-irrigated={Boolean(bedCoverage)}
                  data-overlap={(bedCoverage?.contributions.length ?? 0) > 1}
                  data-coverage-focused={Boolean(focusedContribution)}
                  data-coverage-dimmed={Boolean(
                    highlightedEquipmentId && !focusedContribution,
                  )}
                  style={coverageStyle}
                  aria-pressed={
                    placementEditor
                      ? isEditorSelected || isCenterCandidate
                      : bed.id === selectedBedId
                  }
                  aria-label={bedCoverage
                    ? `${bedAriaLabel(bed)}, apport cumulé ${formatIrrigationRate(bedCoverage.totalRateMmPerHour)}`
                    : bedAriaLabel(bed)}
                  title={
                    bedCoverage
                      ? `${bedAriaLabel(bed)} · ${coverageTitle(bedCoverage)}${markerLabels.length > 0 ? ` · ${markerLabels.join(' · ')}` : ''}`
                      : markerLabels.length > 0
                        ? `${bedAriaLabel(bed)} · ${markerLabels.join(' · ')}`
                        : bedAriaLabel(bed)
                  }
                  onClick={() => {
                    if (placementEditor) {
                      onChoosePlacementBed(placementEditor.equipmentId, bed);
                    } else {
                      onSelectBed(bed.id);
                    }
                  }}
                  onDragOver={(event) => allowEquipmentDrop(event)}
                  onDrop={(event) => {
                    const equipmentId = readDraggedEquipmentId(event);
                    if (equipmentId) onChoosePlacementBed(equipmentId, bed);
                  }}
                >
                  <span>{bed.name}</span>
                  {bedCoverage ? (
                    <span
                      className="coverage-rate-badge"
                      data-overlap={bedCoverage.contributions.length > 1}
                    >
                      {numberFormatter.format(bedCoverage.totalRateMmPerHour)}
                    </span>
                  ) : null}
                  {sprinklerCenterPlacements.length > 0 || isCenterCandidate ? (
                    <span className="placement-line center" aria-hidden="true" />
                  ) : null}
                  {selectedForDrip || isEditorSelected ? (
                    <span
                      className="drip-rails"
                      data-focused={focusedDripPlacement}
                      data-dimmed={Boolean(
                        highlightedEquipmentId &&
                        selectedForDrip &&
                        !focusedDripPlacement,
                      )}
                      data-preview={isEditorSelected}
                      aria-hidden="true"
                    />
                  ) : null}
                </button>
              </div>
            );
            }) : <span className="no-beds">Aucune planche</span>}
          </div>
          {placements.length > 0 ? (
            <div className="plot-placement-labels" aria-label="Matériels positionnés dans ce jardin">
              {placements.map((placement) => {
                const item = equipmentById.get(placement.equipmentId);
                return (
                  <div
                    key={placement.id}
                    className="plot-placement-control"
                    onMouseEnter={() => onHighlightEquipment(placement.equipmentId)}
                    onMouseLeave={() => onHighlightEquipment(null)}
                  >
                    <span
                      className="plot-placement-label"
                      data-kind={item?.kind ?? 'unknown'}
                      data-focused={highlightedEquipmentId === placement.equipmentId}
                    >
                      <strong>
                        {item?.kind === 'drip'
                          ? 'GÀG'
                          : item?.kind === 'sprinkler'
                            ? 'ASP'
                            : '—'}
                      </strong>
                      {placementMarkerLabel(placement, equipmentById)}
                    </span>
                    {item ? (
                      <PlanEquipmentMenu
                        equipment={item}
                        onMove={onMoveEquipment}
                        onAction={onEquipmentAction}
                      />
                    ) : null}
                  </div>
                );
              })}
            </div>
          ) : null}
        </div>
      </div>
      <footer className="plot-card-footer">
        <span aria-hidden="true">▦</span>
        <span>{formatBedGroup(beds)}</span>
      </footer>
    </article>
  );
}

function PlanEquipmentMenu({
  equipment,
  onMove,
  onAction,
}: {
  equipment: EquipmentListItem;
  onMove: (equipmentId: string) => void;
  onAction: (
    equipmentId: string,
    action: EquipmentInventoryAction,
  ) => void;
}) {
  return (
    <details
      className="plan-equipment-menu"
      onToggle={(event) => {
        if (event.currentTarget.open) {
          closeOtherPlanEquipmentMenus(event.currentTarget);
        }
      }}
    >
      <summary
        aria-label={`Actions pour ${equipment.name}`}
        title={`Actions pour ${equipment.name}`}
      >
        ⋮
      </summary>
      <div role="menu">
        <button type="button" role="menuitem" onClick={(event) => runPlanMenuAction(event, () => onMove(equipment.id))}>Déplacer</button>
        <button type="button" role="menuitem" onClick={(event) => runPlanMenuAction(event, () => onAction(equipment.id, 'settings'))}>Configurer les réglages</button>
        <button type="button" role="menuitem" onClick={(event) => runPlanMenuAction(event, () => onAction(equipment.id, 'edit'))}>Modifier</button>
        <button type="button" role="menuitem" onClick={(event) => runPlanMenuAction(event, () => onAction(equipment.id, 'duplicate'))}>Dupliquer</button>
        <button className="archive-action" type="button" role="menuitem" onClick={(event) => runPlanMenuAction(event, () => onAction(equipment.id, 'archive'))}>Archiver</button>
        <button className="delete-action" type="button" role="menuitem" onClick={(event) => runPlanMenuAction(event, () => onAction(equipment.id, 'delete'))}>Supprimer définitivement</button>
      </div>
    </details>
  );
}

function closeOtherPlanEquipmentMenus(currentMenu: HTMLDetailsElement) {
  document
    .querySelectorAll<HTMLDetailsElement>(
      '.equipment-menu[open], .plan-equipment-menu[open]',
    )
    .forEach((menu) => {
      if (menu !== currentMenu) menu.removeAttribute('open');
    });
}

function runPlanMenuAction(
  event: ReactMouseEvent<HTMLButtonElement>,
  action: () => void,
) {
  event.currentTarget.closest<HTMLDetailsElement>('details')?.removeAttribute('open');
  action();
}

function allowEquipmentDrop(event: ReactDragEvent<HTMLElement>) {
  if (
    event.dataTransfer.types.includes(EQUIPMENT_DRAG_TYPE) ||
    event.dataTransfer.types.includes('text/plain')
  ) {
    event.preventDefault();
    event.dataTransfer.dropEffect = 'move';
  }
}

function readDraggedEquipmentId(event: ReactDragEvent<HTMLElement>) {
  event.preventDefault();
  return (
    event.dataTransfer.getData(EQUIPMENT_DRAG_TYPE) ||
    event.dataTransfer.getData('text/plain')
  ).trim();
}

function placementMarkerLabel(
  placement: EquipmentPlacementRecord,
  equipmentById: ReadonlyMap<string, EquipmentListItem>,
) {
  const equipment = equipmentById.get(placement.equipmentId);
  const setting = equipment?.settings.find(
    (item) => item.id === placement.settingId,
  );
  return `${equipment?.name ?? 'Matériel indisponible'} · ${setting?.name ?? 'Réglage indisponible'}`;
}

function coverageTitle(coverage: BedIrrigationCoverage) {
  const details = coverage.contributions.map(
    (contribution) =>
      `${contribution.equipmentName} (${contribution.settingName}) : ${formatIrrigationRate(contribution.rateMmPerHour)}`,
  );
  return `Apport cumulé ${formatIrrigationRate(coverage.totalRateMmPerHour)} · ${details.join(' · ')}`;
}
