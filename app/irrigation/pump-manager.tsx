'use client';

import type { EquipmentListItem } from '@/lib/domain/equipment-record';
import type { IrrigationEventRecord } from '@/lib/domain/irrigation-event-record';
import { useEffect, useRef, useState, useTransition } from 'react';
import { notifyFeasibilityChanged, WATER_SOURCES_CHANGED } from '@/lib/domain/feasibility-notifications';
import type { PumpDashboard } from '@/lib/services/pump-dashboard';
import { findPumpCapacityConflicts, type IrrigationPump, type PumpDraft, type PumpOriginKind, type PumpUsage } from '@/lib/domain/pumps';
import {
  loadPumpDashboardAction,
  saveEquipmentDefaultPumpAction,
  savePumpAction,
  setPumpArchivedAction,
  type PumpActionResult,
} from './pump-actions';

const flow = new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 3 });

export function PumpManager({
  equipment,
  events,
  initialDashboard,
}: {
  equipment: EquipmentListItem[];
  events: IrrigationEventRecord[];
  initialDashboard: PumpDashboard;
}) {
  const [dashboard, setDashboard] = useState(initialDashboard);
  const [editor, setEditor] = useState<IrrigationPump | 'new' | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  // Une relecture en cours cède la place à toute action ou relecture plus récente.
  const latest = useRef(0);
  const run = (work: () => Promise<PumpActionResult>, close = false) => startTransition(async () => {
    latest.current += 1;
    const result = await work();
    if (!result.ok) { setError(result.message); setNotice(null); return; }
    setDashboard(result.dashboard); setNotice(result.message); setError(null);
    notifyFeasibilityChanged();
    if (close) setEditor(null);
  });
  useEffect(() => {
    // Une ressource ou une réserve changée dans le panneau des ressources : le tableau se relit au serveur, et
    // la fiche d'une pompe propose les origines telles qu'elles sont, sans recharger la page (point ouvert 60, D-093).
    const reload = () => {
      const request = ++latest.current;
      void loadPumpDashboardAction().then((result) => {
        if (request !== latest.current) return;
        if (result.ok) setDashboard(result.dashboard);
        else setError(result.message);
      }, () => { if (request === latest.current) setError('Les origines des pompes n’ont pas pu être relues. Rechargez la page.'); });
    };
    window.addEventListener(WATER_SOURCES_CHANGED, reload);
    return () => { window.removeEventListener(WATER_SOURCES_CHANGED, reload); latest.current += 1; };
  }, []);
  const sourceName = (pump: IrrigationPump, defaultOnly = false) => {
    const origins = defaultOnly ? pump.origins.filter((item) => item.isDefault) : pump.origins;
    const names = origins.map((origin) => origin.sourceKind === 'resource'
      ? dashboard.infrastructure.resources.find((item) => item.id === origin.resourceId)?.name
      : dashboard.infrastructure.reservoirs.find((item) => item.id === origin.reservoirId)?.name).filter(Boolean);
    return names.length ? names.join(', ') : 'Non renseignée';
  };
  const usages: PumpUsage[] = events.flatMap((event) => {
    const item = event.equipment;
    const requested = item.requestedFlowCubicMetersPerHour;
    if (!item.pumpId || requested === null || requested === undefined || item.timerState === 'paused') return [];
    const startsAt = item.timerState === 'running' ? item.timerResumedAt ?? item.actualStartAt ?? item.plannedStartAt : item.plannedStartAt;
    const endsAt = item.timerState === 'running' ? item.timerTheoreticalEndAt : item.plannedEndAt;
    if (!startsAt || !endsAt || (!item.timerState && !['planned', 'partially_completed'].includes(item.status))) return [];
    return [{ eventEquipmentId: item.id, label: item.equipmentSnapshot.name, pumpId: item.pumpId, startsAt, endsAt, requestedFlowCubicMetersPerHour: requested }];
  });
  return <section className="pump-section" aria-labelledby="pump-title">
    <div className="pump-heading"><div><span>Ressources en eau</span><h2 id="pump-title">Pompes d’irrigation</h2><p>Contrôlez simplement le débit disponible entre une origine d’eau et les irrigations.</p></div><button type="button" onClick={() => setEditor('new')}>+ Ajouter une pompe</button></div>
    {notice ? <p className="pump-notice">{notice}</p> : null}{error ? <p className="pump-error">{error}</p> : null}
    <div className="pump-grid">
      {dashboard.pumps.map((pump) => { const conflicts = findPumpCapacityConflicts(pump, usages); return <article className={`pump-card ${pump.status === 'archived' ? 'is-archived' : ''}`} key={pump.id}>
        <div className="pump-card-title"><div><strong>{pump.name}</strong><span>{pump.status === 'active' ? 'Active' : 'Archivée'}</span></div><button type="button" onClick={() => setEditor(pump)}>Modifier</button></div>
        <dl><dt>Débit maximal</dt><dd>{flow.format(pump.maximumFlowCubicMetersPerHour)} m³/h</dd><dt>Origine par défaut</dt><dd>{sourceName(pump, true)}</dd><dt>Origines possibles</dt><dd>{sourceName(pump)}</dd></dl>
        {pump.notes ? <p>{pump.notes}</p> : null}
        {conflicts.conflictingEventEquipmentIds.length ? <p className="pump-conflict"><strong>{conflicts.conflictingEventEquipmentIds.length} planification(s) à vérifier.</strong> Le débit cumulé atteint {flow.format(conflicts.maximumFlowCubicMetersPerHour)} m³/h pour une capacité de {flow.format(pump.maximumFlowCubicMetersPerHour)} m³/h.</p> : null}
        <button className="pump-archive" type="button" disabled={pending} onClick={() => run(() => setPumpArchivedAction({ pumpId: pump.id, archived: pump.status === 'active' }))}>{pump.status === 'active' ? 'Archiver' : 'Réactiver'}</button>
      </article>; })}
      {dashboard.pumps.length === 0 ? <p className="pump-empty"><strong>Aucune pompe configurée.</strong> Les irrigations restent possibles ; leur faisabilité hydraulique n’est simplement pas vérifiée.</p> : null}
    </div>
    {editor ? <PumpEditor pump={editor === 'new' ? null : editor} dashboard={dashboard} disabled={pending} onCancel={() => setEditor(null)} onSave={(pump) => run(() => savePumpAction({ pumpId: editor === 'new' ? null : editor.id, pump }), true)} /> : null}
    <article className="pump-defaults"><h3>Pompe habituelle du matériel</h3><p>Ce choix reste facultatif et sert uniquement de présélection.</p><div>{equipment.filter((item) => item.status === 'active').map((item) => <label key={item.id}><span>{item.name}</span><select disabled={pending} value={dashboard.equipmentDefaults.find((entry) => entry.equipmentId === item.id)?.pumpId ?? ''} onChange={(event) => run(() => saveEquipmentDefaultPumpAction({ equipmentId: item.id, pumpId: event.target.value || null }))}><option value="">Aucune pompe · non vérifié</option>{dashboard.pumps.filter((pump) => pump.status === 'active').map((pump) => <option value={pump.id} key={pump.id}>{pump.name}</option>)}</select></label>)}</div></article>
  </section>;
}

