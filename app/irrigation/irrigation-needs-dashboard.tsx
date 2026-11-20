'use client';

import { UNCLASSIFIED_PLOT_REASON } from '@/lib/domain/onboarding/plots';
import { volumeText } from '@/lib/domain/display-numbers';
import { useCallback, useEffect, useMemo, useRef, useState, useTransition } from 'react';
import { notifyFeasibilityChanged } from '@/lib/domain/feasibility-notifications';
import { realRemainingOrigin, type BedIrrigationNeed, type IrrigationNeedPriority, type IrrigationNeedsDashboard } from '@/lib/domain/irrigation-needs';
import { gardenUnknownReason } from '@/lib/domain/objective-reading';
import type { ProposalSummary } from '@/lib/domain/crop-water/proposal';
import { ACTUAL_RAIN_CONSEQUENCE } from '@/lib/domain/today/reliability';
import { FigureOrigin } from './shell/figure-origin';
import { ActionReply, actionReply, type ActionReplyMessage } from './shell/action-reply';
import { PageSettingsFold } from './shell/page-settings-fold';
import { gardenState } from '@/lib/domain/besoins-phone';
import { loadIrrigationNeedsAction, saveIrrigationBedNeedDecisionAction, saveIrrigationNeedThresholdAction, type IrrigationNeedActionResult } from './irrigation-need-actions';
import { dateClockText } from '@/lib/domain/clock-text';

const mm = new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 1 });
const area = new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 2 });
// « 16/06/2026 à 8 h 50 » (audit du 19 novembre 2026, lot K, n° 22, F474).
const dateTime = { format: (value: Date | number) => dateClockText(new Date(value)) };
type SortMode = 'priority' | 'deficit' | 'covered' | 'remaining';
/** Les classes de message de la section, gardées telles qu'avant le lot G. */
const NEEDS_REPLY_CLASSES = { notice: 'water-notice', warning: 'irrigation-needs-warning', error: 'water-error' } as const;

const help = {
  et0: 'ET0 cumulée sur la semaine, réanalyse pour les jours passés et prévision pour les jours à venir. Affichée pour information : elle n’entre pas dans le calcul du besoin.',
  proposed: 'Somme des ETM des sept jours, culture par culture et stade par stade. Une information : elle n’entre dans le besoin que si vous l’adoptez depuis la fiche de la planche.',
  objective: 'Objectif hydrique adopté pour cette planche selon l’historique des objectifs de la semaine. C’est la demande de la semaine, avant déduction des pluies et des irrigations.',
  actual: 'Reste réel après la pluie mesurée ou réanalysée et les irrigations réellement confirmées.',
  forecast: 'Pluie extérieure encore prévue jusqu’à dimanche. Elle vaut 0 sous abri.',
  planning: 'Reste à planifier après pluie réelle, pluie prévue, irrigation réelle et irrigation déjà planifiée.',
  deficit: 'Part du reste réel rapportée à l’objectif de la semaine.',
  effective: 'Besoin transmis aux étapes suivantes : calcul après seuil, ou valeur manuelle si elle est active.',
} as const;

