'use client';

import { useCallback, useEffect, useId, useRef, useState } from 'react';
import { priorityLabel, type AllocationStatus, type IrrigationFeasibility, type PriorityFeasibility } from '@/lib/domain/irrigation-feasibility';
import { notifyFeasibilityChanged } from '@/lib/domain/feasibility-notifications';
import { loadIrrigationFeasibilityAction, saveIrrigationArbitrationAction, type FeasibilityActionResult } from './irrigation-feasibility-actions';

const number = new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 2 });
const decimalVolume = new Intl.NumberFormat('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 3 });
const dates = new Intl.DateTimeFormat('fr-FR', { dateStyle: 'short', timeStyle: 'short', timeZone: 'Europe/Paris' });
const jours = new Intl.DateTimeFormat('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric', timeZone: 'Europe/Paris' });
/** Midi UTC : la date métier ne doit pas glisser d'un jour selon le fuseau. */
const jour = (cle: string) => jours.format(new Date(`${cle}T12:00:00Z`));
const volume = (value: number | null) => value === null ? 'Non calculable' : `${decimalVolume.format(value)} m³`;
const mm = (value: number | null) => value === null ? 'Non calculable' : `${number.format(value)} mm`;
const percent = (value: number | null) => value === null ? 'Non calculable' : `${number.format(value)} %`;
const statusLabels: Record<AllocationStatus, string> = {
  no_need: 'Aucun besoin', full: 'Besoin entièrement satisfait en volume', partial: 'Besoin partiellement satisfait', unsatisfied: 'Besoin non satisfait',
  not_selected: 'Non retenue lors de votre choix', arbitration_required: 'Choix nécessaire entre les demandes d’eau', waiting_priority: 'En attente de la priorité précédente',
  below_threshold: 'Allocation inférieure au seuil', unknown: 'Données insuffisantes',
};
const help = {
  preliminary: 'Cette analyse vérifie les volumes, pas les horaires. Elle ne garantit pas encore qu’un planning exécutable existe : l’alternance des pompes et les créneaux seront vérifiés lors du planning.',
  forecast: 'Estimation jusqu’à dimanche soir : stocks hors minimum de sécurité, apports des ressources, pluie reçue par les réserves et évaporation estimée, après les irrigations déjà planifiées. Les apports futurs restent des prévisions.',
  allocatable: 'Volume pouvant satisfaire les besoins avec les ressources considérées. Avant votre choix entre les demandes d’eau, c’est un maximum théorique, pas une attribution. Après validation, les exclusions et les doses sous seuil sont prises en compte.',
  coverage: 'Volume affectable divisé par le besoin effectif total, multiplié par 100, au maximum 100 %. La part confirmée est un minimum vérifié, compatible avec toutes les allocations proposées. Dans un réseau comportant plusieurs chemins, une vérification détaillée peut confirmer davantage de volume.',
  allocation: 'Volume proposé pour cette planche après les priorités et la sélection manuelle. Ce n’est pas encore une irrigation programmée. Les doses sous seuil ne sont pas transmises au planning.',
  residual: 'Partie du besoin qui reste non satisfaite : besoin effectif moins allocation retenue. Les millimètres sont calculés avec la surface de la planche.',
  arbitration: 'Pour les experts, l’« arbitrage » (3.4). L’eau ne suffit pas pour toutes les planches de même priorité. Sélectionnez celles à servir. Si l’eau manque encore, elle sera partagée proportionnellement à leurs besoins ; les autres recevront zéro.',
};

