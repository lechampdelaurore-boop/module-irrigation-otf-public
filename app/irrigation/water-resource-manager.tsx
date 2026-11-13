'use client';
import { millisecondsFromMinutes } from '@/lib/domain/units';

import { useState, useTransition } from 'react';
import { notifyFeasibilityChanged, notifyWaterSourcesChanged } from '@/lib/domain/feasibility-notifications';
import {
  formatIrrigationDateTime,
  formatIrrigationDateTimeInput,
} from '@/lib/domain/irrigation-format';
import type { WaterResourceDashboard } from '@/lib/services/water-resource-dashboard';
import type {
  IrrigationSupplyDefault,
  WaterReservoir,
  WaterReservoirDraft,
  WaterResource,
  WaterResourceDraft,
} from '@/lib/domain/water-resources';
import { availableAfterPlanningOrigin } from '@/lib/domain/reservoir-origin';
import { reservoirAnchor } from '@/lib/domain/today/reliability';
import { ResourceFlowPanel } from './resource-flow-panel';
import { FigureOrigin } from './shell/figure-origin';
import {
  applyResourceFlowAction,
  correctWaterReservoirVolumeAction,
  deleteResourceMeterReadingAction,
  loadWaterResourceDashboardAction,
  saveDefaultWaterSupplyAction,
  saveReservoirLinkAction,
  saveResourceReservoirLinkAction,
  saveWaterReservoirAction,
  saveResourceMeterReadingAction,
  saveWaterResourceAction,
  type WaterResourceActionResult,
} from './water-resource-actions';

const volume = new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 3 });

const resourceTypes: Array<[WaterResource['type'], string]> = [
  ['borehole', 'Forage'], ['well', 'Puits'], ['spring', 'Source'], ['network', 'Réseau d’eau'],
  ['catchment', 'Captage'], ['river', 'Rivière'], ['other', 'Autre'],
];
const reservoirTypes: Array<[WaterReservoir['type'], string]> = [
  ['buffer', 'Réserve tampon'], ['pond', 'Bassin'], ['cistern', 'Citerne'],
  ['tank', 'Cuve'], ['reservoir', 'Retenue'], ['other', 'Autre'],
];

