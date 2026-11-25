'use client';
import type { EquipmentPlacementRecord } from '@/lib/domain/equipment-placement-record';
import type { EquipmentListItem } from '@/lib/domain/equipment-record';
import type { GardenGroupRecord } from '@/lib/domain/garden-group-record';
import type { IrrigationEventRecord } from '@/lib/domain/irrigation-event-record';
import { MILLISECONDS_PER_HOUR, SECONDS_PER_HOUR, hoursFromSeconds } from '@/lib/domain/units';
import { FinishIrrigationDialog } from './irrigation-manager/finish-irrigation-dialog';
import { ActiveIrrigationCard } from './irrigation-manager/irrigation-cards';
import { UpcomingIrrigations } from './irrigation-manager/upcoming-irrigations';
import { ActionTab, HydraulicIndicator, IrrigationPreview } from './irrigation-manager/irrigation-form';
import { NotificationReadiness } from './irrigation-manager/notification-readiness';
import { PreparationFields } from './irrigation-manager/preparation-fields';
import {
  countLiveOverlapBeds,
  decimalFormatter,
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
import type { IrrigationEventActionResult, IrrigationEventConfirmation, IrrigationPreparationMode } from './irrigation-event/contract';
import { ActionReply, actionReply, type ActionReplyMessage } from './shell/action-reply';
import { ScheduleConflictDialog } from './irrigation-manager/schedule-conflict-dialog';
import { useConfirm } from './shell/use-confirm';
import { ObjectiveExcessDialog } from './irrigation-manager/objective-excess-dialog';
import { NO_FORM_HINTS, objectiveExcess, proposedDoseFor, type IrrigationFormHints, type ObjectiveExcess } from '@/lib/domain/irrigation-form-hints';
import { dateKeyInTimeZone } from '@/lib/domain/water-management';
import { recordDoneAsPlannedAction } from './done-as-planned-actions';
import { isLimitedAlertStatus } from '@/lib/domain/system-alerts-banner';
import { equipmentByGarden } from '@/lib/domain/equipment-by-garden';
import { finishInputText, finishValueToSend } from '@/lib/domain/finish-time';

/** Les classes de message de la section, gardées telles qu'avant le lot G. */
const REPLY_CLASSES = { notice: 'irrigation-event-notice', warning: 'irrigation-event-warning', error: 'irrigation-event-error' } as const;

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
  /** Les jardins de la ferme, pour ranger la liste « Matériel » par jardin (lot H, n° 14, F437). */
  plots?: readonly { id: string; name: string }[];
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
  /** La dose du jour proposée par le planning et les objectifs de la semaine (audit du 19 novembre 2026, lot G, n° 9). */
  formHints?: IrrigationFormHints;
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
  plots = [],
  events,
  pumpDashboard,
  pumpsEnabled,
  lateToleranceMinutes,
  onRecalculatePlan,
  protectedSlots = [],
  formHints = NO_FORM_HINTS,
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
  // Rien d'office : la dose du jour arrive avec le choix d'un matériel, sinon le champ reste vide (lot G, n° 9, F409).
  const [targetMillimeters, setTargetMillimeters] = useState('');
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
  // Chaque message porte l'endroit du geste et s'affiche sous son bouton (audit du 19 novembre 2026, lot G, n° 1, F404) :
  // « formulaire » sous « Planifier l'irrigation », « liste » en tête des irrigations à venir, « haut » pour le reste.
  const [replies, setReplies] = useState<ActionReplyMessage[]>([]);
  const [conflict, setConflict] = useState<IrrigationEventConfirmation | null>(null);
  const [excess, setExcess] = useState<ObjectiveExcess | null>(null);
  const [finishEvent, setFinishEvent] = useState<IrrigationEventRecord | null>(null);
  const [editingEventEquipmentId, setEditingEventEquipmentId] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const { confirm, dialog: confirmDialog } = useConfirm();
  // L'heure de fin proposée, à la seconde ; le champ la montre à la minute (lot K, n° 21, F472).
  const [finishPrecise, setFinishPrecise] = useState(() => localDateTimeInputValue(new Date(initialNowIso), true));
  const [finishAt, setFinishAt] = useState(() => finishInputText(finishPrecise));
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

  const say = (origin: string, tone: ActionReplyMessage['tone'], text: string | null | undefined) => {
    setReplies(text ? [actionReply(origin, tone, text)] : []);
  };
  const setTopWarning = (message: string | null) => say('haut', 'warning', message);
  const { notificationStatus, enableNotifications, disableNotifications } =
    useIrrigationNotifications({ season, now, activeEvents, setWarning: setTopWarning });

  /** Après une réussite, le formulaire se vide : rien ne se renvoie d'un second appui (F406). Les dates restent. */
  const resetCreationForm = () => {
    setEquipmentId('');
    setSettingId('');
    setReferenceBedId('');
    setPumpId('');
    setPumpOriginId('');
    setTargetMillimeters('');
    setDurationHours('1');
    setDurationMinutes('0');
    setNote('');
    setEditingEventEquipmentId(null);
  };

  /** Le jour de l'irrigation : celui de la date de début pour « Planifier », aujourd'hui sinon. */
  const irrigationDay = () => dateKeyInTimeZone(creationKind === 'planned' ? (isoFromLocalInput(plannedStartAt) ?? now) : now);

  /** La dose du jour pour ce matériel, sinon un champ vide (F409) ; une saisie n'est remplacée qu'au changement de matériel. */
  const proposeDose = (nextEquipmentId: string) => {
    const dose = proposedDoseFor(formHints.doses, nextEquipmentId, irrigationDay());
    setTargetMillimeters(dose === null ? '' : String(dose));
  };

  const submitCreation = (confirmScheduleConflict = false, confirmExcess = false) => {
    if (!selectedEquipment || !selectedSetting) {
      say('formulaire', 'error', usableEquipment.length > 0 ? 'Choisissez un matériel avant d’enregistrer une irrigation.' : 'Ajoutez, réglez et placez au moins un matériel avant d’enregistrer une irrigation.');
      return;
    }
    setReplies([]);
    setConflict(null);
    setExcess(null);
    // Au-delà de l'objectif de la semaine d'une planche : la fenêtre demande d'abord (F410). Rien à demander après coup.
    const beyond = confirmExcess || creationKind === 'completed' ? null : objectiveExcess(previewApplications, formHints.weeks, irrigationDay());
    if (beyond) {
      setExcess(beyond);
      return;
    }
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
        confirmScheduleConflict,
      };
      const result = editingEventEquipmentId
        ? await updatePlannedIrrigationAction({ ...input, kind: 'planned', eventEquipmentId: editingEventEquipmentId })
        : await createIrrigationEventAction(input);
      // Le même matériel a déjà une irrigation planifiée sur ce créneau : rien n'est écrit, la fenêtre demande (F407).
      if (!result.ok && result.confirmation) {
        setConflict(result.confirmation);
        return;
      }
      receiveActionResult(result, 'formulaire');
      if (result.ok) resetCreationForm();
    });
  };

  const receiveActionResult = (result: IrrigationEventActionResult, origin: string) => {
    if (!result.ok) {
      say(origin, 'error', result.message);
      return;
    }
    setReplies([
      actionReply(origin, 'notice', result.message),
      ...(result.warning ? [actionReply(origin, 'warning', result.warning)] : []),
    ]);
    setNote('');
    window.dispatchEvent(new CustomEvent('irrigation-events-changed'));
  };

  const runEventAction = (
    action: () => Promise<IrrigationEventActionResult>,
    origin = 'haut',
  ) => {
    setReplies([]);
    startTransition(async () => {
      receiveActionResult(await action(), origin);
    });
  };

  // « Fait comme prévu » (lot 3, point 6.5) : la règle et l'écriture de « Tout est fait », pour une ligne.
  const recordDoneAsPlanned = (event: IrrigationEventRecord) => new Promise<void>((resolve) => {
    setReplies([]);
    startTransition(async () => {
      try {
        const result = await recordDoneAsPlannedAction({ eventEquipmentIds: [event.equipment.id] });
        const refusal = result.ok ? result.refused[0] : null;
        if (result.ok && result.recorded > 0) {
          say('liste', 'notice', 'Irrigation enregistrée comme faite, telle que prévue. Elle se lit dans l’historique.');
          window.dispatchEvent(new CustomEvent('irrigation-events-changed'));
        } else {
          say('liste', 'error', refusal ? `${refusal.title} : ${refusal.reason}` : result.message);
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
    const precise = localDateTimeInputValue(suggestedEnd ? new Date(suggestedEnd) : new Date(), true);
    setFinishPrecise(precise);
    setFinishAt(finishInputText(precise));
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
    say('formulaire', 'notice', 'Modification de l’irrigation planifiée. Toutes les contraintes seront recalculées.');
    document.querySelector('.irrigation-creation-panel')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  const limitedAlerts = isLimitedAlertStatus(notificationStatus);
  const notificationReadiness = (
    <NotificationReadiness
      foldable
      status={notificationStatus}
      pending={pending}
      onEnable={() => void enableNotifications()}
      onDisable={() => void disableNotifications()}
    />
  );

  return (
    <section className="irrigation-events-section" aria-labelledby="irrigation-events-title">
      <header className="irrigation-events-heading">
        <div>
          <h2 id="irrigation-events-title">Enregistrer ou planifier une irrigation</h2>
          {/* L'explication fixe est dans le « ? » de la page (simplification S1, F826). */}
        </div>
        <div className="irrigation-event-counts" aria-label="Résumé des irrigations">
          <span><strong>{activeEvents.length}</strong> en cours</span>
          <span><strong>{plannedEvents.length + openPartialEvents.length}</strong> à venir</span>
          <span><strong>{historyEvents.length}</strong> archivées</span>
        </div>
      </header>

      {/* Un état limité vient sous le formulaire (audit final, lot E, J12, F266) ; « Recevoir les alertes » et « Alertes activées » gardent leur place. */}
      {limitedAlerts ? null : notificationReadiness}

      <ActionReply messages={replies} origin="haut" classNames={REPLY_CLASSES} />

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
        <div className="irrigation-action-tabs" data-tour="arrosage-actions" role="tablist" aria-label="Action d’irrigation">
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
            <div className="irrigation-form-fields" data-tour="arrosage-champs">
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
                    proposeDose(event.target.value);
                  }}
                >
                  <option value="" disabled>Choisissez un matériel</option>
                  {equipmentByGarden(usableEquipment, formPlacements, { plots, groups }).map((garden) => (
                    <optgroup key={garden.label} label={garden.label}>
                      {garden.items.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
                    </optgroup>
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
                  <PreparationFields
                    preparationMode={preparationMode}
                    onPreparationModeChange={setPreparationMode}
                    targetMillimeters={targetMillimeters}
                    onTargetMillimetersChange={setTargetMillimeters}
                    equipment={selectedEquipment}
                    applications={preview?.applications ?? []}
                    referenceBedId={effectiveReferenceBedId}
                    onReferenceBedIdChange={setReferenceBedId}
                    durationHours={durationHours}
                    onDurationHoursChange={setDurationHours}
                    durationMinutes={durationMinutes}
                    onDurationMinutesChange={setDurationMinutes}
                  />
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
              onSubmit={() => submitCreation()}
              pending={pending}
              warning={protectedSlotWarning}
              reply={<ActionReply messages={replies} origin="formulaire" classNames={REPLY_CLASSES} />}
            />
          </div>
        )}
      </div>

      {limitedAlerts ? notificationReadiness : null}

      <ActionReply messages={replies} origin="liste" classNames={REPLY_CLASSES} />
      <UpcomingIrrigations
        events={[...openPartialEvents, ...plannedEvents]}
        beds={beds}
        now={now}
        lateToleranceMinutes={lateToleranceMinutes}
        pending={pending}
        blockedReason={(event) => plannedIrrigationSignal(event, poseByEquipmentId.get(event.equipment.equipmentId) ?? null)}
        onRecalculatePlan={onRecalculatePlan}
        onStart={(event) => runEventAction(() => startIrrigationEventAction(event.equipment.id), 'liste')}
        onEdit={editPlanned}
        onCancel={async (event) => {
          // La fenêtre du module, en rouge, à la place de la boîte du navigateur (lot G, n° 8, F413).
          if (event.status === 'partially_completed') {
            if (!(await confirm({ title: 'Annuler ce qui reste ?', text: 'Annuler définitivement ce qui reste de cette irrigation arrêtée ?', confirmLabel: 'Annuler ce qui reste', cancelLabel: 'Garder ce qui reste' }))) return;
            runEventAction(() => cancelRemainingIrrigationAction(event.equipment.id), 'liste');
            return;
          }
          if (!(await confirm({ title: 'Annuler l’irrigation ?', text: 'Annuler cette irrigation planifiée ?', confirmLabel: 'Annuler l’irrigation', cancelLabel: 'Garder l’irrigation' }))) return;
          runEventAction(() => cancelPlannedIrrigationAction(event.equipment.id), 'liste');
        }}
        onDoneAsPlanned={recordDoneAsPlanned}
      />

      <ScheduleConflictDialog
        conflict={conflict}
        creationKind={editingEventEquipmentId ? 'edit' : creationKind}
        pending={pending}
        onConfirm={() => submitCreation(true, true)}
        onCancel={() => setConflict(null)}
      />

      {confirmDialog}

      <ObjectiveExcessDialog
        excess={excess}
        kind={editingEventEquipmentId ? 'edit' : creationKind === 'planned' ? 'planned' : 'running'}
        pending={pending}
        onConfirm={() => submitCreation(false, true)}
        onCancel={() => setExcess(null)}
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
                actualEndAt: isoFromLocalInput(finishValueToSend(finishAt, finishPrecise)),
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
