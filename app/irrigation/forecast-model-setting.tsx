'use client';

import { useState } from 'react';
import { AnchoredFold } from './shell/page-settings-fold';
import type { WaterDashboard } from '@/lib/services/water-dashboard';
import {
  FORECAST_MODEL_SETTING_TEXT,
  forecastModelFacts,
  forecastModelOptions,
  forecastModelSummary,
  selectedForecastChoice,
  type ForecastModelOption,
} from '@/lib/domain/weather/forecast-model-setting';

/**
 * Le réglage « Modèle de prévision », dans la carte « Lieu de la météo » de
 * Réglages (docs/weather-models-contract.md, § 11 point 5 ; D-347) : un pli
 * fermé, comme toute section nouvelle de « Réglages » (P40), dont la ligne dit
 * le modèle gardé ; dedans, une liste, les faits du modèle choisi, un bouton.
 * Ouvert d'office quand il dit le retour du module à « Automatique »
 * (règle 9). Rien sur « Aujourd'hui ».
 * Le geste est celui du tableau de l'eau, qui montre la réponse sous la carte.
 * Absent en démonstration (règle 13) : rien sans lecteur des modèles.
 */
export function ForecastModelSetting({
  weather,
  pending,
  onSave,
}: {
  /** La météo du tableau de l'eau : le lieu localisé, le modèle gardé, les phrases de la carte (règles 6 et 9). */
  weather: Pick<WaterDashboard['weather'], 'forecastModelsAvailable' | 'location' | 'preference' | 'forecastModelSetting'>;
  pending: boolean;
  onSave: (choice: string) => void;
}) {
  if (!weather.forecastModelsAvailable) return null;
  const place = weather.location;
  const view = weather.forecastModelSetting;
  const savedModelId = weather.preference.forecastModel;
  const options = place === null ? [] : forecastModelOptions(place);
  const saved = selectedForecastChoice(savedModelId, options);
  return (
    <AnchoredFold
      id="modele-de-prevision"
      className="species-fold forecast-model-fold"
      bodyClassName="species-fold-body"
      initiallyOpen={Boolean(view?.returnNotice)}
      summary={<><strong>{FORECAST_MODEL_SETTING_TEXT.title}</strong><small>{forecastModelSummary(saved, options)}</small></>}
    >
      <div className="forecast-model-setting" role="group" aria-label={FORECAST_MODEL_SETTING_TEXT.title}>
        <p>{FORECAST_MODEL_SETTING_TEXT.lead}</p>
        {view?.returnNotice ? <p className="forecast-model-notice">{view.returnNotice}</p> : null}
        {place === null
          ? <p>{FORECAST_MODEL_SETTING_TEXT.noPlace}</p>
          : (
            // Un choix gardé, ou un autre lieu, repart du choix gardé ; le pli, lui, reste ouvert.
            <ForecastModelForm
              key={`${saved}:${place.latitude}:${place.longitude}`}
              options={options}
              saved={saved}
              completion={view?.completion ?? null}
              pending={pending}
              onSave={onSave}
            />
          )}
      </div>
    </AnchoredFold>
  );
}

function ForecastModelForm({ options, saved, completion, pending, onSave }: {
  options: readonly ForecastModelOption[];
  saved: string;
  completion: string | null;
  pending: boolean;
  onSave: (choice: string) => void;
}) {
  const [choice, setChoice] = useState(saved);
  return (
    <>
      <div className="water-inline-form">
        <label>
          <span>Modèle</span>
          <select value={choice} onChange={(event) => setChoice(event.target.value)}>
            {options.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
          </select>
        </label>
        <button type="button" disabled={pending || choice === saved} onClick={() => onSave(choice)}>
          {pending ? FORECAST_MODEL_SETTING_TEXT.saving : FORECAST_MODEL_SETTING_TEXT.save}
        </button>
      </div>
      <p className="forecast-model-facts">{forecastModelFacts(choice)}</p>
      {choice === saved && completion ? <p className="forecast-model-completion">{completion}</p> : null}
      <small>{FORECAST_MODEL_SETTING_TEXT.verified}</small>
    </>
  );
}
