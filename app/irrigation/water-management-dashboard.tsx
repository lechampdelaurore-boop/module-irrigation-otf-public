'use client';

import { volumeText } from '@/lib/domain/display-numbers';
import { useEffect, useMemo, useOptimistic, useRef, useState, useTransition } from 'react';
import type { IrrigationSnapshot } from '@/lib/domain/domain';
import type { WaterDashboard } from '@/lib/services/water-dashboard';
import { actualRainOrigin, dateKeyInTimeZone, isValidDateKey, manualRainInput, weekStartDateKey } from '@/lib/domain/water-management';
import { quietWaterDaysText, waterDaySummary } from '@/lib/domain/water-week-days';
import { FARM_SCOPE_VALUE } from '@/lib/domain/goal-scope-choices';
import { pageHref } from '@/lib/domain/features/pages';
import { FARM_OBJECTIVE_READ, notifyChangeJournalChanged, type FarmObjectiveNotice } from '@/lib/domain/feasibility-notifications';
import { FigureOrigin } from './shell/figure-origin';
import { ActionReply, actionReply, type ActionReplyMessage } from './shell/action-reply';
import { useConfirm } from './shell/use-confirm';
import { AnchoredFold, PageSettingsFold } from './shell/page-settings-fold';
import { notifyWeekWaterRead, WEEK_RAIN_NOTED } from './semaine/week-signals';
import { WaterSummaryTiles } from './water-summary-tiles';
import { goalsFoldLine, manualRainFoldLine, weatherFoldLine, weekTotalsLine } from '@/lib/domain/besoins-phone';
import { automaticRefreshStatus } from '@/lib/domain/weather/automatic-refresh-status';
import { AutomaticWeatherRefresh } from './automatic-weather-refresh';
import { GoalScopePicker } from './goal-scope-picker';
import type { WeatherLocationCandidate } from '@/lib/domain/weather/weather-provider';
import {
  finishManualWeatherRefresh,
  tryStartManualWeatherRefresh,
} from '@/lib/domain/weather/refresh-control';
import {
  clearHydricGoalsAction,
  loadWaterDashboardAction,
  saveAutomaticObjectiveAction,
  saveDailyWaterLimitAction,
  saveHydricGoalAction,
  removeManualRainfallAction,
  saveManualRainfallAction,
  saveWeatherLocationAction,
  searchWeatherLocationsAction,
  restoreOtfWeatherLocationAction,
  type WaterActionResult,
} from './water-actions';
import { dateClockText } from '@/lib/domain/clock-text';
import {
  AUTOMATIC_OBJECTIVE_SETTING_TEXT,
  automaticObjectiveLines,
  automaticObjectiveResultText,
  objectiveInForce,
  type ObjectiveBedReading,
} from '@/lib/domain/objective-reading';
import { AutomaticObjectiveLines, useAutomaticObjectiveToggle } from './automatic-objective-panel';
import { SIMPLE_WORDS } from '@/lib/domain/simple-words';

