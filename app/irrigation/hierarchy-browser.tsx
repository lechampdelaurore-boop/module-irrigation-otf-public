'use client';
import { CoverageOverview } from './hierarchy/coverage-overview';
import { PlacementToolbar, placementPreviewFromEditor } from './hierarchy/placement-toolbar';
import { PlotPlanCard } from './hierarchy/plot-plan-card';
import { formatMeasure } from './hierarchy/presentation';
import { SelectedBedDetails } from './hierarchy/selected-bed-details';
import { usePlacementEditor } from './hierarchy/use-placement-editor';

import type { EquipmentPlacementRecord } from '@/lib/domain/equipment-placement-record';
import type { EquipmentListItem } from '@/lib/domain/equipment-record';
import { useEffect, useMemo, useRef, useState } from 'react';
import type { GardenGroupConfiguration } from '@/lib/domain/garden-group-record';
import type { IrrigationSnapshot } from '@/lib/domain/domain';
import { notifyFeasibilityChanged } from '@/lib/domain/feasibility-notifications';
import { sortBedsByName } from '@/lib/domain/bed-order';
import { calculateIrrigationCoverage } from '@/lib/domain/irrigation-coverage';
import { EquipmentInventory, type EquipmentInventoryHandle } from './equipment-inventory';
import type { CalculatorContext } from './irrigation-calculator/calculator-context';
import { EquipmentRemovalDialog } from './hierarchy/equipment-removal-dialog';
import type { ClosedPlacementPose } from '@/db/equipment-placement-poses';
import type { PlacementPose } from '@/lib/domain/equipment-placement-periods';
import { GardenGroupManager } from './garden-group-manager';
import { BedCropWaterPanel } from './crop-water/bed-crop-water-panel';
import { IrrigationShell, type ShellProps } from './shell/irrigation-shell';

type Props = {
  shell: ShellProps;
  snapshot: IrrigationSnapshot;
  selectedSeason: number;
  equipment: EquipmentListItem[];
  equipmentPlacements: EquipmentPlacementRecord[];
  equipmentPoses: PlacementPose[];
  equipmentPoseHistory: ClosedPlacementPose[];
  gardenGroupConfiguration: GardenGroupConfiguration;
  /** La fiche de la planche montre le besoin de la culture si « Besoin par culture » est cochée. */
  showBedCropWater: boolean;
  /** Le calculateur d'irrigation, s'il est coché (3.8 bis) : la provenance de chaque réglage. */
  calculator: CalculatorContext | null;
};

/**
 * La page « Matériel et placement » (3.8, docs/feature-selection-contract.md,
 * section 5) : le plan des parcelles, la fiche de la planche, les groupes de
 * jardins alignés et le matériel, dans l'ordre d'avant la 3.8.
 */
