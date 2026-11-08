'use client';
import type { EquipmentPlacementRecord } from '@/lib/domain/equipment-placement-record';
import type { EquipmentListItem } from '@/lib/domain/equipment-record';
import type { GardenGroupRecord } from '@/lib/domain/garden-group-record';
import type { IrrigationEventRecord } from '@/lib/domain/irrigation-event-record';
import { MILLISECONDS_PER_HOUR, SECONDS_PER_HOUR, hoursFromSeconds } from '@/lib/domain/units';
import { sortByNameNaturally } from '@/lib/domain/bed-order';
import { FinishIrrigationDialog } from './irrigation-manager/finish-irrigation-dialog';
import { ActiveIrrigationCard } from './irrigation-manager/irrigation-cards';
import { UpcomingIrrigations } from './irrigation-manager/upcoming-irrigations';
import { ActionTab, HydraulicIndicator, IrrigationPreview } from './irrigation-manager/irrigation-form';
import { NotificationReadiness } from './irrigation-manager/notification-readiness';
import {
  countLiveOverlapBeds,
  decimalFormatter,
  formatRate,
  isoFromLocalInput,
  numericInput,
  pumpOriginLabel,
  type CreationKind,
} from './irrigation-manager/presentation';
import { useFarmClock } from './irrigation-manager/use-farm-clock';
import { useIrrigationNotifications } from './irrigation-manager/use-irrigation-notifications';
import { useIrrigationPreview } from './irrigation-manager/use-irrigation-preview';

import { useEffect, useMemo, useState, useTransition } from 'react';
import type { ClosedPlacementPose } from '@/db/equipment-placement-poses';
import type { PlacementPose } from '@/lib/domain/equipment-placement-periods';
import { placementsOpenAt, plannedIrrigationSignal } from '@/lib/domain/equipment-pose-presentation';
import type { ProtectedSlot } from '@/lib/domain/planning/protected-slots';
import { PLANNED_IRRIGATION_FORM_REQUESTED } from '@/lib/domain/feasibility-notifications';
import type { PumpDashboard } from '@/lib/services/pump-dashboard';
import type { Bed } from '@/lib/domain/domain';
import { localDateTimeInputValue } from '@/lib/domain/irrigation-timer';
import {
  cancelPlannedIrrigationAction,
  cancelRemainingIrrigationAction,
  createIrrigationEventAction,
  finishIrrigationEventAction,
  pauseIrrigationEventAction,
  resumeIrrigationEventAction,
  startIrrigationEventAction,
  updatePlannedIrrigationAction,
} from './irrigation-event-actions';
import type { IrrigationEventActionResult, IrrigationPreparationMode } from './irrigation-event/contract';
import { recordDoneAsPlannedAction } from './done-as-planned-actions';

type Props = {
  season: number;
  initialNowIso: string;
  equipment: EquipmentListItem[];
  placements: EquipmentPlacementRecord[];
  /** Les poses courantes, posées ou stockées, et les poses fermées de la saison (2.11). */
  poses: PlacementPose[];
  poseHistory: ClosedPlacementPose[];
  groups: GardenGroupRecord[];
  beds: Bed[];
  events: IrrigationEventRecord[];
  pumpDashboard: PumpDashboard;
  /** La case « Ressources et pompes » cochée : le choix de la pompe et la faisabilité hydraulique (3.8, R1). */
  pumpsEnabled: boolean;
  /** La tolérance R14 du planning : une irrigation planifiée non démarrée au-delà est « en retard » (3.7, règles 18 à 20). */
  lateToleranceMinutes: number;
  /** « Recalculer le plan » sur la carte d'un arrosage en retard (3.7, règle 20) ; absent sans le planning. */
  onRecalculatePlan?: () => void;
  /** Les créneaux protégés, Planning coché seulement : « Planifier » avertit d'un arrosage qui y tombe, sans le bloquer (3.8 ter, règle 12). */
  protectedSlots?: readonly ProtectedSlot[];
};


