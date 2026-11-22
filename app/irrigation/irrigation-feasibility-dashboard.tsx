'use client';

import { millimetersText, volumeText } from '@/lib/domain/display-numbers';
import { useCallback, useEffect, useId, useRef, useState } from 'react';
import { priorityLabel, type AllocationStatus, type IrrigationFeasibility, type PriorityFeasibility } from '@/lib/domain/irrigation-feasibility';
import { feasibilityNoticeSource, notifyFeasibilityChanged } from '@/lib/domain/feasibility-notifications';
import { isArbitrationEditable } from '@/lib/domain/arbitration-preview';
import type { ArbitrationCrops } from '@/lib/domain/arbitration-crops';
import { adoptStageAdviceAction, loadIrrigationFeasibilityAction, saveIrrigationArbitrationAction, type FeasibilityActionResult } from './irrigation-feasibility-actions';
import { feasibilityHeadTiles, isPriorityLevelShown } from '@/lib/domain/feasibility-reading';
import { feasibilityUnknownReason } from '@/lib/domain/objective-reading';
import { bedUnknownReason, feasibilityUnknownReasons, notComputableInline, notComputableLine } from '@/lib/domain/feasibility-unknown';
import { ArbitrationPlan } from './arbitration-plan';
import type { FeasibilityPlanGap } from '@/lib/domain/feasibility-plan-gap';
import { pageHref } from '@/lib/domain/features/pages';
import { dateClockText } from '@/lib/domain/clock-text';
import type { StageAdviceScreen } from '@/lib/domain/stage-advice';
import { StageAdviceBlock } from './stage-advice-block';

const number = new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 2 });
// « 16/06/2026 à 8 h 50 » (audit du 19 novembre 2026, lot K, n° 22, F474).
const dates = { format: (value: Date | number) => dateClockText(new Date(value)) };
const jours = new Intl.DateTimeFormat('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric', timeZone: 'Europe/Paris' });
/** Midi UTC : la date métier ne doit pas glisser d'un jour selon le fuseau. */
const jour = (cle: string) => jours.format(new Date(`${cle}T12:00:00Z`));
/** « Non calculable » se lit toujours avec sa raison, dans la ligne qui suit (lot D, N1, F315, F316). */
const volume = (value: number | null) => value === null ? 'Non calculable' : volumeText(value);
const mm = (value: number | null) => value === null ? 'Non calculable' : millimetersText(value);
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
};

