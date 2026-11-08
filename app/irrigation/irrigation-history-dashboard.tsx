'use client';

import { useMemo, useState, useTransition, type ReactNode } from 'react';
import type { IrrigationSnapshot } from '@/lib/domain/domain';
import type {
  HistoryPeriodMode,
  HistoryScopeInput,
  IrrigationHistoryItem,
} from '@/lib/domain/irrigation-history/contract';
import type {
  IrrigationHistoryDashboard,
  IrrigationHistorySelection,
} from '@/lib/services/irrigation-history-service';
import { irrigationCumulOrigin } from '@/lib/domain/irrigation-history/summary';
import { sortByNameNaturally } from '@/lib/domain/bed-order';
import {
  HISTORY_STATUS_FILTER_LABELS,
  HISTORY_STATUS_FILTERS,
  historyEmptyText,
  historyExportLabel,
  historyListCountText,
  type HistoryStatusFilter,
} from '@/lib/domain/irrigation-history/status-filter';
import { protectedSlotRealSignal } from '@/lib/domain/planning/follow-up';
import { loadIrrigationHistoryAction } from './irrigation-history-actions';
import { FigureOrigin } from './shell/figure-origin';

type Props = {
  season: number;
  snapshot: IrrigationSnapshot;
  initialDashboard: IrrigationHistoryDashboard;
  /** Le commutateur « Par périmètre / Par série », posé par la section qui l'entoure. */
  viewTabs?: ReactNode;
  /** Où saisir la pluie mesurée, quand « Objectifs et besoins » est cochée (audit ergonomique, point 11). */
  rainHref?: string | null;
};

const periodLabels: Record<HistoryPeriodMode, string> = {
  week: 'Semaine',
  month: 'Mois',
  season: 'Saison',
  custom: 'Personnalisé',
};

const numberFormatter = new Intl.NumberFormat('fr-FR', {
  maximumFractionDigits: 2,
});
const volumeFormatter = new Intl.NumberFormat('fr-FR', {
  maximumFractionDigits: 3,
});
const dateFormatter = new Intl.DateTimeFormat('fr-FR', {
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
  timeZone: 'Europe/Paris',
});
const dateTimeFormatter = new Intl.DateTimeFormat('fr-FR', {
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
  timeZone: 'Europe/Paris',
});
const timeFormatter = new Intl.DateTimeFormat('fr-FR', {
  hour: '2-digit',
  minute: '2-digit',
  timeZone: 'Europe/Paris',
});