export function WaterResourceManager({
  season,
  initialNowIso,
  initialDashboard,
}: {
  season: number;
  initialNowIso: string;
  initialDashboard: WaterResourceDashboard;
}) {
  const [dashboard, setDashboard] = useState(initialDashboard);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const [resourceEditor, setResourceEditor] = useState<WaterResource | 'new' | null>(null);
  const [reservoirEditor, setReservoirEditor] = useState<WaterReservoir | 'new' | null>(null);
  const [correctionReservoir, setCorrectionReservoir] = useState<WaterReservoir | null>(null);
  const [flowResourceId, setFlowResourceId] = useState<string | null>(null);
  const [customEndsAt, setCustomEndsAt] = useState(() => formatIrrigationDateTimeInput(
    initialDashboard.projectionEndsAt,
    initialDashboard.timeZone,
  ));
  const initialProjectionMinimum = formatIrrigationDateTimeInput(
    initialNowIso,
    initialDashboard.timeZone,
  );
  const infrastructure = dashboard.infrastructure;
  const flowResource = infrastructure.resources.find((item) => item.id === flowResourceId) ?? null;

  const run = (work: () => Promise<WaterResourceActionResult>, onSuccess?: () => void) => {
    startTransition(async () => {
      const result = await work();
      if (!result.ok) {
        setError(result.message);
        setNotice(null);
        return;
      }
      setDashboard(result.dashboard);
      notifyFeasibilityChanged();
      // La fiche d'une pompe propose les ressources et les réserves telles qu'elles sont (point ouvert 60, D-093).
      notifyWaterSourcesChanged();
      setNotice(result.message);
      setError(null);
      onSuccess?.();
    });
  };

  const projectionInput = (horizon = dashboard.horizon) => {
    const customDate = new Date(customEndsAt);
    return {
      season,
      horizon,
      customEndsAt: horizon === 'custom' && Number.isFinite(customDate.getTime())
        ? customDate.toISOString()
        : null,
    };
  };

  return (
    <section className="water-resources-section" aria-labelledby="water-resources-title">
      <header className="water-resources-heading">
        <div>
          <p className="eyebrow">Disponibilité physique</p>
          <h2 id="water-resources-title">Ressources en eau</h2>
          <p>Origines, réserves, connexions et estimation du volume mobilisable.</p>
        </div>
      </header>

      {notice ? <p className="water-notice" role="status">{notice}</p> : null}
      {error ? <p className="water-error" role="alert">{error}</p> : null}

      <div className="water-assets-columns">
        <article className="water-asset-panel">
          <div className="water-asset-title"><div><h3>Ressources</h3><p>D’où arrive l’eau.</p></div><button type="button" onClick={() => setResourceEditor('new')}>+ Ajouter</button></div>
          {infrastructure.resources.length === 0 ? <Empty text="Aucune ressource enregistrée." /> : (
            <div className="water-asset-list">{infrastructure.resources.map((resource) => {
              const limit = dashboard.latestLimitByResource[resource.id];
              const fed = infrastructure.resourceReservoirLinks.filter((link) => link.resourceId === resource.id && link.active);
              return <div className="water-asset-card" key={resource.id}>
                <div className="water-asset-card-title"><div><strong>{resource.name}</strong><span>{labelOf(resourceTypes, resource.type)}</span></div><div className="water-card-actions"><button type="button" onClick={() => { setFlowResourceId(resource.id); setNotice(null); setError(null); }}>Relevés de débit</button><button type="button" onClick={() => setResourceEditor(resource)}>Modifier</button></div></div>
                <dl><Metric term="Débit" value={`${volume.format(resource.nominalFlowCubicMetersPerHour)} m³/h`} /><Metric term="État" value={resource.status === 'active' ? 'Disponible' : 'Indisponible'} /><Metric term="Limite" value={limit?.enabled ? `${volume.format(limit.maxCubicMetersPerDay ?? 0)} m³/j` : 'Aucune'} /><Metric term="Alimente" value={fed.length ? fed.map((link) => infrastructure.reservoirs.find((item) => item.id === link.reservoirId)?.name).filter(Boolean).join(', ') : 'Aucune réserve'} /></dl>
                {resource.availableFrom || resource.availableUntil ? <small>Disponible du {resource.availableFrom ?? 'début'} au {resource.availableUntil ?? 'sans fin'}.</small> : null}
              </div>;
            })}</div>
          )}
        </article>

        <article className="water-asset-panel" data-tour="ressources-reserves">
          <div className="water-asset-title"><div><h3>Réserves</h3><p>Où l’eau est stockée.</p></div><button type="button" onClick={() => setReservoirEditor('new')}>+ Ajouter</button></div>
          {infrastructure.reservoirs.length === 0 ? <Empty text="Aucune réserve enregistrée." /> : (
            <div className="water-asset-list">{infrastructure.reservoirs.map((reservoir) => {
              const supplied = infrastructure.resourceReservoirLinks.filter((link) => link.reservoirId === reservoir.id && link.active);
              const todayEvaporation = dashboard.todayEstimatedEvaporationByReservoir[reservoir.id];
              const latestCorrection = infrastructure.movements
                .filter((movement) => movement.reservoirId === reservoir.id && movement.kind === 'manual_correction')
                .sort((left, right) => right.occurredAt.localeCompare(left.occurredAt))[0];
              return <div className="water-asset-card" key={reservoir.id} id={reservoirAnchor(reservoir.id)}>
                <div className="water-asset-card-title"><div><strong>{reservoir.name}</strong><span>{labelOf(reservoirTypes, reservoir.type)}</span></div><div className="water-card-actions"><button type="button" onClick={() => setCorrectionReservoir(reservoir)}>Corriger le volume</button><button type="button" onClick={() => setReservoirEditor(reservoir)}>Modifier</button></div></div>
                <dl><Metric term="Actuel" value={reservoir.currentVolumeCubicMeters === null ? 'Non renseigné' : `${volume.format(reservoir.currentVolumeCubicMeters)} m³`} /><Metric term="Capacité" value={`${volume.format(reservoir.capacityCubicMeters)} m³`} /><Metric term="Mobilisable" value={reservoir.currentVolumeCubicMeters === null ? 'Non calculable' : `${volume.format(Math.max(0, reservoir.currentVolumeCubicMeters - reservoir.minimumSafetyCubicMeters))} m³`} /><Metric term="Minimum" value={`${volume.format(reservoir.minimumSafetyCubicMeters)} m³`} /><Metric term="Pluie" value={reservoir.receivesRain ? 'Reçue' : 'Non reçue'} /><Metric term="Perte estimée aujourd’hui" value={!reservoir.evaporationEnabled ? 'Désactivée' : todayEvaporation === null ? 'ET0 indisponible' : `${volume.format(todayEvaporation)} m³`} /><Metric term="Alimentée par" value={supplied.length ? supplied.map((link) => infrastructure.resources.find((item) => item.id === link.resourceId)?.name).filter(Boolean).join(', ') : 'Aucune ressource'} /></dl>
                {reservoir.currentVolumeObservedAt ? <small>Volume observé le {formatIrrigationDateTime(reservoir.currentVolumeObservedAt, dashboard.timeZone)}.</small> : null}
                {latestCorrection ? <small>Dernière correction tracée : {latestCorrection.previousVolumeCubicMeters === null ? 'non renseigné' : `${volume.format(latestCorrection.previousVolumeCubicMeters)} m³`} → {latestCorrection.resultingVolumeCubicMeters === null ? 'non renseigné' : `${volume.format(latestCorrection.resultingVolumeCubicMeters)} m³`}, le {formatIrrigationDateTime(latestCorrection.occurredAt, dashboard.timeZone)}{latestCorrection.reason ? ` · ${latestCorrection.reason}` : ''}.</small> : null}
              </div>;
            })}</div>
          )}
        </article>
      </div>

      {resourceEditor ? <ResourceEditor resource={resourceEditor === 'new' ? null : resourceEditor} dashboard={dashboard} disabled={pending} onCancel={() => setResourceEditor(null)} onSave={(resource, limit) => run(() => saveWaterResourceAction({ ...projectionInput(), resourceId: resourceEditor === 'new' ? null : resourceEditor.id, resource, limit }), () => setResourceEditor(null))} /> : null}
      {reservoirEditor ? <ReservoirEditor reservoir={reservoirEditor === 'new' ? null : reservoirEditor} disabled={pending} onCancel={() => setReservoirEditor(null)} onSave={(reservoir) => run(() => saveWaterReservoirAction({ ...projectionInput(), reservoirId: reservoirEditor === 'new' ? null : reservoirEditor.id, reservoir }), () => setReservoirEditor(null))} /> : null}
      {correctionReservoir ? <VolumeCorrection reservoir={correctionReservoir} disabled={pending} onCancel={() => setCorrectionReservoir(null)} onSave={(volumeCubicMeters, observedAt, reason) => run(() => correctWaterReservoirVolumeAction({ ...projectionInput(), reservoirId: correctionReservoir.id, volumeCubicMeters, observedAt, reason }), () => setCorrectionReservoir(null))} /> : null}
      {flowResource ? <ResourceFlowPanel resource={flowResource} entry={dashboard.flowHistory[flowResource.id] ?? { readings: [], measurements: [], revisions: [] }} timeZone={dashboard.timeZone} nowIso={initialNowIso} authorisedCubicMetersPerDay={dashboard.latestLimitByResource[flowResource.id]?.enabled ? dashboard.latestLimitByResource[flowResource.id]?.maxCubicMetersPerDay ?? null : null} pending={pending} notice={notice} error={error} onClose={() => setFlowResourceId(null)} onSubmit={(input, onSuccess) => run(() => saveResourceMeterReadingAction({ ...projectionInput(), resourceId: flowResource.id, ...input }), onSuccess)} onDelete={(readingId) => run(() => deleteResourceMeterReadingAction({ ...projectionInput(), readingId }))} onApply={(measurement) => run(() => applyResourceFlowAction({ ...projectionInput(), resourceId: flowResource.id, fromReadingId: measurement.fromReadingId, toReadingId: measurement.toReadingId }))} /> : null}

      <article className="water-links-panel">
        <div className="water-asset-title"><div><h3>Liaisons</h3><p>Les connexions décrivent la topologie, sans pompe ni pression.</p></div></div>
        <div className="water-link-forms">
          <ResourceLinkForm dashboard={dashboard} disabled={pending} onSave={(link) => run(() => saveResourceReservoirLinkAction({ ...projectionInput(), link }))} />
          <ReservoirLinkForm dashboard={dashboard} disabled={pending} onSave={(link) => run(() => saveReservoirLinkAction({ ...projectionInput(), link }))} />
          <DefaultSupplyForm dashboard={dashboard} disabled={pending} onSave={(supply) => run(() => saveDefaultWaterSupplyAction({ ...projectionInput(), supply }))} />
        </div>
        <div className="water-network-view">
          {infrastructure.resourceReservoirLinks.map((link) => <Connection key={link.id} source={infrastructure.resources.find((item) => item.id === link.resourceId)?.name ?? 'Ressource'} target={infrastructure.reservoirs.find((item) => item.id === link.reservoirId)?.name ?? 'Réserve'} detail={`${link.fillMode === 'automatic' ? 'Automatique / continu' : 'Manuel'}${link.active ? '' : ' · inactive'}`} active={link.active} disabled={pending} onToggle={() => run(() => saveResourceReservoirLinkAction({ ...projectionInput(), link: { ...link, active: !link.active } }))} />)}
          {infrastructure.reservoirLinks.map((link) => <Connection key={link.id} source={infrastructure.reservoirs.find((item) => item.id === link.upstreamReservoirId)?.name ?? 'Réserve'} target={infrastructure.reservoirs.find((item) => item.id === link.downstreamReservoirId)?.name ?? 'Réserve'} detail={`Connexion existante · transfert à caractériser en 3.2${link.active ? '' : ' · inactive'}`} active={link.active} disabled={pending} onToggle={() => run(() => saveReservoirLinkAction({ ...projectionInput(), link: { ...link, active: !link.active } }))} />)}
          {infrastructure.resourceReservoirLinks.length + infrastructure.reservoirLinks.length === 0 ? <Empty text="Aucune liaison enregistrée." /> : null}
        </div>
      </article>

      <article className="water-projection-panel">
        <div className="water-projection-heading"><div><h3>Disponibilité / projections</h3><p>Estimation à partir du stock observé, des apports potentiels, de la météo et des irrigations déjà planifiées.</p></div><div className="projection-shortcuts" aria-label="Horizon de projection">{(['24h', '48h', '7d'] as const).map((horizon) => <button type="button" className={dashboard.horizon === horizon ? 'is-active' : ''} disabled={pending} key={horizon} onClick={() => run(() => loadWaterResourceDashboardAction(projectionInput(horizon)))}>{horizon === '7d' ? '7 jours' : horizon.replace('h', ' h')}</button>)}<label><span>Date personnalisée</span><input type="datetime-local" value={customEndsAt} min={initialProjectionMinimum} onChange={(event) => setCustomEndsAt(event.target.value)} /></label><button type="button" disabled={pending} onClick={() => run(() => loadWaterResourceDashboardAction(projectionInput('custom')))}>Calculer</button></div></div>
        <p className="projection-date">Projection jusqu’au {formatIrrigationDateTime(dashboard.projectionEndsAt, dashboard.timeZone)}. Les valeurs futures restent des estimations.</p>
        {dashboard.projection.unassignedPlannedCubicMeters > 0 ? <p className="projection-warning">Consommations planifiées non affectées : {volume.format(dashboard.projection.unassignedPlannedCubicMeters)} m³. Aucune provenance n’a été devinée.</p> : null}
        <div className="projection-grid">
          {dashboard.projection.reservoirs.map((projection) => {
            const reservoir = infrastructure.reservoirs.find((item) => item.id === projection.reservoirId);
            if (!reservoir) return null;
            return <div className="projection-card" key={projection.reservoirId}><div><span>Projection</span><h4>{reservoir.name}</h4></div>
              {projection.startVolumeCubicMeters === null ? <p className="projection-unknown"><strong>Volume actuel non renseigné</strong>Les projections de stock absolu ne peuvent pas être calculées précisément.</p> : <dl><Metric term="Stock actuel" value={`${volume.format(projection.startVolumeCubicMeters)} m³`} /><Metric term="Apports automatiques potentiels" value={`+ ${volume.format(projection.automaticPotentialCubicMeters)} m³`} /><Metric term="Pluie prévue" value={`+ ${volume.format(projection.forecastRainCubicMeters)} m³`} /><Metric term="Perte estimée par évaporation" value={`− ${volume.format(projection.estimatedEvaporationCubicMeters)} m³`} /><Metric term="Apport non retenu (réserve pleine)" value={`${volume.format(projection.capacityLimitedCubicMeters ?? 0)} m³`} /><Metric term="Disponible théorique" value={`${volume.format(projection.theoreticalMobilizableCubicMeters ?? 0)} m³ mobilisables`} /><Metric term="Irrigations déjà planifiées" value={`− ${volume.format(projection.plannedConsumptionCubicMeters)} m³`} /><Metric term="Disponible après planification" value={`${volume.format(projection.afterPlanningMobilizableCubicMeters ?? 0)} m³ mobilisables`} origin={availableAfterPlanningOrigin(projection, reservoir.minimumSafetyCubicMeters)} /></dl>}
              {projection.manualPotentialCubicMeters > 0 ? <small>Potentiel manuel non compté : {volume.format(projection.manualPotentialCubicMeters)} m³.</small> : null}
              {projection.sharedResourceIds.length > 0 ? <small>Une ressource alimente plusieurs réserves : son apport n’est pas réparti arbitrairement.</small> : null}
              {projection.uncharacterizedTransferCount > 0 ? <small>{projection.uncharacterizedTransferCount} connexion de réserve ignorée dans le calcul tant que son débit n’est pas caractérisé.</small> : null}
              {projection.missingEt0Dates.length > 0 ? <small>ET0 manquante pour {projection.missingEt0Dates.length} jour(s) : l’évaporation correspondante reste inconnue.</small> : null}
              {projection.safetyMinimumExceededByCubicMeters > 0 ? <p className="projection-warning">Minimum de sécurité franchi de {volume.format(projection.safetyMinimumExceededByCubicMeters)} m³.</p> : null}
            </div>;
          })}
          {dashboard.projection.directSupply ? <div className="projection-card"><div><span>Projection · alimentation directe</span><h4>{infrastructure.resources.find((item) => item.id === dashboard.projection.directSupply?.resourceId)?.name}</h4></div><dl><Metric term="Disponibilité théorique" value={`${volume.format(dashboard.projection.directSupply.theoreticalCubicMeters)} m³`} /><Metric term="Irrigations planifiées" value={`− ${volume.format(dashboard.projection.directSupply.plannedConsumptionCubicMeters)} m³`} /><Metric term="Après planification" value={dashboard.projection.directSupply.afterPlanningCubicMeters === null ? 'Non calculable' : `${volume.format(dashboard.projection.directSupply.afterPlanningCubicMeters)} m³`} /></dl></div> : null}
          {infrastructure.reservoirs.length === 0 && !dashboard.projection.directSupply ? <Empty text="Créez une ressource ou une réserve pour obtenir une projection." /> : null}
        </div>
      </article>
    </section>
  );
}

