'use client';

import { useState, useTransition, type ReactNode } from 'react';
import type { WaterDashboard } from '@/lib/services/water-dashboard';
import type { CropAlertsView } from '@/lib/services/crop-alerts-view';
import type { CropAlertSettings } from '@/lib/domain/crop-alerts/settings';
import { bedsText, celsiusText, dayText, hourText, upperFirst } from '@/lib/domain/crop-alerts/text';
import { DRYING_DAYS, FROST_DAMAGE_CELSIUS, FROST_OFFSET_CELSIUS } from '@/lib/domain/crop-alerts/thresholds';
import { frostThresholdOrigin, type CropAlertCommonView, type DryingRow, type FrostThresholdRow } from '@/lib/domain/crop-alerts/view';
import { FigureOrigin } from './shell/figure-origin';
import {
  saveCropAlertSettingsAction,
  saveCropDryingDaysAction,
  saveCropFrostLinkAction,
  type WaterActionResult,
} from './water-actions';

type Run = (action: () => Promise<WaterActionResult>, after?: () => void) => void;
type Scope = { season: number; weekStart: string };

const HORIZONS = [1, 2, 3, 4, 5, 6, 7];
const instantFormatter = new Intl.DateTimeFormat('fr-FR', { dateStyle: 'short', timeStyle: 'short', timeZone: 'Europe/Paris' });

/**
 * L'encart « Alertes cultures » (docs/weather-crop-alerts-contract.md,
 * « L'écran », 5 quinquies, PR 3) : les réglages de l'exploitation et le
 * curseur de microclimat, les prochaines échéances, les seuils de gel des
 * cultures présentes ou à venir et leur correction, les cultures sans seuil,
 * les délais de séchage, puis l'historique. Une alerte est une information :
 * rien ici ne touche le besoin, l'objectif, le planning ni la dose.
 */