export function IrrigationHistoryDashboardView({
  season,
  snapshot,
  initialDashboard,
  viewTabs = null,
  rainHref = null,
}: Props) {
  const [dashboard, setDashboard] = useState(initialDashboard);
  const [selection, setSelection] = useState<IrrigationHistorySelection>({
    period: {
      mode: initialDashboard.period.mode,
      anchorDate: initialDashboard.period.startDate,
      customStartDate: initialDashboard.period.startDate,
      customEndDate: initialDashboard.period.endDate,
    },
    scope: initialDashboard.scope,
    status: initialDashboard.statusFilter,
    page: initialDashboard.history.page,
  });
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  // Les filtres dans l'ordre naturel des noms : B9-9 avant B9-10 (audit ergonomique, point 4).
  const zones = useMemo(
    () => sortByNameNaturally(snapshot.zones.filter((zone) => zone.seasons.includes(season)), (zone) => zone.name, (zone) => zone.id),
    [snapshot.zones, season],
  );
  const plots = useMemo(
    () => sortByNameNaturally(snapshot.plots.filter((plot) => plot.seasons.includes(season)
      && (!selection.scope.zoneId || plot.zoneId === selection.scope.zoneId)), (plot) => plot.name, (plot) => plot.id),
    [snapshot.plots, season, selection.scope.zoneId],
  );
  const beds = useMemo(
    () => sortByNameNaturally(snapshot.beds.filter((bed) => bed.seasons.includes(season)
      && (!selection.scope.zoneId || bed.zoneId === selection.scope.zoneId)
      && (!selection.scope.plotId || bed.plotId === selection.scope.plotId)), (bed) => bed.name, (bed) => bed.id),
    [snapshot.beds, season, selection.scope.plotId, selection.scope.zoneId],
  );

  function load(next: IrrigationHistorySelection) {
    setSelection(next);
    setError(null);
    startTransition(async () => {
      const result = await loadIrrigationHistoryAction({ season, selection: next });
      if (!result.ok) {
        setError(result.message);
        return;
      }
      setDashboard(result.dashboard);
      setSelection((current) => ({
        ...current,
        period: {
          ...current.period,
          mode: result.dashboard.period.mode,
          anchorDate: result.dashboard.period.startDate,
          customStartDate: result.dashboard.period.startDate,
          customEndDate: result.dashboard.period.endDate,
        },
        scope: result.dashboard.scope,
        status: result.dashboard.statusFilter,
        page: result.dashboard.history.page,
      }));
    });
  }

  function changeMode(mode: HistoryPeriodMode) {
    const anchorDate = dateInSeason(new Date(), season);
    load({
      ...selection,
      period: {
        mode,
        anchorDate,
        customStartDate: dashboard.period.startDate,
        customEndDate: dashboard.period.endDate,
      },
      page: 1,
    });
  }

  function navigatePeriod(direction: -1 | 1) {
    const mode = selection.period.mode;
    const anchorDate = mode === 'week'
      ? addDays(dashboard.period.startDate, direction * 7)
      : addMonths(dashboard.period.startDate, direction);
    load({
      ...selection,
      period: { ...selection.period, anchorDate },
      page: 1,
    });
  }

  function applyScope(scope: HistoryScopeInput) {
    load({ ...selection, scope, page: 1 });
  }

  function applyStatus(status: HistoryStatusFilter) {
    load({ ...selection, status, page: 1 });
  }

  const exportHref = csvHref(season, dashboard, selection);
  const statusFilter = dashboard.statusFilter;
  const exportLabel = historyExportLabel(statusFilter, dashboard.period.mode === 'season' ? `saison ${season}` : periodTitle(dashboard));
  const rainMissing = !dashboard.summary.actualRainAvailability.complete;
  const rainAction = rainMissing && rainHref ? { href: rainHref, label: 'Saisir la pluie' } : null;
  // L'écart manque à cause de la pluie seulement si un objectif existe : sans objectif, la pluie n'y suffirait pas.
  const gapWaitsForRain = dashboard.summary.gapToObjectiveMm === null && rainMissing && dashboard.summary.objectiveAvailability.availableBedDays > 0;
  const canNavigateBack = dashboard.period.startDate > `${season}-01-01`;
  const canNavigateForward = dashboard.period.endDate < `${season}-12-31`;

  return (
    <section className="irrigation-history-dashboard" aria-labelledby="irrigation-history-title">
      <header className="irrigation-history-heading">
        <div>
          <p className="eyebrow">Suivi réel · saison {season}</p>
          <h2 id="irrigation-history-title">Cumuls et historique</h2>
          <p>Analysez l’eau réellement appliquée, la météo observée et les objectifs historisés.</p>
        </div>
        <a className="history-export-button" href={exportHref}>{exportLabel}</a>
      </header>

      {viewTabs}

      <div className="history-controls" aria-busy={pending}>
        <div className="history-control-block">
          <strong>Période</strong>
          <div className="history-period-tabs" role="tablist" aria-label="Période d’analyse">
            {(Object.keys(periodLabels) as HistoryPeriodMode[]).map((mode) => (
              <button
                key={mode}
                type="button"
                role="tab"
                aria-selected={selection.period.mode === mode}
                data-active={selection.period.mode === mode}
                disabled={pending}
                onClick={() => changeMode(mode)}
              >
                {periodLabels[mode]}
              </button>
            ))}
          </div>

          {selection.period.mode === 'week' || selection.period.mode === 'month' ? (
            <div className="history-period-navigation">
              <button type="button" disabled={pending || !canNavigateBack} onClick={() => navigatePeriod(-1)}>
                ← Précédent
              </button>
              <span>{periodTitle(dashboard)}</span>
              <button type="button" disabled={pending || !canNavigateForward} onClick={() => navigatePeriod(1)}>
                Suivant →
              </button>
            </div>
          ) : selection.period.mode === 'season' ? (
            <p className="history-period-title">Saison {season} · {formatDateRange(dashboard)}</p>
          ) : (
            <div className="history-custom-dates">
              <label>
                <span>Date de début</span>
                <input
                  type="date"
                  min={`${season}-01-01`}
                  max={`${season}-12-31`}
                  value={selection.period.customStartDate ?? ''}
                  onChange={(event) => setSelection((current) => ({
                    ...current,
                    period: { ...current.period, customStartDate: event.target.value },
                  }))}
                />
              </label>
              <label>
                <span>Date de fin</span>
                <input
                  type="date"
                  min={`${season}-01-01`}
                  max={`${season}-12-31`}
                  value={selection.period.customEndDate ?? ''}
                  onChange={(event) => setSelection((current) => ({
                    ...current,
                    period: { ...current.period, customEndDate: event.target.value },
                  }))}
                />
              </label>
              <button type="button" disabled={pending} onClick={() => load({ ...selection, page: 1 })}>
                Appliquer
              </button>
            </div>
          )}
        </div>

        <div className="history-control-block">
          <strong>Filtres</strong>
          <div className="history-scope-filters">
            <label>
              <span>Ferme</span>
              <select value="farm" disabled aria-label="Ferme sélectionnée">
                <option value="farm">{snapshot.structure.name}</option>
              </select>
            </label>
            <label>
              <span>Parcelle</span>
              <select
                value={selection.scope.zoneId ?? ''}
                disabled={pending}
                onChange={(event) => {
                  const zoneId = event.target.value || null;
                  applyScope(zoneId
                    ? { level: 'zone', zoneId, plotId: null, bedId: null }
                    : { level: 'farm', zoneId: null, plotId: null, bedId: null });
                }}
              >
                <option value="">Toutes les parcelles</option>
                {zones.map((zone) => <option key={zone.id} value={zone.id}>{zone.name}</option>)}
              </select>
            </label>
            <label>
              <span>Jardin ou abri</span>
              <select
                value={selection.scope.plotId ?? ''}
                disabled={pending || !selection.scope.zoneId}
                onChange={(event) => {
                  const plotId = event.target.value || null;
                  applyScope(plotId
                    ? { level: 'plot', zoneId: selection.scope.zoneId, plotId, bedId: null }
                    : { level: 'zone', zoneId: selection.scope.zoneId, plotId: null, bedId: null });
                }}
              >
                <option value="">Tous les jardins et abris</option>
                {plots.map((plot) => <option key={plot.id} value={plot.id}>{plot.name}</option>)}
              </select>
            </label>
            <label>
              <span>Planche</span>
              <select
                value={selection.scope.bedId ?? ''}
                disabled={pending || !selection.scope.plotId}
                onChange={(event) => {
                  const bedId = event.target.value || null;
                  applyScope(bedId
                    ? {
                        level: 'bed',
                        zoneId: selection.scope.zoneId,
                        plotId: selection.scope.plotId,
                        bedId,
                      }
                    : {
                        level: 'plot',
                        zoneId: selection.scope.zoneId,
                        plotId: selection.scope.plotId,
                        bedId: null,
                      });
                }}
              >
                <option value="">Toutes les planches</option>
                {beds.map((bed) => <option key={bed.id} value={bed.id}>{bed.name}</option>)}
              </select>
            </label>
          </div>
          <p className="history-active-scope">Périmètre analysé : <strong>{dashboard.scopeLabel}</strong></p>
        </div>
      </div>

      {error ? <p className="history-error" role="alert">{error}</p> : null}
      {pending ? <p className="history-loading" role="status">Mise à jour des cumuls…</p> : null}

      <div className="history-summary-grid">
        <SummaryCard
          label="Irrigation"
          value={dashboard.summary.irrigationCubicMeters}
          unit="m³"
          formatter={volumeFormatter}
          availability={dashboard.summary.irrigationVolumeIncomplete ? 'incomplet : une irrigation sans surface mouillée connue' : null}
        />
        <SummaryCard label="Apport irrigation" value={dashboard.summary.irrigationMm} unit="mm" origin={irrigationCumulOrigin(dashboard.summary)} />
        <SummaryCard label="Surface irriguée" value={dashboard.summary.irrigatedAreaSquareMeters} unit="m²" />
        <SummaryCard
          label="Pluie réelle"
          value={dashboard.summary.actualRainMm}
          unit="mm"
          availability={availabilityText(dashboard.summary.actualRainAvailability)}
          action={rainAction}
        />
        <SummaryCard
          label="ET0"
          value={dashboard.summary.et0Mm}
          unit="mm"
          availability={availabilityText(dashboard.summary.et0Availability)}
        />
        <SummaryCard
          label="Objectif"
          value={dashboard.summary.objectiveMm}
          unit="mm"
          availability={objectiveAvailabilityText(dashboard.summary.objectiveAvailability)}
        />
        <SummaryCard
          label="Écart à l’objectif"
          value={dashboard.summary.gapToObjectiveMm}
          unit="mm"
          signed
          tone={gapTone(dashboard.summary.gapToObjectiveMm)}
          availability={gapWaitsForRain ? 'pluie réelle incomplète' : null}
          missingAction={gapWaitsForRain ? rainAction : null}
        />
      </div>

      {dashboard.warnings.length > 0 ? (
        <div className="history-warnings">
          {dashboard.warnings.map((warning) => <p key={warning}>{warning}</p>)}
        </div>
      ) : null}

      <div className="history-list-heading">
        <div>
          <h3>Historique</h3>
          <p>{historyListCountText(dashboard.history.totalItems, statusFilter)}</p>
        </div>
        <div className="history-status-tabs" role="tablist" aria-label="Irrigations listées">
          {HISTORY_STATUS_FILTERS.map((filter) => (
            <button
              key={filter}
              type="button"
              role="tab"
              aria-selected={statusFilter === filter}
              data-active={statusFilter === filter}
              disabled={pending}
              onClick={() => applyStatus(filter)}
            >
              {HISTORY_STATUS_FILTER_LABELS[filter]} <small>{dashboard.statusCounts[filter]}</small>
            </button>
          ))}
        </div>
      </div>

      {dashboard.history.items.length > 0 ? (
        <div className="history-event-list">
          {dashboard.history.items.map((item) => <HistoryItem key={item.eventEquipmentId} item={item} />)}
        </div>
      ) : (
        <p className="history-empty">{historyEmptyText(statusFilter, dashboard.statusCounts)}</p>
      )}

      {dashboard.history.totalPages > 1 ? (
        <nav className="history-pagination" aria-label="Pages de l’historique">
          <button
            type="button"
            disabled={pending || dashboard.history.page <= 1}
            onClick={() => load({ ...selection, page: dashboard.history.page - 1 })}
          >
            ← Précédente
          </button>
          <span>Page {dashboard.history.page} sur {dashboard.history.totalPages}</span>
          <button
            type="button"
            disabled={pending || dashboard.history.page >= dashboard.history.totalPages}
            onClick={() => load({ ...selection, page: dashboard.history.page + 1 })}
          >
            Suivante →
          </button>
        </nav>
      ) : null}
    </section>
  );
}

