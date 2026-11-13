'use client';

import { useEffect, useMemo, useRef, useState, useTransition } from 'react';
import type { IrrigationSnapshot } from '@/lib/domain/domain';
import type { WaterDashboard } from '@/lib/services/water-dashboard';
import { actualRainOrigin, addDaysToDateKey, dateKeyInTimeZone, isValidDateKey, manualRainInput, weekStartDateKey } from '@/lib/domain/water-management';
import { FARM_SCOPE_VALUE } from '@/lib/domain/goal-scope-choices';
import { pageHref } from '@/lib/domain/features/pages';
import { FigureOrigin } from './shell/figure-origin';
import { Icon, type IconName } from './line-icon';
import { GoalScopePicker } from './goal-scope-picker';
import type { WeatherLocationCandidate } from '@/lib/domain/weather/weather-provider';
import {
  finishManualWeatherRefresh,
  tryStartManualWeatherRefresh,
} from '@/lib/domain/weather/refresh-control';
import {
  clearHydricGoalsAction,
  loadWaterDashboardAction,
  saveDailyWaterLimitAction,
  saveHydricGoalAction,
  removeManualRainfallAction,
  saveManualRainfallAction,
  saveWeatherLocationAction,
  searchWeatherLocationsAction,
  restoreOtfWeatherLocationAction,
  type WaterActionResult,
} from './water-actions';

const mm = new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 1 });
const cubicMeters = new Intl.NumberFormat('fr-FR', {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});
const dateFormatter = new Intl.DateTimeFormat('fr-FR', {
  weekday: 'short',
  day: 'numeric',
  month: 'short',
  year: 'numeric',
  timeZone: 'UTC',
});
const dateTimeFormatter = new Intl.DateTimeFormat('fr-FR', {
  dateStyle: 'short',
  timeStyle: 'short',
  timeZone: 'Europe/Paris',
});

/**
 * Le tableau de l'eau de la semaine, rangé en trois parts depuis la 3.8
 * (docs/feature-selection-contract.md, section 5) : les objectifs, la météo,
 * la pluie mesurée et les jours (« Objectifs et besoins ») ; l'eau du jour et
 * la limite journalière (« Arrosages », précision P15) ; la météo de référence
 * seule (« Réglages »). La commune ne se change que dans Réglages ; la page des
 * besoins montre la météo de référence et un lien vers ce réglage (audit
 * ergonomique, point 9, 3.8 quater). Les encarts d'alertes ont leurs pages.
 */
export type WaterDashboardPart = 'besoins' | 'arrosages' | 'reglages';