export function CropAlertsPanel({
  season,
  weekStart,
  view,
  onDashboard,
  sprinklerUnavailable = null,
}: {
  season: number;
  weekStart: string;
  view: CropAlertsView;
  onDashboard: (dashboard: WaterDashboard) => void;
  /** Sans le planning, les aspersions à reconsidérer ne paraissent pas : cette ligne le dit (3.8, P1). */
  sprinklerUnavailable?: ReactNode;
}) {
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const scope = { season, weekStart };

  const run: Run = (action, after) => {
    startTransition(async () => {
      const result = await action();
      if (!result.ok) {
        setError(result.message);
        setNotice(null);
        return;
      }
      onDashboard(result.dashboard);
      setError(null);
      setNotice(result.message);
      after?.();
    });
  };

  return (
    <article className="water-panel crop-alerts-panel" id="crop-alerts" aria-labelledby="crop-alerts-title">
      <div className="water-panel-title">
        <div>
          <h3 id="crop-alerts-title">Alertes cultures</h3>
          <p>
            Le gel selon chaque culture, l’arrêt d’arrosage avant la récolte et les aspersions sous abri à reconsidérer. Les seuils sont des
            repères ; la prévision est celle de l’air à 2 m, à l’extérieur : au ras du sol et sous abri, la température diffère.
          </p>
        </div>
      </div>

      {notice ? <p className="water-notice" role="status">{notice}</p> : null}
      {error ? <p className="water-error" role="alert">{error}</p> : null}

      <details className="crop-alert-fold" suppressHydrationWarning>
        <summary>
          <strong>Réglages</strong>
          <small>{settingsSummary(view.settings, sprinklerUnavailable === null)}</small>
        </summary>
        <SettingsForm key={JSON.stringify(view.settings)} scope={scope} settings={view.settings} sprinkler={sprinklerUnavailable === null} pending={pending} run={run} />
      </details>
      <Upcoming view={view} sprinklerUnavailable={sprinklerUnavailable} />

      <details className="crop-alert-fold" suppressHydrationWarning>
        <summary>
          <strong>Seuils de gel des cultures</strong>
          <small>{view.frost.length === 0 ? 'Aucune culture' : `${view.frost.length} culture${view.frost.length > 1 ? 's' : ''}`} avec un seuil, présente{view.frost.length > 1 ? 's' : ''} ou à venir cette saison</small>
        </summary>
        {view.frost.length === 0 ? <p className="weather-alert-empty">Aucune culture présente ou à venir n’a encore de seuil de gel.</p> : (
          <ul className="crop-alert-rows" aria-label="Seuils de gel des cultures">
            {view.frost.map((row) => (
              <ThresholdItem key={row.subjectKey} row={row} common={view.common} offset={view.settings.frostOffsetCelsius} scope={scope} pending={pending} run={run} />
            ))}
          </ul>
        )}
      </details>

      <details className="crop-alert-fold" suppressHydrationWarning>
        <summary>
          <strong>Cultures sans seuil de gel</strong>
          <small>{view.withoutThreshold.length === 0 ? 'Aucune' : `${view.withoutThreshold.length} : aucune alerte de gel pour elles`}</small>
        </summary>
        {view.withoutThreshold.length === 0 ? <p className="weather-alert-empty">Toutes les cultures présentes ou à venir ont un seuil.</p> : (
          <ul className="crop-alert-rows" aria-label="Cultures sans seuil de gel">
            {view.withoutThreshold.map((row) => (
              <ThresholdItem key={row.subjectKey} row={row} common={view.common} offset={view.settings.frostOffsetCelsius} scope={scope} pending={pending} run={run} />
            ))}
          </ul>
        )}
      </details>

      <details className="crop-alert-fold" suppressHydrationWarning>
        <summary>
          <strong>Arrêt d’arrosage avant récolte</strong>
          <small>{dryingCount(view.drying)}</small>
        </summary>
        {view.drying.length === 0 ? <p className="weather-alert-empty">Aucune culture de la saison n’a de délai de séchage.</p> : (
          <ul className="crop-alert-rows" aria-label="Délais de séchage">
            {view.drying.map((row) => <DryingItem key={row.plantId} row={row} scope={scope} pending={pending} run={run} />)}
          </ul>
        )}
        {view.speciesWithoutDrying.length > 0 ? <AddDryingForm scope={scope} species={view.speciesWithoutDrying} pending={pending} run={run} /> : null}
      </details>

      {/* Repliée par défaut : elle se déplie au besoin (retour du porteur, 7 novembre 2026, précision P45). */}
      <details className="crop-alert-fold" suppressHydrationWarning>
        <summary>
          <strong>Alertes cultures envoyées</strong>
          <small>{view.history.length === 0 ? 'Aucune pour l’instant' : `${view.history.length} alerte${view.history.length > 1 ? 's' : ''}, la plus récente en tête`}</small>
        </summary>
        {view.history.length === 0 ? <p className="weather-alert-empty">Aucune alerte culture envoyée pour l’instant.</p> : (
          <ol className="weather-alert-history" aria-label="Historique des alertes cultures">
            {view.history.map((entry) => (
              <li key={entry.id}>
                <strong>{entry.kindLabel} · {entry.name}</strong>
                <span>{entry.fact}</span>
                {entry.detail ? <small>{entry.detail}</small> : null}
                <small>
                  Envoyée le {instantFormatter.format(new Date(entry.sentAt))} · <span className="weather-alert-delivery" data-status={entry.deliveryStatus}>{entry.deliveryLabel}</span>
                </small>
                <a href={entry.url}>Voir</a>
              </li>
            ))}
          </ol>
        )}
      </details>
    </article>
  );
}