function SummaryCard({
  label,
  value,
  unit,
  signed = false,
  availability = null,
  tone,
  formatter = numberFormatter,
  origin = null,
  action = null,
  missingAction = null,
}: {
  label: string;
  value: number | null;
  unit: string;
  signed?: boolean;
  availability?: string | null;
  tone?: string;
  formatter?: Intl.NumberFormat;
  origin?: string | null;
  /** Un geste qui complète la donnée, sous la valeur (audit ergonomique, point 11). */
  action?: { href: string; label: string } | null;
  /** Le geste qui remplace « Donnée indisponible » quand la valeur manque. */
  missingAction?: { href: string; label: string } | null;
}) {
  const replaced = value === null && missingAction;
  return (
    <article className="history-summary-card" data-tone={tone}>
      <span>{label}</span>
      {replaced
        ? <a className="history-summary-action is-main" href={missingAction.href}>{missingAction.label}</a>
        : <strong>{value === null
          ? 'Donnée indisponible'
          : `${signed && value > 0 ? '+' : ''}${formatter.format(value)} ${unit}`}<FigureOrigin text={origin} /></strong>}
      {availability ? <small>{availability}</small> : null}
      {action && !replaced ? <a className="history-summary-action" href={action.href}>{action.label}</a> : null}
    </article>
  );
}