const mm = new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 1 });
const dateFormatter = new Intl.DateTimeFormat('fr-FR', {
  weekday: 'short',
  day: 'numeric',
  month: 'short',
  year: 'numeric',
  timeZone: 'UTC',
});
// « 16/06/2026 à 8 h 50 » (audit du 19 novembre 2026, lot K, n° 22, F474).
const dateTimeFormatter = { format: (value: Date | number) => dateClockText(new Date(value)) };

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
  initialFarmObjective = null,
  part = 'besoins',
}: {
  season: number;
  snapshot: IrrigationSnapshot;
  initialDashboard: WaterDashboard;
  /** L'objectif de la ferme lu avec les besoins de la même semaine (S1, PR 3). */
  initialFarmObjective?: FarmObjectiveNotice | null;
  part?: WaterDashboardPart;
}) {
  const [dashboard, setDashboard] = useState(initialDashboard);
  const [farmObjectiveNotice, setFarmObjectiveNotice] = useState(initialFarmObjective);
  useEffect(() => {
    const read = (event: Event) => {
      if (event instanceof CustomEvent) setFarmObjectiveNotice(event.detail as FarmObjectiveNotice);
    };
    window.addEventListener(FARM_OBJECTIVE_READ, read);
    return () => window.removeEventListener(FARM_OBJECTIVE_READ, read);
  }, []);
  // Le premier niveau de la page « Semaine » reprend le tableau relu après chaque geste (S4, PR 2).
  useEffect(() => {
    if (part === 'besoins') notifyWeekWaterRead(dashboard);
  }, [dashboard, part]);
  const { confirm, dialog: confirmDialog } = useConfirm();
  // Chaque message s'affiche sous le bouton de son geste (audit du 19 novembre 2026, lot G, n° 1, F404).
  const [replies, setReplies] = useState<ActionReplyMessage[]>([]);
  const say = (origin: string, tone: ActionReplyMessage['tone'], text: string) => setReplies([actionReply(origin, tone, text)]);
  const [scope, setScope] = useState(FARM_SCOPE_VALUE);
  // Ce que la personne a tapé dans « mm / semaine » ; `null` : rien, le champ montre la valeur en vigueur (6 quaterdecies, A1, point 3).
  const [goalDraft, setGoalDraft] = useState<string | null>(null);
  const goalAmountInput = useRef<HTMLInputElement>(null);
  const [city, setCity] = useState('');
  const [postcode, setPostcode] = useState('');
  const [candidates, setCandidates] = useState<WeatherLocationCandidate[]>([]);
  const [rainDate, setRainDate] = useState(() => dateKeyInTimeZone(new Date()));
  // La mesure déjà saisie pour le jour choisi (détail de la recette 3.7) : le champ la montre, on la corrige sur place.
  const [rainAmount, setRainAmount] = useState(() => manualRainInput(initialDashboard.days, dateKeyInTimeZone(new Date())) ?? '');
  // Le numéro du dernier choix de jour : seule sa réponse compte (point ouvert 50).
  const rainDateChoice = useRef(0);
  const today = dateKeyInTimeZone(new Date());
  // Le jour courant ouvert au téléphone, les autres repliés (lot D, J3, F299).
  const [openDay, setOpenDay] = useState<string | null>(today);
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
  // L'objectif de la ferme : celui d'« Aujourd'hui », pour la semaine affichée seulement (S1, PR 3).
  const farmObjective = farmObjectiveNotice?.weekStart === dashboard.weekStart ? farmObjectiveNotice.objective : null;
  // L'objectif de chaque planche de la semaine affichée, lu avec les besoins ; réglage allumé, le volet le montre (A1, points 2 et 3).
  const automaticOn = dashboard.automaticObjective?.enabled === true;
  const objectiveBeds: ObjectiveBedReading[] | null = farmObjectiveNotice?.weekStart === dashboard.weekStart ? farmObjectiveNotice.beds : null;
  const automaticLines = automaticOn && objectiveBeds !== null ? automaticObjectiveLines(objectiveBeds) : [];
  const inForce = automaticOn && objectiveBeds !== null ? objectiveInForce(parseGoalScope(scope), dashboard.goals, objectiveBeds) : null;
  const inForceText = inForce === null ? '' : mm.format(Math.round(inForce.mm * 10) / 10);
  const goalAmount = goalDraft ?? inForceText;
  const quietDays = quietWaterDaysText(dashboard.days);
  const missingEt0Dates = dashboard.days.filter((day) => day.et0Mm === null).map((day) => day.date);
  const missingActualRainDates = dashboard.days.filter((day) => day.date <= today && day.effectiveActualRainMm === null).map((day) => day.date);
  const missingForecastRainDates = dashboard.days.filter((day) => day.date >= today && day.forecastRainMm === null).map((day) => day.date);
  const weatherPlace = dashboard.weather.location?.displayName ?? dashboard.weather.requestedLocationLabel ?? 'Commune non définie';
  const weatherNeedsAttention = Boolean(dashboard.weather.error) || dashboard.weather.stale
    || automaticRefreshStatus(dashboard.weather.preference, new Date()).kind === 'late';
  const weatherCooldown = dashboard.weather.nextRefreshAllowedAt !== null && (
    weatherClock === 0 || Date.parse(dashboard.weather.nextRefreshAllowedAt) > weatherClock
  );

  const receive = (result: WaterActionResult, origin = 'haut') => {
    if (!result.ok) {
      say(origin, 'error', result.message);
      return;
    }
    setDashboard(result.dashboard);
    window.dispatchEvent(new CustomEvent('irrigation-needs-source-changed', {
      detail: { weekStart: result.dashboard.weekStart },
    }));
    say(origin, 'notice', result.message);
  };

  /** Un réglage ou un objectif enregistré : le journal des modifications de la page se relit (F746). */
  const receiveChange = (result: WaterActionResult, origin = 'haut') => {
    receive(result, origin);
    if (result.ok) notifyChangeJournalChanged();
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
      receive(result, 'pluie');
      if (result.ok) setRainAmount(manualRainInput(result.dashboard.days, date) ?? '');
    });
  };

  /** Après l'enregistrement ou le retrait d'une mesure, le champ montre ce qui est enregistré. */
  const receiveRain = (result: WaterActionResult, date: string) => {
    receive(result, 'pluie');
    if (result.ok) setRainAmount(manualRainInput(result.dashboard.days, date) ?? '');
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
        }), 'meteo');
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
          say('haut', 'error', result.message);
        }
      });
    };
    // Une irrigation, un objectif enregistré ailleurs (une proposition adoptée, 5 quater), une pluie notée par « Noter la pluie » de la page (S4, PR 3).
    const signals = ['irrigation-events-changed', 'irrigation-goals-changed', WEEK_RAIN_NOTED];
    signals.forEach((name) => window.addEventListener(name, refreshAfterIrrigation));
    return () => signals.forEach((name) => window.removeEventListener(name, refreshAfterIrrigation));
  }, [dashboard.weekStart, season]);

  const saveGoal = () => {
    const target = parseGoalScope(scope);
    // Réglage allumé, un champ laissé tel quel n'écrit rien (A1, point 3).
    if (inForce !== null && goalAmount === inForceText) {
      say('objectif', 'notice', 'Valeur inchangée : rien n’est enregistré. Modifiez les millimètres pour poser un objectif saisi, qui passe avant l’objectif automatique.');
      return;
    }
    startTransition(async () => {
      const result = await saveHydricGoalAction({
        season,
        weekStart: dashboard.weekStart,
        amountMm: numeric(goalAmount),
        ...target,
      });
      receiveChange(result, 'objectif');
      // Allumé, le champ montre ensuite la valeur en vigueur, l'objectif saisi.
      if (result.ok && automaticOn) setGoalDraft(null);
    });
  };

  /** Un autre endroit choisi : réglage allumé, le champ montre sa valeur en vigueur (A1, point 3) ; éteint, comme avant. */
  const chooseScope = (value: string) => {
    setScope(value);
    if (automaticOn) setGoalDraft(null);
  };

  /** « Corriger » une ligne automatique : son endroit choisi, le champ prêt à la saisie (A1, point 3). */
  const correctLine = (scopeValue: string) => {
    chooseScope(scopeValue);
    goalAmountInput.current?.focus();
  };

  /** « Revenir à l'automatique » : le geste « vider » de cet endroit seul (A1, point 4). */
  const backToAutomatic = (goal: WaterDashboard['goals'][number]) => {
    startTransition(async () => {
      receiveChange(await clearHydricGoalsAction({
        season,
        weekStart: dashboard.weekStart,
        confirmed: true,
        scope: { scopeType: goal.scopeType, otfZoneId: goal.otfZoneId, otfPlotId: goal.otfPlotId, otfBedId: goal.otfBedId },
      }), 'objectif');
      setGoalDraft(null);
    });
  };

  /**
   * Le réglage « Objectif automatique » (6 decies, O4, D-319) : un geste
   * daté, enregistré tout de suite ; le besoin et le journal se relisent.
   */
  // L'interrupteur suit le geste tout de suite ; un refus le rend à l'état enregistré.
  const [automaticShown, showAutomatic] = useOptimistic(dashboard.automaticObjective?.enabled ?? false);
  const saveAutomaticObjective = (enabled: boolean, clearAfter = false) => {
    startTransition(async () => {
      showAutomatic(enabled);
      const result = await saveAutomaticObjectiveAction({ season, weekStart: dashboard.weekStart, enabled });
      if (result.ok && enabled) setGoalDraft(null);
      if (!result.ok || !clearAfter) {
        receiveChange(result, 'objectif-automatique');
        return;
      }
      // « Allumer et vider les objectifs » : le geste existant, confirmé dans la fenêtre d'allumage (A1, point 5) ; les deux messages ensemble.
      const cleared = await clearHydricGoalsAction({ season, weekStart: dashboard.weekStart, confirmed: true });
      if (cleared.ok) {
        receiveChange({ ...cleared, message: `${result.message} ${cleared.message}` }, 'objectif-automatique');
        return;
      }
      receiveChange(result, 'objectif-automatique');
      say('objectif-automatique', 'error', cleared.message);
    });
  };

  // Allumer quand des planches gardent un objectif saisi ouvre d'abord la fenêtre (A1, point 5).
  const { toggle: toggleAutomaticObjective, dialog: enableDialog } = useAutomaticObjectiveToggle(dashboard.automaticObjective?.keptGoalBeds ?? 0, saveAutomaticObjective);

  /** « Vider les objectifs » : le même mot sur le bouton et dans la fenêtre, en rouge (lot G, n° 8, F414 et F415). */
  const clearGoals = async () => {
    if (!(await confirm({
      title: 'Vider les objectifs de cette semaine ?',
      text: 'Les irrigations, la météo, les restrictions et l’historique sont conservés. Seuls les objectifs de la semaine affichée seront retirés.',
      confirmLabel: 'Vider les objectifs',
      cancelLabel: 'Garder les objectifs',
    }))) return;
    startTransition(async () => {
      receiveChange(await clearHydricGoalsAction({
        season,
        weekStart: dashboard.weekStart,
        confirmed: true,
      }), 'objectif');
    });
  };

  const searchLocations = () => {
    setReplies([]);
    startTransition(async () => {
      const result = await searchWeatherLocationsAction({ city, postcode });
      if (!result.ok) {
        say('commune', 'error', result.message);
        setCandidates([]);
        return;
      }
      setCandidates(result.candidates);
      say('commune', 'notice', `${result.candidates.length} commune${result.candidates.length > 1 ? 's' : ''} trouvée${result.candidates.length > 1 ? 's' : ''}.`);
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
        <ActionReply messages={replies} origin="haut" classNames={WATER_REPLY_CLASSES} />

        <div className="today-water-card">
          <div>
            <span className="eyebrow">Eau aujourd’hui</span>
            <strong>{currentDay?.limitCubicMeters === null || !currentDay
              ? 'Aucune limite active'
              : `${volumeText(currentDay.limitCubicMeters)} maximum`}</strong>
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

        {/* La limite journalière et ses dates dans le pli du bas (audit final, lot D, J2, F305). */}
        <PageSettingsFold>
        <div className="water-dashboard-columns">
          <article className="water-panel">
            <div className="water-panel-title"><div><h3>Limite journalière d’irrigation</h3><p>Règle forte appliquée aux nouvelles irrigations en cours ou planifiées.</p></div></div>
            <label className="water-toggle"><input type="checkbox" checked={limitEnabled} onChange={(event) => setLimitEnabled(event.target.checked)} /> Activer la limite</label>
            <div className="water-inline-form water-limit-form">
              <label><span>m³ / jour</span><input disabled={!limitEnabled} inputMode="decimal" value={limitAmount} onChange={(event) => setLimitAmount(event.target.value)} /></label>
              <label><span>Du</span><input type="date" value={limitFrom} onChange={(event) => setLimitFrom(event.target.value)} /></label>
              <label><span>Au</span><input type="date" value={limitUntil} onChange={(event) => setLimitUntil(event.target.value)} /></label>
              <label><span>Note facultative</span><input value={limitNote} onChange={(event) => setLimitNote(event.target.value)} /></label>
              <button type="button" disabled={pending} onClick={() => startTransition(async () => receiveChange(await saveDailyWaterLimitAction({ season, weekStart: dashboard.weekStart, enabled: limitEnabled, maxCubicMetersPerDay: limitEnabled ? numeric(limitAmount) : null, validFrom: limitFrom, validUntil: limitUntil, note: limitNote }), 'limite'))}>Enregistrer</button>
            </div>
            <ActionReply messages={replies} origin="limite" classNames={WATER_REPLY_CLASSES} />
          </article>
        </div>
        </PageSettingsFold>
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
        <ActionReply messages={replies} origin="haut" classNames={WATER_REPLY_CLASSES} />

        <div className="water-dashboard-columns">
          <article className="water-panel">
            <div className="water-panel-title"><div><h3>Météo de référence</h3><p>{dashboard.weather.location?.displayName ?? dashboard.weather.requestedLocationLabel ?? 'Commune non définie'}</p></div><button type="button" disabled={pending || weatherRefreshing || weatherCooldown || !dashboard.weather.locationKey} onClick={refreshWeatherNow}>{weatherRefreshing ? 'Actualisation…' : 'Actualiser la météo'}</button></div>
            <ActionReply messages={replies} origin="meteo" classNames={WATER_REPLY_CLASSES} />
            {dashboard.weather.error ? <p className="weather-stale" role="status">{dashboard.weather.error}{dashboard.weather.preference.locationConfirmed ? ' Les dernières valeurs valides restent affichées.' : ''}{weatherCooldown && dashboard.weather.preference.refreshNotBeforeAt ? ` Nouvelle tentative possible à ${dateTimeFormatter.format(new Date(dashboard.weather.preference.refreshNotBeforeAt))}.` : ''}</p> : null}
            {dashboard.weather.refreshedAt ? <p className={dashboard.weather.stale ? 'weather-stale' : 'weather-fresh'}>Dernière mise à jour : {dateTimeFormatter.format(new Date(dashboard.weather.refreshedAt))}{dashboard.weather.stale ? ' · données anciennes' : ''}</p> : null}
            <AutomaticWeatherRefresh preference={dashboard.weather.preference} />
            <div className="water-inline-form">
              <label><span>Commune</span><input value={city} onChange={(event) => setCity(event.target.value)} /></label>
              <label><span>Code postal</span><input value={postcode} onChange={(event) => setPostcode(event.target.value)} /></label>
              <button type="button" disabled={pending} onClick={searchLocations}>Rechercher</button>
            </div>
            <ActionReply messages={replies} origin="commune" classNames={WATER_REPLY_CLASSES} />
            {candidates.length > 0 ? <div className="weather-candidates">{candidates.map((candidate) => <button key={`${candidate.latitude}:${candidate.longitude}`} type="button" disabled={pending} onClick={() => startTransition(async () => { receiveChange(await saveWeatherLocationAction({ season, weekStart: dashboard.weekStart, candidate }), 'commune'); setCandidates([]); })}>{candidate.displayName}</button>)}</div> : null}
            {dashboard.weather.preference.locationMode === 'custom' || !dashboard.weather.preference.locationConfirmed ? <button type="button" className="secondary-button" disabled={pending} onClick={() => startTransition(async () => receiveChange(await restoreOtfWeatherLocationAction({ season, weekStart: dashboard.weekStart }), 'commune'))}>{dashboard.weather.preference.locationConfirmed ? 'Utiliser la commune du siège OTF' : 'Prendre le siège OTF, en dernier recours'}</button> : null}
            <small>{dashboard.weather.location ? `Coordonnées utilisées : ${dashboard.weather.location.latitude.toFixed(4)}, ${dashboard.weather.location.longitude.toFixed(4)} · ${dashboard.weather.location.source}. ` : ''}{dashboard.weather.attribution} Les « données réelles estimées » proviennent d’une réanalyse, pas d’une station de la ferme.</small>
          </article>
        </div>
      </section>
    );
  }

  return (
    // Dans « Le détail » de la page « Semaine » (S4, PR 2, section 7.1, n° 3 à 6) : l'eau visée, la pluie
    // mesurée, la météo de référence et les jours de la semaine, chacun un pli fermé avec sa ligne. Les flèches
    // de la semaine sont celles de la page, l'adresse dit la semaine (S4-g).
    <section className="water-management-section" aria-label="L’eau de la semaine">
      <ActionReply messages={replies} origin="haut" classNames={WATER_REPLY_CLASSES} />

      <div className="water-dashboard-columns">
        {/* Les objectifs, la météo et la pluie mesurée en plis fermés, une ligne de résumé chacun (lot J, n° 15, F460). */}
        <AnchoredFold
          id="objectifs-de-la-semaine"
          className="water-panel water-fold"
          bodyClassName="water-fold-body"
          summary={<><h3>{SIMPLE_WORDS.weekGoal}</h3><small>{goalsFoldLine(dashboard.goals.length, farmGoal?.amountMm ?? null, dashboard.automaticObjective?.enabled === true)}</small></>}
        >
          {dashboard.automaticObjective ? <AutomaticObjectiveSetting setting={dashboard.automaticObjective} shown={automaticShown} pending={pending} onChange={toggleAutomaticObjective} onClearGoals={() => void clearGoals()} result={automaticOn && farmObjective !== null && objectiveBeds !== null ? automaticObjectiveResultText(farmObjective, objectiveBeds, dashboard.automaticObjective.keptGoalBeds) : null} reply={<ActionReply messages={replies} origin="objectif-automatique" classNames={WATER_REPLY_CLASSES} />} /> : null}
          {enableDialog}
          <div className="water-panel-title">
            <div><p>Valeurs directes, indépendantes et non cumulatives.</p></div>
            <button type="button" className="danger-outline" disabled={pending || dashboard.goals.length === 0} onClick={() => void clearGoals()}>Vider les objectifs</button>
          </div>
          <GoalScopePicker snapshot={snapshot} season={season} value={scope} onChange={chooseScope} />
          <div className="water-inline-form">
            <label><span>mm / semaine</span><input ref={goalAmountInput} inputMode="decimal" value={goalAmount} onChange={(event) => setGoalDraft(event.target.value)} /></label>
            <button type="button" disabled={pending} onClick={saveGoal}>Enregistrer</button>
          </div>
          {/* La valeur en vigueur de l'endroit choisi, et d'où elle vient (A1, point 3). */}
          {inForce !== null && goalDraft === null ? <small className="goal-amount-origin">Valeur en vigueur : {inForce.origin}</small> : null}
          <ActionReply messages={replies} origin="objectif" classNames={WATER_REPLY_CLASSES} />
          <div className="goal-chip-list">
            {dashboard.goals.length === 0 && automaticLines.length === 0 ? <p>Aucun objectif pour cette semaine.</p> : dashboard.goals.map((goal) => (
              <span key={goal.id}><strong>{goalLabel(goal, snapshot)}</strong>{mm.format(goal.amountMm)} mm{automaticOn ? <><small>saisi</small><button type="button" className="secondary-button" disabled={pending} onClick={() => backToAutomatic(goal)}>Revenir à l’automatique</button></> : null}</span>
            ))}
            <AutomaticObjectiveLines lines={automaticLines} pending={pending} onCorrect={correctLine} />
          </div>
        </AnchoredFold>

        <AnchoredFold
          id="manual-rain"
          className="water-panel water-fold"
          bodyClassName="water-fold-body"
          summary={<><h3>Pluie mesurée</h3><small>{manualRainFoldLine(dashboard.days)}</small></>}
        >
          <div className="water-panel-title"><div><p>Mesure de la ferme, prioritaire sur la pluie estimée par la météo, même si la commune météo change.</p></div></div>
          <div className="water-inline-form">
            <label><span>Date</span><input type="date" max={today} value={rainDate} onChange={(event) => chooseRainDate(event.target.value)} /></label>
            <label><span>Millimètres</span><input inputMode="decimal" value={rainAmount} onChange={(event) => setRainAmount(event.target.value)} /></label>
            <button type="button" disabled={pending} onClick={() => startTransition(async () => receiveRain(await saveManualRainfallAction({ season, weekStart: dashboard.weekStart, date: rainDate, precipitationMm: numeric(rainAmount) }), rainDate))}>Enregistrer</button>
            {/* Rien à retirer sur ce jour : le bouton ne fait pas semblant (audit du 19 novembre 2026, lot K, n° 21, F471). */}
            <button type="button" className="secondary-button rain-remove" disabled={pending || nothingToRemove(dashboard.days, rainDate)} onClick={() => startTransition(async () => receiveRain(await removeManualRainfallAction({ season, weekStart: dashboard.weekStart, date: rainDate }), rainDate))}>Retirer la mesure</button>
          </div>
          <ActionReply messages={replies} origin="pluie" classNames={WATER_REPLY_CLASSES} />
        </AnchoredFold>

        {/* La météo tient sur une ligne ; une erreur, des données anciennes ou une mise à jour automatique en retard l'ouvrent d'office. */}
        <AnchoredFold
          id="meteo-de-reference"
          className="water-panel water-fold"
          bodyClassName="water-fold-body"
          initiallyOpen={weatherNeedsAttention}
          summary={<><h3>Météo de référence</h3><small>{weatherFoldLine(weatherPlace, dashboard.weather.refreshedAt, dashboard.weather.stale, (value) => dateTimeFormatter.format(value))}</small></>}
        >
          <div className="water-panel-title"><div><p>{weatherPlace}</p></div><button type="button" disabled={pending || weatherRefreshing || weatherCooldown || !dashboard.weather.locationKey} onClick={refreshWeatherNow}>{weatherRefreshing ? 'Actualisation…' : 'Actualiser la météo'}</button></div>
          <ActionReply messages={replies} origin="meteo" classNames={WATER_REPLY_CLASSES} />
          {dashboard.weather.error ? <p className="weather-stale" role="status">{dashboard.weather.error}{dashboard.weather.preference.locationConfirmed ? ' Les dernières valeurs valides restent affichées.' : ''}{weatherCooldown && dashboard.weather.preference.refreshNotBeforeAt ? ` Nouvelle tentative possible à ${dateTimeFormatter.format(new Date(dashboard.weather.preference.refreshNotBeforeAt))}.` : ''}</p> : null}
          {dashboard.weather.refreshedAt ? <p className={dashboard.weather.stale ? 'weather-stale' : 'weather-fresh'}>Dernière mise à jour : {dateTimeFormatter.format(new Date(dashboard.weather.refreshedAt))}{dashboard.weather.stale ? ' · données anciennes' : ''}</p> : null}
          <AutomaticWeatherRefresh preference={dashboard.weather.preference} />
          {/* La commune se change à un seul endroit, dans Réglages (audit ergonomique, point 9) : ici, le lien qui y mène. */}
          <a className="weather-location-link" href={pageHref('reglages', { season }, 'water-weather-title')}>Changer la commune dans Réglages</a>
          <small>{dashboard.weather.location ? `Coordonnées utilisées : ${dashboard.weather.location.latitude.toFixed(4)}, ${dashboard.weather.location.longitude.toFixed(4)} · ${dashboard.weather.location.source}. ` : ''}{dashboard.weather.attribution} Les « données réelles estimées » proviennent d’une réanalyse, pas d’une station de la ferme.</small>
        </AnchoredFold>
      </div>

      {confirmDialog}

      {/* Les jours de la semaine, un par un (S4, section 7.1, n° 6) : les totaux de la semaine et le tableau des jours ; son ancre `weather` l'ouvre. */}
      <AnchoredFold
        id="weather"
        className="water-panel water-fold water-days-fold"
        bodyClassName="water-fold-body"
        summary={<><h3>Jours de la semaine, un par un</h3><small>{weekTotalsLine({
          objective: farmObjective,
          realizedIrrigationMm: dashboard.totals.realizedIrrigationMm,
          actualRainMm: dashboard.totals.actualRainMm,
          remainingForecastRainMm: dashboard.totals.remainingForecastRainMm,
          et0Mm: dashboard.totals.et0Mm,
          partial: missingActualRainDates.length + missingForecastRainDates.length + missingEt0Dates.length > 0,
        })}</small></>}
      >
        <WaterSummaryTiles dashboard={dashboard} farmObjective={farmObjective} today={today} />
        {dashboard.days.some((day) => day.estimatedOngoingCubicMeters > 0) || currentDay.estimatedOngoingCubicMeters > 0
          ? <p className="weather-stale">Un minuteur attend encore la confirmation de ses horaires réels. Son volume en cours est une estimation, réservée dans le budget mais non ajoutée au réalisé confirmé.</p> : null}
        <div className="water-week-table-wrap">
          {quietDays ? <p className="water-week-quiet">{quietDays}.</p> : null}
          <table className="water-week-table">
            <thead><tr><th>Jour</th><th>Irrigation réalisée</th><th>Planifiée</th><th>Pluie mesurée / estimée</th><th>Prévision</th><th>Températures prévues</th><th>ET0</th><th>Limite</th></tr></thead>
            <tbody>{dashboard.days.map((day) => <tr key={day.date} className={day.limitExceededByCubicMeters > 0 ? 'limit-exceeded-row' : undefined} data-open={openDay === day.date ? 'true' : undefined}>
              <th>
                <span className="water-day-date">{formatDate(day.date)}</span>
                {/* Au téléphone, le jour replié en une ligne ; le bouton ouvre le détail dessous (lot D, J3, F299). */}
                <button type="button" className="water-day-toggle" aria-expanded={openDay === day.date} onClick={() => setOpenDay((current) => (current === day.date ? null : day.date))}>
                  <span>{formatDate(day.date)}</span><small>{waterDaySummary(day)}</small>
                </button>
              </th>
              <td data-label="Irrigation réalisée">{volumeText(day.realizedIrrigationCubicMeters)}{day.volumeIncomplete ? <small> · incomplet, surface mouillée inconnue</small> : null}{day.estimatedOngoingCubicMeters > 0 ? <small> + {volumeText(day.estimatedOngoingCubicMeters)} en cours estimés</small> : null}</td>
              <td data-label="Planifiée">{volumeText(day.plannedIrrigationCubicMeters)}</td>
              <td data-label="Pluie réelle / estimée">{day.effectiveActualRainMm === null ? '—' : `${mm.format(day.effectiveActualRainMm)} mm`}{day.manualRainMm !== null ? ' · mesurée' : day.reanalysisRainMm !== null ? ' · estimée' : ''}<FigureOrigin text={actualRainOrigin(day)} /></td>
              <td data-label="Prévision">{day.forecastRainMm === null ? '—' : `${mm.format(day.forecastRainMm)} mm`}</td>
              <td data-label="Températures prévues">{formatTemperatures(day.forecastMinimumTemperatureCelsius, day.forecastMaximumTemperatureCelsius)}</td>
              <td data-label="ET0">{day.et0Mm === null ? '—' : `${mm.format(day.et0Mm)} mm · ${day.et0Kind === 'reanalysis' ? 'réanalyse' : 'prévue'}`}</td>
              <td data-label="Limite">{day.limitCubicMeters === null ? '—' : `${volumeText(day.limitCubicMeters)}`}{day.limitExceededByCubicMeters > 0 ? ` · +${volumeText(day.actualLimitExceededByCubicMeters || day.limitExceededByCubicMeters)} ${day.actualLimitExceededByCubicMeters > 0 ? 'réels' : 'prévus'}` : ''}</td>
            </tr>)}</tbody>
          </table>
        </div>
      </AnchoredFold>
    </section>
  );
}