export function HierarchyBrowser({
  shell,
  snapshot,
  selectedSeason,
  equipment,
  equipmentPlacements,
  equipmentPoses,
  equipmentPoseHistory,
  gardenGroupConfiguration,
  showBedCropWater,
  calculator,
}: Props) {
  const season = selectedSeason;
  const [zoneId, setZoneId] = useState<string | null>(shell.zone);
  const [bedId, setBedId] = useState<string | null>(null);
  const equipmentInventoryRef = useRef<EquipmentInventoryHandle>(null);

  const zones = snapshot.zones.filter((zone) => zone.seasons.includes(season));
  const seasonPlots = snapshot.plots.filter((plot) =>
    plot.seasons.includes(season),
  );
  const seasonBeds = snapshot.beds.filter((bed) =>
    bed.seasons.includes(season),
  );
  const equipmentById = useMemo(
    () => new Map(equipment.map((item) => [item.id, item])),
    [equipment],
  );
  const bedById = useMemo(
    () => new Map(seasonBeds.map((bed) => [bed.id, bed])),
    [seasonBeds],
  );
  const bedName = (bedId: string) => bedById.get(bedId)?.name ?? null;

  const {
    placementEditor,
    placementEquipment,
    setPlacementEditor,
    applyPlacementUpdate,
    currentEquipmentPlacements,
    placementNotice,
    placementError,
    setPlacementError,
    highlightedEquipmentId,
    setHighlightedEquipmentId,
    placementPending,
    placementByEquipmentId,
    startEquipmentPlacement,
    runEquipmentActionFromPlan,
    chooseBedForPlacement,
    chooseGapForPlacement,
    savePlacement,
    placementDate,
    setPlacementDate,
    currentPoses,
    poseByEquipmentId,
    poseHistory,
    removal,
    setRemoval,
    openRemoval,
    confirmRemoval,
  } = usePlacementEditor({
    equipmentPlacements,
    equipmentPoses,
    equipmentPoseHistory,
    equipmentById,
    bedById,
    gardenGroupConfiguration,
    season,
    equipmentInventoryRef,
    setZoneId,
    setBedId,
  });

  useEffect(() => {
    notifyFeasibilityChanged();
  }, [equipment, equipmentPlacements, gardenGroupConfiguration, snapshot]);

  const selectedZone = zones.find((zone) => zone.id === zoneId) ?? zones[0];
  const plots = snapshot.plots.filter(
    (plot) =>
      plot.zoneId === selectedZone?.id && plot.seasons.includes(season),
  );
  const plotIds = new Set(plots.map((plot) => plot.id));
  const beds = snapshot.beds.filter(
    (bed) => plotIds.has(bed.plotId) && bed.seasons.includes(season),
  );
  const selectedBed = beds.find((bed) => bed.id === bedId) ?? beds[0];
  const selectedPlot = plots.find((plot) => plot.id === selectedBed?.plotId);
  const previewPlacement = placementEditor
    ? placementPreviewFromEditor(
        placementEditor,
        season,
        bedById,
        gardenGroupConfiguration.groups,
      )
    : null;
  const coveragePlacements = placementEditor
    ? [
        ...currentEquipmentPlacements.filter(
          (placement) => placement.equipmentId !== placementEditor.equipmentId,
        ),
        ...(previewPlacement ? [previewPlacement] : []),
      ]
    : currentEquipmentPlacements;
  const irrigationCoverage = calculateIrrigationCoverage({
    beds: seasonBeds,
    groups: gardenGroupConfiguration.groups,
    equipment,
    placements: coveragePlacements,
  });
  const coverageByBedId = new Map(
    irrigationCoverage.beds.map((coverage) => [coverage.bedId, coverage]),
  );
  const displayedEquipmentPlacements = placementEditor
    ? currentEquipmentPlacements.filter(
        (placement) => placement.equipmentId !== placementEditor.equipmentId,
      )
    : currentEquipmentPlacements;

  const chooseZone = (value: string) => {
    setZoneId(value);
    setBedId(null);
    // La parcelle reste dans l'adresse : elle suit d'une page à l'autre et au rechargement (précision P12).
    const url = new URL(window.location.href);
    url.searchParams.set('zone', value);
    window.history.replaceState(window.history.state, '', `${url.pathname}${url.search}${url.hash}`);
  };

  const parcelControl = (
    <label className="control-field parcel-control">
      <span>Parcelle</span>
      <select
        value={selectedZone?.id ?? ''}
        disabled={zones.length === 0}
        onChange={(event) => chooseZone(event.target.value)}
      >
        {zones.map((zone) => (
          <option key={zone.id} value={zone.id}>
            {zone.name}
          </option>
        ))}
      </select>
    </label>
  );

  return (
    <IrrigationShell {...shell} zone={selectedZone?.id ?? null} controls={parcelControl}>
      <nav className="breadcrumb" aria-label="Fil d’Ariane">
        <span>Saison {season}</span>
        <span aria-hidden="true">›</span>
        <span>{selectedZone?.name ?? 'Parcelle'}</span>
        <span aria-hidden="true">›</span>
        <span>{selectedPlot?.name ?? 'Jardin'}</span>
        <span aria-hidden="true">›</span>
        <strong aria-current="page">{selectedBed?.name ?? 'Planche'}</strong>
      </nav>

      {placementNotice ? (
        <p className="placement-notice" role="status">{placementNotice}</p>
      ) : null}
      {placementEditor && placementEquipment ? (
        <PlacementToolbar
          season={season}
          equipment={placementEquipment}
          editor={placementEditor}
          existingPlacement={
            placementByEquipmentId.get(placementEditor.equipmentId) ?? null
          }
          stored={poseByEquipmentId.get(placementEditor.equipmentId)?.removedAt != null}
          placementDate={placementDate}
          onPlacementDateChange={setPlacementDate}
          bedById={bedById}
          error={placementError}
          pending={placementPending}
          onSettingChange={(settingId) => {
            setPlacementEditor({ ...placementEditor, settingId });
            setPlacementError(null);
          }}
          onCancel={() => !placementPending && setPlacementEditor(null)}
          onRemove={() => openRemoval(placementEditor.equipmentId)}
          onSave={savePlacement}
        />
      ) : placementError ? (
        <p className="equipment-error placement-global-error" role="alert">
          {placementError}
        </p>
      ) : null}

      <section
        id="farm-plan"
        className="farm-plan"
        data-placement-mode={placementEditor ? placementEquipment?.kind : undefined}
        aria-label="Plan de la parcelle"
      >
        {selectedZone ? (
          <>
            <header className="parcel-heading">
              <strong>{selectedZone.name}</strong>
              <span>
                {selectedZone.area === null
                  ? 'Surface non renseignée'
                  : formatMeasure(selectedZone.area, 'm²')}
              </span>
              <span>{plots.length} jardin{plots.length > 1 ? 's' : ''} ou abri{plots.length > 1 ? 's' : ''}</span>
              <span>{beds.length} planche{beds.length > 1 ? 's' : ''}</span>
            </header>
            {plots.length > 0 ? (
              <div className="plot-grid">
                {plots.map((plot) => {
                  const plotBeds = sortBedsByName(
                    beds.filter((bed) => bed.plotId === plot.id),
                  );
                  return (
                    <PlotPlanCard
                      key={plot.id}
                      plot={plot}
                      beds={plotBeds}
                      selectedBedId={selectedBed?.id ?? null}
                      placements={displayedEquipmentPlacements.filter(
                        (placement) =>
                          placement.otfPlotId === plot.id ||
                          placement.selectedBeds.some(
                            (bed) => bed.otfPlotId === plot.id,
                          ),
                      )}
                      equipmentById={equipmentById}
                      coverageByBedId={coverageByBedId}
                      maxCoverageRate={irrigationCoverage.maxRateMmPerHour}
                      highlightedEquipmentId={highlightedEquipmentId}
                      placementEditor={placementEditor}
                      onHighlightEquipment={setHighlightedEquipmentId}
                      onMoveEquipment={startEquipmentPlacement}
                      onEquipmentAction={runEquipmentActionFromPlan}
                      onSelectBed={setBedId}
                      onChoosePlacementBed={chooseBedForPlacement}
                      onChoosePlacementGap={chooseGapForPlacement}
                    />
                  );
                })}
              </div>
            ) : (
              <p className="plan-empty-state">
                Aucun jardin ou abri n’est rattaché à cette parcelle.
              </p>
            )}
          </>
        ) : (
          <p className="plan-empty-state">
            Aucune parcelle n’est disponible pour la saison {season}.
          </p>
        )}
      </section>

      {selectedBed && selectedPlot ? (
        <SelectedBedDetails
          bed={selectedBed}
          plot={selectedPlot}
          coverage={coverageByBedId.get(selectedBed.id) ?? null}
        />
      ) : null}
      {selectedBed && showBedCropWater ? (
        <BedCropWaterPanel key={`${season}:${selectedBed.id}`} season={season} bedId={selectedBed.id} bedName={selectedBed.name} />
      ) : null}

      {/* Le plan de la parcelle d'abord, la planche choisie juste dessous, puis l'aperçu (retour du porteur du 8 novembre 2026). */}
      <CoverageOverview
        coverage={irrigationCoverage}
        highlightedEquipmentId={highlightedEquipmentId}
        onHighlightEquipment={setHighlightedEquipmentId}
      />

      <GardenGroupManager
        season={season}
        groups={gardenGroupConfiguration.groups}
        copiedFromSeason={gardenGroupConfiguration.copiedFromSeason}
        plots={seasonPlots}
        beds={seasonBeds}
        zones={zones}
      />

      <EquipmentInventory
        ref={equipmentInventoryRef}
        equipment={equipment}
        placements={currentEquipmentPlacements}
        poseContext={{ poses: currentPoses, history: poseHistory, bedName, onRemove: openRemoval }}
        onStartPlacement={startEquipmentPlacement}
        onPlacementChanged={applyPlacementUpdate}
        calculator={calculator}
      />
      {removal ? (
        <EquipmentRemovalDialog
          equipmentName={equipmentById.get(removal.equipmentId)?.name ?? 'ce matériel'}
          removedAt={removal.removedAt}
          error={removal.error}
          pending={placementPending}
          onRemovedAtChange={(removedAt) => setRemoval({ ...removal, removedAt, error: null })}
          onCancel={() => setRemoval(null)}
          onConfirm={confirmRemoval}
        />
      ) : null}

    </IrrigationShell>
  );
}
