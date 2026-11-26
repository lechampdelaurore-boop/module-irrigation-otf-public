'use client';

import { useRef, useState } from 'react';
import {
  ESTIMATED_RAIN_RESERVE_TEXT,
  forecastReliabilityHeadline,
  forecastReliabilitySummary,
  measuredRainNotEnoughText,
  reliabilityTableRows,
  thirstReserveText,
  type ReadingResult,
} from '@/lib/domain/weather/forecast-reliability';
import { readForecastReliabilityAction, type ForecastReliabilityActionResult } from './forecast-reliability-actions';
import { AnchoredFold } from './shell/page-settings-fold';

/**
 * Le pli « La météo s'est-elle vérifiée ? » de « Objectifs et besoins »
 * (docs/forecast-reliability-contract.md, §6 ; D-338, PR 2) : fermé, il ne
 * lit rien tant qu'on ne l'ouvre pas (lot N, lenteur du module), puis
 * demande la comparaison une fois. Une information seulement : aucun
 * bouton, rien ne se règle ni ne change ailleurs.
 */
export function ForecastReliabilityFold({ season }: { season: number }) {
  const [result, setResult] = useState<ForecastReliabilityActionResult | null>(null);
  const asked = useRef(false);

  const load = () => {
    if (asked.current) return;
    asked.current = true;
    void readForecastReliabilityAction({ season })
      .then(setResult)
      .catch(() => setResult({ ok: false, message: 'La comparaison ne peut pas se calculer pour le moment. Le reste de la page n’est pas touché.' }));
  };

  return (
    <AnchoredFold
      id="meteo-verifiee"
      className="water-panel water-fold forecast-reliability"
      bodyClassName="water-fold-body"
      onOpen={load}
      summary={<><h3>La météo s’est-elle vérifiée ?</h3><small>Ce qui était annoncé, face à ce qui s’est passé, sur 90 jours.</small></>}
    >
      {result === null ? <p role="status">Calcul en cours…</p> : null}
      {result?.ok === false ? <p className="weather-stale" role="status">{result.message}</p> : null}
      {result?.ok ? <ReliabilityBody result={result} /> : null}
    </AnchoredFold>
  );
}

function ReliabilityBody({ result }: { result: Extract<ForecastReliabilityActionResult, { ok: true }> }) {
  const { reliability, example } = result;
  const ready = reliability.status === 'ready';
  return (
    <div className="forecast-reliability-body" data-status={reliability.status}>
      {example ? <p className="forecast-reliability-example">Exemple : chiffres semés pour la démonstration, pas une vraie météo.</p> : null}
      <p className="forecast-reliability-headline">{forecastReliabilityHeadline(reliability)}</p>
      {forecastReliabilitySummary(reliability).map((sentence) => <p key={sentence}>{sentence}</p>)}
      {ready ? (
        <>
          <ReliabilityTable title="La pluie" caption="Pluie annoncée face à la pluie estimée" result={reliability.rainEstimated} />
          {reliability.rainMeasured.result
            ? <ReliabilityTable title="La pluie notée au pluviomètre" caption="Pluie annoncée face à la pluie notée à la ferme" result={reliability.rainMeasured.result} />
            : <p className="forecast-reliability-note">{measuredRainNotEnoughText(reliability.rainMeasured.measuredDays)}</p>}
          <ReliabilityTable title="La soif du jour (ET0)" caption="Soif annoncée face à la soif estimée" result={reliability.thirst} />
          <p className="forecast-reliability-note">{ESTIMATED_RAIN_RESERVE_TEXT}</p>
          <p className="forecast-reliability-note">{thirstReserveText(reliability.thirst)}</p>
        </>
      ) : null}
    </div>
  );
}

function ReliabilityTable({ title, caption, result }: { title: string; caption: string; result: ReadingResult }) {
  return (
    <table className="forecast-reliability-table" data-reading={result.reading}>
      <caption><strong>{title}</strong><small>{caption}</small></caption>
      <thead><tr><th scope="col">Quand</th><th scope="col">Écart moyen, dans un sens ou dans l’autre</th></tr></thead>
      <tbody>
        {reliabilityTableRows(result).map((row) => (
          <tr key={row.label}>
            <th scope="row">{row.label}</th>
            <td>
              <strong>{row.figure}</strong>
              {row.detail ? <small>{row.detail}</small> : null}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