function SettingsForm({ scope, settings, sprinkler, pending, run }: { scope: Scope; settings: CropAlertSettings; sprinkler: boolean; pending: boolean; run: Run }) {
  const [draft, setDraft] = useState({
    frostActive: settings.frostActive,
    dryingActive: settings.dryingActive,
    sprinklerActive: settings.sprinklerActive,
    horizonDays: String(settings.horizonDays),
    frostOffsetCelsius: settings.frostOffsetCelsius,
    frostMarginSensitiveCelsius: decimalText(settings.frostMarginSensitiveCelsius),
    frostMarginHardyCelsius: decimalText(settings.frostMarginHardyCelsius),
    sprinklerMaxTemperatureCelsius: decimalText(settings.sprinklerMaxTemperatureCelsius),
    sprinklerRadiationWattsPerSquareMeter: String(settings.sprinklerRadiationWattsPerSquareMeter),
  });
  return (
    <form
      className="crop-alert-form"
      aria-label="Réglages des alertes cultures"
      onSubmit={(event) => {
        event.preventDefault();
        run(() => saveCropAlertSettingsAction({ ...scope, settings: { ...draft } }));
      }}
    >
      <fieldset>
        <legend>Alertes actives</legend>
        <label className="water-toggle"><input type="checkbox" checked={draft.frostActive} onChange={(event) => setDraft({ ...draft, frostActive: event.target.checked })} /> Gel selon la culture</label>
        <label className="water-toggle"><input type="checkbox" checked={draft.dryingActive} onChange={(event) => setDraft({ ...draft, dryingActive: event.target.checked })} /> Arrêt d’arrosage avant récolte</label>
        {sprinkler ? <label className="water-toggle"><input type="checkbox" checked={draft.sprinklerActive} onChange={(event) => setDraft({ ...draft, sprinklerActive: event.target.checked })} /> Aspersions à reconsidérer</label> : null}
      </fieldset>
      <div className="water-inline-form crop-alert-fields">
        <label>
          <span>Horizon du gel</span>
          <select value={draft.horizonDays} onChange={(event) => setDraft({ ...draft, horizonDays: event.target.value })}>
            {HORIZONS.map((days) => <option key={days} value={days}>{days === 1 ? 'Aujourd’hui seulement' : `${days} jours, aujourd’hui compris`}</option>)}
          </select>
        </label>
        {sprinkler ? <><label>
          <span>Aspersion : maximale prévue sous, en °C</span>
          <input inputMode="decimal" value={draft.sprinklerMaxTemperatureCelsius} onChange={(event) => setDraft({ ...draft, sprinklerMaxTemperatureCelsius: event.target.value })} />
        </label>
        <label>
          <span>Aspersion : rayonnement moyen sous, en W/m²</span>
          <input inputMode="numeric" value={draft.sprinklerRadiationWattsPerSquareMeter} onChange={(event) => setDraft({ ...draft, sprinklerRadiationWattsPerSquareMeter: event.target.value })} />
        </label></> : null}
      </div>
      <fieldset className="crop-alert-margins">
        <legend>Marges de gel</legend>
        <p>
          La prévision est celle de l’air à 2 m du sol ; au ras du sol, il fait plus froid. La marge s’ajoute au seuil de dégâts de
          chaque culture : l’alerte part plus tôt. De 0 à 5 °C, par pas de 0,5 °C.
        </p>
        <div className="water-inline-form crop-alert-fields">
          <label>
            <span>Culture sensible (dégâts à −2 °C ou au-dessus), en °C</span>
            <input inputMode="decimal" value={draft.frostMarginSensitiveCelsius} onChange={(event) => setDraft({ ...draft, frostMarginSensitiveCelsius: event.target.value })} />
          </label>
          <label>
            <span>Culture rustique (dégâts sous −2 °C), en °C</span>
            <input inputMode="decimal" value={draft.frostMarginHardyCelsius} onChange={(event) => setDraft({ ...draft, frostMarginHardyCelsius: event.target.value })} />
          </label>
        </div>
      </fieldset>
      <label className="crop-alert-offset">
        <span>Microclimat : décalage des seuils de gel, {celsiusText(draft.frostOffsetCelsius, true)}</span>
        <input
          type="range"
          min={FROST_OFFSET_CELSIUS.minimum}
          max={FROST_OFFSET_CELSIUS.maximum}
          step={FROST_OFFSET_CELSIUS.step}
          value={draft.frostOffsetCelsius}
          aria-valuetext={celsiusText(draft.frostOffsetCelsius, true)}
          onChange={(event) => setDraft({ ...draft, frostOffsetCelsius: Number(event.target.value) })}
        />
        <small>{offsetText(draft.frostOffsetCelsius)}</small>
      </label>
      <button type="submit" className="weather-alert-primary" disabled={pending}>Enregistrer les réglages</button>
    </form>
  );
}

function dryingCount(rows: readonly DryingRow[]): string {
  const count = rows.filter((row) => row.dryingDays !== null).length;
  return count === 0 ? 'Aucune culture de la saison avec un délai' : `${count} culture${count > 1 ? 's' : ''} de la saison avec un délai`;
}

function settingsSummary(settings: CropAlertSettings, sprinkler: boolean): string {
  const active = [settings.frostActive ? 'gel' : null, settings.dryingActive ? 'arrêt d’arrosage' : null, sprinkler && settings.sprinklerActive ? 'aspersions' : null]
    .filter((label): label is string => label !== null);
  return `${active.length === 0 ? 'Aucune alerte active' : `Actives : ${active.join(', ')}`} · horizon ${settings.horizonDays} jour${settings.horizonDays > 1 ? 's' : ''} · microclimat ${celsiusText(settings.frostOffsetCelsius, true)} · marges ${celsiusText(settings.frostMarginSensitiveCelsius)} et ${celsiusText(settings.frostMarginHardyCelsius)}`;
}