export function IrrigationFeasibilityDashboardView({ season }: { season: number }) {
  const [dashboard, setDashboard] = useState<IrrigationFeasibility | null>(null);
  const [crops, setCrops] = useState<ArbitrationCrops | null>(null);
  const [planGap, setPlanGap] = useState<FeasibilityPlanGap | null>(null);
  const [stageAdvice, setStageAdvice] = useState<StageAdviceScreen | null>(null);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const sequence = useRef(0);
  const root = useRef<HTMLElement>(null);
  const activated = useRef(false);
  // Le nom de ce tableau dans ses propres notifications : il ne relit pas la répartition qu'il vient de valider (D-129).
  const self = useId();
  const receive = useCallback((result: FeasibilityActionResult) => {
    if (result.ok) { setDashboard(result.dashboard); setCrops(result.crops); setPlanGap(result.planGap); setStageAdvice(result.stageAdvice); setError(null); setNotice(result.message); }
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
    const changed = (event?: Event) => { if (!activated.current || (event && feasibilityNoticeSource(event) === self)) return; clearTimeout(timer); timer = setTimeout(() => void refresh(), 180); };
    const events = ['irrigation-feasibility-source-changed', 'irrigation-events-changed', 'irrigation-needs-source-changed'];
    events.forEach((name) => window.addEventListener(name, changed));
    const focused = () => { if (document.visibilityState === 'visible') changed(); };
    document.addEventListener('visibilitychange', focused);
    const channel = typeof BroadcastChannel === 'undefined' ? null : new BroadcastChannel('irrigation-feasibility');
    if (channel) channel.onmessage = changed;
    return () => { observer.disconnect(); clearTimeout(timer); events.forEach((name) => window.removeEventListener(name, changed)); document.removeEventListener('visibilitychange', focused); channel?.close(); sequence.current += 1; };
  }, [refresh, self]);
  const head = dashboard ? feasibilityHeadTiles(dashboard) : null;
  const reasons = dashboard ? feasibilityUnknownReasons(dashboard) : null;
  // L'ancre de « Répartir l'eau », depuis le planning (audit final, lot B, R4, F247).
  return <section ref={root} id="repartition" className="feasibility-section" aria-labelledby="feasibility-title" data-tour="faisabilite" aria-busy={pending}>
    <header className="feasibility-heading"><div><h2 id="feasibility-title">Faisabilité et répartition de l’eau</h2><p>De maintenant à dimanche soir · les volumes, pas encore les horaires <FeasibilityHelp label="Ce que vérifie ce calcul" text={help.preliminary} /></p></div><button type="button" className="feasibility-recalculate" disabled={pending} onClick={() => { activated.current = true; void refresh(); }}>{pending ? 'Calcul en cours…' : 'Recalculer la faisabilité'}</button></header>
    {error ? <p className="water-error" role="alert">{error}</p> : null}
    {notice ? <p className="water-notice feasibility-notice" role="status">{notice}</p> : null}
    {!dashboard ? <p>Les besoins et ressources seront chargés pour la semaine en cours.</p> : <>
      <p className="feasibility-meta">Semaine du {jour(dashboard.weekStart)} au {jour(dashboard.weekEnd)} · Calculé le {dates.format(new Date(dashboard.calculatedAt))}</p>
      {/* Le manque du planning que cette répartition ne voit pas : d'où il vient et quoi faire (audit du 19 novembre 2026, lot I, n° 5, F446). */}
      {planGap ? <div className="feasibility-plan-gap" role="note">
        <p><strong>{planGap.lead}</strong></p>
        <p>{planGap.cause}</p>
        <p className="feasibility-plan-gap-links">{planGap.links.map((link) => <a key={link.page} href={pageHref(link.page, { season })}>{link.label}</a>)}</p>
      </div> : null}
      {dashboard.warnings.map((warning) => <p className="feasibility-warning" key={warning}>{warning}</p>)}
      {/* Ce que le calcul ne compte pas, en texte ordinaire (F447). */}
      {dashboard.notes.map((note) => <p className="feasibility-note" key={note}>{note}</p>)}
      {/* Quatre tuiles au plus en tête ; l'écran de répartition, quand un niveau attend un choix, porte les siennes (audit final, lot B, R3, F245). */}
      {head ? <div className="feasibility-summary is-head">
        <Summary label="Eau disponible" value={volume(head.availableCubicMeters)} detail={head.availableCubicMeters === null && reasons ? reasons.forecast : 'd’ici dimanche soir, après les arrosages déjà planifiés'} />
        {/* Un besoin chiffré en partie se lit « au moins », et la tuile dit pourquoi (audit final, lot A, R2, F282). */}
        <Summary label="Besoin de la semaine" value={head.needCubicMeters === null && head.knownNeedCubicMeters > 0 ? `au moins ${volumeText(head.knownNeedCubicMeters)}` : volume(head.needCubicMeters)} detail={head.needCubicMeters === null ? `non chiffré pour ${feasibilityUnknownReason(head.unknownNeed) ?? 'des planches'}` : 'besoins effectifs restant à planifier'} />
        <Summary label="Part servie" value={percent(head.coveragePercent)} detail={head.coveragePercent === null && reasons ? reasons.need : 'du besoin, en volume'} />
        <Summary label="Planches servies en entier" value={`${head.fullyServedBeds} sur ${head.bedsWithNeed}`} detail="parmi les planches qui ont un besoin" />
      </div> : null}
      {/* En pénurie, le conseil selon le stade sensible, après les tuiles de tête et avant les niveaux (amélioration n° 4, F732). */}
      {stageAdvice ? <StageAdviceBlock screen={stageAdvice} pending={pending} onAdopt={async (bed) => {
        const request = ++sequence.current; setPending(true);
        try {
          const result = await adoptStageAdviceAction({ season, weekStart: dashboard.weekStart, bedId: bed.bedId });
          if (request === sequence.current) receive(result);
          // La priorité change aussi le planning et les besoins : les autres blocs et onglets relisent, celui-ci non (D-129).
          if (result.ok) notifyFeasibilityChanged(self);
        } catch { setError('La priorité n’a pas pu être enregistrée. Recalculez avant de réessayer.'); }
        finally { if (request === sequence.current) setPending(false); }
      }} /> : null}
      <div>{dashboard.priorities.filter(isPriorityLevelShown).map((level) => isArbitrationEditable(level)
        // L'écran d'arbitrage façon plan d'assolement (docs/shortage-contract.md, 2 bis, D-083).
        ? <ArbitrationPlan key={`${dashboard.revision}:${level.priority}`} feasibility={dashboard} level={level} crops={crops} pending={pending} onSave={async (selectedBedIds) => {
          const request = ++sequence.current; setPending(true);
          try {
            const result = await saveIrrigationArbitrationAction({ season, weekStart: dashboard.weekStart, priority: level.priority, selectedBedIds, expectedRevision: dashboard.revision, snapshotSignature: dashboard.snapshotSignature, requestId: crypto.randomUUID() });
            if (request === sequence.current) receive(result);
            // Le résultat porte déjà le tableau à jour : les autres blocs et onglets relisent, celui-ci non (D-129).
            if (result.ok) notifyFeasibilityChanged(self);
          } catch { setError('La répartition n’a pas pu être enregistrée. Recalculez avant de réessayer.'); }
          finally { if (request === sequence.current) setPending(false); }
        }} />
        : <PriorityPanel key={`${dashboard.revision}:${level.priority}`} level={level} />)}</div>
      {/* Les chiffres du calcul, fermés par défaut, sous l'écran de répartition (audit final, lot B, R3, F245). */}
      <details className="feasibility-calculation">
        <summary>Le détail du calcul</summary>
        <div className="feasibility-summary">
          <Summary label="Besoins totaux" value={volume(dashboard.totalNeedCubicMeters)} detail={dashboard.unknownNeedCount ? `Partie connue : ${volume(dashboard.knownNeedCubicMeters)}${dashboard.totalNeedCubicMeters === null && reasons ? ` · ${reasons.need}` : ''}` : 'Besoins effectifs restant à planifier'} />
          <Summary label="Eau mobilisable actuellement" value={volume(dashboard.currentAvailableCubicMeters)} detail={`Stocks renseignés, hors sécurité${dashboard.currentAvailableCubicMeters === null ? ` · Partie connue : ${volume(dashboard.knownCurrentCubicMeters)} · ${reasons?.current ?? ''}` : ''}`} />
          <Summary label="Disponibilité prévisionnelle" value={volume(dashboard.forecastAvailableCubicMeters)} helpText={help.forecast} detail={`Après ${volume(dashboard.reservedPlannedCubicMeters)} déjà planifiés${dashboard.forecastAvailableCubicMeters === null ? ` · Partie connue : ${volume(dashboard.knownForecastCubicMeters)} · ${reasons?.forecast ?? ''}` : ''}`} />
          <Summary label="Volume affectable" value={volume(dashboard.allocatableCubicMeters)} helpText={help.allocatable} detail={dashboard.requiresManualArbitration ? 'Maximum théorique avant votre choix' : 'Après sélection et seuil minimal'} />
          <Summary label="Volume satisfait" value={volume(dashboard.allocatedCubicMeters)} detail={`Dont chaîne connue : ${volume(dashboard.confirmedAllocatedCubicMeters)}`} />
          <Summary label="Déficit global" value={volume(dashboard.residualDeficitCubicMeters)} helpText={help.residual} detail={dashboard.residualDeficitCubicMeters === null && reasons ? reasons.need : dashboard.requiresManualArbitration ? 'Déficit minimal avant votre décision' : 'Besoins non couverts'} />
          <Summary label="Taux de couverture" value={percent(dashboard.coveragePercent)} helpText={help.coverage} detail={dashboard.confirmedCoveragePercent === null && reasons ? `Couverture confirmée : ${notComputableInline(reasons.need)}` : `Couverture confirmée : ${percent(dashboard.confirmedCoveragePercent)}`} />
          <Summary label="Volume non affecté" value={volume(dashboard.unallocatedCubicMeters)} detail={dashboard.withheldBelowThresholdCubicMeters > 0 ? `Dont sous seuil : ${volume(dashboard.withheldBelowThresholdCubicMeters)}` : 'Non consommé ni réservé par cette analyse'} />
        </div>
        {dashboard.potentialAdditionalCubicMeters > 0 ? <p className="feasibility-warning">Volume supplémentaire potentiellement utilisable : {volume(dashboard.potentialAdditionalCubicMeters)}. Son acheminement hydraulique reste à vérifier ; une couverture totale en volume ne prouve pas la faisabilité du planning.</p> : null}
        <details className="feasibility-sources"><summary>Voir les ressources prises en compte</summary><div className="feasibility-bed-grid">{dashboard.pools.map((pool) => <article key={pool.key}><strong>{pool.name}</strong><p>Actuel : {pool.currentCubicMeters === null ? notComputableInline('volume non renseigné') : volume(pool.currentCubicMeters)}<br />Prévisionnel restant : {pool.forecastCubicMeters === null ? notComputableInline('prévision inconnue') : volume(pool.forecastCubicMeters)}</p>{pool.reasons.map((reason) => <p key={reason}>{reason}</p>)}</article>)}</div></details>
      </details>
    </>}
  </section>;
}