/** Les classes de message de la section, gardées telles qu'avant le lot G. */
const WATER_REPLY_CLASSES = { notice: 'water-notice', warning: 'weather-stale', error: 'water-error' } as const;

/** Une tuile de total, son icône au trait devant le libellé ; la pluie est en bleu eau (charte du module). */
/**
 * Le réglage « Objectif automatique », en tête du volet des objectifs
 * (docs/objectif-automatique-contract.md, section 5, points 1 et 2) : la
 * phrase de ce qu'il fait, l'interrupteur, et, allumé, les planches qui
 * gardent un objectif saisi avec le geste existant « Vider les objectifs ».
 * L'écran ne vide jamais seul (règle 2).
 */
function AutomaticObjectiveSetting({ setting, shown, pending, onChange, onClearGoals, result, reply }: {
  setting: NonNullable<WaterDashboard['automaticObjective']>;
  /** L'état que l'interrupteur montre : celui du geste en cours, sinon l'état enregistré. */
  shown: boolean;
  pending: boolean;
  onChange: (enabled: boolean) => void;
  onClearGoals: () => void;
  /** Allumé, la phrase de résultat de la semaine (6 quaterdecies, A1, point 6) ; `null` sinon. */
  result: string | null;
  reply: React.ReactNode;
}) {
  const kept = setting.keptGoalBeds;
  return (
    <div className="automatic-objective-setting">
      <label className="automatic-objective-toggle">
        <input type="checkbox" role="switch" checked={shown} disabled={pending} onChange={(event) => onChange(event.target.checked)} />
        <span><strong>Objectif automatique</strong> · {shown ? 'allumé' : 'éteint'}</span>
      </label>
      <p>{AUTOMATIC_OBJECTIVE_SETTING_TEXT} Un objectif saisi passe toujours avant.</p>
      {result !== null ? <p className="automatic-objective-result" role="status">{result}</p> : null}
      {setting.enabled && kept > 0 ? (
        <div className="automatic-objective-kept" role="note">
          <p>{kept === 1 ? '1 planche garde un objectif saisi cette semaine' : `${kept} planches gardent un objectif saisi cette semaine`} : il passe avant l’objectif automatique. Pour qu’elle{kept > 1 ? 's' : ''} le sui{kept > 1 ? 'vent' : 've'}, videz les objectifs.</p>
          <button type="button" className="danger-outline" disabled={pending} onClick={onClearGoals}>Vider les objectifs</button>
        </div>
      ) : null}
      {reply}
    </div>
  );
}

function TodayMetric({ label, value, warning = false }: { label: string; value: number | null; warning?: boolean }) {
  return <div className={warning ? 'today-water-metric is-warning' : 'today-water-metric'}><span>{label}</span><strong>{value === null ? '—' : `${volumeText(value)}`}</strong></div>;
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

function formatDate(dateKey: string) {
  return dateFormatter.format(new Date(`${dateKey}T12:00:00.000Z`));
}

/** Le jour choisi est dans la semaine affichée et n'a aucune mesure de la ferme : rien à retirer (F471). */
function nothingToRemove(days: readonly { date: string; manualRainMm: number | null }[], date: string): boolean {
  const day = days.find((candidate) => candidate.date === date);
  return day !== undefined && day.manualRainMm === null;
}