function ResourceEditor({ resource, dashboard, disabled, onCancel, onSave }: { resource: WaterResource | null; dashboard: WaterResourceDashboard; disabled: boolean; onCancel: () => void; onSave: (resource: WaterResourceDraft, limit: Parameters<typeof saveWaterResourceAction>[0]['limit']) => void }) {
  const latest = resource ? dashboard.latestLimitByResource[resource.id] : null;
  const [name, setName] = useState(resource?.name ?? ''); const [type, setType] = useState<WaterResource['type']>(resource?.type ?? 'borehole'); const [flow, setFlow] = useState(resource?.nominalFlowCubicMetersPerHour.toString() ?? ''); const [status, setStatus] = useState<WaterResource['status']>(resource?.status ?? 'active'); const [from, setFrom] = useState(resource?.availableFrom ?? ''); const [until, setUntil] = useState(resource?.availableUntil ?? ''); const [notes, setNotes] = useState(resource?.notes ?? ''); const [limitEnabled, setLimitEnabled] = useState(latest?.enabled ?? false); const [limitAmount, setLimitAmount] = useState(latest?.maxCubicMetersPerDay?.toString() ?? ''); const [limitFrom, setLimitFrom] = useState(latest?.validFrom ?? new Date().toISOString().slice(0, 10)); const [limitUntil, setLimitUntil] = useState(latest?.validUntil ?? ''); const [limitNote, setLimitNote] = useState(latest?.referenceNote ?? '');
  return <form className="water-editor" onSubmit={(event) => { event.preventDefault(); onSave({ name, type, nominalFlowCubicMetersPerHour: numeric(flow), status, availableFrom: from || null, availableUntil: until || null, notes }, { enabled: limitEnabled, maxCubicMetersPerDay: limitEnabled ? numeric(limitAmount) : null, validFrom: limitFrom, validUntil: limitUntil || null, referenceNote: limitNote || null }); }}><h3>{resource ? 'Modifier la ressource' : 'Nouvelle ressource'}</h3><div className="water-editor-grid"><TextField label="Nom" value={name} onChange={setName} /><SelectField label="Type" value={type} onChange={(value) => setType(value as WaterResource['type'])} options={resourceTypes} /><TextField label="Débit nominal (m³/h)" value={flow} onChange={setFlow} decimal /><SelectField label="État" value={status} onChange={(value) => setStatus(value as WaterResource['status'])} options={[["active", "Disponible"], ["inactive", "Indisponible"]]} /><DateField label="Disponible à partir du" value={from} onChange={setFrom} /><DateField label="Disponible jusqu’au" value={until} onChange={setUntil} /><TextField label="Notes facultatives" value={notes} onChange={setNotes} /></div><fieldset><legend>Limite de prélèvement distincte de la limite d’irrigation</legend><label className="water-toggle"><input type="checkbox" checked={limitEnabled} onChange={(event) => setLimitEnabled(event.target.checked)} /> Activer une limite en m³/jour</label><div className="water-editor-grid"><TextField label="Maximum (m³/jour)" value={limitAmount} onChange={setLimitAmount} decimal disabled={!limitEnabled} /><DateField label="Du" value={limitFrom} onChange={setLimitFrom} disabled={!limitEnabled} /><DateField label="Au (facultatif)" value={limitUntil} onChange={setLimitUntil} disabled={!limitEnabled} /><TextField label="Référence / note" value={limitNote} onChange={setLimitNote} disabled={!limitEnabled} /></div></fieldset><EditorActions disabled={disabled} onCancel={onCancel} /></form>;
}