/** Un niveau sans choix à faire : allocation automatique, en attente, ou choix plus applicable. */
function PriorityPanel({ level }: { level: PriorityFeasibility }) {
  return <details className="feasibility-priority"><summary><strong>Priorité {priorityLabel(level.priority)}</strong><span>Besoin {volume(level.knownNeedCubicMeters)} · Satisfait {volume(level.allocatedCubicMeters)} · Déficit {volume(level.residualCubicMeters)} · Couverture {percent(level.coveragePercent)}</span></summary>
    {level.arbitration === 'waiting' ? <p className="feasibility-warning">Résolvez d’abord la priorité précédente ou ses données manquantes.</p> : null}
    <div className="feasibility-bed-grid">{level.beds.map((row) => <article key={row.need.bedId} className="feasibility-bed" data-status={row.status}>
      <header><div><strong>{row.need.bedName}</strong><small>{row.need.zoneName} · {row.need.plotName}</small></div></header>
      <dl><div><dt>Besoin effectif</dt><dd>{mm(row.need.effectiveNeedMm)} · {volume(row.need.effectiveVolumeCubicMeters)}</dd></div><div><dt>Déficit actuel</dt><dd>{mm(row.need.realRemainingMm)} · {percent(row.need.relativeDeficitPercent)}</dd></div><div><dt>Allocation faisable <FeasibilityHelp label="Allocation faisable" text={help.allocation} /></dt><dd>{mm(row.allocatedMm)} · {volume(row.allocatedCubicMeters)}</dd></div><div><dt>Déficit résiduel <FeasibilityHelp label="Déficit résiduel" text={help.residual} /></dt><dd>{mm(row.residualMm)} · {volume(row.residualCubicMeters)}</dd></div><div><dt>Satisfaction</dt><dd>{percent(row.satisfactionPercent)}</dd></div></dl>
      {[row.need.effectiveNeedMm, row.need.effectiveVolumeCubicMeters, row.need.realRemainingMm, row.need.relativeDeficitPercent, row.allocatedMm, row.allocatedCubicMeters, row.residualMm, row.residualCubicMeters, row.satisfactionPercent].includes(null)
        ? <p className="need-unknown-reason">{notComputableLine(bedUnknownReason(row.need))}</p> : null}
      {row.need.manualOverrideMm !== null ? <p>Besoin manuel actif{row.need.overrideReason ? ` : ${row.need.overrideReason}` : ''}.</p> : null}
      <p className="feasibility-status">{statusLabels[row.status]}</p>
      {row.status === 'below_threshold' ? <p>Proposition brute : {volume(row.proposedCubicMeters)} · seuil {mm(row.need.thresholdMm)}. Volume non affecté.</p> : null}
      {row.reasons.map((reason) => <p className="feasibility-reason" key={reason}>{reason}</p>)}
    </article>)}</div>
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
