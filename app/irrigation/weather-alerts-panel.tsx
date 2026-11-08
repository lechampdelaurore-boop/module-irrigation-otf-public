'use client';

import { useState, useSyncExternalStore, useTransition } from 'react';
import type { WaterDashboard } from '@/lib/services/water-dashboard';
import type { WeatherAlertHistoryEntry, WeatherAlertsView } from '@/lib/services/weather-alerts-view';
import {
  WEATHER_ALERT_FIELD_CHOICES,
  WEATHER_ALERT_HORIZON_DAYS,
  WEATHER_ALERT_LABEL_MAX_LENGTH,
  type WeatherAlertCriterion,
  type WeatherAlertCriterionInput,
} from '@/lib/domain/weather/weather-alerts';
import {
  readNotificationStatus,
  readServerNotificationStatus,
  subscribeNotificationStatus,
} from './irrigation-manager/notification-status-signal';
import type { NotificationStatus } from './irrigation-manager/use-irrigation-notifications';
import {
  deleteWeatherAlertCriterionAction,
  saveWeatherAlertCriterionAction,
  type WaterActionResult,
} from './water-actions';

type Refusals = Partial<Record<keyof WeatherAlertCriterionInput, string>>;

type Draft = {
  criterionId: string | null;
  field: WeatherAlertCriterion['field'];
  direction: WeatherAlertCriterion['direction'];
  threshold: string;
  horizonDays: string;
  label: string;
  active: boolean;
};

const NEW_DRAFT: Draft = {
  criterionId: null,
  field: 'minimum-temperature',
  direction: 'below',
  threshold: '',
  horizonDays: String(WEATHER_ALERT_HORIZON_DAYS.default),
  label: '',
  active: true,
};

const HORIZONS = Array.from(
  { length: WEATHER_ALERT_HORIZON_DAYS.maximum - WEATHER_ALERT_HORIZON_DAYS.minimum + 1 },
  (_, index) => WEATHER_ALERT_HORIZON_DAYS.minimum + index,
);