function PumpEditor({ pump, dashboard, disabled, onCancel, onSave }: { pump: IrrigationPump | null; dashboard: PumpDashboard; disabled: boolean; onCancel: () => void; onSave: (draft: PumpDraft) => void }) {
  const [name, setName] = useState(pump?.name ?? '');
  const [maximumFlow, setMaximumFlow] = useState(pump?.maximumFlowCubicMetersPerHour.toString() ?? '');
  const [notes, setNotes] = useState(pump?.notes ?? '');
  const [selected, setSelected] = useState(() => new Set(pump?.origins.map(sourceKey) ?? []));
  const [defaultKey, setDefaultKey] = useState(() => pump?.origins.find((item) => item.isDefault) ? sourceKey(pump.origins.find((item) => item.isDefault)!) : '');
  const sources = [
    ...dashboard.infrastructure.reservoirs.map((item) => ({ key: `reservoir:${item.id}`, kind: 'reservoir' as const, id: item.id, name: `${item.name} · réserve`, available: item.status === 'active' })),
    ...dashboard.infrastructure.resources.map((item) => ({ key: `resource:${item.id}`, kind: 'resource' as const, id: item.id, name: `${item.name} · ressource directe`, available: item.status === 'active' })),
  ];
  const toggle = (key: string, checked: boolean) => setSelected((current) => { const next = new Set(current); if (checked) next.add(key); else { next.delete(key); if (defaultKey === key) setDefaultKey(''); } return next; });
  return <div className="pump-dialog-backdrop"><form className="pump-editor" onSubmit={(event) => { event.preventDefault(); const origins = [...selected].map((key) => { const [kind, id] = key.split(':') as [PumpOriginKind, string]; return { sourceKind: kind, resourceId: kind === 'resource' ? id : null, reservoirId: kind === 'reservoir' ? id : null, isDefault: key === defaultKey }; }); onSave({ name, maximumFlowCubicMetersPerHour: numeric(maximumFlow), status: pump?.status ?? 'active', notes, origins }); }}>
    <div className="pump-editor-title"><h3>{pump ? 'Modifier la pompe' : 'Nouvelle pompe'}</h3><button type="button" aria-label="Fermer" onClick={onCancel}>×</button></div>
    <label><span>Nom</span><input required maxLength={100} value={name} onChange={(event) => setName(event.target.value)} /></label>
    <label><span>Débit maximal (m³/h)</span><input required inputMode="decimal" value={maximumFlow} onChange={(event) => setMaximumFlow(event.target.value)} /></label>
    <fieldset><legend>Origines possibles</legend>{sources.map((source) => <div className="pump-origin-row" key={source.key}><label><input type="checkbox" checked={selected.has(source.key)} onChange={(event) => toggle(source.key, event.target.checked)} /> {source.name}{!source.available ? ' · inactive' : ''}</label><label><input type="radio" name="default-origin" disabled={!selected.has(source.key)} checked={defaultKey === source.key} onChange={() => setDefaultKey(source.key)} /> Par défaut</label></div>)}{sources.length === 0 ? <p>Créez d’abord une ressource ou une réserve, ou enregistrez la pompe sans origine.</p> : null}</fieldset>
    <label><span>Notes facultatives</span><textarea maxLength={1000} value={notes} onChange={(event) => setNotes(event.target.value)} /></label>
    <p className="pump-editor-help">Une pompe sans origine reste utilisable : seul son débit maximal sera contrôlé.</p>
    <div className="pump-editor-actions"><button type="button" onClick={onCancel}>Annuler</button><button className="primary" disabled={disabled} type="submit">{disabled ? 'Enregistrement…' : 'Enregistrer'}</button></div>
  </form></div>;
}

function sourceKey(origin: { sourceKind: PumpOriginKind; resourceId: string | null; reservoirId: string | null }) { return `${origin.sourceKind}:${origin.sourceKind === 'resource' ? origin.resourceId : origin.reservoirId}`; }
function numeric(value: string) { return Number(value.trim().replace(',', '.')); }