export function IrrigationFeasibilityDashboardView({ season }: { season: number }) {
  const [dashboard, setDashboard] = useState<IrrigationFeasibility | null>(null);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const sequence = useRef(0);
  const root = useRef<HTMLElement>(null);
  const activated = useRef(false);
  const receive = useCallback((result: FeasibilityActionResult) => {
    if (result.ok) { setDashboard(result.dashboard); setError(null); setNotice(result.message); }
    else setError(result.message);
  }, []);
  const refresh = useCallback(async () => {
    const request = ++sequence.current;
    setPending(true);
    try { const result = await loadIrrigationFeasibilityAction({ season }); if (request === sequence.current) receive(result); }
    catch { if (request === sequence.current) setError('La faisabilité n’a pas pu être actualisée. Réessayez.'); }
    finally { if (request === sequence.current) setPending(false); }
  }, [season, receive]);
  useEffect(() => {
    // Defer the batch until this working section is approached; no polling or global refresh.
    const observer = new IntersectionObserver((entries) => { if (entries.some((entry) => entry.isIntersecting) && !activated.current) { activated.current = true; void refresh(); } }, { rootMargin: '300px' });
    if (root.current) observer.observe(root.current);
    let timer: ReturnType<typeof setTimeout>;
    const changed = () => { if (!activated.current) return; clearTimeout(timer); timer = setTimeout(() => void refresh(), 180); };
    const events = ['irrigation-feasibility-source-changed', 'irrigation-events-changed', 'irrigation-needs-source-changed'];
    events.forEach((name) => window.addEventListener(name, changed));
    const focused = () => { if (document.visibilityState === 'visible') changed(); };
    document.addEventListener('visibilitychange', focused);
    const channel = typeof BroadcastChannel === 'undefined' ? null : new BroadcastChannel('irrigation-feasibility');
    if (channel) channel.onmessage = changed;
    return () => { observer.disconnect(); clearTimeout(timer); events.forEach((name) => window.removeEventListener(name, changed)); document.removeEventListener('visibilitychange', focused); channel?.close(); sequence.current += 1; };
  }, [refresh]);
  return <section ref={root} className="feasibility-section" aria-labelledby="feasibility-title" aria-busy={pending}>
    <header className="feasibility-heading"><div><h2 id="feasibility-title">Faisabilité et répartition de l’eau</h2><p>De maintenant à dimanche soir · Analyse préliminaire <FeasibilityHelp label="Faisabilité préliminaire" text={help.preliminary} /></p></div><button type="button" disabled={pending} onClick={() => { activated.current = true; void refresh(); }}>{pending ? 'Calcul en cours…' : 'Recalculer la faisabilité'}</button></header>
    {error ? <p className="water-error" role="alert">{error}</p> : null}
    {notice ? <p className="feasibility-notice" role="status">{notice}</p> : null}
    {!dashboard ? <p>Les besoins et ressources seront chargés pour la semaine en cours.</p> : <>
      <p className="feasibility-meta">Semaine du {jour(dashboard.weekStart)} au {jour(dashboard.weekEnd)} · Calculé le {dates.format(new Date(dashboard.calculatedAt))}</p>
      {dashboard.warnings.map((warning) => <p className="feasibility-warning" key={warning}>{warning}</p>)}
      <div className="feasibility-summary">
        <Summary label="Besoins totaux" value={volume(dashboard.totalNeedCubicMeters)} detail={dashboard.unknownNeedCount ? `Partie connue : ${volume(dashboard.knownNeedCubicMeters)}` : 'Besoins effectifs restant à planifier'} />
        <Summary label="Eau mobilisable actuellement" value={volume(dashboard.currentAvailableCubicMeters)} detail={`Stocks renseignés, hors sécurité${dashboard.currentAvailableCubicMeters === null ? ` · Partie connue : ${volume(dashboard.knownCurrentCubicMeters)}` : ''}`} />
        <Summary label="Disponibilité prévisionnelle" value={volume(dashboard.forecastAvailableCubicMeters)} helpText={help.forecast} detail={`Après ${volume(dashboard.reservedPlannedCubicMeters)} déjà planifiés${dashboard.forecastAvailableCubicMeters === null ? ` · Partie connue : ${volume(dashboard.knownForecastCubicMeters)}` : ''}`} />
        <Summary label="Volume affectable" value={volume(dashboard.allocatableCubicMeters)} helpText={help.allocatable} detail={dashboard.requiresManualArbitration ? 'Maximum théorique avant votre choix' : 'Après sélection et seuil minimal'} />
        <Summary label="Volume satisfait" value={volume(dashboard.allocatedCubicMeters)} detail={`Dont chaîne connue : ${volume(dashboard.confirmedAllocatedCubicMeters)}`} />
        <Summary label="Déficit global" value={volume(dashboard.residualDeficitCubicMeters)} helpText={help.residual} detail={dashboard.requiresManualArbitration ? 'Déficit minimal avant votre décision' : 'Besoins non couverts'} />
        <Summary label="Taux de couverture" value={percent(dashboard.coveragePercent)} helpText={help.coverage} detail={`Couverture confirmée : ${percent(dashboard.confirmedCoveragePercent)}`} />
        <Summary label="Volume non affecté" value={volume(dashboard.unallocatedCubicMeters)} detail={dashboard.withheldBelowThresholdCubicMeters > 0 ? `Dont sous seuil : ${volume(dashboard.withheldBelowThresholdCubicMeters)}` : 'Non consommé ni réservé par cette analyse'} />
      </div>
      {dashboard.potentialAdditionalCubicMeters > 0 ? <p className="feasibility-warning">Volume supplémentaire potentiellement utilisable : {volume(dashboard.potentialAdditionalCubicMeters)}. Son acheminement hydraulique reste à vérifier ; une couverture totale en volume ne prouve pas la faisabilité du planning.</p> : null}
      <details className="feasibility-sources"><summary>Voir les ressources prises en compte</summary><div className="feasibility-bed-grid">{dashboard.pools.map((pool) => <article key={pool.key}><strong>{pool.name}</strong><p>Actuel : {volume(pool.currentCubicMeters)}<br />Prévisionnel restant : {volume(pool.forecastCubicMeters)}</p>{pool.reasons.map((reason) => <p key={reason}>{reason}</p>)}</article>)}</div></details>
      <div>{dashboard.priorities.map((level) => <PriorityPanel key={`${dashboard.revision}:${level.priority}`} level={level} pending={pending} onSave={async (selectedBedIds) => {
        const request = ++sequence.current; setPending(true);
        try {
          const result = await saveIrrigationArbitrationAction({ season, weekStart: dashboard.weekStart, priority: level.priority, selectedBedIds, expectedRevision: dashboard.revision, snapshotSignature: dashboard.snapshotSignature, requestId: crypto.randomUUID() });
          if (request === sequence.current) receive(result);
          if (result.ok) notifyFeasibilityChanged();
        } catch { setError('Le choix n’a pas pu être enregistré. Recalculez avant de réessayer.'); }
        finally { if (request === sequence.current) setPending(false); }
      }} />)}</div>
    </>}
  </section>;
}