/** `showProposals` : l'objectif proposé de la culture, avec la case « Besoin par culture » (3.8, R1). */
export function IrrigationNeedsDashboardView({ season, initialDashboard, showProposals }: { season: number; initialDashboard: IrrigationNeedsDashboard; showProposals: boolean }) {
  const [dashboard, setDashboard] = useState(initialDashboard);
  const [threshold, setThreshold] = useState(String(initialDashboard.thresholdMm));
  const [sort, setSort] = useState<SortMode>('priority');
  // Le message d'un geste s'affiche sous son bouton (F404) ; un rechargement automatique ne parle pas (F405).
  const [replies, setReplies] = useState<ActionReplyMessage[]>([]);
  const [pending, startTransition] = useTransition();
  const dashboardRef = useRef(initialDashboard);
  /** `origin` nul : un rechargement automatique, silencieux s'il réussit. */
  const receive = useCallback((result: IrrigationNeedActionResult, origin: string | null) => {
    if (result.ok) {
      dashboardRef.current = result.dashboard; setDashboard(result.dashboard); setThreshold(String(result.dashboard.thresholdMm)); notifyFeasibilityChanged();
      if (origin !== null) setReplies([actionReply(origin, 'notice', result.message)]);
    } else setReplies([actionReply(origin ?? 'haut', 'error', result.message)]);
  }, []);
  useEffect(() => {
    const refresh = (event: Event) => {
      const detail = event instanceof CustomEvent ? event.detail as { weekStart?: unknown } | null : null;
      const weekStart = typeof detail?.weekStart === 'string' ? detail.weekStart : dashboardRef.current.weekStart;
      startTransition(async () => receive(await loadIrrigationNeedsAction({ season, weekStart }), null));
    };
    window.addEventListener('irrigation-events-changed', refresh);
    window.addEventListener('irrigation-needs-source-changed', refresh);
    return () => { window.removeEventListener('irrigation-events-changed', refresh); window.removeEventListener('irrigation-needs-source-changed', refresh); };
  }, [receive, season]);
  const sortedGardens = useMemo(() => dashboard.gardens.map((garden) => ({ ...garden, beds: [...garden.beds].sort(sorter(sort)) })), [dashboard.gardens, sort]);
  return <section className="irrigation-needs-section" aria-labelledby="irrigation-needs-title">
    <header className="irrigation-needs-heading"><div><h2 id="irrigation-needs-title">Besoins d’irrigation</h2><p>Besoin calculé par planche pour la semaine sélectionnée, du {formatDate(dashboard.weekStart)} au {formatDate(dashboard.weekEnd)}.</p></div><small>Calculé le {dateTime.format(new Date(dashboard.calculatedAt))}</small></header>
    <ActionReply messages={replies} origin="haut" classNames={NEEDS_REPLY_CLASSES} />
    {!dashboard.completeness.complete ? <p className="irrigation-needs-warning" role="status">{dashboardWarning(dashboard)}</p> : null}
    <div className="irrigation-needs-controls">
      <label><span>Trier les planches</span><select value={sort} onChange={(event) => setSort(event.target.value as SortMode)}><option value="priority">Priorités hautes</option><option value="deficit">Déficit le plus fort</option><option value="remaining">Besoin restant</option><option value="covered">Déjà couvert</option></select></label>
    </div>
    <div className="irrigation-needs-gardens">{sortedGardens.map((garden) => <details key={garden.plotId}>
      {/* Au téléphone, une ligne compacte : le nom, le reste à apporter, l'état ; le détail s'ouvre dessous. Une seule des deux formes s'affiche, et se lit (lot J, n° 15, F460). */}
      <summary><span className="garden-compact"><strong>{garden.plotName}</strong><b>{garden.effectiveNeedMm === null ? '—' : formatMm(garden.effectiveNeedMm)}</b>{gardenStateBadge(garden)}</span><span><strong>{garden.plotName}</strong><small>{garden.zoneName} · {garden.sheltered ? 'Abri' : 'Plein champ'} · {garden.bedCount} planche{garden.bedCount > 1 ? 's' : ''}</small></span><span><strong>À planifier : {gardenMm(garden.effectiveNeedMm, gardenUnknownReason(garden.beds, (bed) => bed.effectiveNeedMm))}</strong><small>Besoin réel : {gardenMm(garden.realRemainingMm, gardenUnknownReason(garden.beds, (bed) => bed.realRemainingMm))} · {garden.effectiveVolumeCubicMeters === null ? 'Volume non calculable' : `${volumeText(garden.effectiveVolumeCubicMeters)}`} · {garden.priorityCounts.high} haute{garden.priorityCounts.high > 1 ? 's' : ''} · {garden.priorityCounts.normal} normale{garden.priorityCounts.normal > 1 ? 's' : ''} · {garden.priorityCounts.low} basse{garden.priorityCounts.low > 1 ? 's' : ''}</small></span></summary>
      <p className="garden-compact-detail">{gardenSummaryDetail(garden)}</p>
      <div className="irrigation-needs-bed-grid">{garden.beds.map((bed) => <BedNeedCard key={`${bed.bedId}:${bed.priority}:${bed.manualOverrideMm ?? 'auto'}:${bed.overrideReason ?? ''}`} bed={bed} proposal={showProposals ? dashboard.proposedByBed?.[bed.bedId] ?? null : null} pending={pending} reply={<ActionReply messages={replies} origin={`planche:${bed.bedId}`} classNames={NEEDS_REPLY_CLASSES} />} onSave={(priority, override, reason) => startTransition(async () => receive(await saveIrrigationBedNeedDecisionAction({ season, weekStart: dashboard.weekStart, bedId: bed.bedId, priority, manualOverrideMm: override, overrideReason: reason, calculatedNeedMm: bed.calculatedNeedMm }), `planche:${bed.bedId}`))} />)}</div>
    </details>)}</div>
    {/* Le seuil minimal de planification dans le pli du bas (audit final, lot D, J2, F305). */}
    <PageSettingsFold>
      <div className="irrigation-needs-controls">
        <label><span>Seuil minimal de planification (mm)</span><input inputMode="decimal" value={threshold} onChange={(event) => setThreshold(event.target.value)} /></label>
        <button type="button" disabled={pending} onClick={() => startTransition(async () => receive(await saveIrrigationNeedThresholdAction({ season, weekStart: dashboard.weekStart, thresholdMm: numeric(threshold) }), 'seuil'))}>Enregistrer le seuil</button>
      </div>
      <ActionReply messages={replies} origin="seuil" classNames={NEEDS_REPLY_CLASSES} />
    </PageSettingsFold>
  </section>;
}