function ReservoirEditor({ reservoir, disabled, onCancel, onSave }: { reservoir: WaterReservoir | null; disabled: boolean; onCancel: () => void; onSave: (reservoir: WaterReservoirDraft) => void }) {
  const [name, setName] = useState(reservoir?.name ?? ''); const [type, setType] = useState<WaterReservoir['type']>(reservoir?.type ?? 'buffer'); const [capacity, setCapacity] = useState(reservoir?.capacityCubicMeters.toString() ?? ''); const [current, setCurrent] = useState(reservoir?.currentVolumeCubicMeters?.toString() ?? ''); const [unknown, setUnknown] = useState(reservoir ? reservoir.currentVolumeCubicMeters === null : true); const [minimum, setMinimum] = useState(reservoir?.minimumSafetyCubicMeters.toString() ?? '0'); const [surface, setSurface] = useState(reservoir?.exposedSurfaceSquareMeters.toString() ?? '0'); const [rain, setRain] = useState(reservoir?.receivesRain ?? false); const [evaporation, setEvaporation] = useState(reservoir?.evaporationEnabled ?? false); const [coefficient, setCoefficient] = useState(reservoir?.evaporationCoefficient.toString() ?? '1'); const [status, setStatus] = useState<WaterReservoir['status']>(reservoir?.status ?? 'active'); const [notes, setNotes] = useState(reservoir?.notes ?? '');
  return <form className="water-editor" onSubmit={(event) => { event.preventDefault(); onSave({ name, type, capacityCubicMeters: numeric(capacity), currentVolumeCubicMeters: reservoir ? reservoir.currentVolumeCubicMeters : unknown ? null : numeric(current), minimumSafetyCubicMeters: numeric(minimum), exposedSurfaceSquareMeters: numeric(surface), receivesRain: rain, evaporationEnabled: evaporation, evaporationCoefficient: numeric(coefficient), status, notes }); }}><h3>{reservoir ? 'Modifier la réserve' : 'Nouvelle réserve'}</h3><div className="water-editor-grid"><TextField label="Nom" value={name} onChange={setName} /><SelectField label="Type" value={type} onChange={(value) => setType(value as WaterReservoir['type'])} options={reservoirTypes} /><TextField label="Capacité maximale (m³)" value={capacity} onChange={setCapacity} decimal /><TextField label="Minimum de sécurité (m³)" value={minimum} onChange={setMinimum} decimal /><TextField label="Surface d’eau exposée (m²)" value={surface} onChange={setSurface} decimal /><TextField label="Coefficient d’évaporation" value={coefficient} onChange={setCoefficient} decimal disabled={!evaporation} /><SelectField label="État" value={status} onChange={(value) => setStatus(value as WaterReservoir['status'])} options={[["active", "Active"], ["inactive", "Inactive"]]} /><TextField label="Notes facultatives" value={notes} onChange={setNotes} /></div>{!reservoir ? <fieldset><legend>Volume actuel</legend><label className="water-toggle"><input type="checkbox" checked={unknown} onChange={(event) => setUnknown(event.target.checked)} /> Volume non renseigné</label><TextField label="Volume observé (m³)" value={current} onChange={setCurrent} decimal disabled={unknown} /></fieldset> : <p className="water-editor-help">Le volume actuel se modifie avec « Corriger le volume » afin de conserver une trace.</p>}<fieldset><legend>Pertes et apports météorologiques</legend><label className="water-toggle"><input type="checkbox" checked={rain} onChange={(event) => setRain(event.target.checked)} /> Reçoit la pluie</label><label className="water-toggle"><input type="checkbox" checked={evaporation} onChange={(event) => setEvaporation(event.target.checked)} /> Estimer la perte par évaporation à partir de l’ET0</label></fieldset><EditorActions disabled={disabled} onCancel={onCancel} /></form>;
}