export function WaterManagementDashboard({
  season,
  snapshot,
  initialDashboard,
  part = 'besoins',
}: {
  season: number;
  snapshot: IrrigationSnapshot;
  initialDashboard: WaterDashboard;
  part?: WaterDashboardPart;
}) {
  const [dashboard, setDashboard] = useState(initialDashboard);
  const clearDialog = useRef<HTMLDialogElement>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [scope, setScope] = useState(FARM_SCOPE_VALUE);
  const [goalAmount, setGoalAmount] = useState('');
  const [city, setCity] = useState('');
  const [postcode, setPostcode] = useState('');
  const [candidates, setCandidates] = useState<WeatherLocationCandidate[]>([]);
  const [rainDate, setRainDate] = useState(() => dateKeyInTimeZone(new Date()));
  // La mesure déjà saisie pour le jour choisi (détail de la recette 3.7) : le champ la montre, on la corrige sur place.
  const [rainAmount, setRainAmount] = useState(() => manualRainInput(initialDashboard.days, dateKeyInTimeZone(new Date())) ?? '');
  // Le numéro du dernier choix de jour : seule sa réponse compte (point ouvert 50).
  const rainDateChoice = useRef(0);
  const today = dateKeyInTimeZone(new Date());
  const activeLimit = useMemo(
    () => dashboard.limits.find(
      (limit) => limit.validFrom <= today && (limit.validUntil === null || limit.validUntil >= today),
    ) ?? dashboard.limits[0] ?? null,
    [dashboard.limits, today],
  );
  const [limitEnabled, setLimitEnabled] = useState(activeLimit?.enabled ?? false);
  const [limitAmount, setLimitAmount] = useState(
    activeLimit?.maxCubicMetersPerDay?.toString() ?? '',
  );
  const [limitFrom, setLimitFrom] = useState(activeLimit?.validFrom ?? `${season}-01-01`);
  const [limitUntil, setLimitUntil] = useState(activeLimit?.validUntil ?? '');
  const [limitNote, setLimitNote] = useState(activeLimit?.note ?? '');
  const [pending, startTransition] = useTransition();
  const weatherRefreshGate = useRef({ running: false });
  const [weatherRefreshing, setWeatherRefreshing] = useState(false);
  const [weatherClock, setWeatherClock] = useState(0);

  const currentDay = dashboard.todayWater;
  const farmGoal = dashboard.goals.find((goal) => goal.scopeType === 'farm');
  const missingEt0Dates = dashboard.days.filter((day) => day.et0Mm === null).map((day) => day.date);
  const missingActualRainDates = dashboard.days.filter((day) => day.date <= today && day.effectiveActualRainMm === null).map((day) => day.date);
  const missingForecastRainDates = dashboard.days.filter((day) => day.date >= today && day.forecastRainMm === null).map((day) => day.date);
  const weatherCooldown = dashboard.weather.nextRefreshAllowedAt !== null && (
    weatherClock === 0 || Date.parse(dashboard.weather.nextRefreshAllowedAt) > weatherClock
  );

  const receive = (result: WaterActionResult) => {
    if (!result.ok) {
      setError(result.message);
      setNotice(null);
      return;
    }
    setDashboard(result.dashboard);
    window.dispatchEvent(new CustomEvent('irrigation-needs-source-changed', {
      detail: { weekStart: result.dashboard.weekStart },
    }));
    setNotice(result.message);
    setError(null);
  };

  /**
   * Le jour de la pluie mesurée change : le champ montre sa mesure ; hors de la semaine affichée, la semaine suit.
   * Le dernier jour choisi l'emporte : la semaine d'un jour choisi plus tôt, arrivée après un autre choix, ne
   * remplace ni la semaine affichée ni le champ (docs/irrigation-needs-contract.md, point ouvert 50).
   */
  const chooseRainDate = (date: string) => {
    const choice = rainDateChoice.current + 1;
    rainDateChoice.current = choice;
    setRainDate(date);
    if (!isValidDateKey(date)) return;
    const shown = manualRainInput(dashboard.days, date);
    if (shown !== null) {
      setRainAmount(shown);
      return;
    }
    setRainAmount('');
    startTransition(async () => {
      const result = await loadWaterDashboardAction({ season, weekStart: weekStartDateKey(date) });
      if (choice !== rainDateChoice.current) return;
      receive(result);
      if (result.ok) setRainAmount(manualRainInput(result.dashboard.days, date) ?? '');
    });
  };

  /** Après l'enregistrement ou le retrait d'une mesure, le champ montre ce qui est enregistré. */
  const receiveRain = (result: WaterActionResult, date: string) => {
    receive(result);
    if (result.ok) setRainAmount(manualRainInput(result.dashboard.days, date) ?? '');
  };

  const loadWeek = (weekStart: string, forceWeatherRefresh = false) => {
    startTransition(async () => {
      receive(await loadWaterDashboardAction({ season, weekStart, forceWeatherRefresh }));
    });
  };

  const refreshWeatherNow = () => {
    if (!tryStartManualWeatherRefresh(weatherRefreshGate.current)) return;
    setWeatherRefreshing(true);
    startTransition(async () => {
      try {
        receive(await loadWaterDashboardAction({
          season,
          weekStart: dashboard.weekStart,
          forceWeatherRefresh: true,
        }));
      } finally {
        finishManualWeatherRefresh(weatherRefreshGate.current);
        setWeatherRefreshing(false);
      }
    });
  };

  useEffect(() => {
    if (!dashboard.weather.nextRefreshAllowedAt) return;
    const allowedAt = dashboard.weather.nextRefreshAllowedAt
      ? Date.parse(dashboard.weather.nextRefreshAllowedAt)
      : Number.NaN;
    const now = Date.now();
    if (!Number.isFinite(allowedAt)) return;
    const timeout = window.setTimeout(
      () => setWeatherClock(Date.now()),
      Math.max(0, allowedAt - now + 50),
    );
    return () => window.clearTimeout(timeout);
  }, [dashboard.weather.nextRefreshAllowedAt]);

  useEffect(() => {
    const refreshAfterIrrigation = () => {
      startTransition(async () => {
        const result = await loadWaterDashboardAction({
          season,
          weekStart: dashboard.weekStart,
          allowWeatherRefresh: false,
        });
        if (result.ok) {
          setDashboard(result.dashboard);
        } else {
          setError(result.message);
        }
      });
    };
    // Une irrigation, ou un objectif enregistré ailleurs (une proposition adoptée, 5 quater).
    const signals = ['irrigation-events-changed', 'irrigation-goals-changed'];
    signals.forEach((name) => window.addEventListener(name, refreshAfterIrrigation));
    return () => signals.forEach((name) => window.removeEventListener(name, refreshAfterIrrigation));
  }, [dashboard.weekStart, season]);

  const saveGoal = () => {
    const target = parseGoalScope(scope);
    startTransition(async () => {
      receive(await saveHydricGoalAction({
        season,
        weekStart: dashboard.weekStart,
        amountMm: numeric(goalAmount),
        ...target,
      }));
    });
  };

  const clearGoals = () => {
    clearDialog.current?.close();
    startTransition(async () => {
      receive(await clearHydricGoalsAction({
        season,
        weekStart: dashboard.weekStart,
        confirmed: true,
      }));
    });
  };

  const searchLocations = () => {
    setError(null);
    startTransition(async () => {
      const result = await searchWeatherLocationsAction({ city, postcode });
      if (!result.ok) {
        setError(result.message);
        setCandidates([]);
        return;
      }
      setCandidates(result.candidates);
      setNotice(`${result.candidates.length} commune${result.candidates.length > 1 ? 's' : ''} trouvée${result.candidates.length > 1 ? 's' : ''}.`);
    });
  };

  if (part === 'arrosages') {
    return (
      <section className="water-management-section" aria-labelledby="water-today-title" data-tour="eau-du-jour">
        <header className="water-management-heading">
          <div>
            <h2 id="water-today-title">L’eau du jour</h2>
            <p>Le volume du jour et la limite journalière, appliquée aux nouvelles irrigations en cours ou planifiées.</p>
          </div>
        </header>
        {notice ? <p className="water-notice" role="status">{notice}</p> : null}
        {error ? <p className="water-error" role="alert">{error}</p> : null}

        <div className="today-water-card">
          <div>
            <span className="eyebrow">Eau aujourd’hui</span>
            <strong>{currentDay?.limitCubicMeters === null || !currentDay
              ? 'Aucune limite active'
              : `${cubicMeters.format(currentDay.limitCubicMeters)} m³ maximum`}</strong>
          </div>
          <TodayMetric label="Réalisé" value={currentDay?.realizedIrrigationCubicMeters ?? 0} />
          {currentDay.estimatedOngoingCubicMeters > 0 ? <TodayMetric label="En cours estimé" value={currentDay.estimatedOngoingCubicMeters} /> : null}
          <TodayMetric label="Planifié" value={currentDay?.plannedIrrigationCubicMeters ?? 0} />
          <TodayMetric
            label={currentDay.actualLimitExceededByCubicMeters > 0 ? 'Dépassement réel' : currentDay.limitExceededByCubicMeters > 0 ? 'Dépassement prévu' : 'Disponible'}
            value={currentDay?.limitCubicMeters === null || !currentDay
              ? null
              : currentDay.limitExceededByCubicMeters > 0
                ? currentDay.actualLimitExceededByCubicMeters || currentDay.limitExceededByCubicMeters
                : Math.max(0, currentDay.limitCubicMeters - currentDay.realizedIrrigationCubicMeters - currentDay.plannedIrrigationCubicMeters - currentDay.estimatedOngoingCubicMeters)}
            warning={Boolean(currentDay && currentDay.limitExceededByCubicMeters > 0)}
          />
        </div>

        {dashboard.days.some((day) => day.estimatedOngoingCubicMeters > 0) || currentDay.estimatedOngoingCubicMeters > 0
          ? <p className="weather-stale">Un minuteur attend encore la confirmation de ses horaires réels. Son volume en cours est une estimation, réservée dans le budget mais non ajoutée au réalisé confirmé.</p> : null}

        <div className="water-dashboard-columns">
          <article className="water-panel">
            <div className="water-panel-title"><div><h3>Limite journalière d’irrigation</h3><p>Règle forte appliquée aux nouvelles irrigations en cours ou planifiées.</p></div></div>
            <label className="water-toggle"><input type="checkbox" checked={limitEnabled} onChange={(event) => setLimitEnabled(event.target.checked)} /> Activer la limite</label>
            <div className="water-inline-form water-limit-form">
              <label><span>m³ / jour</span><input disabled={!limitEnabled} inputMode="decimal" value={limitAmount} onChange={(event) => setLimitAmount(event.target.value)} /></label>
              <label><span>Du</span><input type="date" value={limitFrom} onChange={(event) => setLimitFrom(event.target.value)} /></label>
              <label><span>Au</span><input type="date" value={limitUntil} onChange={(event) => setLimitUntil(event.target.value)} /></label>
              <label><span>Note facultative</span><input value={limitNote} onChange={(event) => setLimitNote(event.target.value)} /></label>
              <button type="button" disabled={pending} onClick={() => startTransition(async () => receive(await saveDailyWaterLimitAction({ season, weekStart: dashboard.weekStart, enabled: limitEnabled, maxCubicMetersPerDay: limitEnabled ? numeric(limitAmount) : null, validFrom: limitFrom, validUntil: limitUntil, note: limitNote })))}>Enregistrer</button>
            </div>
          </article>
        </div>
      </section>
    );
  }

  if (part === 'reglages') {
    return (
      <section className="water-management-section" aria-labelledby="water-weather-title">
        <header className="water-management-heading">
          <div>
            <h2 id="water-weather-title">Lieu de la météo</h2>
            <p>La commune dont la météo sert aux besoins, à la réserve du sol et aux alertes.</p>
          </div>
        </header>
        {notice ? <p className="water-notice" role="status">{notice}</p> : null}
        {error ? <p className="water-error" role="alert">{error}</p> : null}

        <div className="water-dashboard-columns">
          <article className="water-panel">
            <div className="water-panel-title"><div><h3>Météo de référence</h3><p>{dashboard.weather.location?.displayName ?? dashboard.weather.requestedLocationLabel ?? 'Commune non définie'}</p></div><button type="button" disabled={pending || weatherRefreshing || weatherCooldown || !dashboard.weather.locationKey} onClick={refreshWeatherNow}>{weatherRefreshing ? 'Actualisation…' : 'Actualiser la météo'}</button></div>
            {dashboard.weather.error ? <p className="weather-stale" role="status">{dashboard.weather.error} Les dernières valeurs valides restent affichées.{weatherCooldown && dashboard.weather.preference.refreshNotBeforeAt ? ` Nouvelle tentative possible à ${dateTimeFormatter.format(new Date(dashboard.weather.preference.refreshNotBeforeAt))}.` : ''}</p> : null}
            {dashboard.weather.refreshedAt ? <p className={dashboard.weather.stale ? 'weather-stale' : 'weather-fresh'}>Dernière mise à jour : {dateTimeFormatter.format(new Date(dashboard.weather.refreshedAt))}{dashboard.weather.stale ? ' · données anciennes' : ''}</p> : null}
            {dashboard.weather.preference.lastAutomaticRefreshSuccessAt ? <p className="weather-fresh">Dernière synchronisation automatique : {dateTimeFormatter.format(new Date(dashboard.weather.preference.lastAutomaticRefreshSuccessAt))}</p> : null}
            <div className="water-inline-form">
              <label><span>Commune</span><input value={city} onChange={(event) => setCity(event.target.value)} /></label>
              <label><span>Code postal</span><input value={postcode} onChange={(event) => setPostcode(event.target.value)} /></label>
              <button type="button" disabled={pending} onClick={searchLocations}>Rechercher</button>
            </div>
            {candidates.length > 0 ? <div className="weather-candidates">{candidates.map((candidate) => <button key={`${candidate.latitude}:${candidate.longitude}`} type="button" disabled={pending} onClick={() => startTransition(async () => { receive(await saveWeatherLocationAction({ season, weekStart: dashboard.weekStart, candidate })); setCandidates([]); })}>{candidate.displayName}</button>)}</div> : null}
            {dashboard.weather.preference.locationMode === 'custom' ? <button type="button" className="secondary-button" disabled={pending} onClick={() => startTransition(async () => receive(await restoreOtfWeatherLocationAction({ season, weekStart: dashboard.weekStart })))}>Utiliser la commune du siège OTF</button> : null}
            <small>{dashboard.weather.location ? `Coordonnées utilisées : ${dashboard.weather.location.latitude.toFixed(4)}, ${dashboard.weather.location.longitude.toFixed(4)} · ${dashboard.weather.location.source}. ` : ''}{dashboard.weather.attribution} Les « données réelles estimées » proviennent d’une réanalyse, pas d’une station de la ferme.</small>
          </article>
        </div>
      </section>
    );
  }

  return (
    <section className="water-management-section" aria-labelledby="water-management-title">
      <header className="water-management-heading">
        <div>
          <h2 id="water-management-title">Objectifs hydriques, météo et ressource en eau</h2>
          <p>Suivi hebdomadaire du lundi au dimanche. Ces données alimentent le calcul des besoins affiché ensuite.</p>
        </div>
        <div className="water-week-navigation" aria-label="Changer de semaine">
          <button type="button" disabled={pending} onClick={() => loadWeek(addDaysToDateKey(dashboard.weekStart, -7))}>←</button>
          <strong>{formatDateRange(dashboard.weekStart, dashboard.weekEnd)}</strong>
          <button type="button" disabled={pending} onClick={() => loadWeek(addDaysToDateKey(dashboard.weekStart, 7))}>→</button>
          <button type="button" disabled={pending} onClick={() => loadWeek(dateKeyInTimeZone(new Date()))}>Cette semaine</button>
        </div>
      </header>

      {notice ? <p className="water-notice" role="status">{notice}</p> : null}
      {error ? <p className="water-error" role="alert">{error}</p> : null}

      <div className="water-summary-grid">
        <SummaryCard icon="cible" label="Objectif ferme" value={farmGoal ? `${mm.format(farmGoal.amountMm)} mm` : 'Non défini'} detail={`${dashboard.goals.length} objectif${dashboard.goals.length > 1 ? 's' : ''} ciblé${dashboard.goals.length > 1 ? 's' : ''}`} />
        <SummaryCard icon="goutte" label="Irrigation réalisée" value={`${mm.format(dashboard.totals.realizedIrrigationMm)} mm`} detail={`${cubicMeters.format(dashboard.totals.realizedIrrigationCubicMeters)} m³ répartis sur la surface totale des planches`} />
        <SummaryCard water icon="pluie" label="Pluie réelle / estimée" value={`${formatOptionalMm(dashboard.totals.actualRainMm)}${missingActualRainDates.length ? ' · partielle' : ''}`} detail={missingActualRainDates.length ? `Non utilisable pour un bilan complet : ${missingWeatherDates(missingActualRainDates)}. Mesure manuelle prioritaire, sinon réanalyse.` : 'Mesure manuelle prioritaire, sinon réanalyse'} />
        <SummaryCard water icon="pluie" label="Pluie encore prévue" value={`${formatOptionalMm(dashboard.totals.remainingForecastRainMm)}${missingForecastRainDates.length ? ' · partielle' : ''}`} detail={missingForecastRainDates.length ? `Prévision incomplète : ${missingWeatherDates(missingForecastRainDates)}.` : 'Prévision à partir d’aujourd’hui'} />
        <SummaryCard icon="soleil" label="ET0" value={`${formatOptionalMm(dashboard.totals.et0Mm)}${missingEt0Dates.length ? ' · partielle' : ''}`} detail={`Prévision : ${formatOptionalMm(dashboard.totals.et0ForecastMm)} · Réanalyse : ${formatOptionalMm(dashboard.totals.et0ReanalysisMm)}. ${missingEt0Dates.length ? `Non utilisée comme total hebdomadaire complet : ${missingWeatherDates(missingEt0Dates)}.` : 'Utilisée dans le calcul des besoins affiché ensuite.'}`} />
      </div>

      {dashboard.days.some((day) => day.estimatedOngoingCubicMeters > 0) || currentDay.estimatedOngoingCubicMeters > 0
        ? <p className="weather-stale">Un minuteur attend encore la confirmation de ses horaires réels. Son volume en cours est une estimation, réservée dans le budget mais non ajoutée au réalisé confirmé.</p> : null}

      <div className="water-dashboard-columns">
        <article className="water-panel">
          <div className="water-panel-title">
            <div><h3>Objectifs hebdomadaires</h3><p>Valeurs directes, indépendantes et non cumulatives.</p></div>
            <button type="button" className="danger-outline" disabled={pending || dashboard.goals.length === 0} onClick={() => clearDialog.current?.showModal()}>Tout vider</button>
          </div>
          <GoalScopePicker snapshot={snapshot} season={season} value={scope} onChange={setScope} />
          <div className="water-inline-form">
            <label><span>mm / semaine</span><input inputMode="decimal" value={goalAmount} onChange={(event) => setGoalAmount(event.target.value)} /></label>
            <button type="button" disabled={pending} onClick={saveGoal}>Enregistrer</button>
          </div>
          <div className="goal-chip-list">
            {dashboard.goals.length === 0 ? <p>Aucun objectif pour cette semaine.</p> : dashboard.goals.map((goal) => (
              <span key={goal.id}><strong>{goalLabel(goal, snapshot)}</strong>{mm.format(goal.amountMm)} mm</span>
            ))}
          </div>
        </article>

        <article className="water-panel">
          <div className="water-panel-title"><div><h3>Météo de référence</h3><p>{dashboard.weather.location?.displayName ?? dashboard.weather.requestedLocationLabel ?? 'Commune non définie'}</p></div><button type="button" disabled={pending || weatherRefreshing || weatherCooldown || !dashboard.weather.locationKey} onClick={refreshWeatherNow}>{weatherRefreshing ? 'Actualisation…' : 'Actualiser la météo'}</button></div>
          {dashboard.weather.error ? <p className="weather-stale" role="status">{dashboard.weather.error} Les dernières valeurs valides restent affichées.{weatherCooldown && dashboard.weather.preference.refreshNotBeforeAt ? ` Nouvelle tentative possible à ${dateTimeFormatter.format(new Date(dashboard.weather.preference.refreshNotBeforeAt))}.` : ''}</p> : null}
          {dashboard.weather.refreshedAt ? <p className={dashboard.weather.stale ? 'weather-stale' : 'weather-fresh'}>Dernière mise à jour : {dateTimeFormatter.format(new Date(dashboard.weather.refreshedAt))}{dashboard.weather.stale ? ' · données anciennes' : ''}</p> : null}
          {dashboard.weather.preference.lastAutomaticRefreshSuccessAt ? <p className="weather-fresh">Dernière synchronisation automatique : {dateTimeFormatter.format(new Date(dashboard.weather.preference.lastAutomaticRefreshSuccessAt))}</p> : null}
          {/* La commune se change à un seul endroit, dans Réglages (audit ergonomique, point 9) : ici, le lien qui y mène. */}
          <a className="weather-location-link" href={pageHref('reglages', { season }, 'water-weather-title')}>Changer la commune dans Réglages</a>
          <small>{dashboard.weather.location ? `Coordonnées utilisées : ${dashboard.weather.location.latitude.toFixed(4)}, ${dashboard.weather.location.longitude.toFixed(4)} · ${dashboard.weather.location.source}. ` : ''}{dashboard.weather.attribution} Les « données réelles estimées » proviennent d’une réanalyse, pas d’une station de la ferme.</small>
        </article>

        <article className="water-panel" id="manual-rain">
          <div className="water-panel-title"><div><h3>Pluie mesurée</h3><p>Mesure de la ferme, prioritaire sur la réanalyse même si la commune météo change.</p></div></div>
          <div className="water-inline-form">
            <label><span>Date</span><input type="date" max={today} value={rainDate} onChange={(event) => chooseRainDate(event.target.value)} /></label>
            <label><span>Millimètres</span><input inputMode="decimal" value={rainAmount} onChange={(event) => setRainAmount(event.target.value)} /></label>
            <button type="button" disabled={pending} onClick={() => startTransition(async () => receiveRain(await saveManualRainfallAction({ season, weekStart: dashboard.weekStart, date: rainDate, precipitationMm: numeric(rainAmount) }), rainDate))}>Enregistrer</button>
            <button type="button" className="secondary-button" disabled={pending} onClick={() => startTransition(async () => receiveRain(await removeManualRainfallAction({ season, weekStart: dashboard.weekStart, date: rainDate }), rainDate))}>Retirer la mesure</button>
          </div>
        </article>

      </div>

      <dialog ref={clearDialog} className="irrigation-dialog water-clear-dialog" aria-labelledby="clear-water-goals-title">
        <p className="eyebrow">Confirmation</p>
        <h3 id="clear-water-goals-title">Retirer les objectifs de cette semaine ?</h3>
        <p>Les irrigations, la météo, les restrictions et l’historique sont conservés. Seuls les objectifs de la semaine affichée seront retirés.</p>
        <div className="irrigation-dialog-actions">
          <button type="button" onClick={() => clearDialog.current?.close()}>Annuler</button>
          <button type="button" className="primary" onClick={clearGoals}>Retirer les objectifs</button>
        </div>
      </dialog>

      <div className="water-week-table-wrap" id="weather">
        <table className="water-week-table">
          <thead><tr><th>Jour</th><th>Irrigation réalisée</th><th>Planifiée</th><th>Pluie mesurée / réanalyse</th><th>Prévision</th><th>Températures prévues</th><th>ET0</th><th>Limite</th></tr></thead>
          <tbody>{dashboard.days.map((day) => <tr key={day.date} className={day.limitExceededByCubicMeters > 0 ? 'limit-exceeded-row' : undefined}>
            <th>{formatDate(day.date)}</th>
            <td data-label="Irrigation réalisée">{cubicMeters.format(day.realizedIrrigationCubicMeters)} m³{day.volumeIncomplete ? <small> · incomplet, surface mouillée inconnue</small> : null}{day.estimatedOngoingCubicMeters > 0 ? <small> + {cubicMeters.format(day.estimatedOngoingCubicMeters)} m³ en cours estimés</small> : null}</td>
            <td data-label="Planifiée">{cubicMeters.format(day.plannedIrrigationCubicMeters)} m³</td>
            <td data-label="Pluie réelle / estimée">{day.effectiveActualRainMm === null ? '—' : `${mm.format(day.effectiveActualRainMm)} mm`}{day.manualRainMm !== null ? ' · mesurée' : day.reanalysisRainMm !== null ? ' · réanalyse' : ''}<FigureOrigin text={actualRainOrigin(day)} /></td>
            <td data-label="Prévision">{day.forecastRainMm === null ? '—' : `${mm.format(day.forecastRainMm)} mm`}</td>
            <td data-label="Températures prévues">{formatTemperatures(day.forecastMinimumTemperatureCelsius, day.forecastMaximumTemperatureCelsius)}</td>
            <td data-label="ET0">{day.et0Mm === null ? '—' : `${mm.format(day.et0Mm)} mm · ${day.et0Kind === 'reanalysis' ? 'réanalyse' : 'prévue'}`}</td>
            <td data-label="Limite">{day.limitCubicMeters === null ? '—' : `${cubicMeters.format(day.limitCubicMeters)} m³`}{day.limitExceededByCubicMeters > 0 ? ` · +${cubicMeters.format(day.actualLimitExceededByCubicMeters || day.limitExceededByCubicMeters)} ${day.actualLimitExceededByCubicMeters > 0 ? 'réels' : 'prévus'}` : ''}</td>
          </tr>)}</tbody>
        </table>
      </div>

    </section>
  );
}