function BedNeedCard({ bed, proposal, pending, reply, onSave }: { bed: BedIrrigationNeed; proposal: ProposalSummary | null; pending: boolean; reply: React.ReactNode; onSave: (priority: IrrigationNeedPriority, override: number | null, reason: string) => void }) {
  const [priority, setPriority] = useState(bed.priority);
  const [overrideEnabled, setOverrideEnabled] = useState(bed.manualOverrideMm !== null);
  const [override, setOverride] = useState(bed.manualOverrideMm === null ? '' : String(bed.manualOverrideMm));
  const [reason, setReason] = useState(bed.overrideReason ?? '');
  const exceeds = overrideEnabled && numeric(override) > (bed.objectiveMm ?? Number.POSITIVE_INFINITY);
  return <article className="irrigation-need-card" data-priority={bed.priority}>
    <header><div><strong>{bed.bedName}</strong><small>{area.format(bed.areaSquareMeters)} m²</small></div><span className="need-priority-label">Priorité {priorityLabel(bed.priority)}</span></header>
    {/* « À planifier » et le besoin d'abord ; les trois autres quantités dans « Pour les experts » (lot J, n° 15, F460). */}
    <div className="need-primary"><span><small>À planifier <HelpButton text={help.planning} /></small><strong>{formatMm(bed.calculatedNeedMm)}</strong></span><span><small>Besoin réel <HelpButton text={help.actual} /></small><strong>{formatMm(bed.realRemainingMm)}<FigureOrigin text={realRemainingOrigin(bed)} /></strong></span></div>
    <details className="need-experts"><summary>Pour les experts</summary><div className="need-primary"><span><small>Besoin effectif <HelpButton text={help.effective} /></small><strong>{formatMm(bed.effectiveNeedMm)}</strong></span><span><small>Volume</small><strong>{bed.effectiveVolumeCubicMeters === null ? '—' : `${volumeText(bed.effectiveVolumeCubicMeters)}`}</strong></span><span><small>Déficit relatif <HelpButton text={help.deficit} /></small><strong>{bed.relativeDeficitPercent === null ? '—' : `${mm.format(bed.relativeDeficitPercent)} %`}</strong></span></div></details>
    {/* « Non calculable » dit pourquoi, avec la raison que le domaine connaît (audit final, lot A, R2, F282). */}
    {bed.calculatedNeedMm === null && missingLabels(bed, 'planning') ? <p className="need-unknown-reason">Non calculable : {missingLabels(bed, 'planning')}.</p> : null}
    {!bed.completeness.complete ? <NeedDiagnostic bed={bed} /> : null}
    <details className="need-calculation"><summary>Voir le calcul</summary><dl>
      <Et0Metric bed={bed} />
      <Metric label="Objectif" value={bed.objectiveMm} helpText={help.objective} kind="Renseigné · demande de la semaine" />
      {proposal ? <ProposedMetric proposal={proposal} /> : null}
      <Metric label="Pluie réelle" value={bed.actualRainMm} kind={bed.sheltered ? 'Réel · abri = 0' : 'Réel / estimé'} />
      <Metric label="Irrigation réelle" value={bed.actualIrrigationMm} kind="Réel confirmé" />
      <Metric label="Reste réel" value={bed.realRemainingMm} helpText={help.actual} kind="Calculé" />
      <Metric label="Pluie prévue" value={bed.forecastRainMm} helpText={help.forecast} kind={bed.sheltered ? 'Prévu · abri = 0' : 'Prévu'} />
      <Metric label="Irrigation planifiée" value={bed.plannedIrrigationMm} kind="Planifié" />
      <Metric label="Reste brut à planifier" value={bed.rawPlanningNeedMm} helpText={help.planning} kind="Calculé" />
      <Metric label={`Après seuil (${mm.format(bed.thresholdMm)} mm)`} value={bed.calculatedNeedMm} kind="Calculé" />
      <WettedAreaMetric bed={bed} />
    </dl></details>
    <div className="need-decision-form"><label><span>Priorité manuelle</span><select value={priority} onChange={(event) => setPriority(event.target.value as IrrigationNeedPriority)}><option value="low">Basse</option><option value="normal">Normale</option><option value="high">Haute</option></select></label>
      <label className="need-toggle"><input type="checkbox" checked={overrideEnabled} onChange={(event) => setOverrideEnabled(event.target.checked)} /> Remplacer le besoin calculé</label>
      {overrideEnabled ? <><label><span>Besoin manuel (mm)</span><input inputMode="decimal" value={override} onChange={(event) => setOverride(event.target.value)} /></label><label><span>Raison facultative</span><input value={reason} maxLength={500} onChange={(event) => setReason(event.target.value)} /></label>{exceeds ? <small className="need-override-warning">Cette valeur dépasse l’objectif hydrique de la semaine.</small> : null}</> : null}
      <button type="button" disabled={pending || (overrideEnabled && !validNumber(override))} onClick={() => onSave(priority, overrideEnabled ? numeric(override) : null, reason)}>Enregistrer</button>
      {reply}
    </div>
    <footer>Échéance : dimanche fin de journée</footer>
  </article>;
}

