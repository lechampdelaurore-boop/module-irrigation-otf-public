'use client';
import type { ReactNode } from 'react';
import type { EquipmentPlacementRecord } from '@/lib/domain/equipment-placement-record';
import type { GardenGroupRecord } from '@/lib/domain/garden-group-record';
import { equipmentByGarden } from '@/lib/domain/equipment-by-garden';
import type { PumpDashboard } from '@/lib/services/pump-dashboard';
import { ActionTab, HydraulicIndicator, IrrigationPreview } from './irrigation-form';
import { PreparationFields } from './preparation-fields';
import { decimalFormatter, pumpOriginLabel } from './presentation';
import type { CreationForm } from './use-creation-form';
import type { useIrrigationPreview } from './use-irrigation-preview';
import { WateringNowForm } from './watering-now-form';

export type IrrigationPreviewResult = ReturnType<typeof useIrrigationPreview>;

/**
 * Le formulaire d'« Arrosages » et ses trois onglets, séparé du composant de
 * la page (simplification S5, PR 1, section 2). « Arroser maintenant » a son
 * premier niveau en trois champs (`WateringNowForm`) ; « Planifier » et
 * « Déjà réalisée » gardent leur formulaire d'avant jusqu'à la PR 2 du lot.
 */
export function CreationPanel({
  form, preview, pumpDashboard, pumpsEnabled, placements, placementsCount, plots, groups,
  completedStartAt, dose, now, pending, reply, onChooseEquipment, onSubmit,
}: {
  form: CreationForm;
  preview: IrrigationPreviewResult;
  pumpDashboard: PumpDashboard;
  pumpsEnabled: boolean;
  /** Le matériel posé que le formulaire liste : à l'heure de début pour une saisie après coup (2.11, règle 12). */
  placements: EquipmentPlacementRecord[];
  /** Le nombre de poses courantes : « rien n'était posé à cette heure » ne se dit que s'il y en a. */
  placementsCount: number;
  plots: readonly { id: string; name: string }[];
  groups: GardenGroupRecord[];
  completedStartAt: string | null;
  /** La dose du jour pour le matériel choisi (F409), sinon `null`. */
  dose: number | null;
  now: Date;
  pending: boolean;
  reply: ReactNode;
  onChooseEquipment: (equipmentId: string) => void;
  onSubmit: () => void;
}) {
  const { creationKind } = form;
  const { usableEquipment, selectedEquipment, selectedSetting } = preview;
  const gardens = equipmentByGarden(usableEquipment, placements, { plots, groups });
  return (
    <div className="irrigation-creation-panel">
      {form.editingEventEquipmentId ? <div className="irrigation-edit-banner"><strong>Modification d’une irrigation planifiée</strong><button type="button" onClick={() => form.setEditingEventEquipmentId(null)}>Annuler la modification</button></div> : null}
      <div className="irrigation-action-tabs" data-tour="arrosage-actions" role="tablist" aria-label="Action d’irrigation">
        <ActionTab active={creationKind === 'running'} onClick={() => form.setCreationKind('running')} title="Arroser maintenant" description="Calculer puis démarrer le minuteur" />
        <ActionTab active={creationKind === 'planned'} onClick={() => form.setCreationKind('planned')} title="Planifier" description="Préparer une irrigation future" />
        <ActionTab active={creationKind === 'completed'} onClick={() => form.setCreationKind('completed')} title="Déjà réalisée" description="Enregistrer des horaires réels" />
      </div>

      {usableEquipment.length === 0 ? (
        <div className="irrigation-empty-action">
          {/* Saisie après coup : rien n'était posé à cette heure de début ; l'heure reste modifiable (règle 12). */}
          <strong>{completedStartAt !== null && placementsCount > 0 ? 'Aucun matériel n’était posé à cette heure de début' : 'Aucun matériel prêt à irriguer'}</strong>
          <p>Un matériel doit posséder au moins un réglage et une position sur le plan.</p>
          {creationKind === 'completed' ? (
            <label><span>Début réel</span><input type="datetime-local" value={form.actualStartAt} onChange={(event) => form.setActualStartAt(event.target.value)} /></label>
          ) : null}
        </div>
      ) : creationKind === 'running' ? (
        <WateringNowForm
          form={form}
          preview={preview}
          gardens={gardens}
          pumpDashboard={pumpDashboard}
          pumpsEnabled={pumpsEnabled}
          dose={dose}
          now={now}
          pending={pending}
          reply={reply}
          onChooseEquipment={onChooseEquipment}
          onSubmit={onSubmit}
        />
      ) : (
        <div className="irrigation-form-layout">
          <div className="irrigation-form-fields" data-tour="arrosage-champs">
            <label>
              <span>Matériel</span>
              <select value={selectedEquipment?.id ?? ''} onChange={(event) => onChooseEquipment(event.target.value)}>
                <option value="" disabled>Choisissez un matériel</option>
                {gardens.map((garden) => (
                  <optgroup key={garden.label} label={garden.label}>
                    {garden.items.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
                  </optgroup>
                ))}
              </select>
            </label>
            <label>
              <span>Réglage</span>
              <select value={selectedSetting?.id ?? ''} onChange={(event) => { form.setSettingId(event.target.value); form.setReferenceBedId(''); }}>
                {selectedEquipment?.settings.map((setting) => <option key={setting.id} value={setting.id}>{setting.name}</option>)}
              </select>
            </label>
            <p className="placement-summary">
              <span aria-hidden="true">⌖</span>
              {!selectedEquipment
                ? 'Choisissez un matériel : l’apport et la faisabilité se calculent ensuite.'
                : preview.selectedPlacement
                ? `${preview.preview?.applications.length ?? 0} planche${(preview.preview?.applications.length ?? 0) > 1 ? 's' : ''} atteinte${(preview.preview?.applications.length ?? 0) > 1 ? 's' : ''} depuis la position enregistrée`
                : 'Position non renseignée'}
            </p>

            {pumpsEnabled ? (<>
              <PumpFields form={form} preview={preview} pumpDashboard={pumpDashboard} />
              {selectedEquipment ? <HydraulicIndicator feasibility={preview.hydraulicPreview} historical={creationKind === 'completed'} /> : null}
            </>) : null}

            {creationKind === 'completed' ? (
              <div className="irrigation-datetime-grid">
                <label><span>Début réel</span><input type="datetime-local" value={form.actualStartAt} onChange={(event) => form.setActualStartAt(event.target.value)} /></label>
                <label><span>Fin réelle</span><input type="datetime-local" value={form.actualEndAt} onChange={(event) => form.setActualEndAt(event.target.value)} /></label>
              </div>
            ) : (
              <>
                <label><span>Date et heure de début</span><input type="datetime-local" value={form.plannedStartAt} onChange={(event) => form.setPlannedStartAt(event.target.value)} /></label>
                <PreparationFields
                  preparationMode={form.preparationMode}
                  onPreparationModeChange={form.setPreparationMode}
                  targetMillimeters={form.targetMillimeters}
                  onTargetMillimetersChange={form.setTargetMillimeters}
                  equipment={selectedEquipment}
                  applications={preview.preview?.applications ?? []}
                  referenceBedId={preview.effectiveReferenceBedId}
                  onReferenceBedIdChange={form.setReferenceBedId}
                  durationHours={form.durationHours}
                  onDurationHoursChange={form.setDurationHours}
                  durationMinutes={form.durationMinutes}
                  onDurationMinutesChange={form.setDurationMinutes}
                />
              </>
            )}

            <NoteField form={form} />
          </div>

          <IrrigationPreview
            equipment={selectedEquipment}
            setting={selectedSetting}
            applications={preview.previewApplications}
            durationSeconds={preview.previewDurationSeconds}
            volumeLiters={preview.previewVolumeLiters}
            origin={preview.previewOrigin}
            startKnown={preview.previewStartKnown}
            creationKind={creationKind}
            onSubmit={onSubmit}
            pending={pending}
            warning={preview.protectedSlotWarning}
            reply={reply}
          />
        </div>
      )}
    </div>
  );
}

/** La pompe et l'origine de l'eau, facultatives, la case « Ressources et pompes » cochée (3.8, R1). */
export function PumpFields({ form, preview, pumpDashboard }: { form: CreationForm; preview: IrrigationPreviewResult; pumpDashboard: PumpDashboard }) {
  const { selectedPump, selectedPumpOrigin } = preview;
  return (
    <div className="irrigation-pump-fields">
      <label><span>Pompe <small>(facultatif)</small></span><select value={form.pumpId} onChange={(event) => { form.setPumpId(event.target.value); form.setPumpOriginId(''); }}><option value="">Aucune · faisabilité non vérifiée</option>{pumpDashboard.pumps.filter((pump) => pump.status === 'active').map((pump) => <option key={pump.id} value={pump.id}>{pump.name} · {decimalFormatter.format(pump.maximumFlowCubicMetersPerHour)} m³/h</option>)}</select></label>
      {selectedPump ? <label><span>Origine de l’eau <small>(facultative)</small></span><select value={selectedPumpOrigin?.id ?? ''} onChange={(event) => form.setPumpOriginId(event.target.value)}><option value="">Non renseignée</option>{selectedPump.origins.map((origin) => <option key={origin.id} value={origin.id}>{pumpOriginLabel(origin, pumpDashboard)}{origin.isDefault ? ' · par défaut' : ''}</option>)}</select></label> : null}
    </div>
  );
}

/** La note facultative, 500 caractères au plus. */
export function NoteField({ form }: { form: CreationForm }) {
  return (
    <label>
      <span>Note <small>(facultatif)</small></span>
      <textarea value={form.note} maxLength={500} rows={2} placeholder="Ex. vanne nord, pression habituelle…" onChange={(event) => form.setNote(event.target.value)} />
    </label>
  );
}