function VolumeCorrection({ reservoir, disabled, onCancel, onSave }: { reservoir: WaterReservoir; disabled: boolean; onCancel: () => void; onSave: (volume: number, at: string, reason: string) => void }) {
  const [value, setValue] = useState(''); const [observedAt, setObservedAt] = useState(toLocalInput(new Date())); const [reason, setReason] = useState('');
  return <form className="water-editor" onSubmit={(event) => { event.preventDefault(); onSave(numeric(value), new Date(observedAt).toISOString(), reason); }}><h3>Corriger le volume de {reservoir.name}</h3><p>Ancien volume : {reservoir.currentVolumeCubicMeters === null ? 'Non renseigné' : `${volume.format(reservoir.currentVolumeCubicMeters)} m³`} · capacité : {volume.format(reservoir.capacityCubicMeters)} m³.</p><div className="water-editor-grid"><TextField label="Nouveau volume observé (m³)" value={value} onChange={setValue} decimal /><label><span>Date et heure</span><input type="datetime-local" max={toLocalInput(new Date())} value={observedAt} onChange={(event) => setObservedAt(event.target.value)} required /></label><label><span>Motif facultatif</span><select value={reason} onChange={(event) => setReason(event.target.value)}><option value="">Non renseigné</option><option>Mesure visuelle</option><option>Jauge</option><option>Remplissage manuel</option><option>Correction d’inventaire</option><option>Autre</option></select></label></div><EditorActions disabled={disabled} onCancel={onCancel} /></form>;
}