function NeedDiagnostic({ bed }: { bed: BedIrrigationNeed }) {
  const objectiveOrigin = bed.objectiveSource === 'farm' ? 'hérité de la ferme' : bed.objectiveSource === 'zone' ? 'hérité de la parcelle' : bed.objectiveSource === 'plot' ? 'hérité du jardin ou de l’abri' : bed.objectiveSource === 'bed' ? 'défini pour la planche' : bed.objectiveSource === 'mixed' ? 'objectifs historiques de plusieurs niveaux' : 'aucun objectif adopté';
  return <details className="need-diagnostic">
    <summary>ⓘ Pourquoi&nbsp;?</summary>
    <ul>
      <DiagnosticLine label="Objectif" value={bed.objectiveMm} ok={bed.objectiveMm !== null} detail={objectiveOrigin} />
      <li data-status={bed.et0Mm === null ? 'partial' : 'ok'}><strong>ET0, information hors calcul :</strong> {bed.et0Mm === null ? `partielle${bed.et0KnownMm === null ? '' : ` — ${formatMm(bed.et0KnownMm)} disponibles`}` : formatMm(bed.et0Mm)} — {bed.et0Mm === null ? missingDatesText(bed.completeness.missingDates.et0) : 'OK'}<small>Réanalyse : {formatOptionalMm(bed.et0ReanalysisMm)} · Prévision : {formatOptionalMm(bed.et0ForecastMm)} · n’entre pas dans le besoin</small></li>
      <DiagnosticLine label="Pluie réelle" value={bed.actualRainMm} ok={bed.completeness.realComplete} detail={bed.sheltered ? 'abri : pluie extérieure non applicable, zéro valide' : bed.completeness.realComplete ? 'mesure manuelle prioritaire, sinon réanalyse' : rainFallbackText(bed)} />
      <DiagnosticLine label="Irrigation réelle" value={bed.actualIrrigationMm} ok detail="apports confirmés" />
      <DiagnosticLine label="Pluie prévue" value={bed.forecastRainMm} ok={bed.completeness.missingDates.forecastRain.length === 0} detail={bed.sheltered ? 'abri : pluie extérieure non applicable, zéro valide' : bed.completeness.missingDates.forecastRain.length === 0 ? 'prévision disponible' : `${missingDatesText(bed.completeness.missingDates.forecastRain)}, comptée zéro`} />
      <DiagnosticLine label="Irrigation planifiée" value={bed.plannedIrrigationMm} ok detail="planifications actives" />
    </ul>
    <p><strong>Objectif de la semaine :</strong> {bed.completeness.demandComplete ? `${formatMm(bed.objectiveMm)} — calculable` : 'non calculable — aucun objectif adopté'}</p>
    <p><strong>Besoin réel :</strong> {!bed.completeness.demandComplete ? `non calculable — ${missingLabels(bed, 'real')}` : bed.completeness.realComplete ? `${formatMm(bed.realRemainingMm)} — calculable` : `${formatMm(bed.realRemainingMm)} — partiel, ${missingLabels(bed, 'real')}`}</p>
    <p><strong>Besoin à planifier :</strong> {!bed.completeness.demandComplete ? `non calculable — ${missingLabels(bed, 'planning')}` : bed.completeness.planningComplete ? `${formatMm(bed.rawPlanningNeedMm)} — calculable` : `${formatMm(bed.rawPlanningNeedMm)} — partiel, ${missingLabels(bed, 'planning')}`}</p>
    <small>Période : {formatDate(bed.weekStart)} au {formatDate(bed.weekEnd)} · Surface de la planche : {area.format(bed.areaSquareMeters)} m² · Surface mouillée : {wettedArea(bed).value} ({wettedArea(bed).kind}) · {bed.sheltered ? 'Abri' : 'Plein champ'} · Seuil : {formatMm(bed.thresholdMm)} · Override : {bed.manualOverrideMm === null ? 'aucun' : formatMm(bed.manualOverrideMm)}</small>
  </details>;
}