function offsetText(offset: number): string {
  if (offset > 0) return `Les alertes de gel partent ${celsiusText(offset)} plus tôt : pour une ferme plus froide que la prévision de la commune.`;
  if (offset < 0) return `Les alertes de gel partent ${celsiusText(-offset)} plus tard : pour une ferme plus douce que la prévision de la commune.`;
  return 'Aucun décalage : les seuils de chaque culture tels quels.';
}

function Upcoming({ view, sprinklerUnavailable }: { view: CropAlertsView; sprinklerUnavailable: ReactNode }) {
  const { settings, upcoming } = view;
  return (
    <section className="crop-alert-upcoming" aria-label="Prochaines échéances">
      <h4>Prochaines échéances</h4>
      <p className="crop-alert-note">Ce que la prévision actuelle ferait alerter si elle se confirme ; une alerte déjà annoncée ne repart pas.</p>
      <h5>Gel</h5>
      {!settings.frostActive ? <p className="weather-alert-empty">Alerte de gel inactive.</p> : upcoming.frost.length === 0 ? (
        <p className="weather-alert-empty">Aucun gel prévu sur l’horizon pour les cultures qui ont un seuil.</p>
      ) : (
        <ul className="crop-alert-rows" aria-label="Gel prévu">
          {upcoming.frost.map((day) => (
            <li key={day.date}>
              <strong>{upperFirst(dayText(day.date))} : minimale prévue {celsiusText(day.minimumCelsius)}</strong>
              <span>
                {day.crops.map((crop) => `${crop.name} (alerte à ${celsiusText(crop.alertCelsius)}${crop.underShelter ? ', sous abri' : ''}${crop.alreadyAlerted ? ', déjà annoncée' : ''})`).join(' ; ')}
              </span>
            </li>
          ))}
        </ul>
      )}
      {settings.frostActive && upcoming.frostUnavailable ? <p className="weather-alert-unavailable">{upcoming.frostUnavailable}</p> : null}

      <h5>Arrêt d’arrosage</h5>
      {!settings.dryingActive ? <p className="weather-alert-empty">Alerte d’arrêt d’arrosage inactive.</p> : upcoming.drying.length === 0 ? (
        <p className="weather-alert-empty">Aucune date d’arrêt d’arrosage à venir.</p>
      ) : (
        <ul className="crop-alert-rows" aria-label="Arrêts d’arrosage à venir">
          {upcoming.drying.map((deadline) => (
            <li key={deadline.seriesId}>
              <strong>{deadline.plantName} · {deadline.bedNames.length > 0 ? bedsText(deadline.bedNames) : `série ${deadline.seriesName} en bloc`}</strong>
              <span>
                {deadline.stopDate <= view.today ? 'Arrêt dès maintenant' : `Arrêt le ${dayText(deadline.stopDate)}`}, {deadline.dryingDays} jours avant la récolte attendue à partir du {dayText(deadline.harvestStart)} · série {deadline.seriesName}
              </span>
            </li>
          ))}
        </ul>
      )}

      <h5>Aspersions</h5>
      {sprinklerUnavailable !== null ? sprinklerUnavailable : !settings.sprinklerActive ? <p className="weather-alert-empty">Alerte d’aspersion inactive.</p> : upcoming.sprinklerUnjudged ? (
        <p className="weather-alert-unavailable">Le lieu météo n’est pas localisé : les aspersions ne sont pas jugées.</p>
      ) : upcoming.sprinkler.length === 0 ? (
        <p className="weather-alert-empty">Aucune aspersion de jour sous abri à reconsidérer cette semaine.</p>
      ) : (
        <ul className="crop-alert-rows" aria-label="Aspersions à reconsidérer">
          {upcoming.sprinkler.map((flag) => (
            <li key={`${flag.slotKey}|${flag.date}`}>
              <strong>{upperFirst(dayText(flag.date))} {hourText(flag.startAt)}, {bedsText(flag.bedNames)} (sous abri)</strong>
              <span>
                {[
                  flag.cool && flag.maximumCelsius !== null ? `temps frais (maximale prévue ${celsiusText(flag.maximumCelsius)})` : null,
                  flag.overcast && flag.radiationWattsPerSquareMeter !== null ? `ciel couvert (rayonnement moyen ${Math.round(flag.radiationWattsPerSquareMeter)} W/m²)` : null,
                ].filter(Boolean).join(', ')}{flag.alreadyAlerted ? ' · déjà annoncée' : ''}
              </span>
            </li>
          ))}
        </ul>
      )}
      {sprinklerUnavailable === null && settings.sprinklerActive && upcoming.sunshineUnavailable ? <p className="weather-alert-unavailable">{upcoming.sunshineUnavailable}</p> : null}
    </section>
  );
}