/** Une tuile de total, son icône au trait devant le libellé ; la pluie est en bleu eau (charte du module). */
function SummaryCard({ icon, label, value, detail, water = false }: { icon: IconName; label: string; value: string; detail: string; water?: boolean }) {
  return <div className={water ? 'water-summary-card is-water' : 'water-summary-card'}><span><Icon name={icon} />{label}</span><strong>{value}</strong><small>{detail}</small></div>;
}

function TodayMetric({ label, value, warning = false }: { label: string; value: number | null; warning?: boolean }) {
  return <div className={warning ? 'today-water-metric is-warning' : 'today-water-metric'}><span>{label}</span><strong>{value === null ? '—' : `${cubicMeters.format(value)} m³`}</strong></div>;
}

function parseGoalScope(value: string) {
  const [scopeType, otfZoneId, otfPlotId, otfBedId] = value.split(':');
  return {
    scopeType: scopeType as 'farm' | 'zone' | 'plot' | 'bed',
    otfZoneId: otfZoneId ?? null,
    otfPlotId: otfPlotId ?? null,
    otfBedId: otfBedId ?? null,
  };
}

function goalLabel(goal: WaterDashboard['goals'][number], snapshot: IrrigationSnapshot) {
  if (goal.scopeType === 'farm') return 'Toute la ferme';
  if (goal.scopeType === 'zone') return snapshot.zones.find((item) => item.id === goal.otfZoneId)?.name ?? 'Parcelle';
  if (goal.scopeType === 'plot') return snapshot.plots.find((item) => item.id === goal.otfPlotId)?.name ?? 'Jardin / abri';
  return snapshot.beds.find((item) => item.id === goal.otfBedId)?.name ?? 'Planche';
}

function numeric(value: string) {
  return value.trim() ? Number(value.trim().replace(',', '.')) : Number.NaN;
}

/** Minimale et maximale prévues : « 2,6 / 13,8 °C » ; une valeur absente reste un tiret (D-003). */
function formatTemperatures(minimum: number | null, maximum: number | null) {
  if (minimum === null && maximum === null) return '—';
  const text = (value: number | null) => (value === null ? '—' : mm.format(value));
  return `${text(minimum)} / ${text(maximum)} °C`;
}

function formatOptionalMm(value: number | null) {
  return value === null ? 'Non disponible' : `${mm.format(value)} mm`;
}

function formatDate(dateKey: string) {
  return dateFormatter.format(new Date(`${dateKey}T12:00:00.000Z`));
}

function formatDateRange(start: string, end: string) {
  return `${formatDate(start)} – ${formatDate(end)}`;
}

function missingWeatherDates(dates: readonly string[]) {
  return `${dates.length === 1 ? 'donnée manquante le' : 'données manquantes les'} ${dates.map(formatDate).join(', ')}`;
}