/** La surface qui convertit le besoin en volume, et d'où elle vient (D-022, docs/wetted-surface-contract.md). */
function wettedArea(bed: BedIrrigationNeed) {
  const value = bed.wettedAreaSquareMeters === null ? '—' : `${area.format(bed.wettedAreaSquareMeters)} m²`;
  const kind = bed.wettedAreaSource === 'sprinkler' ? 'aspersion, planche et passe-pied'
    : bed.wettedAreaSource === 'drip' ? 'goutte-à-goutte, planche seule'
    : bed.wettedAreaSource === 'bed-only' ? 'planche seule, aucun matériel posé'
    : 'inconnue : aspersion sans passe-pied renseigné';
  return { value, kind };
}
function WettedAreaMetric({ bed }: { bed: BedIrrigationNeed }) { const { value, kind } = wettedArea(bed); return <div><dt>Surface mouillée<small>{kind}</small></dt><dd>{value}</dd></div>; }

function DiagnosticLine({ label, value, ok, detail }: { label: string; value: number | null; ok: boolean; detail: string }) {
  return <li data-status={ok ? 'ok' : 'missing'}><strong>{label} :</strong> {value === null ? 'indisponible' : formatMm(value)} — {ok ? 'OK' : detail}{ok ? <small>{detail}</small> : null}</li>;
}