function ResourceLinkForm({ dashboard, disabled, onSave }: { dashboard: WaterResourceDashboard; disabled: boolean; onSave: (link: { resourceId: string; reservoirId: string; fillMode: 'automatic' | 'manual'; active: boolean }) => void }) { const [resourceId, setResourceId] = useState(''); const [reservoirId, setReservoirId] = useState(''); const [mode, setMode] = useState<'automatic' | 'manual'>('automatic'); return <form className="water-link-form" onSubmit={(event) => { event.preventDefault(); onSave({ resourceId, reservoirId, fillMode: mode, active: true }); }}><h4>Ressource → réserve</h4><select aria-label="Ressource" required value={resourceId} onChange={(event) => setResourceId(event.target.value)}><option value="">Choisir une ressource</option>{dashboard.infrastructure.resources.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select><select aria-label="Réserve destinataire" required value={reservoirId} onChange={(event) => setReservoirId(event.target.value)}><option value="">Choisir une réserve</option>{dashboard.infrastructure.reservoirs.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select><select aria-label="Mode de remplissage" value={mode} onChange={(event) => setMode(event.target.value as typeof mode)}><option value="automatic">Automatique / continu</option><option value="manual">Manuel</option></select><button type="submit" disabled={disabled || !resourceId || !reservoirId}>Relier</button></form>; }
function ReservoirLinkForm({ dashboard, disabled, onSave }: { dashboard: WaterResourceDashboard; disabled: boolean; onSave: (link: { upstreamReservoirId: string; downstreamReservoirId: string; transferMode: 'automatic' | 'manual'; active: boolean }) => void }) { const [upstream, setUpstream] = useState(''); const [downstream, setDownstream] = useState(''); const [mode, setMode] = useState<'automatic' | 'manual'>('manual'); return <form className="water-link-form" onSubmit={(event) => { event.preventDefault(); onSave({ upstreamReservoirId: upstream, downstreamReservoirId: downstream, transferMode: mode, active: true }); }}><h4>Réserve → réserve</h4><select aria-label="Réserve source" required value={upstream} onChange={(event) => setUpstream(event.target.value)}><option value="">Réserve source</option>{dashboard.infrastructure.reservoirs.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select><select aria-label="Réserve destinataire" required value={downstream} onChange={(event) => setDownstream(event.target.value)}><option value="">Réserve destinataire</option>{dashboard.infrastructure.reservoirs.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select><select aria-label="Mode de transfert" value={mode} onChange={(event) => setMode(event.target.value as typeof mode)}><option value="manual">Manuel</option><option value="automatic">Automatique</option></select><button type="submit" disabled={disabled || !upstream || !downstream}>Relier</button><small>Les débits de transfert détaillés ne sont pas encore renseignés.</small></form>; }
function DefaultSupplyForm({ dashboard, disabled, onSave }: { dashboard: WaterResourceDashboard; disabled: boolean; onSave: (supply: IrrigationSupplyDefault | null) => void }) { const initial = dashboard.infrastructure.defaultSupply ? dashboard.infrastructure.defaultSupply.sourceKind === 'resource' ? `resource:${dashboard.infrastructure.defaultSupply.resourceId}` : `reservoir:${dashboard.infrastructure.defaultSupply.reservoirId}` : ''; const [value, setValue] = useState(initial); return <form className="water-link-form" onSubmit={(event) => { event.preventDefault(); const [kind, id] = value.split(':'); onSave(!value ? null : kind === 'resource' ? { sourceKind: 'resource', resourceId: id, reservoirId: null } : { sourceKind: 'reservoir', resourceId: null, reservoirId: id }); }}><h4>Alimentation d’irrigation par défaut</h4><select aria-label="Alimentation par défaut" value={value} onChange={(event) => setValue(event.target.value)}><option value="">Aucune · ne pas affecter</option><optgroup label="Ressources directes">{dashboard.infrastructure.resources.map((item) => <option key={item.id} value={`resource:${item.id}`}>{item.name}</option>)}</optgroup><optgroup label="Réserves">{dashboard.infrastructure.reservoirs.map((item) => <option key={item.id} value={`reservoir:${item.id}`}>{item.name}</option>)}</optgroup></select><button type="submit" disabled={disabled}>Enregistrer</button><small>Ce choix permet notamment d’afficher une projection directe. Chaque irrigation utilise son origine enregistrée ; sans origine, son volume reste réservé globalement.</small></form>; }

function Connection({ source, target, detail, active, disabled, onToggle }: { source: string; target: string; detail: string; active: boolean; disabled: boolean; onToggle: () => void }) { return <div className="water-connection"><strong>{source}</strong><span aria-hidden="true">↓</span><strong>{target}</strong><small>{detail}</small><button type="button" disabled={disabled} onClick={onToggle}>{active ? 'Désactiver' : 'Réactiver'}</button></div>; }
function Metric({ term, value, origin = null }: { term: string; value: string; origin?: string | null }) { return <><dt>{term}</dt><dd>{value}<FigureOrigin text={origin} /></dd></>; }
function Empty({ text }: { text: string }) { return <p className="water-empty">{text}</p>; }
function EditorActions({ disabled, onCancel }: { disabled: boolean; onCancel: () => void }) { return <div className="water-editor-actions"><button type="button" onClick={onCancel}>Annuler</button><button className="primary" type="submit" disabled={disabled}>{disabled ? 'Enregistrement…' : 'Enregistrer'}</button></div>; }
function TextField({ label, value, onChange, decimal = false, disabled = false }: { label: string; value: string; onChange: (value: string) => void; decimal?: boolean; disabled?: boolean }) { return <label><span>{label}</span><input disabled={disabled} inputMode={decimal ? 'decimal' : undefined} value={value} onChange={(event) => onChange(event.target.value)} required={!disabled && !label.includes('facultative') && !label.includes('Référence')} /></label>; }
function DateField({ label, value, onChange, disabled = false }: { label: string; value: string; onChange: (value: string) => void; disabled?: boolean }) { return <label><span>{label}</span><input type="date" disabled={disabled} value={value} onChange={(event) => onChange(event.target.value)} /></label>; }
function SelectField({ label, value, onChange, options }: { label: string; value: string; onChange: (value: string) => void; options: Array<readonly [string, string]> }) { return <label><span>{label}</span><select value={value} onChange={(event) => onChange(event.target.value)}>{options.map(([key, text]) => <option key={key} value={key}>{text}</option>)}</select></label>; }
function labelOf<T extends string>(options: Array<[T, string]>, value: T) { return options.find(([key]) => key === value)?.[1] ?? value; }
function numeric(value: string) { return value.trim() ? Number(value.trim().replace(',', '.')) : Number.NaN; }
function toLocalInput(value: Date) { const local = new Date(value.getTime() - millisecondsFromMinutes(value.getTimezoneOffset())); return local.toISOString().slice(0, 16); }