function PriorityPanel({ level, pending, onSave }: { level: PriorityFeasibility; pending: boolean; onSave: (ids: string[]) => Promise<void> }) {
  const editable = ['required', 'revalidation_required', 'validated'].includes(level.arbitration);
  const [selection, setSelection] = useState(() => level.decision?.selectedBedIds.filter((id) => level.candidates.includes(id)) ?? []);
  return <details className="feasibility-priority" open={editable || undefined}><summary><strong>Priorité {priorityLabel(level.priority)}</strong><span>Besoin {volume(level.knownNeedCubicMeters)} · Satisfait {volume(level.allocatedCubicMeters)} · Déficit {volume(level.residualCubicMeters)} · Couverture {percent(level.coveragePercent)}</span></summary>
    {editable ? <div className="feasibility-arbitration"><h3>{level.arbitration === 'validated' ? 'Choix enregistré' : level.arbitration === 'revalidation_required' ? 'Choix à valider de nouveau' : 'Choix à faire entre les demandes d’eau'} <FeasibilityHelp label="Choix entre les demandes d’eau" text={help.arbitration} /></h3><p>{volume(level.availableCubicMeters)} disponibles au maximum pour {volume(level.knownNeedCubicMeters)} de besoins. Sélectionnez les planches à servir ; aucune quantité n’est à saisir.</p>{level.decision ? <small>Dernière décision : {dates.format(new Date(level.decision.decidedAt))}</small> : null}</div> : null}
    {level.arbitration === 'waiting' ? <p className="feasibility-warning">Résolvez d’abord la priorité précédente ou ses données manquantes.</p> : null}
    <div className="feasibility-bed-grid">{level.beds.map((row) => <article key={row.need.bedId} className="feasibility-bed" data-status={row.status}>
      <header><div><strong>{row.need.bedName}</strong><small>{row.need.zoneName} · {row.need.plotName}</small></div>{editable && level.candidates.includes(row.need.bedId) ? <label className="feasibility-checkbox"><input type="checkbox" disabled={pending} checked={selection.includes(row.need.bedId)} onChange={(event) => setSelection((previous) => event.target.checked ? [...previous, row.need.bedId] : previous.filter((id) => id !== row.need.bedId))} />Servir {row.need.bedName}</label> : null}</header>
      <dl><div><dt>Besoin effectif</dt><dd>{mm(row.need.effectiveNeedMm)} · {volume(row.need.effectiveVolumeCubicMeters)}</dd></div><div><dt>Déficit actuel</dt><dd>{mm(row.need.realRemainingMm)} · {percent(row.need.relativeDeficitPercent)}</dd></div><div><dt>Allocation faisable <FeasibilityHelp label="Allocation faisable" text={help.allocation} /></dt><dd>{mm(row.allocatedMm)} · {volume(row.allocatedCubicMeters)}</dd></div><div><dt>Déficit résiduel <FeasibilityHelp label="Déficit résiduel" text={help.residual} /></dt><dd>{mm(row.residualMm)} · {volume(row.residualCubicMeters)}</dd></div><div><dt>Satisfaction</dt><dd>{percent(row.satisfactionPercent)}</dd></div></dl>
      {row.need.manualOverrideMm !== null ? <p>Besoin manuel actif{row.need.overrideReason ? ` : ${row.need.overrideReason}` : ''}.</p> : null}
      <p className="feasibility-status">{statusLabels[row.status]}</p>
      {row.status === 'below_threshold' ? <p>Proposition brute : {volume(row.proposedCubicMeters)} · seuil {mm(row.need.thresholdMm)}. Volume non affecté.</p> : null}
      {row.reasons.map((reason) => <p className="feasibility-reason" key={reason}>{reason}</p>)}
    </article>)}</div>
    {editable ? <div className="feasibility-validation"><span>{selection.length} planche(s) sélectionnée(s){!selection.length ? ' · aucune planche ne sera retenue' : ''}</span><button type="button" disabled={pending} onClick={() => void onSave(selection)}>{pending ? 'Enregistrement…' : 'Valider la sélection'}</button></div> : null}
  </details>;
}
function Summary({ label, value, detail, helpText }: { label: string; value: string; detail: string; helpText?: string }) { return <div><span>{label} {helpText ? <FeasibilityHelp label={label} text={helpText} /> : null}</span><strong>{value}</strong><small>{detail}</small></div>; }
/**
 * Une bulle d'aide : le survol l'ouvre et la ferme ; un clic ou un toucher
 * l'épingle, et seuls « Fermer » ou Échap la referment. Sur téléphone, le
 * pointeur « quitte » la bulle dès que la page défile ou bouge sous lui : une
 * bulle ouverte d'un toucher ne doit pas se refermer pour autant.
 */
function FeasibilityHelp({ label, text }: { label: string; text: string }) {
  const id = useId(); const [hovered, setHovered] = useState(false); const [pinned, setPinned] = useState(false);
  const open = hovered || pinned;
  const close = () => { setHovered(false); setPinned(false); };
  return <span className="feasibility-help" onMouseLeave={() => setHovered(false)} onKeyDown={(event) => { if (event.key === 'Escape') close(); }}>
    <button type="button" aria-label={`Explication : ${label}`} aria-expanded={open} aria-controls={id} onMouseEnter={() => setHovered(true)} onFocus={() => setHovered(true)} onClick={(event) => { event.preventDefault(); event.stopPropagation(); setPinned(true); }}>ⓘ</button>
    {open ? <span id={id} role="tooltip">{text}<button type="button" aria-label={`Fermer : ${label}`} onClick={(event) => { event.preventDefault(); event.stopPropagation(); close(); }}>Fermer</button></span> : null}
  </span>;
}