function Metric({ label, value, kind, helpText }: { label: string; value: number | null; kind: string; helpText?: string }) { return <div><dt>{label}{helpText ? <> <HelpButton text={helpText} /></> : null}<small>{kind}</small></dt><dd>{formatMm(value)}</dd></div>; }
/** L'objectif proposé à côté de l'objectif (5 quater) : une information, avec son écart quand elle est complète. */
function ProposedMetric({ proposal }: { proposal: ProposalSummary }) {
  const kind = proposal.status === 'complete' ? `Proposé · information${proposal.differenceMm === null ? '' : ` · écart ${signedMm(proposal.differenceMm)}${proposal.differencePercent === null ? '' : ` (${proposal.differencePercent > 0 ? '+' : ''}${mm.format(proposal.differencePercent)} %)`}`}`
    : proposal.status === 'partial' ? 'Proposé · partiel, un jour ou une culture manque'
    : proposal.status === 'no-crop' ? 'Proposé · aucune culture à Kc'
    : 'Proposé · indisponible';
  return <div data-kind="proposed"><dt>Objectif proposé <HelpButton text={help.proposed} /><small>{kind}</small></dt><dd>{proposal.status === 'no-crop' ? '—' : formatMm(proposal.proposedMm)}</dd></div>;
}
function signedMm(value: number) { return `${value > 0 ? '+' : ''}${mm.format(value)} mm`; }
function Et0Metric({ bed }: { bed: BedIrrigationNeed }) { return <div><dt>ET0 <HelpButton text={help.et0} /><small>Information · hors calcul</small></dt><dd>{formatEt0(bed)}</dd></div>; }
function formatEt0(bed: BedIrrigationNeed) {
  if (bed.et0Mm !== null) return formatMm(bed.et0Mm);
  return bed.et0KnownMm === null ? 'Non disponible' : `${formatMm(bed.et0KnownMm)} (partielle)`;
}
function HelpButton({ text }: { text: string }) {
  const [pinned, setPinned] = useState(false);
  const [hovered, setHovered] = useState(false);
  const [focused, setFocused] = useState(false);
  const [dismissed, setDismissed] = useState(false);
  const open = !dismissed && (pinned || hovered || focused);
  return <span className="need-help" onMouseLeave={() => setHovered(false)}><button type="button" aria-label="Afficher l’explication" aria-expanded={open} onClick={() => { setDismissed(false); setPinned(!pinned); }} onMouseEnter={() => { setDismissed(false); setHovered(true); }} onFocus={() => { setDismissed(false); setFocused(true); }} onBlur={() => setFocused(false)}>i</button>{open ? <span role="tooltip">{text}<button type="button" aria-label="Fermer l’explication" onClick={(event) => { event.stopPropagation(); setPinned(false); setHovered(false); setFocused(false); setDismissed(true); }}>×</button></span> : null}</span>;
}
type GardenNeeds = IrrigationNeedsDashboard['gardens'][number];
/** L'état d'un jardin sur sa ligne compacte, au téléphone (F460). */
function gardenStateBadge(garden: GardenNeeds) {
  const state = gardenState(garden);
  return state.text ? <small className="garden-compact-state" data-tone={state.tone}>{state.text}</small> : null;
}
/** Le détail du jardin que sa ligne compacte cache, en tête du jardin ouvert au téléphone (F460). */
function gardenSummaryDetail(garden: GardenNeeds) {
  const priorities = `${garden.priorityCounts.high} haute${garden.priorityCounts.high > 1 ? 's' : ''} · ${garden.priorityCounts.normal} normale${garden.priorityCounts.normal > 1 ? 's' : ''} · ${garden.priorityCounts.low} basse${garden.priorityCounts.low > 1 ? 's' : ''}`;
  return `${garden.zoneName} · ${garden.sheltered ? 'Abri' : 'Plein champ'} · ${garden.bedCount} planche${garden.bedCount > 1 ? 's' : ''} · besoin réel ${gardenMm(garden.realRemainingMm, gardenUnknownReason(garden.beds, (bed) => bed.realRemainingMm))} · ${garden.effectiveVolumeCubicMeters === null ? 'volume non calculable' : volumeText(garden.effectiveVolumeCubicMeters)} · ${priorities}`;
}
function formatMm(value: number | null) { return value === null ? 'Non calculable' : `${mm.format(value)} mm`; }
/** Le total d'un jardin, ou « Non calculable » avec sa raison (audit final, lot A, R2, F282). */
function gardenMm(value: number | null, reason: string | null) { return value === null && reason ? `Non calculable (${reason})` : formatMm(value); }
function formatOptionalMm(value: number | null) { return value === null ? 'non disponible' : formatMm(value); }
function formatDate(value: string, withYear = true) { return new Intl.DateTimeFormat('fr-FR', { day: 'numeric', month: 'long', ...(withYear ? { year: 'numeric' as const } : {}), timeZone: 'UTC' }).format(new Date(`${value}T12:00:00Z`)); }
/** Origine de la pluie retenue pour les jours écoulés sans mesure ni réanalyse (D-019). */
function rainFallbackText(bed: BedIrrigationNeed) {
  const missing = bed.completeness.missingDates.actualRain;
  const estimated = bed.completeness.estimatedDates.actualRain;
  const zeroFilled = missing.filter((date) => !estimated.includes(date));
  const days = (dates: readonly string[]) => `${dates.length === 1 ? 'le' : 'les'} ${dates.map((date) => formatDate(date, false)).join(', ')}`;
  const parts = [missingDatesText(missing)];
  if (estimated.length > 0) parts.push(`reprise de la prévision ${days(estimated)}`);
  if (zeroFilled.length > 0) parts.push(`comptée zéro ${days(zeroFilled)}`);
  return parts.join(' · ');
}
function missingDatesText(dates: readonly string[]) { return dates.length === 0 ? 'donnée indisponible' : `manquante ${dates.length === 1 ? 'le' : 'les'} ${dates.map((date) => formatDate(date, false)).join(', ')}`; }
function missingLabels(bed: BedIrrigationNeed, level: 'real' | 'planning') {
  const missing = bed.completeness.missing.filter((item) => level === 'planning' || item !== 'forecast-rain');
  return missing.map((item) => item === 'unclassified-plot' ? UNCLASSIFIED_PLOT_REASON : item === 'objective' ? 'aucun objectif adopté' : item === 'actual-rain' ? `pluie réelle ${missingDatesText(bed.completeness.missingDates.actualRain)}` : `pluie prévue ${missingDatesText(bed.completeness.missingDates.forecastRain)}`).join(' ; ');
}
function dashboardWarning(dashboard: IrrigationNeedsDashboard) {
  const beds = dashboard.gardens.flatMap((garden) => garden.beds);
  const causes = [
    ['unclassified-plot', UNCLASSIFIED_PLOT_REASON, []] as const,
    ['objective', 'aucun objectif hydrique adopté', []] as const,
    ['actual-rain', 'pluie réelle incomplète', dashboard.completeness.missingDates.actualRain] as const,
    ['forecast-rain', 'pluie prévue incomplète', dashboard.completeness.missingDates.forecastRain] as const,
  ].flatMap(([key, label, dates]) => {
    const count = beds.filter((bed) => bed.completeness.missing.includes(key)).length;
    return count === 0 ? [] : [`${count} planche${count > 1 ? 's' : ''} : ${label}${dates.length ? ` (${missingDatesText(dates)})` : ''}`];
  });
  // La pluie réelle manquante se dit dans les mots de « Fiabilité du calcul » (audit ergonomique, lot 2, F9).
  const rainMissing = beds.some((bed) => bed.completeness.missing.includes('actual-rain'));
  return `${causes.join(' · ')}.${rainMissing ? ` ${ACTUAL_RAIN_CONSEQUENCE}` : ''} Les zéros enregistrés restent des valeurs valides. Ouvrez « Pourquoi ? » pour le détail d’une planche.`;
}
function numeric(value: string) { return Number(value.trim().replace(',', '.')); }
function validNumber(value: string) { const parsed = numeric(value); return value.trim() !== '' && Number.isFinite(parsed) && parsed >= 0 && parsed <= 500; }
function priorityLabel(value: IrrigationNeedPriority) { return value === 'high' ? 'haute' : value === 'low' ? 'basse' : 'normale'; }
function sorter(mode: SortMode) { return (a: BedIrrigationNeed, b: BedIrrigationNeed) => mode === 'priority' ? priorityRank(b.priority) - priorityRank(a.priority) || (b.realRemainingMm ?? -1) - (a.realRemainingMm ?? -1) : mode === 'deficit' ? (b.relativeDeficitPercent ?? -1) - (a.relativeDeficitPercent ?? -1) : mode === 'remaining' ? (b.effectiveNeedMm ?? -1) - (a.effectiveNeedMm ?? -1) : (a.effectiveNeedMm ?? Number.POSITIVE_INFINITY) - (b.effectiveNeedMm ?? Number.POSITIVE_INFINITY); }
function priorityRank(priority: IrrigationNeedPriority) { return priority === 'high' ? 3 : priority === 'normal' ? 2 : 1; }