function ThresholdItem({ row, common, offset, scope, pending, run }: {
  row: FrostThresholdRow;
  common: readonly CropAlertCommonView[];
  offset: number;
  scope: Scope;
  pending: boolean;
  run: Run;
}) {
  const [editing, setEditing] = useState(false);
  return (
    <li className="crop-alert-row">
      <div className="crop-alert-row-text">
        <strong>{row.name}{row.status === 'threshold' && row.alertCelsius !== null ? ` · alerte à ${celsiusText(row.alertCelsius)}` : ''}<FigureOrigin text={frostThresholdOrigin(row, offset)} /></strong>
        {row.status === 'threshold' && row.damageCelsius !== null && row.marginCelsius !== null ? (
          <>
            <span>Dégâts à {celsiusText(row.damageCelsius)}, marge {celsiusText(row.marginCelsius)}, microclimat {celsiusText(offset, true)}</span>
            <small>
              {row.source === 'farm' ? 'Seuil de la ferme' : 'Jeu commun'}
              {row.common ? ` · ${row.common.name}${row.common.damageCelsius !== null && row.source === 'farm' ? ` (jeu commun : ${celsiusText(row.common.damageCelsius)})` : ''}, confiance ${row.common.confidence}` : ''}
            </small>
            {row.source === 'common' && row.common ? <small className="crop-alert-source">Source : {row.common.source}</small> : null}
          </>
        ) : (
          <span>{row.status === 'missing' ? 'À rattacher : aucune culture du jeu commun choisie.' : 'Sans seuil de gel : aucune alerte pour elle.'}</span>
        )}
        {!row.presentToday ? <small>À venir cette saison.</small> : null}
      </div>
      {editing ? (
        <FrostLinkForm row={row} common={common} scope={scope} pending={pending} run={run} onClose={() => setEditing(false)} />
      ) : (
        <div className="weather-alert-actions">
          <button type="button" disabled={pending} onClick={() => setEditing(true)}>{row.status === 'missing' ? 'Rattacher' : 'Corriger'}</button>
        </div>
      )}
    </li>
  );
}

function FrostLinkForm({ row, common, scope, pending, run, onClose }: {
  row: FrostThresholdRow;
  common: readonly CropAlertCommonView[];
  scope: Scope;
  pending: boolean;
  run: Run;
  onClose: () => void;
}) {
  const [commonKey, setCommonKey] = useState(row.commonKey ?? (row.status === 'missing' ? suggestedEntry(row.name, common) : '') ?? '');
  const [damage, setDamage] = useState(row.source === 'farm' && row.damageCelsius !== null ? decimalText(row.damageCelsius) : '');
  const [seriesId, setSeriesId] = useState(row.seriesId ?? '');
  return (
    <form
      className="crop-alert-form"
      aria-label={`Seuil de gel · ${row.name}`}
      onSubmit={(event) => {
        event.preventDefault();
        run(() => saveCropFrostLinkAction({ ...scope, plantId: row.plantId, seriesId: seriesId || null, commonKey: commonKey || null, damageCelsius: damage }), onClose);
      }}
    >
      <div className="water-inline-form crop-alert-fields">
        <label>
          <span>Culture du jeu commun</span>
          <select value={commonKey} onChange={(event) => setCommonKey(event.target.value)}>
            <option value="">Aucune</option>
            {common.map((entry) => (
              <option key={entry.key} value={entry.key}>{entry.name} · {entry.damageCelsius === null ? 'sans seuil' : `dégâts ${celsiusText(entry.damageCelsius)}`}</option>
            ))}
          </select>
        </label>
        <label>
          <span>Seuil de dégâts de la ferme, en °C</span>
          <input inputMode="decimal" value={damage} placeholder="Vide : celui du jeu commun" onChange={(event) => setDamage(event.target.value)} />
        </label>
        {row.series.length > 1 || row.seriesId !== null ? (
          <label>
            <span>Pour</span>
            <select value={seriesId} onChange={(event) => setSeriesId(event.target.value)}>
              <option value="">Toute l’espèce</option>
              {row.series.map((series) => <option key={series.id} value={series.id}>Série {series.name} seulement</option>)}
            </select>
          </label>
        ) : null}
      </div>
      <small>
        Dégâts de {FROST_DAMAGE_CELSIUS.minimum} à +{FROST_DAMAGE_CELSIUS.maximum} °C, par pas de 0,5 °C. Ni culture ni seuil : la culture est enregistrée sans
        seuil de gel. Une correction remet à zéro les jours déjà alertés de la culture.
      </small>
      <div className="weather-alert-actions">
        <button type="submit" className="weather-alert-primary" disabled={pending}>Enregistrer le seuil</button>
        <button type="button" disabled={pending} onClick={onClose}>Annuler</button>
      </div>
    </form>
  );
}