function HistoryItem({ item }: { item: IrrigationHistoryItem }) {
  const showsActual = item.status === 'completed' || item.status === 'partially_completed';
  // 3.8 ter, règle 11 : faite pendant un créneau protégé, enregistrée telle quelle, sans suggestion.
  const protectedSignal = protectedSlotRealSignal(item.protectedSlotNames);
  return (
    <details className="history-event-card">
      <summary>
        <span className="history-event-date">{formatDate(item.date)}</span>
        <span className="history-event-main">
          <strong>{item.locationLabel} · {item.equipmentName}</strong>
          <small>{item.settingName}</small>
          {protectedSignal ? <small className="history-event-signal">{protectedSignal}</small> : null}
        </span>
        <span className="history-event-measures">
          {showsActual ? <strong>{numberFormatter.format(item.actualAmountMm)} mm · {item.actualCubicMeters === null ? 'volume inconnu' : `${volumeFormatter.format(item.actualCubicMeters)} m³`}</strong> : null}
          <em data-status={item.status}>{item.statusLabel}</em>
        </span>
      </summary>
      <div className="history-event-detail">
        <dl>
          <Detail label="Date" value={formatDate(item.date)} />
          <Detail label="Début réel" value={formatDateTime(item.actualStartAt)} />
          <Detail label="Fin réelle" value={formatDateTime(item.actualEndAt)} />
          <Detail label="Durée réelle" value={formatDuration(item.actualDurationSeconds)} />
          <Detail label="Début prévu" value={formatDateTime(item.plannedStartAt)} />
          <Detail label="Fin prévue" value={formatDateTime(item.plannedEndAt)} />
          <Detail label="Matériel historique" value={item.equipmentName} />
          <Detail label="Réglage historique" value={item.settingName} />
          <Detail label="Pompe historique" value={item.pumpName ?? 'Non renseignée · faisabilité non vérifiée'} />
          <Detail label="Débit demandé" value={item.requestedFlowCubicMetersPerHour === null || item.requestedFlowCubicMetersPerHour === undefined ? 'Non vérifié' : `${volumeFormatter.format(item.requestedFlowCubicMetersPerHour)} m³/h`} />
          <Detail label="Débit maximal historique" value={item.pumpMaximumFlowCubicMetersPerHour === null || item.pumpMaximumFlowCubicMetersPerHour === undefined ? '—' : `${volumeFormatter.format(item.pumpMaximumFlowCubicMetersPerHour)} m³/h`} />
          <Detail label="Origine historique" value={item.pumpOriginName ?? 'Non renseignée'} />
          <Detail label="Placement" value={item.placementLabel} />
          <Detail label="Parcelle" value={item.zoneName ?? '—'} />
          <Detail label="Jardin(s) ou abri(s)" value={item.plotNames.join(', ') || '—'} />
          <Detail label="Planche(s)" value={item.bedNames.join(', ') || '—'} />
          <Detail label="Apport réel" value={showsActual ? `${numberFormatter.format(item.actualAmountMm)} mm` : '0 mm'} />
          <Detail label="Volume réel" value={!showsActual ? '0 m³' : item.actualCubicMeters === null ? '— (surface mouillée inconnue)' : `${volumeFormatter.format(item.actualCubicMeters)} m³`} />
          <Detail label="Surface concernée" value={showsActual ? `${numberFormatter.format(item.irrigatedAreaSquareMeters)} m²` : '0 m²'} />
          <Detail label="Surface mouillée" value={item.wettedAreaSquareMeters === null ? item.wettedAreaLabel : `${numberFormatter.format(item.wettedAreaSquareMeters)} m² — ${item.wettedAreaLabel}`} />
          <Detail label="Objectif initial" value={item.initialObjectiveMm === null ? 'Non historisé' : `${numberFormatter.format(item.initialObjectiveMm)} mm`} />
          <Detail label="Statut" value={item.statusLabel} />
          <Detail label="Mode de création" value={item.modeLabel} />
        </dl>
        {item.note ? <p className="history-event-note"><strong>Note :</strong> {item.note}</p> : null}
        <div className="history-timeline">
          <h4>Chronologie</h4>
          {item.timeline.length > 0 ? (
            <ol>
              {item.timeline.map((entry, index) => (
                <li key={`${entry.at}-${entry.label}-${index}`}>
                  <time dateTime={entry.at}>{formatTime(entry.at)}</time>
                  <span>{entry.label}</span>
                </li>
              ))}
            </ol>
          ) : <p>Aucun événement technique détaillé disponible.</p>}
        </div>
      </div>
    </details>
  );
}