const dayFormatter = new Intl.DateTimeFormat('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'UTC' });
const instantFormatter = new Intl.DateTimeFormat('fr-FR', { dateStyle: 'short', timeStyle: 'short', timeZone: 'Europe/Paris' });

/**
 * L'encart « Alertes météo » (docs/weather-alerts-contract.md, « L'écran ») :
 * les critères de l'exploitation, leur ajout, leur modification, leur
 * activation et leur suppression, le rappel des appareils qui reçoivent les
 * alertes, et l'historique, plus récente en premier. Une alerte est une
 * information : rien ici ne touche le besoin, l'objectif ni le planning.
 */
export function WeatherAlertsPanel({
  season,
  weekStart,
  view,
  cropAlertsHref,
  onDashboard,
}: {
  season: number;
  /** La page « Alertes cultures » quand elle est cochée, `null` sinon (précision P43). */
  cropAlertsHref: string | null;
  weekStart: string;
  view: WeatherAlertsView;
  onDashboard: (dashboard: WaterDashboard) => void;
}) {
  const [draft, setDraft] = useState<Draft | null>(null);
  const [refusals, setRefusals] = useState<Refusals>({});
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const run = (action: () => Promise<WaterActionResult>, after?: () => void) => {
    startTransition(async () => {
      const result = await action();
      if (!result.ok) {
        setRefusals(Object.fromEntries((result.refusals ?? []).map((refusal) => [refusal.input, refusal.message])));
        setError(result.refusals?.length ? null : result.message);
        setNotice(null);
        return;
      }
      onDashboard(result.dashboard);
      setRefusals({});
      setError(null);
      setNotice(result.message);
      after?.();
    });
  };

  const edit = (criterion: WeatherAlertCriterion) => {
    setDraft({
      criterionId: criterion.id,
      field: criterion.field,
      direction: criterion.direction,
      threshold: String(criterion.threshold).replace('.', ','),
      horizonDays: String(criterion.horizonDays),
      label: criterion.label ?? '',
      active: criterion.active,
    });
    setRefusals({});
    setNotice(null);
  };

  const save = () => {
    if (!draft) return;
    run(() => saveWeatherAlertCriterionAction({
      season,
      weekStart,
      criterionId: draft.criterionId,
      criterion: {
        field: draft.field,
        direction: draft.direction,
        threshold: draft.threshold,
        horizonDays: draft.horizonDays,
        label: draft.label,
        active: draft.active,
      },
    }), () => setDraft(null));
  };

  const toggle = (criterion: WeatherAlertCriterion) => run(() => saveWeatherAlertCriterionAction({
    season,
    weekStart,
    criterionId: criterion.id,
    criterion: {
      field: criterion.field,
      direction: criterion.direction,
      threshold: criterion.threshold,
      horizonDays: criterion.horizonDays,
      label: criterion.label,
      active: !criterion.active,
    },
  }));

  const remove = (criterionId: string) => run(
    () => deleteWeatherAlertCriterionAction({ season, weekStart, criterionId }),
    () => {
      setConfirmDeleteId(null);
      if (draft?.criterionId === criterionId) setDraft(null);
    },
  );

  const unit = WEATHER_ALERT_FIELD_CHOICES.find((choice) => choice.field === draft?.field)?.unit ?? '°C';

  return (
    <article className="water-panel weather-alerts-panel" id="weather-alerts" aria-labelledby="weather-alerts-title">
      <div className="water-panel-title">
        <div>
          <h3 id="weather-alerts-title">Alertes météo</h3>
          <p>Une notification quand la prévision de la commune franchit le seuil que vous choisissez, sans marge ajoutée.</p>
          <p className="weather-alerts-margin">
            La prévision est celle de l’air à 2 m du sol : au ras du sol, il fait souvent 2 à 3 °C de moins, et sous abri la
            température diffère. Pour une gelée, choisissez donc un seuil au-dessus de 0 °C. Le gel selon chaque culture, avec
            cette marge réglable, est dans{' '}
            {cropAlertsHref === null ? '« Alertes cultures », à cocher dans Réglages.' : <><a href={cropAlertsHref}>Alertes cultures</a>.</>}
          </p>
        </div>
        {draft === null ? (
          <button type="button" disabled={pending} onClick={() => { setDraft(NEW_DRAFT); setRefusals({}); setNotice(null); }}>
            Ajouter une alerte
          </button>
        ) : null}
      </div>

      <DeviceReminder />

      {notice ? <p className="water-notice" role="status">{notice}</p> : null}
      {error ? <p className="water-error" role="alert">{error}</p> : null}

      {draft ? (
        <form
          className="weather-alert-form"
          aria-label={draft.criterionId ? 'Modifier l’alerte météo' : 'Nouvelle alerte météo'}
          onSubmit={(event) => { event.preventDefault(); save(); }}
        >
          <div className="water-inline-form weather-alert-fields">
            <label>
              <span>Surveiller</span>
              <select value={draft.field} onChange={(event) => setDraft({ ...draft, field: event.target.value as Draft['field'] })}>
                {WEATHER_ALERT_FIELD_CHOICES.map((choice) => (
                  <option key={choice.field} value={choice.field}>{choice.label} prévue ({choice.unit})</option>
                ))}
              </select>
            </label>
            <label>
              <span>Sens</span>
              <select value={draft.direction} onChange={(event) => setDraft({ ...draft, direction: event.target.value as Draft['direction'] })}>
                <option value="below">En dessous de (seuil non compris)</option>
                <option value="above">Au-dessus de (seuil non compris)</option>
              </select>
            </label>
            <label>
              <span>Seuil, en {unit}</span>
              <input
                inputMode="decimal"
                value={draft.threshold}
                aria-invalid={refusals.threshold ? true : undefined}
                aria-describedby={refusals.threshold ? 'weather-alert-threshold-refusal' : undefined}
                onChange={(event) => setDraft({ ...draft, threshold: event.target.value })}
              />
            </label>
            <label>
              <span>Horizon</span>
              <select value={draft.horizonDays} onChange={(event) => setDraft({ ...draft, horizonDays: event.target.value })}>
                {HORIZONS.map((days) => (
                  <option key={days} value={days}>{days === 1 ? 'Aujourd’hui seulement' : `${days} jours, aujourd’hui compris`}</option>
                ))}
              </select>
            </label>
            <label>
              <span>Libellé facultatif</span>
              <input
                value={draft.label}
                maxLength={WEATHER_ALERT_LABEL_MAX_LENGTH}
                placeholder="Gel sur les tomates"
                onChange={(event) => setDraft({ ...draft, label: event.target.value })}
              />
            </label>
          </div>
          {Object.entries(refusals).map(([input, message]) => (
            <p key={input} id={`weather-alert-${input}-refusal`} className="water-error" role="alert">{message}</p>
          ))}
          <label className="water-toggle">
            <input type="checkbox" checked={draft.active} onChange={(event) => setDraft({ ...draft, active: event.target.checked })} /> Alerte active
          </label>
          <div className="weather-alert-actions">
            <button type="submit" className="weather-alert-primary" disabled={pending}>Enregistrer l’alerte</button>
            <button type="button" disabled={pending} onClick={() => { setDraft(null); setRefusals({}); }}>Annuler</button>
          </div>
          <small>Évaluée à chaque nouvelle prévision : la synchronisation de 06 h 15 et « Actualiser la météo ». Un jour n’est annoncé qu’une fois ; une modification de l’alerte peut l’annoncer de nouveau.</small>
        </form>
      ) : null}

      {view.criteria.length === 0 && draft === null ? <p className="weather-alert-empty">Aucune alerte météo pour l’exploitation.</p> : null}
      <ul className="weather-alert-list" aria-label="Alertes météo de l’exploitation">
        {view.criteria.map(({ criterion, summary, unavailableMessage, lastAlert }) => (
          <li key={criterion.id} className="weather-alert-criterion" data-active={criterion.active}>
            <div className="weather-alert-criterion-text">
              <strong>{criterion.label ?? summary}</strong>
              {criterion.label ? <span>{summary}</span> : null}
              <span className="weather-alert-state">{criterion.active ? 'Active' : 'Inactive : elle n’est pas évaluée'}</span>
              {criterion.active && unavailableMessage ? <span className="weather-alert-unavailable">{unavailableMessage}</span> : null}
              <span>{lastAlert ? `Dernière alerte : ${alertFact(lastAlert)} · ${lastAlert.deliveryLabel}` : 'Aucune alerte envoyée pour l’instant.'}</span>
            </div>
            <div className="weather-alert-actions">
              <button type="button" disabled={pending} onClick={() => edit(criterion)}>Modifier</button>
              <button type="button" disabled={pending} onClick={() => toggle(criterion)}>{criterion.active ? 'Désactiver' : 'Activer'}</button>
              {confirmDeleteId === criterion.id ? (
                <>
                  <button type="button" className="danger-outline" disabled={pending} onClick={() => remove(criterion.id)}>Confirmer la suppression</button>
                  <button type="button" disabled={pending} onClick={() => setConfirmDeleteId(null)}>Garder</button>
                </>
              ) : (
                <button type="button" className="danger-outline" disabled={pending} onClick={() => setConfirmDeleteId(criterion.id)}>Supprimer</button>
              )}
            </div>
          </li>
        ))}
      </ul>

      <h4 className="weather-alert-history-title">Alertes envoyées</h4>
      {view.history.length === 0 ? <p className="weather-alert-empty">Aucune alerte envoyée pour l’instant.</p> : (
        <ol className="weather-alert-history" aria-label="Historique des alertes météo">
          {view.history.map((entry) => (
            <li key={entry.id}>
              <strong>{entry.label ?? 'Alerte météo'}</strong>
              <span>{alertFact(entry)}</span>
              <small>{entry.criterionSummary}</small>
              <small>
                Prévision du {instantFormatter.format(new Date(entry.forecastedAt))} · envoyée le {instantFormatter.format(new Date(entry.sentAt))} · <span className="weather-alert-delivery" data-status={entry.deliveryStatus}>{entry.deliveryLabel}</span>
              </small>
              <a href={entry.url}>Voir la semaine</a>
            </li>
          ))}
        </ol>
      )}
    </article>
  );
}

/** Le rappel du contrat : les alertes ne partent que vers les appareils où elles sont activées. */
function DeviceReminder() {
  const status = useSyncExternalStore(subscribeNotificationStatus, readNotificationStatus, readServerNotificationStatus);
  return (
    <div className="weather-alert-device" data-status={status}>
      <span>{deviceText(status)}</span>
      {status === 'default' ? <a href="#irrigation-notifications">Activer les alertes sur cet appareil</a> : null}
    </div>
  );
}

function deviceText(status: NotificationStatus): string {
  const rule = 'Les alertes partent vers tous les appareils de l’exploitation où les alertes sont activées.';
  switch (status) {
    case 'enabled': return `${rule} Cet appareil les reçoit.`;
    case 'default': return `${rule} Cet appareil ne les reçoit pas encore.`;
    case 'checking': return rule;
    case 'denied': return `${rule} Elles sont bloquées dans les réglages du navigateur de cet appareil.`;
    case 'unsupported': return `${rule} Ce navigateur ne peut pas les recevoir.`;
    case 'unavailable': return `${rule} Le service de notification n’a pas pu démarrer sur cet appareil.`;
  }
}

/** « Valeur prévue 2,6 °C le lundi 2 novembre » : toujours une prévision, jamais une observation. */
function alertFact(entry: WeatherAlertHistoryEntry): string {
  return `Valeur prévue ${entry.forecastValue} le ${dayFormatter.format(new Date(`${entry.targetDate}T12:00:00.000Z`))}`;
}
