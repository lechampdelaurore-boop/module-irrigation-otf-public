'use client';

import { useId, useState } from 'react';
import {
  FORECAST_MODEL_SETTING_TEXT,
  forecastModelFacts,
  forecastModelOptions,
  selectedForecastChoice,
  type ForecastModelSettingView,
} from '@/lib/domain/weather/forecast-model-setting';

/**
 * Le réglage « Modèle de prévision », dans la carte « Lieu de la météo » de
 * Réglages (docs/weather-models-contract.md, § 11 point 5 ; D-347) : une
 * liste, les faits du modèle choisi, un bouton. Rien sur « Aujourd'hui ».
 * Le geste est celui du tableau de l'eau, qui montre la réponse sous la carte.
 * Absent en démonstration (règle 13) : le parent ne le monte pas.
 */
export function ForecastModelSetting({
  place,
  savedModelId,
  view,
  pending,
  onSave,
}: {
  /** Le lieu localisé de la ferme ; `null` : aucune commune encore. */
  place: { latitude: number; longitude: number } | null;
  savedModelId: string | null;
  /** Les jours complétés du modèle gardé et le retour du module à « Automatique » (règles 6 et 9). */
  view: ForecastModelSettingView | null;
  pending: boolean;
  onSave: (choice: string) => void;
}) {
  const titleId = useId();
  const options = place === null ? [] : forecastModelOptions(place);
  const saved = selectedForecastChoice(savedModelId, options);
  const [choice, setChoice] = useState(saved);
  return (
    <div className="forecast-model-setting" role="group" aria-labelledby={titleId}>
      <h4 id={titleId}>{FORECAST_MODEL_SETTING_TEXT.title}</h4>
      <p>{FORECAST_MODEL_SETTING_TEXT.lead}</p>
      {view?.returnNotice ? <p className="forecast-model-notice">{view.returnNotice}</p> : null}
      {place === null ? <p>{FORECAST_MODEL_SETTING_TEXT.noPlace}</p> : (
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
          {choice === saved && view?.completion ? <p className="forecast-model-completion">{view.completion}</p> : null}
          <small>{FORECAST_MODEL_SETTING_TEXT.verified}</small>
        </>
      )}
    </div>
  );
}
