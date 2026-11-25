'use client';
import Link from 'next/link';
import type { ReactNode } from 'react';
import type { EquipmentPlacementRecord } from '@/lib/domain/equipment-placement-record';
import type { GardenGroupRecord } from '@/lib/domain/garden-group-record';
import { equipmentByGarden } from '@/lib/domain/equipment-by-garden';
import type { PumpDashboard } from '@/lib/services/pump-dashboard';
import { WATERING_TAB_LABELS } from '@/lib/domain/watering-plan-record';
import { ActionTab } from './irrigation-form';
import { decimalFormatter, pumpOriginLabel } from './presentation';
import type { CreationForm } from './use-creation-form';
import type { useIrrigationPreview } from './use-irrigation-preview';
import { WateringForm } from './watering-form';

export type IrrigationPreviewResult = ReturnType<typeof useIrrigationPreview>;

/**
 * Le formulaire d'« Arrosages » et ses trois onglets, séparé du composant de
 * la page (simplification S5, PR 1, section 2). Les trois onglets partagent
 * un squelette (`WateringForm`, PR 2, section 4) ; au téléphone, ils tiennent
 * sur une ligne, sans leur phrase de description (S5-e).
 */
export function CreationPanel({
  form, preview, pumpDashboard, pumpsEnabled, placements, placementsCount, plots, groups,
  completedStartAt, dose, unplacedChoice, todayHref, fromGesture, justStarted, now, pending, reply, onChooseEquipment, onSubmit,
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
  /** Le nom d'un matériel choisi qui n'était pas posé à l'heure de début de « Déjà fait » (section 4). */
  unplacedChoice: string | null;
  /** L'adresse d'« Aujourd'hui », la saison gardée. */
  todayHref: string;
  /** Arrivé par un geste du « + » : le retour « ‹ Aujourd'hui » en tête (section 7). */
  fromGesture: boolean;
  /** Un arrosage vient de démarrer d'ici : le lien vers sa carte d'« Aujourd'hui » (S5-g). */
  justStarted: boolean;
  now: Date;
  pending: boolean;
  reply: ReactNode;
  onChooseEquipment: (equipmentId: string) => void;
  onSubmit: () => void;
}) {
  const { creationKind } = form;
  const { usableEquipment } = preview;
  const gardens = equipmentByGarden(usableEquipment, placements, { plots, groups });
  return (
    <div className="irrigation-creation-panel">
      {fromGesture ? <Link className="watering-back" href={todayHref} prefetch={false}>‹ Aujourd’hui</Link> : null}
      {form.editingEventEquipmentId ? <div className="irrigation-edit-banner"><strong>Modification d’une irrigation planifiée</strong><button type="button" onClick={() => form.setEditingEventEquipmentId(null)}>Annuler la modification</button></div> : null}
      <div className="irrigation-action-tabs" data-tour="arrosage-actions" role="tablist" aria-label="Action d’irrigation">
        <ActionTab active={creationKind === 'running'} onClick={() => form.setCreationKind('running')} title={WATERING_TAB_LABELS.running} description="Calculer puis démarrer le minuteur" />
        <ActionTab active={creationKind === 'planned'} onClick={() => form.setCreationKind('planned')} title={WATERING_TAB_LABELS.planned} description="Préparer une irrigation future" />
        <ActionTab active={creationKind === 'completed'} onClick={() => form.setCreationKind('completed')} title={WATERING_TAB_LABELS.completed} description="Enregistrer des horaires réels" />
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
      ) : (
        <WateringForm
          form={form}
          preview={preview}
          gardens={gardens}
          pumpDashboard={pumpDashboard}
          pumpsEnabled={pumpsEnabled}
          dose={dose}
          unplacedChoice={unplacedChoice}
          afterStart={justStarted ? <Link className="watering-after-start" href={todayHref} prefetch={false}>Voir l’arrosage en cours sur Aujourd’hui</Link> : null}
          now={now}
          pending={pending}
          reply={reply}
          onChooseEquipment={onChooseEquipment}
          onSubmit={onSubmit}
        />
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