function DryingItem({ row, scope, pending, run }: { row: DryingRow; scope: Scope; pending: boolean; run: Run }) {
  const [editing, setEditing] = useState(false);
  const [days, setDays] = useState(row.dryingDays === null ? '' : String(row.dryingDays));
  return (
    <li className="crop-alert-row">
      <div className="crop-alert-row-text">
        <strong>{row.name} · {row.dryingDays === null ? 'aucun délai' : `${row.dryingDays} jours avant la récolte`}</strong>
        <small>{row.origin === 'farm' ? (row.dryingDays === null ? 'Délai retiré par la ferme' : 'Délai de la ferme') : 'Jeu commun'}</small>
      </div>
      {editing ? (
        <form
          className="crop-alert-form"
          aria-label={`Délai de séchage · ${row.name}`}
          onSubmit={(event) => {
            event.preventDefault();
            run(() => saveCropDryingDaysAction({ ...scope, plantId: row.plantId, dryingDays: days }), () => setEditing(false));
          }}
        >
          <label>
            <span>Délai, en jours (vide : aucun)</span>
            <input inputMode="numeric" value={days} onChange={(event) => setDays(event.target.value)} />
          </label>
          <div className="weather-alert-actions">
            <button type="submit" className="weather-alert-primary" disabled={pending}>Enregistrer le délai</button>
            <button type="button" disabled={pending} onClick={() => setEditing(false)}>Annuler</button>
          </div>
        </form>
      ) : (
        <div className="weather-alert-actions">
          <button type="button" disabled={pending} onClick={() => setEditing(true)}>Corriger</button>
        </div>
      )}
    </li>
  );
}

function AddDryingForm({ scope, species, pending, run }: { scope: Scope; species: { plantId: string; name: string }[]; pending: boolean; run: Run }) {
  const [plantId, setPlantId] = useState(species[0]?.plantId ?? '');
  const [days, setDays] = useState('');
  return (
    <form
      className="crop-alert-form"
      aria-label="Ajouter un délai de séchage"
      onSubmit={(event) => {
        event.preventDefault();
        run(() => saveCropDryingDaysAction({ ...scope, plantId, dryingDays: days }), () => setDays(''));
      }}
    >
      <div className="water-inline-form crop-alert-fields">
        <label>
          <span>Culture</span>
          <select value={plantId} onChange={(event) => setPlantId(event.target.value)}>
            {species.map((plant) => <option key={plant.plantId} value={plant.plantId}>{plant.name}</option>)}
          </select>
        </label>
        <label>
          <span>Délai, en jours</span>
          <input inputMode="numeric" value={days} placeholder={`De ${DRYING_DAYS.minimum} à ${DRYING_DAYS.maximum}`} onChange={(event) => setDays(event.target.value)} />
        </label>
      </div>
      <button type="submit" className="weather-alert-primary" disabled={pending}>Ajouter le délai</button>
    </form>
  );
}

/** L'entrée du jeu commun du même nom que l'espèce, proposée dans le formulaire ; rien n'est enregistré sans la ferme. */
function suggestedEntry(name: string, common: readonly CropAlertCommonView[]): string | null {
  const wanted = normalized(name);
  return common.find((entry) => normalized(entry.name) === wanted)?.key ?? null;
}

function normalized(text: string): string {
  return text.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLocaleLowerCase('fr-FR').trim();
}

function decimalText(value: number): string {
  return String(value).replace('.', ',');
}