function Detail({ label, value }: { label: string; value: string }) {
  return <div><dt>{label}</dt><dd>{value}</dd></div>;
}

function periodTitle(dashboard: IrrigationHistoryDashboard) {
  if (dashboard.period.mode === 'month') {
    const date = new Date(`${dashboard.period.startDate}T12:00:00Z`);
    return new Intl.DateTimeFormat('fr-FR', { month: 'long', year: 'numeric', timeZone: 'UTC' }).format(date);
  }
  return formatDateRange(dashboard);
}

function formatDateRange(dashboard: IrrigationHistoryDashboard) {
  return `du ${formatDateKey(dashboard.period.startDate)} au ${formatDateKey(dashboard.period.endDate)}`;
}

function formatDateKey(dateKey: string) {
  return dateFormatter.format(new Date(`${dateKey}T12:00:00Z`));
}

function formatDate(value: string) {
  const date = new Date(value);
  return Number.isFinite(date.getTime()) ? dateFormatter.format(date) : '—';
}

function formatDateTime(value: string | null) {
  if (!value) return '—';
  const date = new Date(value);
  return Number.isFinite(date.getTime()) ? dateTimeFormatter.format(date) : '—';
}

function formatTime(value: string) {
  const date = new Date(value);
  return Number.isFinite(date.getTime()) ? timeFormatter.format(date) : '—';
}