export function IrrigationEventManager({
  season,
  initialNowIso,
  equipment,
  placements,
  poses,
  poseHistory,
  groups,
  beds,
  events,
  pumpDashboard,
  pumpsEnabled,
  lateToleranceMinutes,
  onRecalculatePlan,
  protectedSlots = [],
}: Props) {
  const [creationKind, setCreationKind] = useState<CreationKind>('running');
  // Aucun matériel présélectionné à l'ouverture (audit ergonomique, lot 3, point 6, cas 3) :
  // rien ne se calcule, et aucun cadre rouge ne paraît, avant un choix de l'utilisateur.
  const [equipmentId, setEquipmentId] = useState('');
  const [settingId, setSettingId] = useState('');
  const [pumpId, setPumpId] = useState('');
  const [pumpOriginId, setPumpOriginId] = useState('');
  const [preparationMode, setPreparationMode] =
    useState<IrrigationPreparationMode>('amount');
  const [targetMillimeters, setTargetMillimeters] = useState('25');
  const [durationHours, setDurationHours] = useState('1');
  const [durationMinutes, setDurationMinutes] = useState('0');
  const [referenceBedId, setReferenceBedId] = useState('');
  const [plannedStartAt, setPlannedStartAt] = useState(() =>
    localDateTimeInputValue(new Date(Date.parse(initialNowIso) + MILLISECONDS_PER_HOUR)),
  );
  const [actualStartAt, setActualStartAt] = useState(() =>
    localDateTimeInputValue(new Date(Date.parse(initialNowIso) - MILLISECONDS_PER_HOUR)),
  );
  const [actualEndAt, setActualEndAt] = useState(() =>
    localDateTimeInputValue(new Date(initialNowIso)),
  );
  const [note, setNote] = useState('');
  const [notice, setNotice] = useState<string | null>(null);
  const [warning, setWarning] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [finishEvent, setFinishEvent] = useState<IrrigationEventRecord | null>(null);
  const [editingEventEquipmentId, setEditingEventEquipmentId] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const [finishAt, setFinishAt] = useState(() =>
    localDateTimeInputValue(new Date(initialNowIso), true),
  );
  const activeEvents = events.filter((event) => event.equipment.timerState !== null);
  const plannedEvents = events.filter(
    (event) => event.status === 'planned' && !event.equipment.timerState,
  );
  const openPartialEvents = events.filter(
    (event) =>
      event.status === 'partially_completed' &&
      !event.remainingCanceledAt &&
      !event.equipment.timerState,
  );
  const historyEvents = events.filter(
    (event) =>
      event.status === 'completed' ||
      event.status === 'canceled' ||
      Boolean(event.remainingCanceledAt),
  );
  const liveOverlapCount = countLiveOverlapBeds(activeEvents);

  const now = useFarmClock(initialNowIso, activeEvents);

  // Saisie après coup : le matériel posé à l'heure de début, même retiré
  // depuis ; à venir ou en cours : le matériel posé (2.11, règles 11 et 12).
  const completedStartAt = creationKind === 'completed' ? isoFromLocalInput(actualStartAt) : null;
  const formPlacements = useMemo(() => completedStartAt === null
    ? placements
    : placementsOpenAt([...poseHistory, ...poses.filter((pose) => pose.removedAt === null)], completedStartAt),
  [completedStartAt, placements, poseHistory, poses]);
  const poseByEquipmentId = new Map(poses.map((pose) => [pose.equipmentId, pose]));

  const {
    usableEquipment,
    selectedEquipment,
    selectedPlacement,
    selectedSetting,
    selectedPump,
    selectedPumpOrigin,
    preview,
    effectiveReferenceBedId,
    previewDurationSeconds,
    previewApplications,
    previewVolumeLiters,
    previewOrigin,
    previewStartKnown,
    hydraulicPreview,
    protectedSlotWarning,
  } = useIrrigationPreview({
    equipment, placements: formPlacements, groups, beds, events, pumpDashboard, now, creationKind,
    equipmentId, settingId, pumpId, pumpOriginId, preparationMode, targetMillimeters,
    durationHours, durationMinutes, referenceBedId, plannedStartAt, actualStartAt,
    actualEndAt, editingEventEquipmentId, protectedSlots,
  });

  const { notificationStatus, enableNotifications, disableNotifications } =
    useIrrigationNotifications({ season, now, activeEvents, setWarning });

  const submitCreation = () => {
    if (!selectedEquipment || !selectedSetting) {
      setError(usableEquipment.length > 0 ? 'Choisissez un matériel avant d’enregistrer une irrigation.' : 'Ajoutez, réglez et placez au moins un matériel avant d’enregistrer une irrigation.');
      return;
    }
    setNotice(null);
    setWarning(null);
    setError(null);
    startTransition(async () => {
      const input = {
        kind: creationKind,
        season,
        equipmentId: selectedEquipment.id,
        settingId: selectedSetting.id,
        preparationMode,
        targetMillimeters: numericInput(targetMillimeters),
        referenceBedId: effectiveReferenceBedId || null,
        durationMinutes:
          numericInput(durationHours) * 60 + numericInput(durationMinutes),
        plannedStartAt: isoFromLocalInput(plannedStartAt),
        actualStartAt: isoFromLocalInput(actualStartAt),
        actualEndAt: isoFromLocalInput(actualEndAt),
        note,
        pumpId: pumpId || null,
        pumpOriginId: selectedPumpOrigin?.id ?? null,
      };
      const result = editingEventEquipmentId
        ? await updatePlannedIrrigationAction({ ...input, kind: 'planned', eventEquipmentId: editingEventEquipmentId })
        : await createIrrigationEventAction(input);
      receiveActionResult(result);
      if (result.ok) setEditingEventEquipmentId(null);
    });
  };

  const receiveActionResult = (result: IrrigationEventActionResult) => {
    if (!result.ok) {
      setError(result.message);
      return;
    }
    setNotice(result.message);
    setWarning(result.warning ?? null);
    setError(null);
    setNote('');
    window.dispatchEvent(new CustomEvent('irrigation-events-changed'));
  };

  const runEventAction = (
    action: () => Promise<IrrigationEventActionResult>,
  ) => {
    setNotice(null);
    setWarning(null);
    setError(null);
    startTransition(async () => {
      receiveActionResult(await action());
    });
  };

  // « Fait comme prévu » (lot 3, point 6.5) : la règle et l'écriture de « Tout est fait », pour une ligne.
  const recordDoneAsPlanned = (event: IrrigationEventRecord) => new Promise<void>((resolve) => {
    setNotice(null);
    setWarning(null);
    setError(null);
    startTransition(async () => {
      try {
        const result = await recordDoneAsPlannedAction({ eventEquipmentIds: [event.equipment.id] });
        const refusal = result.ok ? result.refused[0] : null;
        if (result.ok && result.recorded > 0) {
          setNotice('Irrigation enregistrée comme faite, telle que prévue. Elle se lit dans l’historique.');
          window.dispatchEvent(new CustomEvent('irrigation-events-changed'));
        } else {
          setError(refusal ? `${refusal.title} : ${refusal.reason}` : result.message);
        }
      } finally {
        resolve();
      }
    });
  });

  const openFinish = (event: IrrigationEventRecord) => {
    setFinishEvent(event);
    const suggestedEnd = event.equipment.timerState === 'paused'
      ? event.equipment.timerPausedAt
      : new Date().toISOString();
    setFinishAt(localDateTimeInputValue(
      suggestedEnd ? new Date(suggestedEnd) : new Date(),
      true,
    ));
  };

  useEffect(() => {
    // Le planning (3.6) envoie ici le maraîcher qui veut ajouter un créneau de sa main.
    const openPlannedForm = () => {
      setEditingEventEquipmentId(null);
      setCreationKind('planned');
      document.querySelector('.irrigation-creation-panel')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    };
    window.addEventListener(PLANNED_IRRIGATION_FORM_REQUESTED, openPlannedForm);
    return () => window.removeEventListener(PLANNED_IRRIGATION_FORM_REQUESTED, openPlannedForm);
  }, []);

  const editPlanned = (event: IrrigationEventRecord) => {
    const item = event.equipment;
    if (!item.plannedStartAt) return;
    setEditingEventEquipmentId(item.id);
    setCreationKind('planned');
    setEquipmentId(item.equipmentId);
    setSettingId(item.settingId);
    setPumpId(item.pumpId ?? '');
    setPumpOriginId(item.pumpOriginId ?? '');
    setPreparationMode('duration');
    setDurationHours(String(Math.floor(hoursFromSeconds(item.plannedDurationSeconds))));
    setDurationMinutes(String(Math.round((item.plannedDurationSeconds % SECONDS_PER_HOUR) / 60)));
    setPlannedStartAt(localDateTimeInputValue(new Date(item.plannedStartAt)));
    setNote(event.note ?? '');
    setNotice('Modification de l’irrigation planifiée. Toutes les contraintes seront recalculées.');
    document.querySelector('.irrigation-creation-panel')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  return (
    <section className="irrigation-events-section" aria-labelledby="irrigation-events-title">
      <header className="irrigation-events-heading">
        <div>
          <h2 id="irrigation-events-title">Enregistrer ou planifier une irrigation</h2>
          <p>
            Calculez l’apport, lancez un minuteur fiable ou conservez une irrigation déjà réalisée.
          </p>
        </div>
        <div className="irrigation-event-counts" aria-label="Résumé des irrigations">
          <span><strong>{activeEvents.length}</strong> en cours</span>
          <span><strong>{plannedEvents.length + openPartialEvents.length}</strong> à venir</span>
          <span><strong>{historyEvents.length}</strong> archivées</span>
        </div>
      </header>

      <NotificationReadiness
        foldable
        status={notificationStatus}
        pending={pending}
        onEnable={() => void enableNotifications()}
        onDisable={() => void disableNotifications()}
      />

      {notice ? <p className="irrigation-event-notice" role="status">{notice}</p> : null}
      {warning ? <p className="irrigation-event-warning" role="alert">{warning}</p> : null}
      {error ? <p className="irrigation-event-error" role="alert">{error}</p> : null}

      {activeEvents.length > 0 ? (
        <div className="active-irrigations" aria-label="Irrigations en cours">
          <div className="active-irrigations-title">
            <h3>Irrigations en cours</h3>
            {liveOverlapCount > 0 ? (
              <span className="overlap-warning">
                {liveOverlapCount} planche{liveOverlapCount > 1 ? 's' : ''} avec apports cumulés
              </span>
            ) : null}
          </div>
          <div className="active-irrigation-grid">
            {activeEvents.map((event) => (
              <ActiveIrrigationCard
                key={event.id}
                event={event}
                beds={beds}
                now={now}
                pending={pending}
                onPause={() => runEventAction(
                  () => pauseIrrigationEventAction(event.equipment.id),
                )}
                onResume={() => runEventAction(
                  () => resumeIrrigationEventAction(event.equipment.id),
                )}
                onFinish={() => openFinish(event)}
              />
            ))}
          </div>
        </div>
      ) : null}

      <div className="irrigation-creation-panel">
        {editingEventEquipmentId ? <div className="irrigation-edit-banner"><strong>Modification d’une irrigation planifiée</strong><button type="button" onClick={() => setEditingEventEquipmentId(null)}>Annuler la modification</button></div> : null}
        <div className="irrigation-action-tabs" role="tablist" aria-label="Action d’irrigation">
          <ActionTab
            active={creationKind === 'running'}
            onClick={() => setCreationKind('running')}
            title="Irriguer maintenant"
            description="Calculer puis démarrer le minuteur"
          />
          <ActionTab
            active={creationKind === 'planned'}
            onClick={() => setCreationKind('planned')}
            title="Planifier"
            description="Préparer une irrigation future"
          />
          <ActionTab
            active={creationKind === 'completed'}
            onClick={() => setCreationKind('completed')}
            title="Déjà réalisée"
            description="Enregistrer des horaires réels"
          />
        </div>

        {usableEquipment.length === 0 ? (
          <div className="irrigation-empty-action">
            {/* Saisie après coup : rien n'était posé à cette heure de début ; l'heure reste modifiable (règle 12). */}
            <strong>{completedStartAt !== null && placements.length > 0 ? 'Aucun matériel n’était posé à cette heure de début' : 'Aucun matériel prêt à irriguer'}</strong>
            <p>Un matériel doit posséder au moins un réglage et une position sur le plan.</p>
            {creationKind === 'completed' ? (
              <label><span>Début réel</span><input type="datetime-local" value={actualStartAt} onChange={(event) => setActualStartAt(event.target.value)} /></label>
            ) : null}
          </div>
        ) : (
          <div className="irrigation-form-layout">
            <div className="irrigation-form-fields">
              <label>
                <span>Matériel</span>
                <select
                  value={selectedEquipment?.id ?? ''}
                  onChange={(event) => {
                    setEquipmentId(event.target.value);
                    setSettingId('');
                    setReferenceBedId('');
                    setPumpId(pumpDashboard.equipmentDefaults.find((item) => item.equipmentId === event.target.value)?.pumpId ?? '');
                    setPumpOriginId('');
                  }}
                >
                  <option value="" disabled>Choisissez un matériel</option>
                  {usableEquipment.map((item) => (
                    <option key={item.id} value={item.id}>{item.name}</option>
                  ))}
                </select>
              </label>
              <label>
                <span>Réglage</span>
                <select
                  value={selectedSetting?.id ?? ''}
                  onChange={(event) => {
                    setSettingId(event.target.value);
                    setReferenceBedId('');
                  }}
                >
                  {selectedEquipment?.settings.map((setting) => (
                    <option key={setting.id} value={setting.id}>{setting.name}</option>
                  ))}
                </select>
              </label>
              <p className="placement-summary">
                <span aria-hidden="true">⌖</span>
                {!selectedEquipment
                  ? 'Choisissez un matériel : l’apport et la faisabilité se calculent ensuite.'
                  : selectedPlacement
                  ? `${preview?.applications.length ?? 0} planche${(preview?.applications.length ?? 0) > 1 ? 's' : ''} atteinte${(preview?.applications.length ?? 0) > 1 ? 's' : ''} depuis la position enregistrée`
                  : 'Position non renseignée'}
              </p>

              {pumpsEnabled ? (<>
              <div className="irrigation-pump-fields">
                <label><span>Pompe <small>(facultatif)</small></span><select value={pumpId} onChange={(event) => { setPumpId(event.target.value); setPumpOriginId(''); }}><option value="">Aucune · faisabilité non vérifiée</option>{pumpDashboard.pumps.filter((pump) => pump.status === 'active').map((pump) => <option key={pump.id} value={pump.id}>{pump.name} · {decimalFormatter.format(pump.maximumFlowCubicMetersPerHour)} m³/h</option>)}</select></label>
                {selectedPump ? <label><span>Origine de l’eau <small>(facultative)</small></span><select value={selectedPumpOrigin?.id ?? ''} onChange={(event) => setPumpOriginId(event.target.value)}><option value="">Non renseignée</option>{selectedPump.origins.map((origin) => <option key={origin.id} value={origin.id}>{pumpOriginLabel(origin, pumpDashboard)}{origin.isDefault ? ' · par défaut' : ''}</option>)}</select></label> : null}
              </div>
              {selectedEquipment ? <HydraulicIndicator feasibility={hydraulicPreview} historical={creationKind === 'completed'} /> : null}
              </>) : null}

              {creationKind === 'completed' ? (
                <div className="irrigation-datetime-grid">
                  <label>
                    <span>Début réel</span>
                    <input
                      type="datetime-local"
                      value={actualStartAt}
                      onChange={(event) => setActualStartAt(event.target.value)}
                    />
                  </label>
                  <label>
                    <span>Fin réelle</span>
                    <input
                      type="datetime-local"
                      value={actualEndAt}
                      onChange={(event) => setActualEndAt(event.target.value)}
                    />
                  </label>
                </div>
              ) : (
                <>
                  {creationKind === 'planned' ? (
                    <label>
                      <span>Date et heure de début</span>
                      <input
                        type="datetime-local"
                        value={plannedStartAt}
                        onChange={(event) => setPlannedStartAt(event.target.value)}
                      />
                    </label>
                  ) : null}
                  <div className="calculation-mode" role="group" aria-label="Mode de calcul">
                    <button
                      type="button"
                      data-active={preparationMode === 'amount'}
                      onClick={() => setPreparationMode('amount')}
                    >
                      Objectif en mm
                    </button>
                    <button
                      type="button"
                      data-active={preparationMode === 'duration'}
                      onClick={() => setPreparationMode('duration')}
                    >
                      Durée d’irrigation
                    </button>
                  </div>
                  {preparationMode === 'amount' ? (
                    <>
                      <label>
                        <span>Quantité souhaitée</span>
                        <span className="input-with-unit">
                          <input
                            type="number"
                            min="0.01"
                            step="0.1"
                            inputMode="decimal"
                            value={targetMillimeters}
                            onChange={(event) => setTargetMillimeters(event.target.value)}
                          />
                          <b>mm</b>
                        </span>
                      </label>
                      {selectedEquipment?.kind === 'sprinkler' ? (
                        <label>
                          <span>Planche de référence</span>
                          <select
                            value={effectiveReferenceBedId}
                            onChange={(event) => setReferenceBedId(event.target.value)}
                          >
                            {sortByNameNaturally(preview?.applications ?? [], (application) => application.bed.name, (application) => application.bed.id).map((application) => (
                              <option key={application.bed.id} value={application.bed.id}>
                                {application.bed.name} · {formatRate(application.rateMmPerHour)}
                              </option>
                            ))}
                          </select>
                          <small>La durée est calculée pour atteindre l’objectif sur cette planche.</small>
                        </label>
                      ) : null}
                    </>
                  ) : (
                    <div className="duration-inputs">
                      <label>
                        <span>Heures</span>
                        <input
                          type="number"
                          min="0"
                          max="744"
                          step="1"
                          inputMode="numeric"
                          value={durationHours}
                          onChange={(event) => setDurationHours(event.target.value)}
                        />
                      </label>
                      <label>
                        <span>Minutes</span>
                        <input
                          type="number"
                          min="0"
                          max="59"
                          step="1"
                          inputMode="numeric"
                          value={durationMinutes}
                          onChange={(event) => setDurationMinutes(event.target.value)}
                        />
                      </label>
                    </div>
                  )}
                </>
              )}

              <label>
                <span>Note <small>(facultatif)</small></span>
                <textarea
                  value={note}
                  maxLength={500}
                  rows={2}
                  placeholder="Ex. vanne nord, pression habituelle…"
                  onChange={(event) => setNote(event.target.value)}
                />
              </label>
            </div>

            <IrrigationPreview
              equipment={selectedEquipment}
              setting={selectedSetting}
              applications={previewApplications}
              durationSeconds={previewDurationSeconds}
              volumeLiters={previewVolumeLiters}
              origin={previewOrigin}
              startKnown={previewStartKnown}
              creationKind={creationKind}
              onSubmit={submitCreation}
              pending={pending}
              warning={protectedSlotWarning}
            />
          </div>
        )}
      </div>

      <UpcomingIrrigations
        events={[...openPartialEvents, ...plannedEvents]}
        beds={beds}
        now={now}
        lateToleranceMinutes={lateToleranceMinutes}
        pending={pending}
        blockedReason={(event) => plannedIrrigationSignal(event, poseByEquipmentId.get(event.equipment.equipmentId) ?? null)}
        onRecalculatePlan={onRecalculatePlan}
        onStart={(event) => runEventAction(() => startIrrigationEventAction(event.equipment.id))}
        onEdit={editPlanned}
        onCancel={(event) => {
          if (event.status === 'partially_completed') {
            if (!window.confirm('Annuler définitivement le reliquat de cette irrigation ?')) return;
            runEventAction(() => cancelRemainingIrrigationAction(event.equipment.id));
            return;
          }
          if (!window.confirm('Annuler cette irrigation planifiée ?')) return;
          runEventAction(() => cancelPlannedIrrigationAction(event.equipment.id));
        }}
        onDoneAsPlanned={recordDoneAsPlanned}
      />

      {finishEvent ? (
        <FinishIrrigationDialog
          event={finishEvent}
          finishAt={finishAt}
          pending={pending}
          onFinishAtChange={setFinishAt}
          onCancel={() => !pending && setFinishEvent(null)}
          onConfirm={() => {
            runEventAction(async () => {
              const result = await finishIrrigationEventAction({
                eventEquipmentId: finishEvent.equipment.id,
                actualEndAt: isoFromLocalInput(finishAt),
              });
              if (result.ok) setFinishEvent(null);
              return result;
            });
          }}
        />
      ) : null}
    </section>
  );
}