function formatDuration(seconds: number) {
  if (!Number.isFinite(seconds) || seconds <= 0) return '—';
  const minutes = Math.round(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const remainder = minutes % 60;
  return hours > 0 ? `${hours} h ${String(remainder).padStart(2, '0')} min` : `${minutes} min`;
}

function availabilityText(value: { availableDays: number; totalDays: number; complete: boolean }) {
  if (value.complete) return null;
  return `${value.availableDays}/${value.totalDays} jour(s) disponible(s)`;
}

function objectiveAvailabilityText(value: { availableBedDays: number; totalBedDays: number; complete: boolean }) {
  if (value.complete) return null;
  if (value.availableBedDays === 0) return 'Aucun objectif sur la période';
  return `Objectif posé sur ${value.availableBedDays}/${value.totalBedDays} journée(s)-planche`;
}

function gapTone(value: number | null) {
  if (value === null || value === 0) return 'neutral';
  return value > 0 ? 'deficit' : 'surplus';
}

function csvHref(
  season: number,
  dashboard: IrrigationHistoryDashboard,
  selection: IrrigationHistorySelection,
) {
  const params = new URLSearchParams({
    season: String(season),
    mode: dashboard.period.mode,
    level: dashboard.scope.level,
    anchor: dashboard.period.startDate,
    start: dashboard.period.startDate,
    end: dashboard.period.endDate,
  });
  if (selection.scope.zoneId) params.set('zone', selection.scope.zoneId);
  if (selection.scope.plotId) params.set('plot', selection.scope.plotId);
  if (selection.scope.bedId) params.set('bed', selection.scope.bedId);
  params.set('status', dashboard.statusFilter);
  return `/irrigation/historique.csv?${params.toString()}`;
}

function addDays(dateKey: string, days: number) {
  const date = new Date(`${dateKey}T12:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

function addMonths(dateKey: string, months: number) {
  const date = new Date(`${dateKey.slice(0, 7)}-15T12:00:00Z`);
  date.setUTCMonth(date.getUTCMonth() + months);
  return date.toISOString().slice(0, 10);
}

function dateInSeason(date: Date, season: number) {
  const monthDay = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Europe/Paris',
    month: '2-digit',
    day: '2-digit',
  }).format(date);
  return `${season}-${monthDay}`;
}
